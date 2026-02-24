#!/usr/bin/env node
/**
 * Crack AnimeKai tables v12 — Build FULL 183-position tables
 * 
 * Key insight: We know the EXACT plaintext format for every sample.
 * The only unknowns are:
 *   1. The 8 variable video ID chars (pos 62-69 for g0, 64-71 for g1)
 *   2. The 3 skip numbers (intro_end, outro_start, outro_end)
 * 
 * For constant positions, we can directly build table entries.
 * For digit positions, we can determine the digits by trying all
 * possible (lenA, lenB, lenC) combinations and checking consistency.
 * 
 * For video ID chars, we can use the fact that video IDs contain
 * only alphanumeric chars + some special chars.
 */
const fs = require('fs');

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

// Load existing samples
const existing = JSON.parse(
  fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
const samples = existing.samples.map(s => ({
  ...s,
  enc: Buffer.from(s.cipherHex, 'hex'), // encrypted block (no header)
}));

console.log(`Loaded ${samples.length} samples`);

// Split into groups by cipher byte at position 93
const cp93 = cipherPos(93);
const byByte93 = {};
for (const s of samples) {
  const v = s.enc[cp93];
  if (!byByte93[v]) byByte93[v] = [];
  byByte93[v].push(s);
}
const sorted = Object.values(byByte93).sort((a, b) => {
  const avgA = a.reduce((s, x) => s + x.ptLen, 0) / a.length;
  const avgB = b.reduce((s, x) => s + x.ptLen, 0) / b.length;
  return avgA - avgB;
});
const g0 = sorted[0]; // shorter ptLen group
const g1 = sorted[1]; // longer ptLen group (+2)
console.log(`g0: ${g0.length} samples, g1: ${g1.length} samples`);

// ═══════════════════════════════════════════════════════════
// KNOWN PLAINTEXT STRUCTURE
// ═══════════════════════════════════════════════════════════
// 
// {"url":"https:\/\/megaup22.online\/e\/VIDEOID","skip":{"intro":{"start":0,"end":A},"outro":{"start":B,"end":C}}}
//
// For g0: VIDEOID is 54 chars (pos 38-91), suffix starts at pos 93
// For g1: VIDEOID is 56 chars (pos 38-93), suffix starts at pos 95
// pos 92 (g0) / pos 94 (g1) = " (closing quote)
//
// Suffix: ,"skip":{"intro":{"start":0,"end":A},"outro":{"start":B,"end":C}}}
// where A, B, C are integer values (variable number of digits)
//
// Fixed suffix template (without A,B,C digits):
// ,"skip":{"intro":{"start":0,"end":},"outro":{"start":,"end":}}}
// = 62 chars
//
// For g0: suffixLen = ptLen - 93, totalDigits = suffixLen - 62
// For g1: suffixLen = ptLen - 95, totalDigits = suffixLen - 62

const PREFIX = '{"url":"https:\\/\\/megaup22.online\\/e\\/';

// Build the FULL plaintext for a sample given digit lengths
function buildPlaintext(isG1, lenA, lenB, lenC) {
  // Returns array of { pos, char } for all FIXED positions
  const suffixStart = isG1 ? 95 : 93;
  const quotePos = isG1 ? 94 : 92;
  const fixed = [];
  
  // Prefix (pos 0-37)
  for (let i = 0; i < PREFIX.length; i++) {
    fixed.push({ pos: i, char: PREFIX[i] });
  }
  
  // Closing quote
  fixed.push({ pos: quotePos, char: '"' });
  
  // Suffix
  let offset = 0;
  const suffixStr = ',"skip":{"intro":{"start":';
  for (const ch of suffixStr) {
    fixed.push({ pos: suffixStart + offset, char: ch });
    offset++;
  }
  // '0' for intro_start
  fixed.push({ pos: suffixStart + offset, char: '0' });
  offset++;
  // ,"end":
  for (const ch of ',"end":') {
    fixed.push({ pos: suffixStart + offset, char: ch });
    offset++;
  }
  // A digits (skip)
  offset += lenA;
  // },"outro":{"start":
  for (const ch of '},"outro":{"start":') {
    fixed.push({ pos: suffixStart + offset, char: ch });
    offset++;
  }
  // B digits (skip)
  offset += lenB;
  // ,"end":
  for (const ch of ',"end":') {
    fixed.push({ pos: suffixStart + offset, char: ch });
    offset++;
  }
  // C digits (skip)
  offset += lenC;
  // }}}
  for (const ch of '}}}') {
    fixed.push({ pos: suffixStart + offset, char: ch });
    offset++;
  }
  
  return fixed;
}

// ═══════════════════════════════════════════════════════════
// DETERMINE DIGIT DISTRIBUTION FOR EACH SAMPLE
// ═══════════════════════════════════════════════════════════

// For each sample, try all valid (lenA, lenB, lenC) combinations.
// Score each by checking if the cipher bytes at fixed positions
// are consistent (same byte always maps to same char at that position).

// First pass: build initial table from positions we're 100% sure about
const tables = {}; // tables[pos] = Map<byte, char>

function addEntry(pos, byte, char) {
  if (byte === undefined) return false;
  if (!tables[pos]) tables[pos] = new Map();
  const existing = tables[pos].get(byte);
  if (existing !== undefined && existing !== char) return false; // conflict
  tables[pos].set(byte, char);
  return true;
}

// Add prefix entries (these are 100% certain)
for (let i = 0; i < PREFIX.length; i++) {
  const byte = samples[0].enc[cipherPos(i)];
  addEntry(i, byte, PREFIX[i]);
}

// Add closing quote at pos 92 (g0) and pos 94 (g1)
addEntry(92, g0[0].enc[cipherPos(92)], '"');
addEntry(94, g1[0].enc[cipherPos(94)], '"');

// Add the first 26 chars of suffix (,"skip":{"intro":{"start":)
const SUFFIX_PREFIX = ',"skip":{"intro":{"start":';
for (let i = 0; i < SUFFIX_PREFIX.length; i++) {
  // g0: suffix starts at 93
  addEntry(93 + i, g0[0].enc[cipherPos(93 + i)], SUFFIX_PREFIX[i]);
  // g1: suffix starts at 95
  addEntry(95 + i, g1[0].enc[cipherPos(95 + i)], SUFFIX_PREFIX[i]);
}

// Add '0' at pos 119 (g0) and 121 (g1) — intro_start = 0
addEntry(119, g0[0].enc[cipherPos(119)], '0');
addEntry(121, g1[0].enc[cipherPos(121)], '0');

// Add ,"end": at pos 120-126 (g0) and 122-128 (g1)
const END_STR = ',"end":';
for (let i = 0; i < END_STR.length; i++) {
  addEntry(120 + i, g0[0].enc[cipherPos(120 + i)], END_STR[i]);
  addEntry(122 + i, g1[0].enc[cipherPos(122 + i)], END_STR[i]);
}

console.log(`\nInitial table entries: ${[...Object.values(tables)].reduce((s, m) => s + m.size, 0)}`);

// Now try all (lenA, lenB, lenC) for each sample and find the best fit
function findBestDistribution(sample, isG1) {
  const suffixStart = isG1 ? 95 : 93;
  const suffixLen = sample.ptLen - suffixStart;
  const totalDigits = suffixLen - 62;
  
  if (totalDigits < 3 || totalDigits > 30) return null;
  
  let bestScore = -1;
  let bestCombo = null;
  let bestConflicts = Infinity;
  
  for (let lenA = 1; lenA <= Math.min(totalDigits - 2, 8); lenA++) {
    for (let lenB = 1; lenB <= Math.min(totalDigits - lenA - 1, 8); lenB++) {
      const lenC = totalDigits - lenA - lenB;
      if (lenC < 1 || lenC > 8) continue;
      
      const fixedPositions = buildPlaintext(isG1, lenA, lenB, lenC);
      let matches = 0;
      let conflicts = 0;
      
      for (const { pos, char } of fixedPositions) {
        const byte = sample.enc[cipherPos(pos)];
        if (byte === undefined) continue;
        
        if (tables[pos]) {
          const existing = tables[pos].get(byte);
          if (existing === char) matches++;
          else if (existing !== undefined && existing !== char) conflicts++;
        }
      }
      
      if (conflicts < bestConflicts || (conflicts === bestConflicts && matches > bestScore)) {
        bestScore = matches;
        bestConflicts = conflicts;
        bestCombo = { lenA, lenB, lenC };
      }
    }
  }
  
  return bestConflicts === 0 ? bestCombo : null;
}

// Iteratively determine distributions and add table entries
console.log('\nDetermining digit distributions...');

let iterations = 0;
let totalResolved = 0;

while (iterations < 10) {
  iterations++;
  let newEntries = 0;
  let resolved = 0;
  
  for (const s of [...g0, ...g1]) {
    const isG1 = g1.includes(s);
    const combo = findBestDistribution(s, isG1);
    if (!combo) continue;
    
    resolved++;
    const fixedPositions = buildPlaintext(isG1, combo.lenA, combo.lenB, combo.lenC);
    
    for (const { pos, char } of fixedPositions) {
      const byte = s.enc[cipherPos(pos)];
      if (byte === undefined) continue;
      if (!tables[pos]) tables[pos] = new Map();
      if (!tables[pos].has(byte)) {
        tables[pos].set(byte, char);
        newEntries++;
      }
    }
  }
  
  totalResolved = resolved;
  console.log(`  Iteration ${iterations}: resolved ${resolved}/${samples.length} samples, +${newEntries} entries`);
  
  if (newEntries === 0) break;
}

// Now extract digit mappings from the resolved samples
console.log('\n=== Extracting digit mappings ===\n');

// For each resolved sample, the digit positions contain digits 0-9.
// We can collect cipher_byte → possible_digit mappings.
const digitCandidates = {}; // digitCandidates[pos] = Map<byte, Set<digit>>

for (const s of [...g0, ...g1]) {
  const isG1 = g1.includes(s);
  const combo = findBestDistribution(s, isG1);
  if (!combo) continue;
  
  const suffixStart = isG1 ? 95 : 93;
  const { lenA, lenB, lenC } = combo;
  
  // Digit positions for A (intro_end)
  const aStart = suffixStart + 27 + 7; // after "start":0,"end":
  for (let i = 0; i < lenA; i++) {
    const pos = aStart + i;
    const byte = s.enc[cipherPos(pos)];
    if (byte === undefined) continue;
    if (!digitCandidates[pos]) digitCandidates[pos] = new Map();
    if (!digitCandidates[pos].has(byte)) digitCandidates[pos].set(byte, new Set());
    // We know it's a digit but don't know which one yet
  }
  
  // Digit positions for B (outro_start)
  const bStart = aStart + lenA + 19; // after },"outro":{"start":
  for (let i = 0; i < lenB; i++) {
    const pos = bStart + i;
    const byte = s.enc[cipherPos(pos)];
    if (byte === undefined) continue;
    if (!digitCandidates[pos]) digitCandidates[pos] = new Map();
    if (!digitCandidates[pos].has(byte)) digitCandidates[pos].set(byte, new Set());
  }
  
  // Digit positions for C (outro_end)
  const cStart = bStart + lenB + 7; // after ,"end":
  for (let i = 0; i < lenC; i++) {
    const pos = cStart + i;
    const byte = s.enc[cipherPos(pos)];
    if (byte === undefined) continue;
    if (!digitCandidates[pos]) digitCandidates[pos] = new Map();
    if (!digitCandidates[pos].has(byte)) digitCandidates[pos].set(byte, new Set());
  }
}

// Count what we have
let totalTableEntries = 0;
let positionsCovered = 0;
for (const pos in tables) {
  positionsCovered++;
  totalTableEntries += tables[pos].size;
}

console.log(`Fixed-char table entries: ${totalTableEntries} across ${positionsCovered} positions`);
console.log(`Digit candidate positions: ${Object.keys(digitCandidates).length}`);

// For digit positions, we know the byte maps to SOME digit (0-9).
// We can add all 10 possibilities and narrow down later.
// Actually, let's just mark them and move on to building the Rust tables.

// ═══════════════════════════════════════════════════════════
// BUILD COMPLETE TABLES FOR RUST
// ═══════════════════════════════════════════════════════════

// For each position 0-182, we need a mapping: ASCII char (0-127) → cipher byte
// The ENCRYPT table maps: plaintext_char → cipher_byte
// We've been collecting: cipher_byte → plaintext_char (DECRYPT direction)
// For Rust, we need ENCRYPT tables (char → byte) since that's what animekai_tables.rs uses.

// Convert our decrypt mappings to encrypt mappings
const encryptTables = {}; // encryptTables[pos][ascii] = cipherByte

for (const [posStr, mapping] of Object.entries(tables)) {
  const pos = parseInt(posStr);
  if (!encryptTables[pos]) encryptTables[pos] = {};
  for (const [byte, char] of mapping) {
    const ascii = char.charCodeAt(0);
    if (ascii < 128) {
      encryptTables[pos][ascii] = byte;
    }
  }
}

// Print coverage
console.log('\n=== Table Coverage ===\n');
const allPositions = new Set([
  ...Object.keys(encryptTables).map(Number),
  ...Object.keys(digitCandidates).map(Number),
]);
const maxPos = Math.max(...allPositions);
console.log(`Max position: ${maxPos}`);
console.log(`Positions with encrypt entries: ${Object.keys(encryptTables).length}`);

// For positions we DON'T have entries for, list them
const missing = [];
for (let i = 0; i <= maxPos; i++) {
  if (!encryptTables[i] || Object.keys(encryptTables[i]).length === 0) {
    missing.push(i);
  }
}
console.log(`Missing positions: ${missing.join(', ')}`);

// Save results
const output = {
  timestamp: new Date().toISOString(),
  totalSamples: samples.length,
  resolved: totalResolved,
  positionsCovered: Object.keys(encryptTables).length,
  maxPosition: maxPos,
  missingPositions: missing,
  // Encrypt tables: pos -> { ascii -> cipherByte }
  encryptTables,
  // Decrypt tables: pos -> { cipherByte -> char }
  decryptTables: {},
};

for (const [posStr, mapping] of Object.entries(tables)) {
  output.decryptTables[posStr] = {};
  for (const [byte, char] of mapping) {
    output.decryptTables[posStr][byte] = char;
  }
}

fs.writeFileSync('scripts/kai-tables-v12.json', JSON.stringify(output, null, 2));
console.log('\nSaved to scripts/kai-tables-v12.json');
