#!/usr/bin/env node
/**
 * Crack AnimeKai tables v14 — Get actual video IDs
 * 
 * We found old 26-char MegaUp video IDs. New ones are 54/56 chars.
 * Let me collect FRESH AnimeKai samples and simultaneously get the
 * actual MegaUp embed URL by trying to access the MegaUp page.
 * 
 * The trick: After getting the encrypted response from AnimeKai,
 * we can try to construct the MegaUp URL from what we know:
 * - The URL is https://megaup22.online/e/VIDEOID
 * - The video ID has constant prefix (24 chars) + variable (8) + constant suffix (22)
 * - We know the cipher bytes for the constant parts
 * 
 * If we can find ONE actual video ID, we can determine all constant chars.
 * 
 * APPROACH: Fetch the MegaUp /media/ endpoint for old known video IDs
 * and see if they still work. If they do, we can use them as reference.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];
const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01' };

function kaiFetch(urlPath) {
  for (const domain of KAI_DOMAINS) {
    try {
      const raw = rf(`${domain}${urlPath}`, 'fetch',
        { ...KAI_HDRS, 'Referer': `${domain}/` });
      return JSON.parse(raw);
    } catch {}
  }
  return null;
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

// Step 1: Get a fresh AnimeKai sample AND the actual MegaUp URL
// by fetching the embed page directly.
// 
// The AnimeKai /ajax/links/view response is encrypted.
// But we can try to get the MegaUp URL from the embed page itself.
// 
// Actually, the embed page IS the MegaUp page. The encrypted response
// contains the URL to the MegaUp embed page. We need to decrypt it
// to get the URL, then fetch the MegaUp page.
//
// CHICKEN AND EGG PROBLEM: We need the video ID to build tables,
// but we need the tables to decrypt the video ID.
//
// SOLUTION: Use a KNOWN working MegaUp video ID from the old system.
// The old video IDs were 26 chars. If the new format is just a longer
// version with the same structure, we might be able to find the pattern.
//
// Let me check: do the old 26-char IDs still work on MegaUp?

console.log('=== Testing old MegaUp video IDs ===\n');

const oldIds = [
  'jIrrLzj-WS2JcOLzF79O5xvpCQ',
  'k5OoeWapWS2JcOLzF79O5xvpCQ',
];

for (const id of oldIds) {
  const url = `https://megaup22.online/media/${id}`;
  const resp = rf(url);
  console.log(`/media/${id}: ${resp.substring(0, 100)}`);
}

// Step 2: Get a FRESH AnimeKai link and try to find the video ID
// by checking the MegaUp embed page title.
//
// When we fetch https://megaup22.online/e/VIDEOID, the page title
// contains the video filename. If we know what anime episode it is,
// we can match it.
//
// But we need the video ID first to fetch the page...
//
// ALTERNATIVE APPROACH: The MegaUp /media/ endpoint returns encrypted data.
// If we decrypt it with our megaup mode, we get the sources JSON.
// The sources JSON contains the stream URL.
// If we can find the same stream URL from HiAnime (via MegaCloud),
// we can match the video IDs.
//
// But MegaCloud and MegaUp are different services with different stream URLs.
//
// OK, let me try the NUCLEAR OPTION:
// 1. Get a fresh AnimeKai sample (encrypted response)
// 2. We know positions 0-37 and 92+ of the plaintext
// 3. For positions 38-91, we know the cipher bytes
// 4. Try ALL possible video ID chars at each position
// 5. For each candidate video ID, fetch the MegaUp /media/ endpoint
// 6. If it returns valid data, we found the video ID!
//
// But 54^64 is way too many combinations.
//
// SMARTER: We know the video ID has 24 constant chars + 8 variable + 22 constant.
// The constant parts are the same for ALL g0 samples.
// If we can determine the 24-char prefix and 22-char suffix,
// we only need to figure out the 8 variable chars per episode.
//
// For the 8 variable chars, there are 64^8 ≈ 2.8 × 10^14 possibilities.
// Still too many.
//
// BUT: MegaUp video IDs have a specific format.
// Old IDs: 8 variable + 18 constant = 26 chars
// New IDs: 24 constant + 8 variable + 22 constant = 54 chars
//
// The 18-char constant suffix of old IDs was "WS2JcOLzF79O5xvpCQ".
// Maybe the new 22-char constant suffix CONTAINS this old suffix.
// And the new 24-char constant prefix might be a new addition.
//
// If the new format is: NEW_PREFIX(24) + VARIABLE(8) + OLD_SUFFIX(18) + NEW_SUFFIX(4)
// Then we just need to figure out the 24-char prefix and 4-char suffix.
//
// Let me test this hypothesis by checking if the old suffix bytes match
// any part of the new constant bytes.

console.log('\n=== Checking if old suffix pattern exists in new IDs ===\n');

const oldSuffix = 'WS2JcOLzF79O5xvpCQ'; // 18 chars
console.log(`Old suffix: "${oldSuffix}" (${oldSuffix.length} chars)`);

// For g0, the constant suffix is at positions 70-91 (22 chars).
// If the old 18-char suffix is embedded in the new 22-char suffix,
// it could be at positions 70-87 or 72-89 or 74-91.

// We can't directly compare because we don't know the char→byte mapping
// for positions 70-91. But we CAN check if the byte pattern is consistent
// with the old suffix being there.

// Actually, let me try a completely different approach.
// Let me get a FRESH AnimeKai response and try to brute-force
// the video ID by using the MegaUp /media/ endpoint.
// 
// The /media/ endpoint returns {"result":"ENCRYPTED_DATA"} for valid IDs
// and something else for invalid IDs.
// 
// Wait, from the context: "Both valid AND invalid video IDs return HTTP 200 with content"
// So we can't distinguish valid from invalid IDs via /media/.
//
// But we CAN check if the decrypted data is valid JSON with sources.
// Our megaup mode does XOR decryption. If the video ID is wrong,
// the decrypted data will be garbage.

// Let me try yet another approach: extract the tables from the JS bundle.
// The bundle at scripts/animekai-crypto-bundle-1771726946134.js contains
// the encryption logic. The tables might be generated dynamically.

console.log('\n=== Analyzing bundle for table generation ===\n');

const bundle = fs.readFileSync('scripts/animekai-crypto-bundle-1771726946134.js', 'utf8');

// Search for the shuffle function name
const shuffleNames = ['p_mLjDq', 'shuffle', 'permut'];
for (const name of shuffleNames) {
  const idx = bundle.indexOf(name);
  if (idx >= 0) {
    console.log(`Found "${name}" at index ${idx}`);
    console.log(`  Context: ...${bundle.substring(Math.max(0, idx-30), idx+50)}...`);
  }
}

// Search for array patterns that could be tables
// Tables might be stored as comma-separated numbers in the bundle
const numArrayRe = /\[(\d{1,3}(?:,\d{1,3}){90,})\]/g;
let match;
let tableCount = 0;
while ((match = numArrayRe.exec(bundle)) !== null) {
  const nums = match[1].split(',').map(Number);
  if (nums.length >= 95 && nums.length <= 256 && nums.every(n => n >= 0 && n <= 255)) {
    tableCount++;
    if (tableCount <= 5) {
      console.log(`Table ${tableCount} at ${match.index}: ${nums.length} entries, first=[${nums.slice(0,5)}], max=${Math.max(...nums)}`);
    }
  }
}
console.log(`Total table-like arrays: ${tableCount}`);

// Search for the specific pattern used in AnimeKai crypto
// The crypto uses a position-dependent substitution cipher.
// The tables are likely generated from a seed/key using the shuffle function.

// Let me look for the key/seed that generates the tables
const keyPatterns = [
  /['"]([\w+/=]{20,})['"]/g,  // base64-like keys
  /key\s*[:=]\s*['"](.*?)['"]/gi,
  /secret\s*[:=]\s*['"](.*?)['"]/gi,
  /seed\s*[:=]\s*['"](.*?)['"]/gi,
];

for (const pattern of keyPatterns) {
  let m;
  const found = [];
  while ((m = pattern.exec(bundle)) !== null) {
    if (m[1].length >= 20 && m[1].length <= 200) {
      found.push({ index: m.index, value: m[1].substring(0, 50) });
    }
  }
  if (found.length > 0 && found.length < 20) {
    console.log(`\nPattern ${pattern.source}: ${found.length} matches`);
    for (const f of found.slice(0, 5)) {
      console.log(`  at ${f.index}: "${f.value}..."`);
    }
  }
}

// Let me also look at the crypto region more carefully
const region = fs.readFileSync('scripts/kai-crypto-region.js', 'utf8');

// Look for function that builds/uses tables
const funcPatterns = [
  /function\s+\w+\s*\([^)]*\)\s*\{[^}]*(?:table|cipher|encrypt|decrypt|subst)[^}]*\}/gi,
  /(?:encrypt|decrypt|encode|decode)\s*[:=]\s*function/gi,
];

for (const pattern of funcPatterns) {
  let m;
  while ((m = pattern.exec(region)) !== null) {
    console.log(`\nFunction match at ${m.index}: ${m[0].substring(0, 100)}...`);
  }
}

// Let me search for the specific obfuscated variable names used in the crypto
// The shuffle function is p_mLjDq. Let me find what calls it.
const shuffleCallRe = /p_mLjDq\s*\(/g;
let callCount = 0;
while (shuffleCallRe.exec(region) !== null) callCount++;
console.log(`\np_mLjDq called ${callCount} times in crypto region`);

// Let me find the table generation code
// It likely looks like: for each position, generate a permutation using the shuffle
const forLoopRe = /for\s*\(\s*\w+\s*=\s*0\s*;\s*\w+\s*<\s*(\d+)/g;
while ((match = forLoopRe.exec(region)) !== null) {
  const limit = parseInt(match[1]);
  if (limit >= 95 && limit <= 256) {
    console.log(`For loop with limit ${limit} at ${match.index}`);
    console.log(`  Context: ${region.substring(match.index, match.index + 100)}`);
  }
}

// ACTUALLY, let me just run the shuffle function with the right parameters
// to regenerate the tables. The run-kai-shuffle.js script already has this.
// Let me check what it does.

console.log('\n=== Running shuffle function to generate tables ===\n');

// The shuffle function takes a seed and generates a permutation.
// If we can find the seed used for each position, we can regenerate all tables.

// Let me read the shuffle script to understand the parameters
const shuffleScript = fs.readFileSync('scripts/run-kai-shuffle.js', 'utf8');

// Look for the seed/key values
const seedMatch = shuffleScript.match(/seed|key|secret/gi);
console.log(`Shuffle script mentions: ${seedMatch?.join(', ') || 'none'}`);

// Let me just execute the shuffle script and see what it outputs
try {
  const output = execFileSync('node', ['scripts/run-kai-shuffle.js'], {
    encoding: 'utf8', timeout: 10000, windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  console.log(`Shuffle output (first 500 chars):\n${output.substring(0, 500)}`);
} catch (e) {
  console.log(`Shuffle error: ${e.message?.substring(0, 200)}`);
  if (e.stdout) console.log(`Stdout: ${e.stdout.substring(0, 500)}`);
}
