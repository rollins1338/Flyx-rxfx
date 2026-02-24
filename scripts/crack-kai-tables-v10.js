#!/usr/bin/env node
/**
 * Crack AnimeKai tables v10 — Determine exact video ID length
 * 
 * Key insight: positions 70-91 are constant within g0 but different from g1.
 * These could be part of the suffix (not the video ID) if the suffix
 * contains content that differs between sub/dub servers.
 * 
 * The video ID might be only 24-32 chars, not 54.
 * The "constant but different between groups" section could be
 * part of the JSON response that varies per server type.
 */
const fs = require('fs');

const existing = JSON.parse(fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
const samples = existing.samples.map(s => ({
  ...s,
  data: Buffer.from(s.cipherHex, 'hex'),
}));

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

// Split into groups
const cp93 = cipherPos(93);
const byByte93 = {};
for (const s of samples) {
  if (cp93 < s.data.length) {
    const v = s.data[cp93];
    if (!byByte93[v]) byByte93[v] = [];
    byByte93[v].push(s);
  }
}
const sortedGroups = Object.values(byByte93).sort((a, b) => {
  const avgA = a.reduce((sum, s) => sum + s.ptLen, 0) / a.length;
  const avgB = b.reduce((sum, s) => sum + s.ptLen, 0) / b.length;
  return avgA - avgB;
});
const g0 = sortedGroups[0];
const g1 = sortedGroups[1];

// Let's look at the FULL position map more carefully
// Group samples by lid to see which positions vary per episode

console.log('=== Per-lid analysis for Group 0 ===\n');

const g0ByLid = {};
for (const s of g0) {
  if (!g0ByLid[s.lid]) g0ByLid[s.lid] = [];
  g0ByLid[s.lid].push(s);
}

// For each position, check if it varies across different lids
// (same lid = same episode = same video ID)
const g0Lids = Object.keys(g0ByLid);
console.log(`Group 0 has ${g0Lids.length} unique lids\n`);

// Get one sample per lid
const g0Representatives = g0Lids.map(lid => g0ByLid[lid][0]);

// For each position, check how many unique values across different lids
console.log('Position variability across different episodes (lids):');
for (let pos = 38; pos <= 130; pos++) {
  const cp = cipherPos(pos);
  const values = new Set();
  let count = 0;
  for (const s of g0Representatives) {
    if (cp < s.data.length) {
      values.add(s.data[cp]);
      count++;
    }
  }
  if (count < 3) continue;
  
  const marker = values.size === 1 ? 'CONST' : 
                 values.size <= 3 ? `${values.size} vals` :
                 `${values.size} vals (VARIABLE)`;
  
  if (values.size <= 3 || pos <= 42 || (pos >= 58 && pos <= 75) || pos >= 125) {
    console.log(`  pos ${pos.toString().padStart(3)}: ${marker.padEnd(20)} [${[...values].slice(0,5).map(v => '0x'+v.toString(16).padStart(2,'0')).join(',')}${values.size > 5 ? ',...' : ''}]`);
  }
}

// Now let's check: within the SAME lid, do any positions vary?
// (This would indicate digit positions in the suffix that change per request)
console.log('\n=== Same-lid variability (suffix digit positions) ===\n');

// Find lids with multiple samples
const multiSampleLids = Object.entries(g0ByLid).filter(([_, ss]) => ss.length > 1);
console.log(`Lids with multiple samples: ${multiSampleLids.length}`);

// Hmm, each lid appears only once in the existing samples.
// Let me check the fresh samples from v4 instead.

// Actually, let me just look at the ptLen distribution more carefully.
// If the suffix has the format ","skip":{"intro":[A,B],"outro":[C,D]}}
// then the suffix length = 36 + sum(digits of A,B,C,D)
// 
// For g0: ptLen = 38 + videoIdLen + suffixLen
// If videoIdLen = 32 (positions 38-69):
//   suffixLen = ptLen - 70
//   For ptLen=169: suffixLen = 99
//   Fixed suffix = 36, so digits = 63. Still too many.
//
// If videoIdLen = 24 (positions 38-61):
//   suffixLen = ptLen - 62
//   For ptLen=169: suffixLen = 107
//   Fixed suffix = 36, so digits = 71. Way too many.
//
// Something is fundamentally wrong with my suffix assumption.
// The suffix must be much longer than I think.

// Let me try a completely different approach: just map out ALL positions
// and see which are constant vs variable, without assuming any format.

console.log('\n=== Complete position map ===\n');

// For ALL samples (both groups), find constant positions
const maxPtLen = Math.max(...samples.map(s => s.ptLen));
console.log(`Max ptLen: ${maxPtLen}`);

// For each position, categorize:
// - ALL_CONST: same byte in all samples
// - GROUP_CONST: same byte within each group, different between groups
// - VARIABLE: varies within at least one group
// - DIGIT_LIKE: varies but only a few values (likely digits)

const posInfo = [];
for (let pos = 0; pos < maxPtLen; pos++) {
  const cp = cipherPos(pos);
  const g0Vals = new Set();
  const g1Vals = new Set();
  
  for (const s of g0) {
    if (cp < s.data.length) g0Vals.add(s.data[cp]);
  }
  for (const s of g1) {
    if (cp < s.data.length) g1Vals.add(s.data[cp]);
  }
  
  let type;
  if (g0Vals.size === 1 && g1Vals.size === 1 && [...g0Vals][0] === [...g1Vals][0]) {
    type = 'ALL_CONST';
  } else if (g0Vals.size === 1 && g1Vals.size === 1) {
    type = 'GROUP_CONST';
  } else if (g0Vals.size === 1 || g1Vals.size === 1) {
    type = 'PARTIAL_CONST';
  } else if (g0Vals.size <= 10 && g1Vals.size <= 10) {
    type = 'LOW_VAR';
  } else {
    type = 'HIGH_VAR';
  }
  
  posInfo.push({ pos, type, g0Size: g0Vals.size, g1Size: g1Vals.size });
}

// Print runs of same type
let currentType = null;
let runStart = 0;
for (let i = 0; i <= posInfo.length; i++) {
  const type = i < posInfo.length ? posInfo[i].type : 'END';
  if (type !== currentType) {
    if (currentType !== null) {
      const runLen = i - runStart;
      const detail = posInfo.slice(runStart, i).map(p => `${p.g0Size}/${p.g1Size}`).join(',');
      console.log(`  pos ${runStart.toString().padStart(3)}-${(i-1).toString().padStart(3)} (${runLen.toString().padStart(2)} chars): ${currentType.padEnd(15)} g0/g1 vals: ${detail.substring(0, 80)}`);
    }
    currentType = type;
    runStart = i;
  }
}

// Now let's figure out the actual suffix format.
// The key is: what are the GROUP_CONST positions after the variable video ID?
// These positions have the same char within each group but different between groups.
// This means the plaintext at these positions is DIFFERENT between the two groups.
// 
// If the suffix is the same for both groups (same JSON structure),
// then GROUP_CONST positions in the suffix would mean the suffix
// contains different VALUES (not structure) between groups.
// 
// But wait — if the suffix is ","skip":{"intro":[A,B],"outro":[C,D]}}
// and A,B,C,D are the same for both groups (same episode), then
// the suffix should be ALL_CONST, not GROUP_CONST.
// 
// Unless the intro/outro values differ between sub and dub servers!
// That would explain GROUP_CONST positions in the suffix.

// Actually, the GROUP_CONST positions after the variable part (pos 70-91 for g0)
// could be the SECOND HALF of the video ID. The video ID has:
// - Constant prefix (same for all episodes in this group)
// - Variable middle (differs per episode)
// - Constant suffix (same for all episodes in this group)
// 
// This is consistent with video IDs like:
// PROVIDER_PREFIX + EPISODE_HASH + PROVIDER_SUFFIX
// e.g., "sub-megaup-" + "AbCdEfGh" + "-quality-1080p"

// The total video ID is 54 chars for g0 (positions 38-91).
// Constant prefix: 24 chars (pos 38-61)
// Variable: 8 chars (pos 62-69)
// Constant suffix: 22 chars (pos 70-91)

// For g1: 
// Constant prefix: 26 chars (pos 38-63)
// Variable: 8 chars (pos 64-71)
// Constant suffix: 20 chars (pos 72-91)

// So g1's video ID is 26+8+20 = 54 chars too? But g1 is 2 chars longer...
// Wait, let me recheck. g1's ptLen is g0's ptLen + 2.
// If both have 54-char video IDs, the suffix must be 2 chars longer for g1.
// But the suffix structure should be the same...

// UNLESS the video ID is 56 chars for g1:
// Constant prefix: 26 chars (pos 38-63)
// Variable: 8 chars (pos 64-71)
// Constant suffix: 22 chars (pos 72-93)
// Total: 56 chars

// Then position 94 would be the closing " for g1.
// Let me check: is position 94 constant for g1?
const cp94 = cipherPos(94);
const g1_94 = new Set();
for (const s of g1) {
  if (cp94 < s.data.length) g1_94.add(s.data[cp94]);
}
console.log(`\nPosition 94 for g1: ${g1_94.size} values [${[...g1_94].map(v => '0x'+v.toString(16).padStart(2,'0')).join(',')}]`);

// And position 92 for g0:
const cp92 = cipherPos(92);
const g0_92 = new Set();
for (const s of g0) {
  if (cp92 < s.data.length) g0_92.add(s.data[cp92]);
}
console.log(`Position 92 for g0: ${g0_92.size} values [${[...g0_92].map(v => '0x'+v.toString(16).padStart(2,'0')).join(',')}]`);

// Both should be the same byte (0x44) if they both map to "
// Position 92 maps to " with byte 0x44 (from our known tables)
// Position 94 for g1 should also map to " but with a DIFFERENT byte
// (because position 94 has a different substitution table than position 92)

// So the structure is:
// g0: prefix(38) + videoId(54, pos 38-91) + "(pos 92) + suffix
// g1: prefix(38) + videoId(56, pos 38-93) + "(pos 94) + suffix
// 
// g0 suffix starts at pos 93
// g1 suffix starts at pos 95
// 
// g0 ptLen = 38 + 54 + 1 + suffixLen = 93 + suffixLen
// g1 ptLen = 38 + 56 + 1 + suffixLen = 95 + suffixLen
// 
// g0 ptLen - g1 ptLen = -2, which matches!
// 
// For g0 ptLen=169: suffixLen = 76
// For g0 ptLen=179: suffixLen = 86
// 
// Suffix = ,"skip":{"intro":[A,B],"outro":[C,D]}}
// Fixed part: ,"skip":{"intro":[,],"outro":[,]}} = 34 chars
// Variable: 4 numbers
// suffixLen = 34 + sum(digits)
// 
// For suffixLen=76: sum(digits) = 42. STILL too many!

// OK this is clearly wrong. The suffix format must be different.
// Let me try to figure it out empirically.

// For g0, the suffix starts at position 93.
// We already verified that positions 93-118 match ,"skip":{"intro":{"start":
// That's 26 chars. So the suffix starts with ,"skip":{"intro":{"start":
// 
// Wait — I verified this earlier and it was ALL CONSTANT!
// Let me re-verify with the correct group.

console.log('\n=== Re-verifying suffix from position 93 for Group 0 ===\n');

const suffixChars = ',"skip":{"intro":{"start":';
for (let i = 0; i < suffixChars.length; i++) {
  const pos = 93 + i;
  const cp = cipherPos(pos);
  const values = new Set();
  for (const s of g0) {
    if (cp < s.data.length) values.add(s.data[cp]);
  }
  console.log(`  pos ${pos}: '${suffixChars[i]}' → ${values.size === 1 ? `CONST 0x${[...values][0].toString(16).padStart(2,'0')}` : `${values.size} values`}`);
}

// So the suffix IS ,"skip":{"intro":{"start": (with objects, not arrays!)
// That means the format is:
// ,"skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
// 
// Fixed part: ,"skip":{"intro":{"start":,"end":},"outro":{"start":,"end":}}}
// Let me count: , " s k i p " : { " i n t r o " : { " s t a r t " : , " e n d " : } , " o u t r o " : { " s t a r t " : , " e n d " : } } }
// = 1+1+4+1+1+1+1+5+1+1+1+5+1+1+1+1+3+1+1+1+1+5+1+1+1+5+1+1+1+1+3+1+1+5+1+1+1+5+1+1+3
// Let me just count the string:
const fixedSuffix2 = ',"skip":{"intro":{"start":,"end":},"outro":{"start":,"end":}}}';
console.log(`\nFixed suffix: "${fixedSuffix2}"`);
console.log(`Fixed suffix length: ${fixedSuffix2.length}`);

// g0 suffixLen = ptLen - 93
// g0 ptLen=169: suffixLen = 76
// fixedSuffix = 62 chars
// digits = 76 - 62 = 14. That's 3.5 digits per number on average.
// Typical: intro start=0(1), intro end=90(2), outro start=1300(4), outro end=1385(4) = 11 digits
// Or: intro start=0(1), intro end=100(3), outro start=1300(4), outro end=1400(4) = 12 digits
// 14 digits is reasonable! (e.g., 0, 100, 1300, 1400 = 1+3+4+4 = 12, or with larger numbers)

// For ptLen=179: suffixLen = 86, digits = 86 - 62 = 24
// 24 digits across 4 numbers = 6 per number. That's like 100000. Hmm, that's a lot.
// Unless the numbers are timestamps in milliseconds? Like 0, 90000, 1300000, 1385000
// That would be 1+5+7+7 = 20 digits. Close to 24.

// Actually wait, maybe the numbers are in SECONDS with decimals?
// Like 0, 90.5, 1300.25, 1385.75
// That would add decimal points too.

// Or maybe there are MORE fields in the skip object.
// Like: {"intro":{"start":N,"end":N,"type":"op"},"outro":{"start":N,"end":N,"type":"ed"}}
// That would add more fixed chars.

// Let me just empirically determine the suffix by checking which positions
// are constant vs variable in the g0 ptLen=179 samples.

console.log('\n=== Empirical suffix mapping for g0 ptLen=179 ===\n');

const g0_179 = g0.filter(s => s.ptLen === 179);
console.log(`${g0_179.length} samples with ptLen=179`);

for (let pos = 93; pos <= 178; pos++) {
  const cp = cipherPos(pos);
  const values = new Set();
  for (const s of g0_179) {
    if (cp < s.data.length) values.add(s.data[cp]);
  }
  const type = values.size === 1 ? 'CONST' : `${values.size} vals`;
  console.log(`  pos ${pos.toString().padStart(3)}: ${type.padEnd(10)} [${[...values].map(v => '0x'+v.toString(16).padStart(2,'0')).join(',')}]`);
}
