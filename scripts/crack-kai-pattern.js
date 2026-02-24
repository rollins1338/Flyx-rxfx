#!/usr/bin/env node
/**
 * The encrypted response has 72 common bytes across ALL samples.
 * This means the first 72 bytes encode the SAME thing for all responses.
 * 
 * Known plaintext: {"url":"https://
 * That's 16 chars. With the position mapping:
 * pos 0 -> offset 0
 * pos 1 -> offset 7
 * pos 2 -> offset 11
 * pos 3 -> offset 13
 * pos 4 -> offset 15
 * pos 5 -> offset 17
 * pos 6 -> offset 19
 * pos 7+ -> offset 20+
 * 
 * So 16 chars of plaintext use offsets: 0, 7, 11, 13, 15, 17, 19, 20-28
 * That's up to offset 28 (29 bytes of data used out of 72 common bytes)
 * 
 * But wait - the 72 common bytes include the 21-byte header!
 * So the DATA part starts at byte 21, and we have 72-21 = 51 common data bytes.
 * 
 * With the position mapping, 51 data bytes encode:
 * Positions 0-6 use offsets 0,7,11,13,15,17,19 (7 positions, max offset 19)
 * Positions 7+ use offsets 20+ 
 * So 51 data bytes = offsets 0-50, which means positions 0-6 + positions 7 through 7+(50-20) = 7+30 = 37
 * Total: 38 plaintext positions (0-37) are common across ALL samples
 * 
 * But the plaintext is {"url":"https://DOMAIN/path"}
 * Position 0-15 = {"url":"https://
 * Position 16-37 = first 22 chars of the domain
 * 
 * If ALL samples share the same domain for the first 22 chars, that means
 * ALL URLs start with the same domain! Like "megacloud.blog" or similar.
 * 
 * Wait, but the samples data showed that at position 16, DIFFERENT chars
 * map to the SAME cipher byte. That was the "many-to-one" finding.
 * But if all URLs share the same domain, then position 16 should be the
 * same char for all of them!
 * 
 * UNLESS... the position mapping is WRONG.
 * 
 * Let me re-examine the position mapping.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', 'fetch', '--timeout', '15',
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

function b64decode(s) {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - std.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

// First, let me understand the ENCRYPT side better
// The Rust code can encrypt. Let me encrypt a known string and see the output format
console.log('=== Understanding encryption format ===\n');

// Encrypt a simple test string
const testStr = 'hello';
const encrypted = kaiEncrypt(testStr);
console.log(`Encrypt("hello") = ${encrypted}`);
console.log(`Length: ${encrypted.length}`);

const encBuf = b64decode(encrypted);
console.log(`Decoded bytes: ${encBuf.length}`);
console.log(`Hex: ${[...encBuf].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

// Encrypt another string
const testStr2 = 'world';
const encrypted2 = kaiEncrypt(testStr2);
console.log(`\nEncrypt("world") = ${encrypted2}`);
const encBuf2 = b64decode(encrypted2);
console.log(`Decoded bytes: ${encBuf2.length}`);
console.log(`Hex: ${[...encBuf2].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

// Compare - do they share a common prefix?
let commonBytes = 0;
for (let i = 0; i < Math.min(encBuf.length, encBuf2.length); i++) {
  if (encBuf[i] === encBuf2[i]) commonBytes++;
  else break;
}
console.log(`Common prefix bytes: ${commonBytes}`);

// Now encrypt a longer string that looks like what the server would return
const testUrl = '{"url":"https://megacloud.blog/embed/123"}';
const encUrl = kaiEncrypt(testUrl);
console.log(`\nEncrypt(URL JSON) = ${encUrl.substring(0, 80)}...`);
const encUrlBuf = b64decode(encUrl);
console.log(`Decoded bytes: ${encUrlBuf.length}`);

// Compare with a server response
const data = JSON.parse(fs.readFileSync('scripts/kai-server-tables.json', 'utf8'));
const serverEnc = data.samples[0].encrypted;
const serverBuf = b64decode(serverEnc);

console.log(`\nServer response bytes: ${serverBuf.length}`);

// Compare our encryption with server encryption
let match = 0;
for (let i = 0; i < Math.min(encUrlBuf.length, serverBuf.length); i++) {
  if (encUrlBuf[i] === serverBuf[i]) match++;
  else break;
}
console.log(`Common prefix with server: ${match} bytes`);

// This tells us if the server uses the SAME encryption as our Rust code
// If they share a long prefix, the encryption is the same
// If not, the server uses a different method

// Let me also check: does the Rust encrypt produce the same header?
console.log(`\nOur header (first 21): ${[...encUrlBuf.subarray(0, 21)].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
console.log(`Server header (first 21): ${[...serverBuf.subarray(0, 21)].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

// Now let me look at the Rust encryption code to understand the position mapping
console.log('\n=== Checking Rust encryption position mapping ===');

// The Rust code encrypts by:
// 1. For each plaintext char at position i, look up the substitution table
// 2. Place the cipher byte at a specific offset in the output
// The position mapping in the Rust code should tell us the exact layout

// Let me encrypt single chars at different positions to map the layout
const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
for (let len = 1; len <= 5; len++) {
  const input = chars.substring(0, len);
  const enc = kaiEncrypt(input);
  const buf = b64decode(enc);
  console.log(`"${input}" -> ${buf.length} bytes, data: ${[...buf.subarray(0, Math.min(30, buf.length))].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
}

// Now let me try to understand the server's encryption by using a KNOWN response
// If I can get the server to return a URL I already know...
// Actually, I already have the encrypted responses AND I know the URL format
// The URLs are typically like: https://megacloud.blog/e/XXXXX or https://vidplay.site/e/XXXXX

// Let me check: for the SAME lid, does the server always return the SAME encrypted response?
console.log('\n=== Checking response consistency ===');
const KAI_HDRS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

// Get bleach page
const searchHtml = rf('https://animekai.to/ajax/anime/search?keyword=bleach', {
  ...KAI_HDRS, 'Referer': 'https://animekai.to/'
});
const sd = JSON.parse(searchHtml);
const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
const pageHtml = rf(`https://animekai.to/watch/${slug}`);
const syncMatch = pageHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
const sync = JSON.parse(syncMatch[1]);
const animeId = sync.anime_id;

const encId = kaiEncrypt(animeId);
const epHtml = rf(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, {
  ...KAI_HDRS, 'Referer': 'https://animekai.to/'
});
const epData = JSON.parse(epHtml);
const token = epData.result.match(/token="([^"]+)"/)[1];

const encToken = kaiEncrypt(token);
const srvHtml = rf(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, {
  ...KAI_HDRS, 'Referer': 'https://animekai.to/'
});
const srvData = JSON.parse(srvHtml);

// Get ALL server links with their names
const serverLinks = [...srvData.result.matchAll(/data-lid="([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)/g)];
console.log('\nServer links:');
for (const [, lid, name] of serverLinks) {
  console.log(`  ${lid}: ${name.trim()}`);
}

// Get encrypted response for first lid, twice
const lid = serverLinks[0]?.[1];
if (lid) {
  const encLid = kaiEncrypt(lid);
  const r1 = rf(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, {
    ...KAI_HDRS, 'Referer': 'https://animekai.to/'
  });
  const r2 = rf(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, {
    ...KAI_HDRS, 'Referer': 'https://animekai.to/'
  });
  
  const d1 = JSON.parse(r1).result;
  const d2 = JSON.parse(r2).result;
  
  console.log('\nSame lid, two requests:');
  console.log('  Response 1:', d1.substring(0, 60));
  console.log('  Response 2:', d2.substring(0, 60));
  console.log('  Identical:', d1 === d2);
  
  if (d1 !== d2) {
    // Find where they differ
    for (let i = 0; i < Math.min(d1.length, d2.length); i++) {
      if (d1[i] !== d2[i]) {
        console.log(`  First diff at base64 pos ${i}`);
        break;
      }
    }
  }
}
