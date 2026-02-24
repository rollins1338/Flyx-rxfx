#!/usr/bin/env node
/**
 * Crack AnimeKai SERVER encryption tables
 * 
 * PROBLEM: We can encrypt (server accepts our tokens) but can't decrypt
 * server responses. The server uses DIFFERENT substitution tables.
 * 
 * APPROACH: Collect known plaintext-ciphertext pairs by:
 * 1. Getting an encrypted response from AnimeKai /ajax/links/view
 * 2. Getting the SAME video URL from HiAnime (which uses MegaCloud, same videos)
 * 3. Matching the plaintext to cipher bytes to build server tables
 * 
 * The server response format is:
 *   {"url":"https://DOMAIN/e/VIDEO_ID","skip":{"intro":[S,E],"outro":[S,E]}}
 * 
 * Characters at known positions:
 *   pos 0: '{'     pos 1: '"'     pos 2: 'u'     pos 3: 'r'
 *   pos 4: 'l'     pos 5: '"'     pos 6: ':'     pos 7: '"'
 *   pos 8: 'h'     pos 9: 't'     pos 10: 't'    pos 11: 'p'
 *   pos 12: 's'    pos 13: ':'    pos 14: '/'    pos 15: '/'
 *   ... (domain varies but is from a known set)
 *   ... /e/ is constant
 *   ... then video ID
 *   ... then ","skip":{"intro":[...
 * 
 * Even without knowing the full URL, we know the first 16 chars!
 * That gives us 16 table entries right away.
 */
const { execFileSync } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '15',
    '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, {
      encoding: 'utf8', timeout: 25000,
      maxBuffer: 10*1024*1024, windowsHide: true
    }).trim();
  } catch(e) { return e.stdout?.trim() || ''; }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'],
    { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': UA, ...hdrs },
      timeout: 15000,
    };
    https.get(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej);
  });
}

function cipherPos(i) {
  if (i === 0) return 0;
  if (i === 1) return 7;
  if (i === 2) return 11;
  if (i === 3) return 13;
  if (i === 4) return 15;
  if (i === 5) return 17;
  if (i === 6) return 19;
  return 20 + (i - 7);
}

function b64decode(s) {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - std.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

const KAI_HDRS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Referer': 'https://animekai.to/',
};

// Known MegaUp domains (they rotate)
const MEGAUP_DOMAINS = [
  'megaup.net', 'megaup22.online', '4spromax.site', 'hub26link.site',
  'dev23app.site', 'net22lab.site', 'pro25zone.site', 'tech20hub.site',
  'code29wave.site', 'app28base.site',
];


// Server encrypt tables: serverEncrypt[position][ascii_char] = cipher_byte
// We build this by collecting samples where we know the plaintext
const serverEncrypt = {};

function addMapping(pos, plainChar, cipherByte) {
  if (!serverEncrypt[pos]) serverEncrypt[pos] = {};
  const ascii = plainChar.charCodeAt(0);
  if (serverEncrypt[pos][ascii] !== undefined && serverEncrypt[pos][ascii] !== cipherByte) {
    console.log(`  ⚠ CONFLICT at pos ${pos}: char '${plainChar}' (${ascii}) → was 0x${serverEncrypt[pos][ascii].toString(16)}, now 0x${cipherByte.toString(16)}`);
  }
  serverEncrypt[pos][ascii] = cipherByte;
}

function analyzeEncryptedResponse(encrypted, knownPlaintext) {
  const buf = b64decode(encrypted);
  if (buf.length <= 21) {
    console.log('  Too short:', buf.length);
    return 0;
  }
  
  const data = buf.slice(21);
  let added = 0;
  
  for (let i = 0; i < knownPlaintext.length; i++) {
    const cp = cipherPos(i);
    if (cp >= data.length) break;
    const cipherByte = data[cp];
    const plainChar = knownPlaintext[i];
    addMapping(i, plainChar, cipherByte);
    added++;
  }
  
  return added;
}

async function getAnimeKaiSample(keyword) {
  console.log(`\n--- Fetching AnimeKai sample for "${keyword}" ---`);
  
  // Search
  const sr = await fetch(`https://animekai.to/ajax/anime/search?keyword=${encodeURIComponent(keyword)}`, KAI_HDRS);
  if (sr.status !== 200) { console.log('  Search failed:', sr.status); return null; }
  const sd = JSON.parse(sr.body);
  
  // Get first watch link
  const slugMatch = sd.result?.html?.match(/href="\/watch\/([^"]+)"/);
  if (!slugMatch) { console.log('  No results'); return null; }
  const slug = slugMatch[1];
  console.log('  Slug:', slug);
  
  // Get anime page for syncData
  const wp = await fetch(`https://animekai.to/watch/${slug}`);
  const syncMatch = wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
  if (!syncMatch) { console.log('  No syncData'); return null; }
  const sync = JSON.parse(syncMatch[1]);
  const animeId = sync.anime_id;
  const malId = sync.mal_id;
  console.log('  anime_id:', animeId, 'mal_id:', malId);
  
  // Get episodes
  const encId = kaiEncrypt(animeId);
  const epResp = await fetch(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
  const epData = JSON.parse(epResp.body);
  if (!epData.result) { console.log('  No episodes'); return null; }
  
  // Get first episode token
  const tokenMatch = epData.result.match(/token="([^"]+)"/);
  if (!tokenMatch) { console.log('  No token'); return null; }
  const token = tokenMatch[1];
  
  // Get servers
  const encToken = kaiEncrypt(token);
  const srvResp = await fetch(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
  const srvData = JSON.parse(srvResp.body);
  if (!srvData.result) { console.log('  No servers'); return null; }
  
  // Get ALL lids (multiple servers = multiple samples!)
  const lidMatches = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)];
  console.log(`  Found ${lidMatches.length} server links`);
  
  const samples = [];
  for (const lm of lidMatches) {
    const lid = lm[1];
    const encLid = kaiEncrypt(lid);
    try {
      const viewResp = await fetch(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
      const viewData = JSON.parse(viewResp.body);
      if (viewData.result) {
        samples.push({
          keyword, slug, malId, lid,
          encrypted: viewData.result,
        });
        console.log(`  ✓ Got encrypted response for lid ${lid} (${viewData.result.length} chars)`);
      }
    } catch (e) {
      console.log(`  ✗ Failed lid ${lid}: ${e.message}`);
    }
  }
  
  return samples;
}

async function main() {
  console.log('=== AnimeKai Server Table Cracker ===\n');
  
  // Step 1: Collect encrypted samples from multiple anime
  const animeList = [
    'bleach', 'naruto', 'one piece', 'dragon ball',
    'attack on titan', 'demon slayer', 'jujutsu kaisen',
    'solo leveling', 'spy x family', 'chainsaw man',
    'my hero academia', 'death note', 'fullmetal alchemist',
    'hunter x hunter', 'one punch man',
  ];
  
  const allSamples = [];
  
  for (const anime of animeList) {
    try {
      const samples = await getAnimeKaiSample(anime);
      if (samples && samples.length > 0) {
        allSamples.push(...samples);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 1500));
  }
  
  console.log(`\n=== Collected ${allSamples.length} samples ===\n`);
  
  if (allSamples.length === 0) {
    console.log('No samples collected. Exiting.');
    return;
  }
  
  // Step 2: For each sample, we know the plaintext starts with {"url":"https://
  // The response is: {"url":"https://DOMAIN/e/VIDEO_ID","skip":{"intro":[S,E],"outro":[S,E]}}
  // First 16 chars are always: {"url":"https://
  const KNOWN_PREFIX = '{"url":"https://';
  
  for (const sample of allSamples) {
    console.log(`\nAnalyzing: ${sample.keyword} (lid: ${sample.lid})`);
    const added = analyzeEncryptedResponse(sample.encrypted, KNOWN_PREFIX);
    console.log(`  Added ${added} mappings from prefix`);
    
    // Also analyze the suffix. The response ends with:
    // ...,"skip":{"intro":[N,N],"outro":[N,N]}}
    // or just: ..."}  if no skip data
    // 
    // We can also try to figure out the domain by checking which MegaUp domain
    // produces a consistent mapping at positions 16+
    
    const buf = b64decode(sample.encrypted);
    const data = buf.slice(21);
    
    // Calculate plaintext length
    const dataLen = data.length;
    const ptLen = dataLen > 20 ? 7 + (dataLen - 20) : 1;
    console.log(`  Data length: ${dataLen}, estimated plaintext length: ${ptLen}`);
    
    // Try each known domain to see which one is consistent
    for (const domain of MEGAUP_DOMAINS) {
      const testPlain = `{"url":"https://${domain}/e/`;
      let consistent = true;
      
      for (let i = 16; i < testPlain.length && i < ptLen; i++) {
        const cp = cipherPos(i);
        if (cp >= data.length) break;
        const cipherByte = data[cp];
        const plainChar = testPlain[i];
        const ascii = plainChar.charCodeAt(0);
        
        // Check if this mapping is consistent with what we already have
        if (serverEncrypt[i] && serverEncrypt[i][ascii] !== undefined) {
          if (serverEncrypt[i][ascii] !== cipherByte) {
            consistent = false;
            break;
          }
        }
      }
      
      if (consistent) {
        // This domain might be correct - add all its mappings
        const added2 = analyzeEncryptedResponse(sample.encrypted, testPlain);
        if (added2 > 16) {
          console.log(`  ✓ Domain "${domain}" is consistent! Added ${added2} mappings`);
        }
      }
    }
  }
  
  // Step 3: Now try to determine more of the plaintext.
  // After the domain and /e/, there's a video ID (variable length).
  // After the video ID: ","skip":{"intro":[N,N],"outro":[N,N]}}
  // 
  // The suffix pattern is fixed. If we know the plaintext length,
  // we can work backwards from the end.
  
  // The suffix is: ","skip":{"intro":[N,N],"outro":[N,N]}}
  // Where N is a number (seconds). Common patterns:
  // ","skip":{"intro":[0,0],"outro":[0,0]}}  (42 chars)
  // ","skip":{"intro":[85,170],"outro":[1300,1419]}}  (51 chars)
  
  // Actually, let me check: does the response always have skip data?
  // Some responses might just be: {"url":"https://domain/e/ID"}
  // That would be much shorter.
  
  // Let me look at the data lengths to figure out the format
  console.log('\n=== Sample data lengths ===');
  for (const sample of allSamples) {
    const buf = b64decode(sample.encrypted);
    const data = buf.slice(21);
    const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;
    console.log(`  ${sample.keyword}: data=${data.length}b, pt≈${ptLen} chars`);
  }
  
  // Step 4: Output what we have so far
  console.log('\n=== Server Encrypt Tables (so far) ===');
  let totalMappings = 0;
  const positions = Object.keys(serverEncrypt).map(Number).sort((a,b) => a-b);
  
  for (const pos of positions) {
    const entries = Object.entries(serverEncrypt[pos]);
    totalMappings += entries.length;
    const mappings = entries.map(([ascii, cipher]) => 
      `'${String.fromCharCode(Number(ascii))}' → 0x${cipher.toString(16).padStart(2,'0')}`
    ).join(', ');
    console.log(`  pos ${pos}: ${entries.length} mappings: ${mappings}`);
  }
  
  console.log(`\nTotal: ${totalMappings} mappings across ${positions.length} positions`);
  
  // Step 5: Cross-reference with HiAnime to get actual video URLs
  // For each sample, if we have the MAL ID, we can search HiAnime
  // and get the MegaCloud embed URL, which contains the video ID.
  // MegaCloud and MegaUp often share the same video IDs.
  
  console.log('\n=== Cross-referencing with HiAnime ===');
  
  for (const sample of allSamples.slice(0, 5)) {
    if (!sample.malId) continue;
    
    console.log(`\nLooking up MAL ID ${sample.malId} (${sample.keyword}) on HiAnime...`);
    
    try {
      // Search HiAnime
      const hiSearch = await fetch(
        `https://hianimez.to/ajax/search/suggest?keyword=${encodeURIComponent(sample.keyword)}`,
        { 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/' }
      );
      const hiData = JSON.parse(hiSearch.body);
      
      if (hiData.html) {
        const links = [...hiData.html.matchAll(/<a[^>]*href="\/([^"?]+)"[^>]*>/g)];
        console.log(`  Found ${links.length} results on HiAnime`);
        
        if (links.length > 0) {
          const hiSlug = links[0][1];
          const hiId = hiSlug.match(/-(\d+)$/)?.[1];
          
          if (hiId) {
            // Get episodes
            const hiEpResp = await fetch(
              `https://hianimez.to/ajax/v2/episode/list/${hiId}`,
              { 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/' }
            );
            const hiEpData = JSON.parse(hiEpResp.body);
            const epMatch = hiEpData.html?.match(/data-id="(\d+)"/);
            
            if (epMatch) {
              const epId = epMatch[1];
              
              // Get servers
              const hiSrvResp = await fetch(
                `https://hianimez.to/ajax/v2/episode/servers?episodeId=${epId}`,
                { 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/' }
              );
              const hiSrvData = JSON.parse(hiSrvResp.body);
              
              // Find VidStreaming server (serverId=4)
              const srvMatch = hiSrvData.html?.match(/data-id="(\d+)"[^>]*data-type="sub"[^>]*data-server-id="4"/);
              
              if (srvMatch) {
                const srvId = srvMatch[1];
                
                // Get source link
                const srcResp = await fetch(
                  `https://hianimez.to/ajax/v2/episode/sources?id=${srvId}`,
                  { 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://hianimez.to/' }
                );
                const srcData = JSON.parse(srcResp.body);
                
                if (srcData.link) {
                  console.log(`  ✓ HiAnime embed URL: ${srcData.link}`);
                  
                  // Extract the source ID from the embed URL
                  // Format: https://megacloud.blog/embed-2/v3/e-1/SOURCEID?k=1
                  const sourceId = srcData.link.split('/').pop()?.split('?')[0];
                  console.log(`  Source ID: ${sourceId}`);
                  
                  // Now we know the MegaCloud source ID.
                  // AnimeKai uses MegaUp which has DIFFERENT video IDs.
                  // But the video content is the same.
                  // We can't directly map MegaCloud ID to MegaUp ID.
                  
                  // HOWEVER: if AnimeKai also uses MegaCloud (via different server),
                  // the source ID might be the same!
                  // Let's check if the AnimeKai response contains a megacloud URL.
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Save results
  const output = {
    timestamp: new Date().toISOString(),
    totalSamples: allSamples.length,
    totalMappings,
    positionsCovered: positions.length,
    tables: serverEncrypt,
    samples: allSamples.map(s => ({
      keyword: s.keyword, slug: s.slug, malId: s.malId, lid: s.lid,
      encryptedLength: s.encrypted.length,
      encrypted: s.encrypted,
    })),
  };
  
  fs.writeFileSync('scripts/kai-server-tables.json', JSON.stringify(output, null, 2));
  console.log('\nSaved to scripts/kai-server-tables.json');
}

main().catch(e => console.error('Fatal:', e));
