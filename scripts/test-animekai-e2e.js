#!/usr/bin/env node
/**
 * End-to-end AnimeKai extraction test
 * Tests the FULL pipeline locally step by step
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];
let KAI_BASE = KAI_DOMAINS[0];
const HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://animekai.to/',
  'X-Requested-With': 'XMLHttpRequest',
};

// Load AnimeKai crypto from RPI proxy
const fs = require('fs');
const path = require('path');

// ============================================================================
// AnimeKai Crypto (copied from rpi-proxy/server.js)
// ============================================================================

function urlSafeBase64Decode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

function urlSafeBase64Encode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getCipherPosition(plainPos) {
  if (plainPos === 0) return 0;
  if (plainPos === 1) return 7;
  if (plainPos === 2) return 11;
  if (plainPos === 3) return 13;
  if (plainPos === 4) return 15;
  if (plainPos === 5) return 17;
  if (plainPos === 6) return 19;
  return 20 + (plainPos - 7);
}

let TABLES = null;
try {
  TABLES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rpi-proxy', 'animekai-tables.json'), 'utf8'));
  console.log(`Loaded ${Object.keys(TABLES).length} AnimeKai substitution tables\n`);
} catch (e) {
  console.error('Failed to load animekai-tables.json:', e.message);
  process.exit(1);
}

function decryptAnimeKai(ciphertext) {
  const HEADER_LEN = 21;
  const cipher = urlSafeBase64Decode(ciphertext);
  const hasHeader = cipher.length > HEADER_LEN;
  const dataOffset = hasHeader ? HEADER_LEN : 0;
  const dataLen = cipher.length - dataOffset;
  let plaintextLen = 0;
  if (dataLen > 20) plaintextLen = 7 + (dataLen - 20);
  else if (dataLen > 19) plaintextLen = 7;
  else if (dataLen > 17) plaintextLen = 6;
  else if (dataLen > 15) plaintextLen = 5;
  else if (dataLen > 13) plaintextLen = 4;
  else if (dataLen > 11) plaintextLen = 3;
  else if (dataLen > 7) plaintextLen = 2;
  else if (dataLen > 0) plaintextLen = 1;
  let plaintext = '';
  for (let i = 0; i < plaintextLen; i++) {
    const cipherPos = getCipherPosition(i);
    const actualPos = dataOffset + cipherPos;
    if (actualPos >= cipher.length) break;
    const byte = cipher[actualPos];
    const table = TABLES[i];
    if (table && byte in table) plaintext += table[byte];
    else plaintext += String.fromCharCode(byte);
  }
  return plaintext;
}

const CONSTANT_BYTES = { 1:0xf2,2:0xdf,3:0x9b,4:0x9d,5:0x16,6:0xe5,8:0x67,9:0xc9,10:0xdd,12:0x9c,14:0x29,16:0x35,18:0xc8 };
const ANIMEKAI_HEADER = Buffer.from('c509bdb497cbc06873ff412af12fd8007624c29faa', 'hex');

function encryptAnimeKai(plaintext) {
  // Build encrypt tables (reverse of decrypt)
  const encTables = {};
  for (const [pos, table] of Object.entries(TABLES)) {
    encTables[pos] = {};
    for (const [byte, char] of Object.entries(table)) {
      encTables[pos][char] = parseInt(byte);
    }
  }
  const plaintextLen = plaintext.length;
  let cipherDataLen;
  if (plaintextLen <= 1) cipherDataLen = 1;
  else if (plaintextLen <= 2) cipherDataLen = 8;
  else if (plaintextLen <= 3) cipherDataLen = 12;
  else if (plaintextLen <= 4) cipherDataLen = 14;
  else if (plaintextLen <= 5) cipherDataLen = 16;
  else if (plaintextLen <= 6) cipherDataLen = 18;
  else if (plaintextLen <= 7) cipherDataLen = 20;
  else cipherDataLen = 20 + (plaintextLen - 7);
  const cipher = Buffer.alloc(21 + cipherDataLen);
  ANIMEKAI_HEADER.copy(cipher, 0);
  for (const [pos, byte] of Object.entries(CONSTANT_BYTES)) {
    const idx = 21 + parseInt(pos);
    if (idx < cipher.length) cipher[idx] = byte;
  }
  for (let i = 0; i < plaintextLen; i++) {
    const char = plaintext[i];
    const cipherPos = getCipherPosition(i);
    const table = encTables[i];
    if (table && char in table) cipher[21 + cipherPos] = table[char];
    else cipher[21 + cipherPos] = char.charCodeAt(0);
  }
  return urlSafeBase64Encode(cipher);
}

function decodeAnimeKaiHex(str) {
  return str.replace(/}([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// MegaUp native decryption
const MEGAUP_KEYSTREAM_HEX = 'cd04e9c92863097ef5e0b5010d2d7bb7ff8e3efd831d83da12a45a1aca29d1953c552272fdb39a789049975aa97586781074b4a13d841e7945e2f0c5b632b4202dc8979699db15aacdc53193784eb52278fb7c0c33e2b3073bb1c2d6b86e9aa17a8c4d58e44d2b6035e2966ead4047bbe68392924ede09de62294c29b998568eaf420dd8a84a476d0e5ebd76ec8d83dfc186903afc109a855dc05da1d1c57084e8316191571538ecdd51be555c4e245bc38068ac8054af44089db6fc10470a7bca7d276045b11caeac973263324e86fcf8d79f8415c33fce7b53e0dfcba2ec8157ab8504c03a9687fd57909cc78aeef452b06f54c2d6d990390ed49ddc605a9fecc1509619342f70884a399a51097388f58d2668f1a80d9e14acb6502125658f5c42394595c52c8e76baa7b1249051bc09ab642f6eb26a9d2de9bc67f964af9ad02dbb3573998e6dd5d05c32160f340da7d94e7e463f98ecf7b75176838cbb239c1b73d394e9fe62eba27b52efda2b50d50ab727e2e21cea81787cc220b3ac038dbd47a9ead5b952b7f2e6ced5ce55a6cb5d2d6cc0f843b38c33f53ddc50d9261ac01ddad199b09c79414ade30fce9eb39b040b8881704b368eae842a65858ede4bed9cae74089d096558838309b170a4010547718792e00536ebbc1b903e7b9f77ff78b66535c7ba90f218bb1bc11677ade52cf3927cdd53a9560d76b0ee9e90328b5261f62e35f42';
const MEGAUP_KEYSTREAM = Buffer.from(MEGAUP_KEYSTREAM_HEX, 'hex');

function decryptMegaUp(encryptedBase64) {
  const base64 = encryptedBase64.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  const decLength = Math.min(MEGAUP_KEYSTREAM.length, encBytes.length);
  const decBytes = Buffer.alloc(decLength);
  for (let i = 0; i < decLength; i++) decBytes[i] = encBytes[i] ^ MEGAUP_KEYSTREAM[i];
  const result = decBytes.toString('utf8');
  for (let i = result.length; i > 0; i--) {
    const substr = result.substring(0, i);
    if (substr.endsWith('}')) {
      try { JSON.parse(substr); return substr; } catch {}
    }
  }
  return result;
}


// ============================================================================
// Main test
// ============================================================================

async function fetchKai(url) {
  for (const domain of KAI_DOMAINS) {
    const fullUrl = url.startsWith('http') ? url : `${domain}${url}`;
    try {
      const res = await fetch(fullUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        if (domain !== KAI_BASE) { KAI_BASE = domain; console.log(`  Switched to domain: ${KAI_BASE}`); }
        return await res.json();
      }
      console.log(`  ${domain}: HTTP ${res.status}`);
    } catch (e) { console.log(`  ${domain}: ${e.message}`); }
  }
  return null;
}

async function main() {
  console.log('=== ANIMEKAI E2E EXTRACTION TEST ===\n');
  console.log(`Time: ${new Date().toISOString()}\n`);

  const searchQuery = process.argv[2] || 'One Piece';
  const targetEp = parseInt(process.argv[3] || '1');
  console.log(`Search: "${searchQuery}", Episode: ${targetEp}\n`);

  try {
    // Step 1: Search
    console.log('[Step 1] Searching AnimeKai...');
    const searchData = await fetchKai(`/ajax/anime/search?keyword=${encodeURIComponent(searchQuery)}`);
    if (!searchData?.result?.html) { console.log('  ✗ No search results'); return; }
    
    const animeRegex = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*(?:data-jp="([^"]*)")?[^>]*>([^<]*)<\/h6>/gi;
    const results = [];
    let m;
    while ((m = animeRegex.exec(searchData.result.html)) !== null) {
      results.push({ slug: m[1], jpTitle: m[2] || '', enTitle: m[3].trim() });
    }
    console.log(`  Found ${results.length} results: ${results.map(r => r.enTitle).join(', ')}`);
    if (results.length === 0) return;

    // Get anime_id from watch page
    const slug = results[0].slug;
    console.log(`\n[Step 1b] Fetching watch page: ${KAI_BASE}/watch/${slug}`);
    const watchRes = await fetch(`${KAI_BASE}/watch/${slug}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    const watchHtml = await watchRes.text();
    console.log(`  Watch page: ${watchRes.status}, size: ${watchHtml.length}`);
    
    const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
    if (!syncMatch) { console.log('  ✗ No syncData found'); return; }
    const syncData = JSON.parse(syncMatch[1]);
    const animeId = syncData.anime_id;
    const malId = syncData.mal_id;
    console.log(`  anime_id: ${animeId}, mal_id: ${malId}`);

    // Step 2: Get episodes
    console.log(`\n[Step 2] Getting episodes for anime_id: ${animeId}`);
    const encId = encryptAnimeKai(animeId);
    console.log(`  Encrypted ID: ${encId.substring(0, 30)}...`);
    const epData = await fetchKai(`/ajax/episodes/list?ani_id=${animeId}&_=${encId}`);
    if (!epData?.result) { console.log('  ✗ No episodes data'); return; }
    
    const epRegex = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"[^>]*>/gi;
    const episodes = {};
    while ((m = epRegex.exec(epData.result)) !== null) episodes[m[1]] = m[2];
    // Also try alternate order
    const altEpRegex = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"[^>]*>/gi;
    while ((m = altEpRegex.exec(epData.result)) !== null) { if (!episodes[m[2]]) episodes[m[2]] = m[1]; }
    
    console.log(`  Found ${Object.keys(episodes).length} episodes`);
    if (!episodes[targetEp]) { console.log(`  ✗ Episode ${targetEp} not found. Available: ${Object.keys(episodes).join(', ')}`); return; }
    const epToken = episodes[targetEp];
    console.log(`  Episode ${targetEp} token: ${epToken.substring(0, 30)}...`);

    // Step 3: Get servers
    console.log(`\n[Step 3] Getting servers...`);
    const encToken = encryptAnimeKai(epToken);
    const srvData = await fetchKai(`/ajax/links/list?token=${epToken}&_=${encToken}`);
    if (!srvData?.result) { console.log('  ✗ No servers data'); return; }
    
    const serverRegex = /<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>([^<]*)<\/span>/gi;
    const servers = [];
    while ((m = serverRegex.exec(srvData.result)) !== null) servers.push({ lid: m[1], name: m[2].trim() });
    console.log(`  Found ${servers.length} servers: ${servers.map(s => s.name).join(', ')}`);
    if (servers.length === 0) return;

    // Step 4: Get encrypted embed for first server
    const server = servers[0];
    console.log(`\n[Step 4] Getting embed for "${server.name}" (lid: ${server.lid.substring(0, 20)}...)`);
    const encLid = encryptAnimeKai(server.lid);
    const embedData = await fetchKai(`/ajax/links/view?id=${server.lid}&_=${encLid}`);
    if (!embedData?.result) { console.log('  ✗ No embed data'); return; }
    console.log(`  Encrypted embed: ${embedData.result.length} chars`);

    // Step 5: Decrypt AnimeKai embed
    console.log(`\n[Step 5] Decrypting AnimeKai embed...`);
    const decrypted = decryptAnimeKai(embedData.result);
    console.log(`  Decrypted: ${decrypted.substring(0, 100)}...`);
    const decoded = decodeAnimeKaiHex(decrypted);
    console.log(`  Decoded: ${decoded.substring(0, 100)}...`);
    
    let embedJson;
    try { embedJson = JSON.parse(decoded); } catch (e) { console.log(`  ✗ JSON parse failed: ${e.message}`); console.log(`  Raw: ${decoded}`); return; }
    console.log(`  Embed URL: ${embedJson.url}`);
    console.log(`  Skip: ${JSON.stringify(embedJson.skip || {})}`);

    // Step 6: Extract video ID and fetch MegaUp /media/
    const urlMatch = embedJson.url.match(/https?:\/\/([^\/]+)\/e\/([^\/\?]+)/);
    if (!urlMatch) { console.log(`  ✗ Invalid embed URL format`); return; }
    const [, host, videoId] = urlMatch;
    const mediaUrl = `https://${host}/media/${videoId}`;
    console.log(`\n[Step 6] Fetching MegaUp /media/: ${mediaUrl}`);
    
    // Try direct first
    console.log(`  [6a] Direct fetch...`);
    let mediaResponse;
    try {
      mediaResponse = await fetch(mediaUrl, {
        headers: { 'User-Agent': MEGAUP_UA, 'Accept': '*/*' },
        signal: AbortSignal.timeout(10000),
      });
      console.log(`  Direct: ${mediaResponse.status}`);
    } catch (e) { console.log(`  Direct error: ${e.message}`); }
    
    if (!mediaResponse || !mediaResponse.ok) {
      // Try via RPI proxy
      console.log(`  [6b] Via RPI proxy...`);
      const rpiUrl = `https://rpi-proxy.vynx.cc/animekai?url=${encodeURIComponent(mediaUrl)}&ua=${encodeURIComponent(MEGAUP_UA)}&key=5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560`;
      try {
        mediaResponse = await fetch(rpiUrl, { signal: AbortSignal.timeout(15000) });
        console.log(`  RPI: ${mediaResponse.status}`);
      } catch (e) { console.log(`  RPI error: ${e.message}`); return; }
    }
    
    if (!mediaResponse.ok) {
      const errText = await mediaResponse.text();
      console.log(`  ✗ MegaUp /media/ failed: ${errText.substring(0, 200)}`);
      return;
    }
    
    const megaupData = await mediaResponse.json();
    console.log(`  MegaUp status: ${megaupData.status}, result length: ${megaupData.result?.length || 0}`);
    
    if (megaupData.status !== 200 || !megaupData.result) {
      console.log(`  ✗ MegaUp API error:`, megaupData);
      return;
    }

    // Step 7: Decrypt MegaUp
    console.log(`\n[Step 7] Decrypting MegaUp response...`);
    const megaDecrypted = decryptMegaUp(megaupData.result);
    console.log(`  Decrypted: ${megaDecrypted.substring(0, 200)}`);
    
    let streamData;
    try { streamData = JSON.parse(megaDecrypted); } catch (e) { console.log(`  ✗ JSON parse failed: ${e.message}`); return; }
    
    let streamUrl = '';
    if (streamData.sources?.[0]) streamUrl = streamData.sources[0].file || streamData.sources[0].url || '';
    else if (streamData.file) streamUrl = streamData.file;
    else if (streamData.url) streamUrl = streamData.url;
    
    if (!streamUrl) { console.log(`  ✗ No stream URL in decrypted data`); return; }
    console.log(`  ✓ Stream URL: ${streamUrl}`);

    // Step 8: Verify stream URL
    console.log(`\n[Step 8] Verifying stream URL...`);
    const streamHost = new URL(streamUrl).hostname;
    console.log(`  Host: ${streamHost}`);
    
    // Direct fetch
    console.log(`  [8a] Direct fetch...`);
    try {
      const directRes = await fetch(streamUrl, {
        headers: { 'User-Agent': MEGAUP_UA, 'Accept': '*/*' },
        signal: AbortSignal.timeout(10000),
      });
      console.log(`  Status: ${directRes.status}`);
      if (directRes.ok) {
        const text = await directRes.text();
        if (text.includes('#EXTM3U')) console.log(`  ✓✓✓ VALID M3U8! Size: ${text.length}`);
        else console.log(`  Content: ${text.substring(0, 150)}`);
      } else {
        const err = await directRes.text();
        console.log(`  Error: ${err.substring(0, 150)}`);
      }
    } catch (e) { console.log(`  Error: ${e.message}`); }

    // Via RPI proxy
    console.log(`  [8b] Via RPI proxy...`);
    try {
      const rpiUrl = `https://rpi-proxy.vynx.cc/animekai?url=${encodeURIComponent(streamUrl)}&ua=${encodeURIComponent(MEGAUP_UA)}&key=5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560`;
      const rpiRes = await fetch(rpiUrl, { signal: AbortSignal.timeout(15000) });
      console.log(`  Status: ${rpiRes.status}, X-Proxied-By: ${rpiRes.headers.get('x-proxied-by')}`);
      if (rpiRes.ok) {
        const text = await rpiRes.text();
        if (text.includes('#EXTM3U')) console.log(`  ✓✓✓ VALID M3U8 VIA RPI! Size: ${text.length}`);
        else console.log(`  Content: ${text.substring(0, 150)}`);
      }
    } catch (e) { console.log(`  Error: ${e.message}`); }

    console.log(`\n=== TEST COMPLETE ===`);
  } catch (e) {
    console.error(`\n✗ FATAL: ${e.message}`);
    console.error(e.stack);
  }
}

main();
