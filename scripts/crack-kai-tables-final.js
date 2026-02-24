#!/usr/bin/env node
/**
 * Crack AnimeKai tables — FINAL approach
 * 
 * We have 118 out of ~183 positions covered from fixed/constant chars.
 * The missing 54 positions (38-91) are the video ID.
 * 
 * For DECRYPT, we need cipher_byte → char at each position.
 * The video ID chars are from [a-zA-Z0-9_-].
 * 
 * KEY INSIGHT: We can determine the video ID by fetching the MegaUp
 * embed page for each AnimeKai lid. Even though we can't decrypt the
 * AnimeKai response, we CAN:
 * 1. Get the lid from AnimeKai
 * 2. The lid corresponds to a specific MegaUp video
 * 3. Fetch the MegaUp embed page and extract the video ID from the page
 * 
 * Wait — we don't have the MegaUp URL yet (that's what we're trying to decrypt).
 * 
 * BETTER INSIGHT: The video ID constant parts (pos 38-61, 70-91 for g0)
 * are the SAME for all samples in a group. This means they're a
 * server/provider identifier, not episode-specific.
 * 
 * If we can find ANY MegaUp URL from AnimeKai (even from a cached/old response),
 * we can determine these constant parts.
 * 
 * ACTUALLY THE BEST APPROACH: Use the AnimeKai JavaScript bundle.
 * The bundle contains the encryption/decryption tables.
 * We already downloaded it: scripts/animekai-crypto-bundle-1771726946134.js
 * Let me extract the tables from it!
 */
const fs = require('fs');

// Check if we have the bundle
const bundlePath = 'scripts/animekai-crypto-bundle-1771726946134.js';
if (fs.existsSync(bundlePath)) {
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  console.log(`Bundle size: ${bundle.length} chars`);
  
  // The bundle contains the substitution tables used for encryption/decryption.
  // These are typically stored as arrays of numbers.
  // Let me search for patterns that look like substitution tables.
  
  // Look for large arrays of numbers (256 entries each)
  const arrayPattern = /\[(\d+(?:,\d+){50,})\]/g;
  let match;
  const arrays = [];
  while ((match = arrayPattern.exec(bundle)) !== null) {
    const nums = match[1].split(',').map(Number);
    if (nums.length >= 95 && nums.length <= 256) {
      arrays.push({ index: match.index, length: nums.length, first5: nums.slice(0, 5) });
    }
  }
  console.log(`Found ${arrays.length} large number arrays`);
  for (const a of arrays.slice(0, 10)) {
    console.log(`  at ${a.index}: ${a.length} nums, first5=[${a.first5}]`);
  }
} else {
  console.log('Bundle not found, skipping bundle analysis');
}

// Let me also check the extracted crypto region
const cryptoRegionPath = 'scripts/kai-crypto-region.js';
if (fs.existsSync(cryptoRegionPath)) {
  const region = fs.readFileSync(cryptoRegionPath, 'utf8');
  console.log(`\nCrypto region size: ${region.length} chars`);
  
  // Look for the shuffle/permutation function and table data
  // The tables might be encoded as hex strings or number arrays
  
  // Search for hex-like strings (potential table data)
  const hexPattern = /["']([0-9a-f]{100,})["']/gi;
  let m;
  const hexStrings = [];
  while ((m = hexPattern.exec(region)) !== null) {
    hexStrings.push({ index: m.index, length: m[1].length });
  }
  console.log(`Found ${hexStrings.length} hex strings`);
  
  // Search for base64-like strings
  const b64Pattern = /["']([A-Za-z0-9+/=]{100,})["']/g;
  const b64Strings = [];
  while ((m = b64Pattern.exec(region)) !== null) {
    b64Strings.push({ index: m.index, length: m[1].length, preview: m[1].substring(0, 30) });
  }
  console.log(`Found ${b64Strings.length} base64-like strings`);
  for (const s of b64Strings.slice(0, 5)) {
    console.log(`  at ${s.index}: ${s.length} chars, "${s.preview}..."`);
  }
}

// Let me try yet another approach: use the run-kai-shuffle.js to understand
// the permutation, then apply it to extract tables from the bundle.
// But first, let me check what the shuffle function looks like.

const shufflePath = 'scripts/run-kai-shuffle.js';
if (fs.existsSync(shufflePath)) {
  const shuffle = fs.readFileSync(shufflePath, 'utf8');
  console.log(`\nShuffle script size: ${shuffle.length} chars`);
  // Just check if it has the key function
  if (shuffle.includes('p_mLjDq')) {
    console.log('Contains p_mLjDq shuffle function');
  }
}

// OK, let me take the MOST DIRECT approach possible.
// We have 82 samples with known cipher bytes.
// We know the plaintext format exactly.
// The ONLY unknowns are:
//   1. Video ID chars at positions 38-91 (54 chars for g0, 56 for g1)
//   2. Skip value digits
//
// For the video ID, we know:
//   - Positions 38-61 are constant within g0 (24 chars)
//   - Positions 62-69 are variable (8 chars, episode-specific)
//   - Positions 70-91 are constant within g0 (22 chars)
//
// The constant parts are the SAME cipher bytes for all g0 samples.
// If we can determine what char each byte maps to at each position,
// we have the video ID prefix and suffix.
//
// For the variable parts (pos 62-69), different samples have different bytes.
// Each byte maps to a different char. If we can determine the mapping for
// even a few chars, we can start building the table.
//
// The video ID chars are from a limited set: [a-zA-Z0-9] plus maybe [-_./]
// That's about 66 possible chars.
//
// For each constant position, we have 1 cipher byte → 1 unknown char.
// We can't determine the char from just one mapping.
//
// BUT: if we can find the SAME video ID from another source (like HiAnime),
// we can determine all the chars at once.
//
// Let me try to find a MegaUp video ID that matches one of our AnimeKai samples.
// The approach:
// 1. For each AnimeKai sample, we know the query (anime name) and lid
// 2. Search for the same anime on HiAnime
// 3. Get all available servers for the same episode
// 4. If any server uses MegaUp, we get the video ID
// 5. Match the video ID to the AnimeKai sample

// But HiAnime doesn't seem to use MegaUp directly (it uses MegaCloud).
// MegaCloud and MegaUp are different services.

// ALTERNATIVE: Can we determine the video ID from the MegaUp /media/ endpoint?
// If we try fetching /media/VIDEOID for various IDs, we might find one that works.
// But we'd need to know the video ID first...

// FINAL APPROACH: Brute force the constant video ID chars.
// For each constant position, the cipher byte is known.
// The char is one of ~66 possible URL-safe chars.
// We can try each char and see if it's consistent with other data.
//
// Actually, we can use a MUCH smarter approach:
// The substitution tables are PERMUTATIONS of the byte space.
// Each position has a unique permutation.
// If we know the mapping for one char at a position, we can't determine
// the mapping for other chars (it's a random permutation).
//
// So we MUST get the actual video ID from somewhere.
// Let me try to find it by fetching the MegaUp embed page for various
// video IDs and matching the page title to known anime.

console.log('\n=== Trying to find MegaUp video IDs ===\n');

// MegaUp video IDs from old working system might still be valid.
// Let me check the old animekai-crypto.ts for any hardcoded video IDs.
const cryptoTsPath = 'app/lib/animekai-crypto.ts';
if (fs.existsSync(cryptoTsPath)) {
  const cryptoTs = fs.readFileSync(cryptoTsPath, 'utf8');
  // Look for megaup URLs
  const megaupUrls = cryptoTs.match(/megaup[^"'\s]*/g);
  if (megaupUrls) {
    console.log('MegaUp URLs in animekai-crypto.ts:');
    for (const u of megaupUrls) console.log(`  ${u}`);
  }
}

// Check test scripts for MegaUp video IDs
const testFiles = [
  'scripts/test-megaup-full.js',
  'scripts/test-megaup-extraction.js',
  'scripts/test-megaup-api.js',
  'scripts/probe-megaup.js',
];

for (const f of testFiles) {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const ids = content.match(/megaup\d*\.online\/e\/([a-zA-Z0-9_-]+)/g);
    if (ids) {
      console.log(`\nMegaUp IDs in ${f}:`);
      for (const id of [...new Set(ids)]) console.log(`  ${id}`);
    }
  }
}
