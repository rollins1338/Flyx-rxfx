#!/usr/bin/env node
/**
 * Crack AnimeKai tables v9 — Correct suffix format with arrays
 * 
 * The CORRECT format is:
 * {"url":"https:\/\/megaup22.online\/e\/VIDEO_ID","skip":{"intro":[A,B],"outro":[C,D]}}
 * 
 * NOT {"start":N,"end":N} objects, but [A,B] arrays!
 * 
 * Fixed suffix: ","skip":{"intro":[,],"outro":[,]}}
 * = 1(") + 1(,) + 1(") + 4(skip) + 1(") + 1(:) + 1({) + 1(") + 5(intro) + 1(") + 1(:) + 1([) + 1(,) + 1(]) + 1(,) + 1(") + 5(outro) + 1(") + 1(:) + 1([) + 1(,) + 1(]) + 2(}})
 * Let me just count: ","skip":{"intro":[,],"outro":[,]}}
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

console.log(`Group 0: ${g0.length} samples (shorter)`);
console.log(`Group 1: ${g1.length} samples (longer, +2)\n`);

// The suffix with ARRAYS:
// ","skip":{"intro":[A,B],"outro":[C,D]}}
const testSuffix = '","skip":{"intro":[0,0],"outro":[0,0]}}';
console.log(`Test suffix (min digits): "${testSuffix}" (${testSuffix.length} chars)`);
console.log(`Total min ptLen: 38 + 54 + ${testSuffix.length} = ${38 + 54 + testSuffix.length}`);

// Fixed part of suffix: ","skip":{"intro":[,],"outro":[,]}}
const fixedSuffix = '","skip":{"intro":[,],"outro":[,]}}';
console.log(`Fixed suffix: "${fixedSuffix}" (${fixedSuffix.length} chars)`);
console.log(`Total fixed: 38 + 54 + ${fixedSuffix.length} = ${38 + 54 + fixedSuffix.length}`);

// ptLen = 38 + videoIdLen + fixedSuffix.length + sum(digits)
// For g0: ptLen = 38 + 54 + 34 + sum(digits) = 126 + sum(digits)
// For g1: ptLen = 38 + 56 + 34 + sum(digits) = 128 + sum(digits)

// g0 ptLen range: 169-179 → sum(digits) = 43-53... that's way too many digits
// That can't be right. Let me recount.

// Actually let me count the fixed suffix more carefully:
// " , " s k i p " : { " i n t r o " : [ , ] , " o u t r o " : [ , ] } }
// 1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1
// Let me just spell it out:
const suffix = '","skip":{"intro":[,],"outro":[,]}}';
console.log(`\nSuffix chars: ${suffix.split('').map(c => `'${c}'`).join(' ')}`);
console.log(`Suffix length: ${suffix.length}`);

// Hmm, 34 chars. ptLen = 38 + 54 + 34 + digits = 126 + digits
// g0 ptLen 169 → digits = 43. That's way too many for 4 numbers.
// Something is wrong with my assumptions.

// Let me reconsider. Maybe the video ID is NOT 54 chars.
// The kai-new-tables.json said videoIdLen=54, but that was based on
// the assumption that position 92 is always ".
// 
// What if the video ID is shorter and the suffix is longer?
// Or what if the format is different?

// Let me go back to basics. We know:
// - Position 92 is constant (byte 0x44) across ALL samples
// - The prefix is 38 chars
// - So position 92 is at offset 92 from the start of plaintext
// - That's 92 - 38 = 54 chars after the prefix
// - But maybe the video ID is shorter and there's more URL structure

// Wait — what if the URL has query parameters?
// Like: https://megaup22.online/e/VIDEO_ID?k=1
// In JSON: https:\/\/megaup22.online\/e\/VIDEO_ID?k=1
// The ?k=1 would be 4 chars, making the "video ID + params" = 54 chars
// But the actual video ID would be 50 chars.

// Or maybe the URL is longer:
// https://megaup22.online/e/VIDEO_ID?k=1&ref=animekai
// That would explain the 54-char "ID" section.

// Actually, let me check: what if the format is completely different?
// What if it's NOT {"url":"...","skip":{...}} but something else?

// Let me verify the prefix more carefully.
// We know position 0 maps to '{' (byte 0xd4)
// Position 1 maps to '"' (byte 0x6b)
// Position 2 maps to 'u' (byte 0x52)
// etc.
// This gives us: {"url":"https:\/\/megaup22.online\/e\/
// That's confirmed.

// Now, position 92 maps to '"' (byte 0x44).
// What if position 92 is NOT the closing quote of the URL,
// but rather a quote in the middle of the URL?
// Like: https://megaup22.online/e/PART1"PART2
// No, that doesn't make sense in a URL.

// OR: what if the JSON has escaped characters in the video ID?
// Like: https:\/\/megaup22.online\/e\/PART1\/PART2
// The \/ would add 2 chars per slash.

// Actually, let me reconsider the whole thing.
// The prefix is: {"url":"https:\/\/megaup22.online\/e\/
// That's 38 chars. After that comes the video ID.
// Old video IDs were 26 chars. New ones might be different.
// 
// If the video ID is 26 chars, then position 64 would be the closing ".
// Let me check if position 64 is constant.

console.log('\n=== Checking various video ID lengths ===\n');

for (let vidLen = 20; vidLen <= 60; vidLen++) {
  const quotePos = 38 + vidLen; // position of closing "
  const cp = cipherPos(quotePos);
  
  const allValues = new Set();
  const g0Values = new Set();
  const g1Values = new Set();
  
  for (const s of g0) {
    if (cp < s.data.length) { allValues.add(s.data[cp]); g0Values.add(s.data[cp]); }
  }
  for (const s of g1) {
    if (cp < s.data.length) { allValues.add(s.data[cp]); g1Values.add(s.data[cp]); }
  }
  
  // Check if this position is constant (would indicate a fixed char like ")
  const marker = allValues.size === 1 ? ' ★★★ ALL CONSTANT' : 
                 g0Values.size === 1 && g1Values.size === 1 ? ' ★ BOTH GROUPS CONSTANT' :
                 g0Values.size === 1 ? ' ◆ G0 CONSTANT' :
                 g1Values.size === 1 ? ' ◇ G1 CONSTANT' : '';
  
  if (allValues.size <= 3 || marker) {
    console.log(`  vidLen=${vidLen} → quotePos=${quotePos}: all=${allValues.size} g0=${g0Values.size} g1=${g1Values.size}${marker}`);
  }
}

// Also check: what if the two groups have DIFFERENT video ID lengths?
// Group 0 might have 26-char IDs and Group 1 might have 28-char IDs.
// Let's check positions 64 and 66.

console.log('\n=== Detailed position analysis around expected quote positions ===\n');

for (let pos = 60; pos <= 100; pos++) {
  const cp = cipherPos(pos);
  const g0Values = new Set();
  const g1Values = new Set();
  
  for (const s of g0) {
    if (cp < s.data.length) g0Values.add(s.data[cp]);
  }
  for (const s of g1) {
    if (cp < s.data.length) g1Values.add(s.data[cp]);
  }
  
  const g0c = g0Values.size === 1 ? `CONST(0x${[...g0Values][0].toString(16).padStart(2,'0')})` : `${g0Values.size} vals`;
  const g1c = g1Values.size === 1 ? `CONST(0x${[...g1Values][0].toString(16).padStart(2,'0')})` : `${g1Values.size} vals`;
  
  console.log(`  pos ${pos.toString().padStart(3)}: g0=${g0c.padEnd(16)} g1=${g1c.padEnd(16)}`);
}
