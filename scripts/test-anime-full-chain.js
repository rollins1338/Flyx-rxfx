/**
 * Full anime pipeline test: Extraction → RPI Proxy → m3u8 → Segments
 * Tests exactly what the CF worker does, but locally.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const HIANIME_DOMAIN = 'hianimez.to';
const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

// ── Decryption engine (same as hianime-proxy.ts) ──
function keygen2(megacloudKey, clientKey) {
  const keygenHashMultVal = 31n, keygenXORVal = 247, keygenShiftVal = 5;
  let tempKey = megacloudKey + clientKey;
  let hashVal = 0n;
  for (let i = 0; i < tempKey.length; i++) hashVal = BigInt(tempKey.charCodeAt(i)) + hashVal * keygenHashMultVal + (hashVal << 7n) - hashVal;
  hashVal = hashVal < 0n ? -hashVal : hashVal;
  const lHash = Number(hashVal % 0x7fffffffffffffffn);
  tempKey = tempKey.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ keygenXORVal)).join('');
  const pivot = (lHash % tempKey.length) + keygenShiftVal;
  tempKey = tempKey.slice(pivot) + tempKey.slice(0, pivot);
  const leafStr = clientKey.split('').reverse().join('');
  let returnKey = '';
  for (let i = 0; i < Math.max(tempKey.length, leafStr.length); i++) returnKey += (tempKey[i] || '') + (leafStr[i] || '');
  returnKey = returnKey.substring(0, 96 + (lHash % 33));
  returnKey = [...returnKey].map(c => String.fromCharCode((c.charCodeAt(0) % 95) + 32)).join('');
  return returnKey;
}
function seedShuffle2(charArray, iKey) {
  let hashVal = 0n;
  for (let i = 0; i < iKey.length; i++) hashVal = (hashVal * 31n + BigInt(iKey.charCodeAt(i))) & 0xffffffffn;
  let shuffleNum = hashVal;
  const psudoRand = (arg) => { shuffleNum = (shuffleNum * 1103515245n + 12345n) & 0x7fffffffn; return Number(shuffleNum % BigInt(arg)); };
  const retStr = [...charArray];
  for (let i = retStr.length - 1; i > 0; i--) { const s = psudoRand(i + 1); [retStr[i], retStr[s]] = [retStr[s], retStr[i]]; }
  return retStr;
}
function columnarCipher2(src, ikey) {
  const cc = ikey.length, rc = Math.ceil(src.length / cc);
  const ca = Array(rc).fill(null).map(() => Array(cc).fill(' '));
  const sm = [...ikey.split('').map((c, i) => ({ c, i }))].sort((a, b) => a.c.charCodeAt(0) - b.c.charCodeAt(0));
  let si = 0; sm.forEach(({ i }) => { for (let r = 0; r < rc; r++) ca[r][i] = src[si++]; });
  let ret = ''; for (let x = 0; x < rc; x++) for (let y = 0; y < cc; y++) ret += ca[x][y];
  return ret;
}
function decryptSrc2(src, clientKey, megacloudKey) {
  const layers = 3, genKey = keygen2(megacloudKey, clientKey);
  let decSrc = atob(src);
  const charArray = [...Array(95)].map((_, i) => String.fromCharCode(32 + i));
  const reverseLayer = (iter) => {
    const lk = genKey + iter;
    let hv = 0n; for (let i = 0; i < lk.length; i++) hv = (hv * 31n + BigInt(lk.charCodeAt(i))) & 0xffffffffn;
    let seed = hv;
    const sr = (a) => { seed = (seed * 1103515245n + 12345n) & 0x7fffffffn; return Number(seed % BigInt(a)); };
    decSrc = decSrc.split('').map(c => { const ci = charArray.indexOf(c); if (ci === -1) return c; return charArray[(ci - sr(95) + 95) % 95]; }).join('');
    decSrc = columnarCipher2(decSrc, lk);
    const sv = seedShuffle2(charArray, lk), cm = {};
    sv.forEach((c, i) => { cm[c] = charArray[i]; });
    decSrc = decSrc.split('').map(c => cm[c] || c).join('');
  };
  for (let i = layers; i > 0; i--) reverseLayer(i);
  const dl = parseInt(decSrc.substring(0, 4), 10);
  return decSrc.substring(4, 4 + dl);
}

// ── Client key extraction ──
async function getMegaCloudClientKey(sourceId) {
  const res = await fetch(`https://megacloud.blog/embed-2/v3/e-1/${sourceId}`, {
    headers: { 'User-Agent': UA, 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  const text = await res.text();
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
  let pass = null, count = 0;
  for (let i = 0; i < regexes.length; i++) { pass = text.match(regexes[i]); if (pass) { count = i; break; } }
  if (!pass) throw new Error('Failed extracting client key');
  let ck = '';
  if (count === 2) {
    const x = pass[0].match(lkDbRegex[0]), y = pass[0].match(lkDbRegex[1]), z = pass[0].match(lkDbRegex[2]);
    if (!x || !y || !z) throw new Error('Failed building client key (xyz)');
    const p1 = x[0].match(keyRegex), p2 = y[0].match(keyRegex), p3 = z[0].match(keyRegex);
    if (!p1 || !p2 || !p3) throw new Error('Failed building client key (xyz)');
    ck = p1[0].replace(/"/g, '') + p2[0].replace(/"/g, '') + p3[0].replace(/"/g, '');
  } else if (count === 1) {
    const kt = pass[0].match(/:[a-zA-Z0-9]+ /);
    if (!kt) throw new Error('Failed extracting client key (comment)');
    ck = kt[0].replace(/:/g, '').replace(/ /g, '');
  } else {
    const kt = pass[0].match(keyRegex);
    if (!kt) throw new Error('Failed extracting client key');
    ck = kt[0].replace(/"/g, '');
  }
  return ck;
}

// ── Main test ──
async function main() {
  console.log('=== FULL ANIME PIPELINE TEST ===\n');
  const startTime = Date.now();

  // Step 1: Extract HLS URL (same as extract5)
  const hianimeId = '18718'; // Solo Leveling
  console.log('[1] Getting episode list...');
  const epRes = await fetch(`https://${HIANIME_DOMAIN}/ajax/v2/episode/list/${hianimeId}`, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  const epJson = await epRes.json();
  const epMatch = epJson.html.match(/<a[^>]*data-number="1"[^>]*data-id="(\d+)"[^>]*>/);
  if (!epMatch) { console.log('❌ Episode not found'); return; }
  console.log(`   Episode 1 dataId: ${epMatch[1]}`);

  console.log('[2] Getting servers...');
  const srvRes = await fetch(`https://${HIANIME_DOMAIN}/ajax/v2/episode/servers?episodeId=${epMatch[1]}`, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  const srvJson = await srvRes.json();
  const srvRegex = /<div[\s\S]*?class="[^"]*server-item[^"]*"[\s\S]*?>/g;
  let m, subServerId = null;
  while ((m = srvRegex.exec(srvJson.html)) !== null) {
    const block = m[0];
    const type = block.match(/data-type="(sub|dub)"/)?.[1];
    const sid = block.match(/data-server-id="(\d+)"/)?.[1];
    const did = block.match(/data-id="(\d+)"/)?.[1];
    if (type === 'sub' && sid === '4') { subServerId = did; break; }
  }
  if (!subServerId) { console.log('❌ No sub server found'); return; }
  console.log(`   Sub server dataId: ${subServerId}`);

  console.log('[3] Getting source link...');
  const srcRes = await fetch(`https://${HIANIME_DOMAIN}/ajax/v2/episode/sources?id=${subServerId}`, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': `https://${HIANIME_DOMAIN}/` },
  });
  const srcJson = await srcRes.json();
  const embedUrl = srcJson.link;
  console.log(`   Embed URL: ${embedUrl}`);

  console.log('[4] Extracting MegaCloud stream...');
  const sourceId = new URL(embedUrl).pathname.split('/').pop();
  const clientKey = await getMegaCloudClientKey(sourceId);
  console.log(`   Client key: ${clientKey}`);

  const megaKeyRes = await fetch('https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json');
  const megaKeys = await megaKeyRes.json();
  const megacloudKey = megaKeys.mega;
  console.log(`   MegaCloud key: ${megacloudKey.substring(0, 20)}...`);

  const getSrcRes = await fetch(`https://megacloud.blog/embed-2/v3/e-1/getSources?id=${sourceId}&_k=${clientKey}`, {
    headers: { 'User-Agent': UA, 'Referer': embedUrl },
  });
  const getSrcData = await getSrcRes.json();
  let hlsUrl;
  if (!getSrcData.encrypted) {
    hlsUrl = getSrcData.sources[0].file;
  } else {
    const decrypted = decryptSrc2(getSrcData.sources, clientKey, megacloudKey);
    hlsUrl = JSON.parse(decrypted)[0].file;
  }
  console.log(`   ✅ HLS URL: ${hlsUrl.substring(0, 80)}...`);

  // Step 2: Test DIRECT fetch (expected to fail with 403)
  console.log('\n[5] Testing DIRECT m3u8 fetch (no proxy)...');
  const directRes = await fetch(hlsUrl, { headers: { 'User-Agent': UA } });
  console.log(`   Status: ${directRes.status} (${directRes.status === 403 ? '❌ BLOCKED as expected' : '✅ WORKS'})`);
  await directRes.text(); // consume body

  // Step 3: Test via RPI proxy (what the CF worker does)
  console.log('\n[6] Testing via RPI proxy (/animekai endpoint)...');
  const rpiParams = new URLSearchParams({ url: hlsUrl, key: RPI_KEY });
  const rpiUrl = `${RPI_URL}/animekai?${rpiParams.toString()}`;
  console.log(`   RPI URL: ${rpiUrl.substring(0, 100)}...`);
  
  const rpiRes = await fetch(rpiUrl, { signal: AbortSignal.timeout(20000) });
  console.log(`   Status: ${rpiRes.status}`);
  console.log(`   Content-Type: ${rpiRes.headers.get('content-type')}`);
  const rpiText = await rpiRes.text();
  console.log(`   Size: ${rpiText.length} bytes`);
  
  if (rpiRes.status !== 200) {
    console.log(`   ❌ RPI PROXY FAILED! Response: ${rpiText.substring(0, 300)}`);
    console.log('\n   This is the problem — RPI proxy cannot fetch MegaCloud CDN streams.');
    console.log('   Possible causes:');
    console.log('   1. RPI residential IP is also blocked by MegaCloud CDN');
    console.log('   2. Missing/wrong headers when RPI fetches from CDN');
    console.log('   3. RPI proxy /animekai endpoint not handling this CDN correctly');
    return;
  }

  // Check if it's a valid m3u8
  if (!rpiText.includes('#EXTM3U')) {
    console.log(`   ❌ Response is NOT a valid m3u8! First 300 chars:`);
    console.log(`   ${rpiText.substring(0, 300)}`);
    return;
  }
  console.log(`   ✅ Got valid master m3u8 via RPI!`);
  console.log(`   First 300 chars:\n${rpiText.substring(0, 300)}`);

  // Step 4: Parse variant playlist and test it
  const variantLines = rpiText.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  if (variantLines.length === 0) {
    console.log('   No variant playlists found in master m3u8');
    return;
  }

  // Resolve variant URL relative to HLS URL
  const variantRaw = variantLines[0].trim();
  const variantAbsolute = variantRaw.startsWith('http') ? variantRaw : new URL(variantRaw, hlsUrl).href;
  
  console.log(`\n[7] Testing variant playlist via RPI...`);
  console.log(`   Variant URL: ${variantAbsolute.substring(0, 100)}...`);
  const varRpiParams = new URLSearchParams({ url: variantAbsolute, key: RPI_KEY });
  const varRpiRes = await fetch(`${RPI_URL}/animekai?${varRpiParams.toString()}`, { signal: AbortSignal.timeout(20000) });
  console.log(`   Status: ${varRpiRes.status}`);
  const varText = await varRpiRes.text();
  console.log(`   Size: ${varText.length} bytes`);

  if (varRpiRes.status !== 200 || !varText.includes('#EXTINF')) {
    console.log(`   ❌ Variant playlist fetch failed! Response: ${varText.substring(0, 300)}`);
    return;
  }
  console.log(`   ✅ Got valid variant playlist!`);

  // Step 5: Test segment fetch
  const segLines = varText.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  if (segLines.length > 0) {
    const segRaw = segLines[0].trim();
    const segAbsolute = segRaw.startsWith('http') ? segRaw : new URL(segRaw, variantAbsolute).href;
    
    console.log(`\n[8] Testing segment fetch via RPI...`);
    console.log(`   Segment URL: ${segAbsolute.substring(0, 100)}...`);
    const segRpiParams = new URLSearchParams({ url: segAbsolute, key: RPI_KEY });
    const segRpiRes = await fetch(`${RPI_URL}/animekai?${segRpiParams.toString()}`, { signal: AbortSignal.timeout(20000) });
    console.log(`   Status: ${segRpiRes.status}`);
    console.log(`   Content-Type: ${segRpiRes.headers.get('content-type')}`);
    const segBuf = await segRpiRes.arrayBuffer();
    console.log(`   Size: ${segBuf.byteLength} bytes`);
    
    if (segRpiRes.status === 200 && segBuf.byteLength > 1000) {
      console.log(`   ✅ SEGMENT FETCHED SUCCESSFULLY!`);
    } else {
      console.log(`   ❌ Segment fetch failed`);
    }
  }

  // Step 6: Test the CF Worker extract endpoint
  console.log('\n[9] Testing CF Worker /hianime/extract endpoint...');
  const cfWorkerUrl = 'https://media-proxy.vynx.workers.dev';
  try {
    const cfRes = await fetch(`${cfWorkerUrl}/hianime/extract?malId=52299&title=Solo%20Leveling&episode=1`, {
      signal: AbortSignal.timeout(45000),
    });
    const cfData = await cfRes.json();
    console.log(`   Status: ${cfRes.status}`);
    console.log(`   Success: ${cfData.success}`);
    console.log(`   Sources: ${cfData.sources?.length || 0}`);
    console.log(`   Execution time: ${cfData.executionTime}ms`);
    if (cfData.sources?.length > 0) {
      console.log(`   First source URL: ${cfData.sources[0].url.substring(0, 100)}...`);
      
      // Step 7: Test the proxied URL from CF worker
      console.log('\n[10] Testing proxied stream URL from CF worker...');
      const proxiedUrl = cfData.sources[0].url;
      const proxiedRes = await fetch(proxiedUrl, { signal: AbortSignal.timeout(20000) });
      console.log(`   Status: ${proxiedRes.status}`);
      console.log(`   Content-Type: ${proxiedRes.headers.get('content-type')}`);
      console.log(`   X-Proxied-Via: ${proxiedRes.headers.get('x-proxied-via')}`);
      const proxiedText = await proxiedRes.text();
      console.log(`   Size: ${proxiedText.length} bytes`);
      if (proxiedRes.status === 200 && proxiedText.includes('#EXTM3U')) {
        console.log(`   ✅ CF Worker proxied stream works!`);
      } else {
        console.log(`   ❌ CF Worker proxied stream FAILED`);
        console.log(`   Response: ${proxiedText.substring(0, 300)}`);
      }
    }
    if (cfData.error) {
      console.log(`   Error: ${cfData.error}`);
    }
  } catch (e) {
    console.log(`   ❌ CF Worker error: ${e.message}`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`\n=== TEST COMPLETE (${elapsed}ms) ===`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
