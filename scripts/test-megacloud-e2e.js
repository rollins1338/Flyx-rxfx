#!/usr/bin/env node
/**
 * End-to-end MegaCloud extraction test
 * Replicates the FULL pipeline locally:
 *   1. Search HiAnime for anime
 *   2. Get episode list
 *   3. Get servers
 *   4. Get source link (MegaCloud embed URL)
 *   5. Extract client key from embed page
 *   6. Fetch megacloud decryption key from GitHub
 *   7. Call getSources API → decrypt encrypted response
 *   8. Verify the resulting CDN URL is valid
 */

const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const HIANIME_DOMAIN = 'hianimez.to';
const MEGACLOUD_KEYS_URLS = [
  'https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json',
  'https://raw.githubusercontent.com/CattoFish/MegacloudKeys/refs/heads/main/keys.json',
  'https://raw.githubusercontent.com/ghoshRitesh12/aniwatch/refs/heads/main/src/extractors/megacloud-keys.json',
];

// ============================================================================
// MegaCloud Decryption (copied from CF worker)
// ============================================================================

function keygen2(megacloudKey, clientKey) {
  const keygenHashMultVal = 31n;
  const keygenXORVal = 247;
  const keygenShiftVal = 5;
  let tempKey = megacloudKey + clientKey;
  let hashVal = 0n;
  for (let i = 0; i < tempKey.length; i++) {
    hashVal = BigInt(tempKey.charCodeAt(i)) + hashVal * keygenHashMultVal + (hashVal << 7n) - hashVal;
  }
  hashVal = hashVal < 0n ? -hashVal : hashVal;
  const lHash = Number(hashVal % 0x7fffffffffffffffn);
  tempKey = tempKey.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ keygenXORVal)).join('');
  const pivot = (lHash % tempKey.length) + keygenShiftVal;
  tempKey = tempKey.slice(pivot) + tempKey.slice(0, pivot);
  const leafStr = clientKey.split('').reverse().join('');
  let returnKey = '';
  for (let i = 0; i < Math.max(tempKey.length, leafStr.length); i++) {
    returnKey += (tempKey[i] || '') + (leafStr[i] || '');
  }
  returnKey = returnKey.substring(0, 96 + (lHash % 33));
  returnKey = [...returnKey].map(c => String.fromCharCode((c.charCodeAt(0) % 95) + 32)).join('');
  return returnKey;
}

function seedShuffle2(charArray, iKey) {
  let hashVal = 0n;
  for (let i = 0; i < iKey.length; i++) {
    hashVal = (hashVal * 31n + BigInt(iKey.charCodeAt(i))) & 0xffffffffn;
  }
  let shuffleNum = hashVal;
  const psudoRand = (arg) => {
    shuffleNum = (shuffleNum * 1103515245n + 12345n) & 0x7fffffffn;
    return Number(shuffleNum % BigInt(arg));
  };
  const retStr = [...charArray];
  for (let i = retStr.length - 1; i > 0; i--) {
    const swapIndex = psudoRand(i + 1);
    [retStr[i], retStr[swapIndex]] = [retStr[swapIndex], retStr[i]];
  }
  return retStr;
}

function columnarCipher2(src, ikey) {
  const columnCount = ikey.length;
  const rowCount = Math.ceil(src.length / columnCount);
  const cipherArry = Array(rowCount).fill(null).map(() => Array(columnCount).fill(' '));
  const keyMap = ikey.split('').map((char, index) => ({ char, idx: index }));
  const sortedMap = [...keyMap].sort((a, b) => a.char.charCodeAt(0) - b.char.charCodeAt(0));
  let srcIndex = 0;
  sortedMap.forEach(({ idx: index }) => {
    for (let i = 0; i < rowCount; i++) {
      cipherArry[i][index] = src[srcIndex++];
    }
  });
  let returnStr = '';
  for (let x = 0; x < rowCount; x++) {
    for (let y = 0; y < columnCount; y++) {
      returnStr += cipherArry[x][y];
    }
  }
  return returnStr;
}

function decryptSrc2(src, clientKey, megacloudKey) {
  const layers = 3;
  const genKey = keygen2(megacloudKey, clientKey);
  let decSrc = atob(src);
  const charArray = [...Array(95)].map((_, index) => String.fromCharCode(32 + index));

  const reverseLayer = (iteration) => {
    const layerKey = genKey + iteration;
    let hashVal = 0n;
    for (let i = 0; i < layerKey.length; i++) {
      hashVal = (hashVal * 31n + BigInt(layerKey.charCodeAt(i))) & 0xffffffffn;
    }
    let seed = hashVal;
    const seedRand = (arg) => {
      seed = (seed * 1103515245n + 12345n) & 0x7fffffffn;
      return Number(seed % BigInt(arg));
    };
    decSrc = decSrc.split('').map((char) => {
      const cArryIndex = charArray.indexOf(char);
      if (cArryIndex === -1) return char;
      const randNum = seedRand(95);
      const newCharIndex = (cArryIndex - randNum + 95) % 95;
      return charArray[newCharIndex];
    }).join('');
    decSrc = columnarCipher2(decSrc, layerKey);
    const subValues = seedShuffle2(charArray, layerKey);
    const charMap = {};
    subValues.forEach((char, index) => { charMap[char] = charArray[index]; });
    decSrc = decSrc.split('').map(char => charMap[char] || char).join('');
  };

  for (let i = layers; i > 0; i--) {
    reverseLayer(i);
  }
  const dataLen = parseInt(decSrc.substring(0, 4), 10);
  return decSrc.substring(4, 4 + dataLen);
}


// ============================================================================
// Client Key Extraction (copied from CF worker)
// ============================================================================

async function getMegaCloudClientKey(sourceId) {
  console.log(`\n[Step 5] Fetching MegaCloud embed page for sourceId: ${sourceId}`);
  const res = await fetch(`https://megacloud.blog/embed-2/v3/e-1/${sourceId}`, {
    headers: { 'User-Agent': UA, 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  const text = await res.text();
  console.log(`  Embed page: ${res.status}, size: ${text.length}`);

  if (!res.ok) throw new Error(`MegaCloud embed page returned HTTP ${res.status}`);

  const regexes = [
    /<meta name="_gg_fb" content="[a-zA-Z0-9]+">/,
    /<!--\s+_is_th:[0-9a-zA-Z]+\s+-->/,
    /<script>window\._lk_db\s+=\s+\{[xyz]:\s+["'][a-zA-Z0-9]+["'],\s+[xyz]:\s+["'][a-zA-Z0-9]+["'],\s+[xyz]:\s+["'][a-zA-Z0-9]+["']\};<\/script>/,
    /<div\s+data-dpi="[0-9a-zA-Z]+"\s+.*><\/div>/,
    /<script nonce="[0-9a-zA-Z]+">/,
    /<script>window\._xy_ws = ['"`][0-9a-zA-Z]+['"`];<\/script>/,
  ];
  const keyRegex = /"[a-zA-Z0-9]+"/;
  const lkDbRegex = [/x:\s+"[a-zA-Z0-9]+"/, /y:\s+"[a-zA-Z0-9]+"/, /z:\s+"[a-zA-Z0-9]+"/];

  let pass = null;
  let count = 0;
  for (let i = 0; i < regexes.length; i++) {
    pass = text.match(regexes[i]);
    if (pass !== null) { count = i; break; }
  }
  if (!pass) {
    console.log(`  ✗ No client key pattern matched!`);
    console.log(`  First 500 chars of embed page:\n${text.substring(0, 500)}`);
    throw new Error('Failed extracting MegaCloud client key');
  }

  let clientKey = '';
  if (count === 2) {
    const x = pass[0].match(lkDbRegex[0]);
    const y = pass[0].match(lkDbRegex[1]);
    const z = pass[0].match(lkDbRegex[2]);
    if (!x || !y || !z) throw new Error('Failed building client key (xyz)');
    const p1 = x[0].match(keyRegex), p2 = y[0].match(keyRegex), p3 = z[0].match(keyRegex);
    if (!p1 || !p2 || !p3) throw new Error('Failed building client key (xyz)');
    clientKey = p1[0].replace(/"/g, '') + p2[0].replace(/"/g, '') + p3[0].replace(/"/g, '');
  } else if (count === 1) {
    const keytest = pass[0].match(/:[a-zA-Z0-9]+ /);
    if (!keytest) throw new Error('Failed extracting client key (comment)');
    clientKey = keytest[0].replace(/:/g, '').replace(/ /g, '');
  } else {
    const keytest = pass[0].match(keyRegex);
    if (!keytest) throw new Error('Failed extracting client key');
    clientKey = keytest[0].replace(/"/g, '');
  }
  console.log(`  ✓ Client key extracted (pattern ${count}): ${clientKey.substring(0, 20)}...`);
  return clientKey;
}

async function getMegaCloudKey() {
  console.log(`\n[Step 6] Fetching MegaCloud decryption key from GitHub...`);
  for (const url of MEGACLOUD_KEYS_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) { console.log(`  ${url.split('/')[4]}: HTTP ${res.status}`); continue; }
      const keys = await res.json();
      const key = keys.mega || keys.key || Object.values(keys)[0];
      if (key && typeof key === 'string' && key.length > 0) {
        console.log(`  ✓ Got key from ${url.split('/')[4]}: ${key.substring(0, 20)}...`);
        return key;
      }
    } catch (e) {
      console.log(`  ${url.split('/')[4]}: ${e.message}`);
    }
  }
  throw new Error('Failed to fetch MegaCloud key from all sources');
}

// ============================================================================
// HiAnime API (direct fetch from this machine)
// ============================================================================

async function hianimeSearch(query) {
  console.log(`\n[Step 1] Searching HiAnime for: "${query}"`);
  const searchUrl = `https://${HIANIME_DOMAIN}/ajax/search/suggest?keyword=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  console.log(`  Search response: ${res.status}`);
  const json = await res.json();
  if (!json.status || !json.html) {
    console.log(`  ✗ Search failed: status=${json.status}`);
    return [];
  }
  const results = [];
  const itemRegex = /<a[^>]*href="\/([^"?]+)"[^>]*class="[^"]*nav-item[^"]*"[^>]*>/g;
  const nameRegex = /<h3[^>]*class="[^"]*film-name[^"]*"[^>]*>([^<]*)<\/h3>/g;
  const links = [];
  let m;
  while ((m = itemRegex.exec(json.html)) !== null) links.push(m[1]);
  const names = [];
  while ((m = nameRegex.exec(json.html)) !== null) names.push(m[1].trim());
  for (let i = 0; i < links.length; i++) {
    const id = links[i];
    const name = names[i] || id;
    const numId = id.match(/-(\d+)$/)?.[1] || null;
    results.push({ id, name, hianimeId: numId });
  }
  console.log(`  ✓ Found ${results.length} results: ${results.map(r => `${r.name} (${r.hianimeId})`).join(', ')}`);
  return results;
}

async function getEpisodeList(animeId) {
  console.log(`\n[Step 2] Getting episode list for animeId: ${animeId}`);
  const res = await fetch(`https://${HIANIME_DOMAIN}/ajax/v2/episode/list/${animeId}`, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  const json = await res.json();
  const episodes = [];
  const epRegex = /<a[^>]*data-number="(\d+)"[^>]*data-id="(\d+)"[^>]*href="([^"]*)"[^>]*>/g;
  let m;
  while ((m = epRegex.exec(json.html)) !== null) {
    episodes.push({ number: parseInt(m[1]), dataId: m[2], href: m[3] });
  }
  console.log(`  ✓ Found ${episodes.length} episodes`);
  return episodes;
}

async function getServers(episodeId) {
  console.log(`\n[Step 3] Getting servers for episodeId: ${episodeId}`);
  const res = await fetch(`https://${HIANIME_DOMAIN}/ajax/v2/episode/servers?episodeId=${episodeId}`, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  const json = await res.json();
  const servers = [];
  const serverRegex = /<div[\s\S]*?class="[^"]*server-item[^"]*"[\s\S]*?>/g;
  let m;
  while ((m = serverRegex.exec(json.html)) !== null) {
    const block = m[0];
    const dataId = block.match(/data-id="(\d+)"/)?.[1];
    const type = block.match(/data-type="(sub|dub|raw)"/)?.[1];
    const serverId = block.match(/data-server-id="(\d+)"/)?.[1];
    if (dataId && type && serverId) servers.push({ dataId, type, serverId });
  }
  console.log(`  ✓ Found ${servers.length} servers: ${servers.map(s => `${s.type}:srv${s.serverId}(${s.dataId})`).join(', ')}`);
  return servers;
}

async function getSourceLink(serverId) {
  console.log(`\n[Step 4] Getting source link for serverId: ${serverId}`);
  const res = await fetch(`https://${HIANIME_DOMAIN}/ajax/v2/episode/sources?id=${serverId}`, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  const json = await res.json();
  console.log(`  ✓ Source link: ${json.link || 'NONE'}`);
  return json.link || null;
}


// ============================================================================
// Main test
// ============================================================================

async function main() {
  console.log('=== MEGACLOUD E2E EXTRACTION TEST ===\n');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Running from: local machine (Windows)\n`);

  try {
    // Step 1: Search
    const results = await hianimeSearch('One Piece');
    if (results.length === 0) throw new Error('No search results');
    
    // Pick first result (should be One Piece)
    const anime = results[0];
    console.log(`\n  Using: ${anime.name} (hianimeId: ${anime.hianimeId}, slug: ${anime.id})`);

    // Step 2: Episodes
    const episodes = await getEpisodeList(anime.hianimeId);
    if (episodes.length === 0) throw new Error('No episodes found');
    const ep = episodes[0]; // Episode 1
    console.log(`  Target episode: #${ep.number} (dataId: ${ep.dataId})`);

    // Step 3: Servers
    const servers = await getServers(ep.dataId);
    const subServer = servers.find(s => s.type === 'sub' && s.serverId === '4') || servers.find(s => s.type === 'sub');
    if (!subServer) throw new Error('No sub server found');
    console.log(`  Using server: ${subServer.type}:srv${subServer.serverId} (dataId: ${subServer.dataId})`);

    // Step 4: Source link
    const embedUrl = await getSourceLink(subServer.dataId);
    if (!embedUrl) throw new Error('No source link');

    // Step 5: Client key
    const sourceId = new URL(embedUrl).pathname.split('/').pop();
    const clientKey = await getMegaCloudClientKey(sourceId);

    // Step 6: MegaCloud key
    const megacloudKey = await getMegaCloudKey();

    // Step 7: getSources API
    console.log(`\n[Step 7] Calling getSources API...`);
    const srcUrl = `https://megacloud.blog/embed-2/v3/e-1/getSources?id=${sourceId}&_k=${clientKey}`;
    console.log(`  URL: ${srcUrl}`);
    const srcRes = await fetch(srcUrl, {
      headers: { 'User-Agent': UA, 'Referer': embedUrl },
    });
    const srcData = await srcRes.json();
    console.log(`  Response: ${srcRes.status}, encrypted: ${srcData.encrypted}`);
    console.log(`  Sources type: ${typeof srcData.sources} (${typeof srcData.sources === 'string' ? srcData.sources.length + ' chars' : Array.isArray(srcData.sources) ? srcData.sources.length + ' items' : 'unknown'})`);
    console.log(`  Tracks: ${srcData.tracks?.length || 0}`);
    console.log(`  Intro: ${JSON.stringify(srcData.intro)}`);
    console.log(`  Outro: ${JSON.stringify(srcData.outro)}`);

    // Step 8: Decrypt
    let sources;
    if (!srcData.encrypted && Array.isArray(srcData.sources)) {
      sources = srcData.sources;
      console.log(`\n[Step 8] Sources not encrypted, using directly`);
    } else {
      console.log(`\n[Step 8] Decrypting sources...`);
      try {
        const decrypted = decryptSrc2(srcData.sources, clientKey, megacloudKey);
        console.log(`  Decrypted: ${decrypted.substring(0, 200)}`);
        sources = JSON.parse(decrypted);
        console.log(`  ✓ Decryption successful! ${sources.length} source(s)`);
      } catch (e) {
        console.log(`  ✗ Decryption FAILED: ${e.message}`);
        console.log(`  Raw sources (first 200): ${String(srcData.sources).substring(0, 200)}`);
        throw e;
      }
    }

    // Step 9: Verify CDN URLs
    console.log(`\n[Step 9] Verifying CDN URLs...`);
    for (const src of sources) {
      const cdnUrl = src.file;
      console.log(`\n  CDN URL: ${cdnUrl}`);
      
      const parsed = new URL(cdnUrl);
      console.log(`  Host: ${parsed.hostname}`);
      console.log(`  Path: ${parsed.pathname.substring(0, 50)}...`);
      console.log(`  Is MegaCloud CDN: ${parsed.pathname.startsWith('/_v')}`);

      // Test 1: Direct fetch from this machine
      console.log(`\n  [Test A] Direct fetch from local machine...`);
      try {
        const directRes = await fetch(cdnUrl, {
          headers: { 'User-Agent': UA, 'Accept': '*/*' },
          signal: AbortSignal.timeout(15000),
        });
        console.log(`    Status: ${directRes.status}`);
        console.log(`    Content-Type: ${directRes.headers.get('content-type')}`);
        if (directRes.ok) {
          const text = await directRes.text();
          console.log(`    Size: ${text.length} bytes`);
          if (text.includes('#EXTM3U')) {
            console.log(`    ✓✓✓ VALID M3U8 PLAYLIST!`);
            console.log(`    First 300 chars:\n${text.substring(0, 300)}`);
            // Count segment URLs
            const segLines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));
            console.log(`    Segments: ${segLines.length}`);
            if (segLines.length > 0) {
              console.log(`    First segment: ${segLines[0].substring(0, 100)}`);
            }
          } else {
            console.log(`    Content (first 200): ${text.substring(0, 200)}`);
          }
        } else {
          const errText = await directRes.text();
          console.log(`    ✗ FAILED: ${errText.substring(0, 300)}`);
        }
      } catch (e) {
        console.log(`    ✗ ERROR: ${e.message}`);
      }

      // Test 2: Via RPI proxy /animekai endpoint
      console.log(`\n  [Test B] Via RPI proxy /animekai (IPv4 forced)...`);
      try {
        const rpiUrl = `https://rpi-proxy.vynx.cc/animekai?url=${encodeURIComponent(cdnUrl)}&key=5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560`;
        const rpiRes = await fetch(rpiUrl, { signal: AbortSignal.timeout(20000) });
        console.log(`    Status: ${rpiRes.status}`);
        console.log(`    Content-Type: ${rpiRes.headers.get('content-type')}`);
        console.log(`    X-Proxied-By: ${rpiRes.headers.get('x-proxied-by') || 'none'}`);
        if (rpiRes.ok) {
          const text = await rpiRes.text();
          console.log(`    Size: ${text.length} bytes`);
          if (text.includes('#EXTM3U')) {
            console.log(`    ✓✓✓ VALID M3U8 VIA RPI!`);
            console.log(`    First 300 chars:\n${text.substring(0, 300)}`);
          } else {
            console.log(`    Content (first 200): ${text.substring(0, 200)}`);
          }
        } else {
          const errText = await rpiRes.text();
          console.log(`    ✗ FAILED: ${errText.substring(0, 300)}`);
        }
      } catch (e) {
        console.log(`    ✗ ERROR: ${e.message}`);
      }

      // Test 3: Via CF Worker /hianime/stream
      console.log(`\n  [Test C] Via CF Worker /hianime/stream...`);
      try {
        const cfUrl = `https://media-proxy.vynx.workers.dev/hianime/stream?url=${encodeURIComponent(cdnUrl)}`;
        const cfRes = await fetch(cfUrl, { signal: AbortSignal.timeout(30000) });
        console.log(`    Status: ${cfRes.status}`);
        console.log(`    Content-Type: ${cfRes.headers.get('content-type')}`);
        console.log(`    X-Proxied-Via: ${cfRes.headers.get('x-proxied-via') || 'none'}`);
        if (cfRes.ok) {
          const text = await cfRes.text();
          console.log(`    Size: ${text.length} bytes`);
          if (text.includes('#EXTM3U')) {
            console.log(`    ✓✓✓ VALID M3U8 VIA CF WORKER!`);
          } else {
            console.log(`    Content (first 200): ${text.substring(0, 200)}`);
          }
        } else {
          const errText = await cfRes.text();
          console.log(`    ✗ FAILED: ${errText.substring(0, 300)}`);
        }
      } catch (e) {
        console.log(`    ✗ ERROR: ${e.message}`);
      }
    }

    console.log(`\n\n=== TEST COMPLETE ===`);
  } catch (e) {
    console.error(`\n✗ FATAL ERROR: ${e.message}`);
    console.error(e.stack);
  }
}

main();
