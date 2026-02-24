#!/usr/bin/env node
/**
 * RETHINKING the AnimeKai encryption.
 * 
 * Key observation: ALL encrypted responses start with the SAME base64 prefix:
 * "xQm9tJfLwGhz_0Eq8S_YAHYkwp-q1PLfm50W5Wtnyd1SnPcp6jWPyFiIOMigRPPiSynOWbHeUY_yjCU--Li_5zfPowFQeBVg"
 * 
 * This is 92 base64 chars = 69 bytes. That's the HEADER.
 * 
 * After that, the responses diverge. Let me look at where they diverge
 * and what the actual variable part encodes.
 */
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scripts/kai-server-tables.json', 'utf8'));

// Group samples by anime
const byAnime = {};
for (const s of data.samples) {
  if (!byAnime[s.keyword]) byAnime[s.keyword] = [];
  byAnime[s.keyword].push(s);
}

// Find the common prefix across ALL samples
const allEnc = data.samples.map(s => s.encrypted);
let commonLen = 0;
for (let i = 0; i < allEnc[0].length; i++) {
  if (allEnc.every(e => e[i] === allEnc[0][i])) {
    commonLen = i + 1;
  } else break;
}
console.log('Common base64 prefix length:', commonLen);
console.log('Common prefix:', allEnc[0].substring(0, commonLen));

// Now look at where they diverge
console.log('\nFirst divergent chars:');
for (const s of data.samples.slice(0, 10)) {
  console.log(`  ${s.keyword}: ...${s.encrypted.substring(commonLen - 5, commonLen + 20)}`);
}

// Decode the common prefix to bytes
function b64decode(s) {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - std.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

const commonB64 = allEnc[0].substring(0, commonLen);
const commonBytes = b64decode(commonB64);
console.log('\nCommon prefix bytes:', commonBytes.length);
console.log('Common bytes hex:', [...commonBytes].map(b => b.toString(16).padStart(2, '0')).join(' '));

// Now let's look at the FULL decoded bytes for a few samples
console.log('\n=== Full byte analysis ===');
for (const s of data.samples.slice(0, 6)) {
  const buf = b64decode(s.encrypted);
  console.log(`\n${s.keyword} (lid=${s.lid}):`);
  console.log(`  Total bytes: ${buf.length}`);
  console.log(`  First 30 bytes: ${[...buf.subarray(0, 30)].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Find where bytes diverge from first sample
  const ref = b64decode(data.samples[0].encrypted);
  let divergeAt = -1;
  for (let i = 0; i < Math.min(buf.length, ref.length); i++) {
    if (buf[i] !== ref[i]) {
      divergeAt = i;
      break;
    }
  }
  console.log(`  Diverges from sample 0 at byte: ${divergeAt}`);
  if (divergeAt >= 0) {
    console.log(`  Bytes around divergence: ...${[...buf.subarray(Math.max(0, divergeAt-3), divergeAt+10)].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  }
}

// Now let's look at samples from the SAME anime but different lids
// These should have the same URL prefix but different server URLs
console.log('\n=== Same anime, different lids ===');
for (const [keyword, samples] of Object.entries(byAnime)) {
  if (samples.length < 2) continue;
  console.log(`\n${keyword}:`);
  
  const bufs = samples.map(s => b64decode(s.encrypted));
  
  // Find common bytes within this anime
  let animeCommon = 0;
  for (let i = 0; i < bufs[0].length; i++) {
    if (bufs.every(b => i < b.length && b[i] === bufs[0][i])) {
      animeCommon = i + 1;
    } else break;
  }
  console.log(`  Common bytes: ${animeCommon} (vs global: ${commonBytes.length})`);
  
  // Show the divergent part
  for (const s of samples.slice(0, 3)) {
    const buf = b64decode(s.encrypted);
    const varPart = [...buf.subarray(animeCommon, animeCommon + 20)].map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`  lid=${s.lid}: ${varPart}... (total ${buf.length} bytes)`);
  }
  
  if (keyword === 'bleach') break; // Just show one for now
}

// CRITICAL: Let me check if the encrypted response is actually TWO parts:
// 1. A fixed header/envelope
// 2. The actual encrypted URL
// And maybe the "encryption" is just the URL part, not the whole thing

// Let's look at the structure more carefully
// The known plaintext is {"url":"https://..."}
// Let's see if the variable part (after common prefix) could be the URL

console.log('\n=== Analyzing variable part ===');
for (const s of data.samples.slice(0, 4)) {
  const buf = b64decode(s.encrypted);
  const varBytes = buf.subarray(commonBytes.length);
  console.log(`\n${s.keyword} (lid=${s.lid}):`);
  console.log(`  Variable bytes: ${varBytes.length}`);
  console.log(`  As ASCII: ${[...varBytes].map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('')}`);
  
  // Try: maybe the variable part is base64 encoded again?
  const varB64 = varBytes.toString('utf8');
  console.log(`  As UTF8: ${varB64.substring(0, 80)}`);
  
  // Try decoding the variable part as base64
  try {
    const decoded = b64decode(varB64);
    console.log(`  Decoded: ${decoded.toString('utf8').substring(0, 80)}`);
  } catch(e) {
    console.log(`  Not valid base64`);
  }
}

// Let me also check: what if the ENTIRE encrypted string is NOT base64 of raw bytes,
// but rather a custom encoding where each base64 character represents something?
// The base64 alphabet has 64 chars. Maybe each char maps to a different char via the permutation.

console.log('\n=== Base64 character-level analysis ===');
// The common prefix in base64 is the same for all samples
// After that, the base64 chars differ
// Let's see if the differing base64 chars correspond to URL chars

// For bleach samples, the URLs should contain "megacloud" or "vidplay" or similar
// Let's compare two bleach samples character by character in base64
const b1 = data.samples[0].encrypted; // bleach lid dIaz9KKh5Q
const b2 = data.samples[1].encrypted; // bleach lid dIaz9KKh5A

console.log('\nComparing two bleach samples (base64 level):');
console.log('Lengths:', b1.length, b2.length);

let firstDiff = -1;
for (let i = 0; i < Math.min(b1.length, b2.length); i++) {
  if (b1[i] !== b2[i]) {
    if (firstDiff === -1) firstDiff = i;
  }
}
console.log('First base64 char difference at:', firstDiff);
console.log('b1 around diff:', b1.substring(firstDiff - 5, firstDiff + 30));
console.log('b2 around diff:', b2.substring(firstDiff - 5, firstDiff + 30));

// Count total differences
let diffs = 0;
for (let i = 0; i < Math.min(b1.length, b2.length); i++) {
  if (b1[i] !== b2[i]) diffs++;
}
console.log('Total base64 char differences:', diffs, 'out of', Math.min(b1.length, b2.length));
