#!/usr/bin/env node
/**
 * Test AnimeKai E2E with enc-dec.app for MegaUp decryption
 * Verifies the full pipeline works before we update the codebase
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];
let KAI_BASE = KAI_DOMAINS[0];
const HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Referer': 'https://animekai.to/',
  'X-Requested-With': 'XMLHttpRequest',
};

// Load AnimeKai crypto tables
let TABLES;
try {
  TABLES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rpi-proxy', 'animekai-tables.json'), 'utf8'));
  console.log(`Loaded ${Object.keys(TABLES).length} AnimeKai substitution tables\n`);
} catch (e) { console.error('Failed to load tables:', e.message); process.exit(1); }

// --- AnimeKai crypto (same as E2E test) ---
function urlSafeBase64Decode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64 + '='.repeat((4 - base64.length % 4) % 4), 'base64');
}
function urlSafeBase64Encode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function getCipherPosition(i) {
  return [0,7,11,13,15,17,19][i] ?? (20 + (i - 7));
}
function decryptAnimeKai(ciphertext) {
  const HEADER_LEN = 21;
  const cipher = urlSafeBase64Decode(ciphertext);
  const dataOffset = cipher.length > HEADER_LEN ? HEADER_LEN : 0;
  const dataLen = cipher.length - dataOffset;
  let pLen = 0;
  if (dataLen > 20) pLen = 7 + (dataLen - 20);
  else if (dataLen > 19) pLen = 7;
  else if (dataLen > 17) pLen = 6;
  else if (dataLen > 15) pLen = 5;
  else if (dataLen > 13) pLen = 4;
  else if (dataLen > 11) pLen = 3;
  else if (dataLen > 7) pLen = 2;
  else if (dataLen > 0) pLen = 1;
  let plain = '';
  for (let i = 0; i < pLen; i++) {
    const pos = dataOffset + getCipherPosition(i);
    if (pos >= cipher.length) break;
    const byte = cipher[pos];
    const table = TABLES[i];
    plain += (table && byte in table) ? table[byte] : String.fromCharCode(byte);
  }
  return plain;
}
function encryptAnimeKai(plaintext) {
  const encTables = {};
  for (const [pos, table] of Object.entries(TABLES)) {
    encTables[pos] = {};
    for (const [byte, char] of Object.entries(table)) encTables[pos][char] = parseInt(byte);
  }
  const CONSTANT_BYTES = {1:0xf2,2:0xdf,3:0x9b,4:0x9d,5:0x16,6:0xe5,8:0x67,9:0xc9,10:0xdd,12:0x9c,14:0x29,16:0x35,18:0xc8};
  const HEADER = Buffer.from('c509bdb497cbc06873ff412af12fd8007624c29faa', 'hex');
  const pLen = plaintext.length;
  let cLen;
  if (pLen <= 1) cLen = 1; else if (pLen <= 2) cLen = 8; else if (pLen <= 3) cLen = 12;
  else if (pLen <= 4) cLen = 14; else if (pLen <= 5) cLen = 16; else if (pLen <= 6) cLen = 18;
  else if (pLen <= 7) cLen = 20; else cLen = 20 + (pLen - 7);
  const cipher = Buffer.alloc(21 + cLen);
  HEADER.copy(cipher, 0);
  for (const [pos, byte] of Object.entries(CONSTANT_BYTES)) {
    const idx = 21 + parseInt(pos);
    if (idx < cipher.length) cipher[idx] = byte;
  }
  for (let i = 0; i < pLen; i++) {
    const ch = plaintext[i];
    const cPos = getCipherPosition(i);
    const table = encTables[i];
    cipher[21 + cPos] = (table && ch in table) ? table[ch] : ch.charCodeAt(0);
  }
  return urlSafeBase64Encode(cipher);
}
function decodeHex(str) {
  return str.replace(/}([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// --- MegaUp decryption via enc-dec.app ---
function decryptMegaUpViaAPI(encryptedBase64) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ text: encryptedBase64, agent: MEGAUP_UA });
    const req = https.request({
      hostname: 'enc-dec.app',
      path: '/api/dec-mega',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': MEGAUP_UA,
      },
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          const result = JSON.parse(data);
          if (result.status !== 200) return reject(new Error(`API error: ${JSON.stringify(result)}`));
          const decrypted = typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
          resolve(decrypted);
        } catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    });
    req.on('error', e => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData);
    req.end();
  });
}

// --- Native MegaUp decrypt (stale keystream - for comparison) ---
const MEGAUP_KEYSTREAM = Buffer.from('cd04e9c92863097ef5e0b5010d2d7bb7ff8e3efd831d83da12a45a1aca29d1953c552272fdb39a789049975aa97586781074b4a13d841e7945e2f0c5b632b4202dc8979699db15aacdc53193784eb52278fb7c0c33e2b3073bb1c2d6b86e9aa17a8c4d58e44d2b6035e2966ead4047bbe68392924ede09de62294c29b998568eaf420dd8a84a476d0e5ebd76ec8d83dfc186903afc109a855dc05da1d1c57084e8316191571538ecdd51be555c4e245bc38068ac8054af44089db6fc10470a7bca7d276045b11caeac973263324e86fcf8d79f8415c33fce7b53e0dfcba2ec8157ab8504c03a9687fd57909cc78aeef452b06f54c2d6d990390ed49ddc605a9fecc1509619342f70884a399a51097388f58d2668f1a80d9e14acb6502125658f5c42394595c52c8e76baa7b1249051bc09ab642f6eb26a9d2de9bc67f964af9ad02dbb3573998e6dd5d05c32160f340da7d94e7e463f98ecf7b75176838cbb239c1b73d394e9fe62eba27b52efda2b50d50ab727e2e21cea81787cc220b3ac038dbd47a9ead5b952b7f2e6ced5ce55a6cb5d2d6cc0f843b38c33f53ddc50d9261ac01ddad199b09c79414ade30fce9eb39b040b8881704b368eae842a65858ede4bed9cae74089d096558838309b170a4010547718792e00536ebbc1b903e7b9f77ff78b66535c7ba90f218bb1bc11677ade52cf3927cdd53a9560d76b0ee9e90328b5261f62e35f42', 'hex');
function decryptMegaUpNative(encryptedBase64) {
  const base64 = encryptedBase64.replace(/-/g, '+').replace(/_/g, '/');
  const enc = Buffer.from(base64, 'base64');
  const len = Math.min(MEGAUP_KEYSTREAM.length, enc.length);
  const dec = Buffer.alloc(len);
  for (let i = 0; i < len; i++) dec[i] = enc[i] ^ MEGAUP_KEYSTREAM[i];
  const result = dec.toString('utf8');
  for (let i = result.length; i > 0; i--) {
    const s = result.substring(0, i);
    if (s.endsWith('}')) { try { JSON.parse(s); return s; } catch {} }
  }
  return result;
}

async function fetchKai(urlPath) {
  for (const domain of KAI_DOMAINS) {
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${domain}${urlPath}`;
    try {
      const res = await fetch(fullUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        if (domain !== KAI_BASE) { KAI_BASE = domain; console.log(`  Switched to: ${KAI_BASE}`); }
        return await res.json();
      }
    } catch (e) { /* try next */ }
  }
  return null;
}

async function main() {
  console.log('=== ANIMEKAI + ENC-DEC.APP MEGAUP FIX TEST ===\n');
  
  const query = process.argv[2] || 'One Piece';
  const ep = parseInt(process.argv[3] || '1');
  console.log(`Search: "${query}", Episode: ${ep}\n`);

  // Step 1: Search
  console.log('[1] Searching...');
  const searchData = await fetchKai(`/ajax/anime/search?keyword=${encodeURIComponent(query)}`);
  if (!searchData?.result?.html) { console.log('  ✗ No results'); return; }
  
  const animeRegex = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*>([^<]*)<\/h6>/gi;
  const results = [];
  let m;
  while ((m = animeRegex.exec(searchData.result.html)) !== null) results.push({ slug: m[1], title: m[2].trim() });
  console.log(`  Found: ${results.map(r => r.title).join(', ')}`);
  if (!results.length) return;

  // Get anime_id
  console.log('\n[1b] Getting anime_id...');
  const watchRes = await fetch(`${KAI_BASE}/watch/${results[0].slug}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
  const watchHtml = await watchRes.text();
  const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
  if (!syncMatch) { console.log('  ✗ No syncData'); return; }
  const syncData = JSON.parse(syncMatch[1]);
  console.log(`  anime_id: ${syncData.anime_id}, mal_id: ${syncData.mal_id}`);

  // Step 2: Episodes
  console.log('\n[2] Getting episodes...');
  const encId = encryptAnimeKai(syncData.anime_id);
  const epData = await fetchKai(`/ajax/episodes/list?ani_id=${syncData.anime_id}&_=${encId}`);
  if (!epData?.result) { console.log('  ✗ No episodes'); return; }
  
  const episodes = {};
  const epRegex = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"[^>]*>/gi;
  while ((m = epRegex.exec(epData.result)) !== null) episodes[m[1]] = m[2];
  const altRegex = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"[^>]*>/gi;
  while ((m = altRegex.exec(epData.result)) !== null) if (!episodes[m[2]]) episodes[m[2]] = m[1];
  
  if (!episodes[ep]) { console.log(`  ✗ Ep ${ep} not found. Available: ${Object.keys(episodes).join(', ')}`); return; }
  console.log(`  ✓ Episode ${ep} token found`);

  // Step 3: Servers
  console.log('\n[3] Getting servers...');
  const encToken = encryptAnimeKai(episodes[ep]);
  const srvData = await fetchKai(`/ajax/links/list?token=${episodes[ep]}&_=${encToken}`);
  if (!srvData?.result) { console.log('  ✗ No servers'); return; }
  
  const servers = [];
  const srvRegex = /<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>([^<]*)<\/span>/gi;
  while ((m = srvRegex.exec(srvData.result)) !== null) servers.push({ lid: m[1], name: m[2].trim() });
  console.log(`  Servers: ${servers.map(s => s.name).join(', ')}`);
  if (!servers.length) return;

  // Step 4: Get embed
  const srv = servers[0];
  console.log(`\n[4] Getting embed for "${srv.name}"...`);
  const encLid = encryptAnimeKai(srv.lid);
  const embedData = await fetchKai(`/ajax/links/view?id=${srv.lid}&_=${encLid}`);
  if (!embedData?.result) { console.log('  ✗ No embed'); return; }

  // Step 5: Decrypt AnimeKai embed
  console.log('\n[5] Decrypting AnimeKai embed...');
  const decrypted = decryptAnimeKai(embedData.result);
  const decoded = decodeHex(decrypted);
  let embedJson;
  try { embedJson = JSON.parse(decoded); } catch (e) { console.log(`  ✗ Parse failed: ${decoded.substring(0, 100)}`); return; }
  console.log(`  Embed URL: ${embedJson.url}`);

  // Step 6: Fetch MegaUp /media/
  const urlMatch = embedJson.url.match(/https?:\/\/([^\/]+)\/e\/([^\/\?]+)/);
  if (!urlMatch) { console.log('  ✗ Invalid embed URL'); return; }
  const [, host, videoId] = urlMatch;
  const mediaUrl = `https://${host}/media/${videoId}`;
  console.log(`\n[6] Fetching MegaUp /media/: ${mediaUrl}`);
  
  let mediaResponse;
  try {
    mediaResponse = await fetch(mediaUrl, {
      headers: { 'User-Agent': MEGAUP_UA, 'Accept': '*/*' },
      signal: AbortSignal.timeout(10000),
    });
    console.log(`  Direct: ${mediaResponse.status}`);
  } catch (e) { console.log(`  Direct error: ${e.message}`); }
  
  if (!mediaResponse?.ok) {
    console.log('  Trying RPI proxy...');
    const rpiUrl = `https://rpi-proxy.vynx.cc/animekai?url=${encodeURIComponent(mediaUrl)}&ua=${encodeURIComponent(MEGAUP_UA)}&key=5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560`;
    mediaResponse = await fetch(rpiUrl, { signal: AbortSignal.timeout(15000) });
    console.log(`  RPI: ${mediaResponse.status}`);
  }
  
  if (!mediaResponse.ok) { console.log('  ✗ MegaUp /media/ failed'); return; }
  const megaupData = await mediaResponse.json();
  if (megaupData.status !== 200 || !megaupData.result) { console.log('  ✗ MegaUp API error:', megaupData); return; }
  console.log(`  ✓ Got encrypted data (${megaupData.result.length} chars)`);

  // Step 7: Compare native vs enc-dec.app
  console.log('\n[7] COMPARING DECRYPTION METHODS:');
  
  console.log('\n  [7a] Native (stale keystream):');
  const nativeResult = decryptMegaUpNative(megaupData.result);
  console.log(`    Result: ${nativeResult.substring(0, 150)}`);
  let nativeValid = false;
  try { JSON.parse(nativeResult); nativeValid = true; } catch { nativeValid = false; }
  console.log(`    Valid JSON: ${nativeValid}`);
  
  console.log('\n  [7b] enc-dec.app API:');
  try {
    const apiResult = await decryptMegaUpViaAPI(megaupData.result);
    console.log(`    Result: ${apiResult.substring(0, 150)}`);
    let apiValid = false;
    try { JSON.parse(apiResult); apiValid = true; } catch { apiValid = false; }
    console.log(`    Valid JSON: ${apiValid}`);
    
    if (apiValid) {
      const streamData = JSON.parse(apiResult);
      const streamUrl = streamData.sources?.[0]?.file || streamData.sources?.[0]?.url || streamData.file || '';
      console.log(`\n  ✓✓✓ STREAM URL: ${streamUrl}`);
      
      // Step 8: Verify stream
      if (streamUrl) {
        console.log('\n[8] Verifying stream URL...');
        try {
          const streamRes = await fetch(streamUrl, {
            headers: { 'User-Agent': MEGAUP_UA },
            signal: AbortSignal.timeout(10000),
          });
          console.log(`  Direct: ${streamRes.status}`);
          if (streamRes.ok) {
            const text = await streamRes.text();
            if (text.includes('#EXTM3U')) {
              console.log(`  ✓✓✓ VALID M3U8! Size: ${text.length}`);
              console.log(`  First 200 chars: ${text.substring(0, 200)}`);
            } else {
              console.log(`  Content: ${text.substring(0, 100)}`);
            }
          }
        } catch (e) { console.log(`  Error: ${e.message}`); }
        
        // Also try without any headers (MegaUp CDN might not need Referer like MegaCloud)
        console.log('\n  Checking if CDN needs special headers...');
        try {
          const bareRes = await fetch(streamUrl, { signal: AbortSignal.timeout(10000) });
          console.log(`  No headers: ${bareRes.status}`);
        } catch (e) { console.log(`  Error: ${e.message}`); }
      }
      
      // Step 9: Derive correct keystream from known plaintext + ciphertext
      if (apiValid) {
        console.log('\n[9] DERIVING CORRECT KEYSTREAM:');
        const base64 = megaupData.result.replace(/-/g, '+').replace(/_/g, '/');
        const encBytes = Buffer.from(base64, 'base64');
        const plainBytes = Buffer.from(apiResult, 'utf8');
        const ksLen = Math.min(encBytes.length, plainBytes.length);
        const newKeystream = Buffer.alloc(ksLen);
        for (let i = 0; i < ksLen; i++) newKeystream[i] = encBytes[i] ^ plainBytes[i];
        console.log(`  Keystream length: ${ksLen} bytes`);
        console.log(`  Keystream hex: ${newKeystream.toString('hex')}`);
        console.log(`\n  OLD keystream (first 20): ${MEGAUP_KEYSTREAM.slice(0, 20).toString('hex')}`);
        console.log(`  NEW keystream (first 20): ${newKeystream.slice(0, 20).toString('hex')}`);
        
        // Check how many bytes match
        let matchCount = 0;
        for (let i = 0; i < Math.min(MEGAUP_KEYSTREAM.length, newKeystream.length); i++) {
          if (MEGAUP_KEYSTREAM[i] === newKeystream[i]) matchCount++;
        }
        console.log(`  Matching bytes: ${matchCount}/${Math.min(MEGAUP_KEYSTREAM.length, newKeystream.length)}`);
        
        // Verify the new keystream works
        console.log('\n  Verifying new keystream...');
        const verifyLen = Math.min(newKeystream.length, encBytes.length);
        const verifyDec = Buffer.alloc(verifyLen);
        for (let i = 0; i < verifyLen; i++) verifyDec[i] = encBytes[i] ^ newKeystream[i];
        const verifyResult = verifyDec.toString('utf8');
        try {
          JSON.parse(verifyResult);
          console.log(`  ✓ New keystream produces valid JSON!`);
        } catch {
          console.log(`  ✗ New keystream still invalid: ${verifyResult.substring(0, 100)}`);
        }
      }
    }
  } catch (e) {
    console.log(`    ✗ API error: ${e.message}`);
  }

  console.log('\n=== DONE ===');
}

main().catch(e => console.error('Fatal:', e));
