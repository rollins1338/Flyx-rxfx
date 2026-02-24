#!/usr/bin/env node
/**
 * Probe AnimeKai decryption: compare Rust output with expected.
 * enc-dec.app is dead (400), so we need to figure out decryption ourselves.
 * 
 * Strategy: encrypt known plaintext with Rust, then decrypt it back.
 * If roundtrip works, the tables are fine and the issue is elsewhere.
 * If not, tables changed.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const https = require('https');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function rustExec(url, mode) {
  try {
    return execFileSync(RUST, ['--url', url, '--mode', mode], { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (e) {
    return `ERROR: ${e.stderr?.toString().trim() || e.message}`;
  }
}

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', ...hdrs }
    };
    https.get(opts, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej);
  });
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/javascript, */*; q=0.01', 'Referer': 'https://animekai.to/' };

async function main() {
  // STEP 1: Roundtrip test with known strings
  console.log('=== STEP 1: Roundtrip Tests ===');
  const tests = ['abc123', 'hello', 'c4Oz9qI', 'https://example.com/e/test123'];
  for (const t of tests) {
    const enc = rustExec(t, 'kai-encrypt');
    const dec = rustExec(enc, 'kai-decrypt');
    const match = dec === t;
    console.log(`  "${t}" → enc(${enc.length}ch) → dec = "${dec}" ${match ? '✓' : '✗ MISMATCH'}`);
  }

  // STEP 2: Get a REAL encrypted response from AnimeKai and try to decrypt
  console.log('\n=== STEP 2: Real AnimeKai Response ===');
  
  // Search → get anime_id
  const sr = await fetch('https://animekai.to/ajax/anime/search?keyword=bleach', KAI_HDRS);
  const sd = JSON.parse(sr.body);
  const slugMatch = sd.result?.html?.match(/href="\/watch\/([^"]+)"/);
  if (!slugMatch) { console.log('No results'); return; }
  
  const wp = await fetch('https://animekai.to/watch/' + slugMatch[1]);
  const syncMatch = wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
  const sync = JSON.parse(syncMatch[1]);
  const animeId = sync.anime_id;
  console.log('anime_id:', animeId);

  // Get episodes
  const encId = rustExec(animeId, 'kai-encrypt');
  const epResp = await fetch(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
  const epData = JSON.parse(epResp.body);
  console.log('Episodes fetch:', epResp.status, 'has result:', !!epData.result);

  // Get first episode token
  const tokenMatch = epData.result?.match(/token="([^"]+)"/);
  if (!tokenMatch) { console.log('No episode token'); return; }
  const token = tokenMatch[1];
  console.log('Token:', token);

  // Get servers
  const encToken = rustExec(token, 'kai-encrypt');
  const srvResp = await fetch(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
  const srvData = JSON.parse(srvResp.body);
  console.log('Servers fetch:', srvResp.status, 'has result:', !!srvData.result);

  // Get first lid
  const lidMatch = srvData.result?.match(/data-lid="([^"]+)"/);
  if (!lidMatch) { console.log('No lid'); return; }
  const lid = lidMatch[1];
  console.log('lid:', lid);

  // Get embed link (this response needs decryption)
  const encLid = rustExec(lid, 'kai-encrypt');
  const viewResp = await fetch(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
  const viewData = JSON.parse(viewResp.body);
  console.log('View fetch:', viewResp.status);
  console.log('Encrypted result:', viewData.result?.substring(0, 80) + '...');

  // STEP 3: Analyze the encrypted response
  console.log('\n=== STEP 3: Decrypt Analysis ===');
  const encrypted = viewData.result;
  
  // Decode base64 to see raw bytes
  const b64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  const buf = Buffer.from(padded, 'base64');
  console.log('Total bytes:', buf.length);
  console.log('Header (21 bytes):', buf.slice(0, 21).toString('hex'));
  
  const EXPECTED_HEADER = 'c509bdb497cbc06873ff412af12fd8007624c29faa';
  const actualHeader = buf.slice(0, 21).toString('hex');
  console.log('Header match:', actualHeader === EXPECTED_HEADER ? 'YES ✓' : 'NO ✗');
  
  const data = buf.slice(21);
  console.log('Data bytes:', data.length);
  console.log('Data hex:', data.toString('hex'));

  // STEP 4: Try Rust decrypt
  console.log('\n=== STEP 4: Rust Decrypt ===');
  const rustDec = rustExec(encrypted, 'kai-decrypt');
  console.log('Rust raw output:', JSON.stringify(rustDec.substring(0, 200)));
  console.log('Rust output length:', rustDec.length);
  
  // Check if it looks like a URL
  const hasUrl = rustDec.includes('http') || rustDec.includes('url');
  console.log('Contains http/url:', hasUrl);

  // STEP 5: Manual decrypt attempt - try each byte through our known tables
  console.log('\n=== STEP 5: Manual Byte Analysis ===');
  // The expected output should be something like: {"url":"https://...","skip":{"intro":[...],"outro":[...]}}
  // Let's see what bytes are at the cipher positions
  const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);
  
  // Expected first chars of decrypted: {"url":"https://...
  const expected = '{"url":"https://';
  console.log('Expected first chars:', expected);
  console.log('Checking byte-by-byte:');
  
  for (let i = 0; i < Math.min(20, expected.length); i++) {
    const cp = cipherPos(i);
    if (cp >= data.length) break;
    const cipherByte = data[cp];
    const expectedChar = expected[i];
    const expectedByte = expectedChar.charCodeAt(0);
    console.log(`  pos ${i} → cipher_pos ${cp} → byte 0x${cipherByte.toString(16).padStart(2,'0')} | expected char '${expectedChar}' (0x${expectedByte.toString(16).padStart(2,'0')})`);
  }

  // STEP 6: Try to build decrypt tables from known plaintext-ciphertext pairs
  console.log('\n=== STEP 6: Reverse Engineering ===');
  // We know the encrypt tables work (Rust encrypt → API accepts).
  // So let's encrypt '{"url":"https://' and compare with the actual cipher bytes
  const testPlain = '{"url":"https://';
  const testEnc = rustExec(testPlain, 'kai-encrypt');
  const testBuf = Buffer.from(testEnc.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - testEnc.length % 4) % 4), 'base64');
  const testData = testBuf.slice(21);
  
  console.log('Our encrypt of expected plaintext:');
  for (let i = 0; i < Math.min(20, testPlain.length); i++) {
    const cp = cipherPos(i);
    if (cp >= testData.length && cp >= data.length) break;
    const ourByte = cp < testData.length ? testData[cp] : '??';
    const actualByte = cp < data.length ? data[cp] : '??';
    const match = ourByte === actualByte;
    console.log(`  pos ${i} char '${testPlain[i]}' → our_enc: 0x${typeof ourByte === 'number' ? ourByte.toString(16).padStart(2,'0') : ourByte} | actual: 0x${typeof actualByte === 'number' ? actualByte.toString(16).padStart(2,'0') : actualByte} ${match ? '✓' : '✗'}`);
  }
}

main().catch(e => console.error('Fatal:', e));
