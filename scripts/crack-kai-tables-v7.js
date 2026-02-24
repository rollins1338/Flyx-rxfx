#!/usr/bin/env node
/**
 * Crack AnimeKai tables v7 — Build tables from suffix structure
 * 
 * We know:
 * - Prefix (pos 0-37): {"url":"https:\/\/megaup22.online\/e\/
 * - Video ID (pos 38-91 for group0, 38-93 for group1): UNKNOWN
 * - Position 92 (group0) or 94 (group1): " (closing quote)
 * - Suffix: ,"skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
 * 
 * The suffix has fixed characters at known positions.
 * We can build table entries for ALL fixed suffix positions.
 * Combined with the prefix entries, this gives us ~100+ table entries.
 * 
 * For the video ID positions, we need a different approach.
 */
const fs = require('fs');

// Load samples
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
const group0 = [], group1 = [];
const byte93vals = {};
for (const s of samples) {
  if (cp93 < s.data.length) {
    const v = s.data[cp93];
    if (!byte93vals[v]) byte93vals[v] = [];
    byte93vals[v].push(s);
  }
}
const groups = Object.values(byte93vals).sort((a, b) => {
  const avgA = a.reduce((sum, s) => sum + s.ptLen, 0) / a.length;
  const avgB = b.reduce((sum, s) => sum + s.ptLen, 0) / b.length;
  return avgA - avgB;
});
const g0 = groups[0]; // shorter ptLen
const g1 = groups[1]; // longer ptLen (+2)

console.log(`Group 0: ${g0.length} samples`);
console.log(`Group 1: ${g1.length} samples\n`);

// ═══════════════════════════════════════════════════════════
// Build the suffix template
// ═══════════════════════════════════════════════════════════

// The suffix after the video ID is:
// ","skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
// 
// Let's map each character to its position.
// For Group 0: video ID ends at position 91, so:
//   pos 92: "
//   pos 93: ,
//   pos 94: "
//   pos 95: s
//   pos 96: k
//   pos 97: i
//   pos 98: p
//   pos 99: "
//   pos 100: :
//   pos 101: {
//   pos 102: "
//   pos 103: i
//   pos 104: n
//   pos 105: t
//   pos 106: r
//   pos 107: o
//   pos 108: "
//   pos 109: :
//   pos 110: {
//   pos 111: "
//   pos 112: s
//   pos 113: t
//   pos 114: a
//   pos 115: r
//   pos 116: t
//   pos 117: "
//   pos 118: :
//   pos 119+: DIGITS (intro start value)
//   then: ,
//   then: "end":
//   then: DIGITS (intro end value)
//   then: },"outro":{"start":
//   then: DIGITS (outro start value)
//   then: ,"end":
//   then: DIGITS (outro end value)
//   then: }}}

// For Group 1: video ID ends at position 93, so everything shifts by 2:
//   pos 94: "
//   pos 95: ,
//   pos 96: "
//   etc.

// Let's verify by checking if the cipher bytes at the fixed suffix positions
// are constant within each group.

const prefix = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
const suffixTemplate = '","skip":{"intro":{"start":';
// After the first number: ,"end":
// After the second number: },"outro":{"start":
// After the third number: ,"end":
// After the fourth number: }}}

console.log('=== Verifying suffix template for Group 0 ===\n');

// Group 0: suffix starts at position 92
const g0SuffixStart = 92;
const fixedSuffix = '","skip":{"intro":{"start":';

for (let i = 0; i < fixedSuffix.length; i++) {
  const pos = g0SuffixStart + i;
  const cp = cipherPos(pos);
  const char = fixedSuffix[i];
  const charCode = char.charCodeAt(0);
  
  const values = new Set();
  for (const s of g0) {
    if (cp < s.data.length) values.add(s.data[cp]);
  }
  
  const isConstant = values.size === 1;
  const byte = isConstant ? [...values][0] : null;
  
  console.log(`  pos ${pos}: '${char}' (${charCode}) → ${isConstant ? `constant 0x${byte.toString(16).padStart(2,'0')}` : `${values.size} values`}`);
}

// Now let's also check Group 1 with offset +2
console.log('\n=== Verifying suffix template for Group 1 (offset +2) ===\n');

const g1SuffixStart = 94;
for (let i = 0; i < fixedSuffix.length; i++) {
  const pos = g1SuffixStart + i;
  const cp = cipherPos(pos);
  const char = fixedSuffix[i];
  const charCode = char.charCodeAt(0);
  
  const values = new Set();
  for (const s of g1) {
    if (cp < s.data.length) values.add(s.data[cp]);
  }
  
  const isConstant = values.size === 1;
  const byte = isConstant ? [...values][0] : null;
  
  console.log(`  pos ${pos}: '${char}' (${charCode}) → ${isConstant ? `constant 0x${byte.toString(16).padStart(2,'0')}` : `${values.size} values`}`);
}

// ═══════════════════════════════════════════════════════════
// Build the FULL table from all known positions
// ═══════════════════════════════════════════════════════════

console.log('\n=== Building substitution tables ===\n');

// Tables: position → { cipherByte → plainChar }
const tables = {};

function addEntry(pos, plainChar, cipherByte) {
  if (!tables[pos]) tables[pos] = {};
  const existing = tables[pos][cipherByte];
  if (existing && existing !== plainChar) {
    console.log(`  CONFLICT at pos ${pos}: byte 0x${cipherByte.toString(16)} → '${existing}' vs '${plainChar}'`);
    return false;
  }
  tables[pos][cipherByte] = plainChar;
  return true;
}

// Add prefix entries (positions 0-37)
for (let i = 0; i < prefix.length; i++) {
  const cp = cipherPos(i);
  const char = prefix[i];
  // All samples should have the same byte at this position
  const values = new Set();
  for (const s of samples) {
    if (cp < s.data.length) values.add(s.data[cp]);
  }
  if (values.size === 1) {
    addEntry(i, char, [...values][0]);
  }
}

// Add suffix entries from Group 0
// The full suffix structure:
// pos 92: "
// pos 93-118: ,"skip":{"intro":{"start":
// pos 119+: digits (variable)
// After digits: ,"end":
// After more digits: },"outro":{"start":
// After more digits: ,"end":
// After more digits: }}}

// For the fixed parts, we can add entries from Group 0
const g0FixedParts = [
  { start: 92, text: '","skip":{"intro":{"start":' },
];

for (const part of g0FixedParts) {
  for (let i = 0; i < part.text.length; i++) {
    const pos = part.start + i;
    const cp = cipherPos(pos);
    const char = part.text[i];
    
    const values = new Set();
    for (const s of g0) {
      if (cp < s.data.length) values.add(s.data[cp]);
    }
    
    if (values.size === 1) {
      addEntry(pos, char, [...values][0]);
    }
  }
}

// Same for Group 1 (offset +2)
const g1FixedParts = [
  { start: 94, text: '","skip":{"intro":{"start":' },
];

for (const part of g1FixedParts) {
  for (let i = 0; i < part.text.length; i++) {
    const pos = part.start + i;
    const cp = cipherPos(pos);
    const char = part.text[i];
    
    const values = new Set();
    for (const s of g1) {
      if (cp < s.data.length) values.add(s.data[cp]);
    }
    
    if (values.size === 1) {
      addEntry(pos, char, [...values][0]);
    }
  }
}

// Now let's find the END of the response
// The last characters should be }}}
// For the longest samples (ptLen=179 in g0, ptLen=181 in g1):
// Last 3 positions: }}}, second-to-last 3: }}}

// For Group 0, ptLen=179: last position is 178, so }}} at 176,177,178
// For Group 1, ptLen=181: last position is 180, so }}} at 178,179,180

// Let's verify and add entries for the closing braces
console.log('Adding closing brace entries...');

// Group 0: check last 3 positions for each ptLen
for (const s of g0) {
  const lastPos = s.ptLen - 1;
  // }}} at positions lastPos-2, lastPos-1, lastPos
  for (let offset = 0; offset < 3; offset++) {
    const pos = lastPos - 2 + offset;
    const cp = cipherPos(pos);
    if (cp < s.data.length) {
      addEntry(pos, '}', s.data[cp]);
    }
  }
}

// Group 1: same
for (const s of g1) {
  const lastPos = s.ptLen - 1;
  for (let offset = 0; offset < 3; offset++) {
    const pos = lastPos - 2 + offset;
    const cp = cipherPos(pos);
    if (cp < s.data.length) {
      addEntry(pos, '}', s.data[cp]);
    }
  }
}

// Now let's also figure out the intermediate fixed parts
// After "start":N, we have ,"end":N},"outro":{"start":N,"end":N}}}
// 
// The tricky part is that N is variable length (1-4 digits).
// But we can work backwards from the end.
// 
// From the end: }}}
// Before that: N (outro end digits)
// Before that: ,"end":
// Before that: N (outro start digits)  
// Before that: },"outro":{"start":
// Before that: N (intro end digits)
// Before that: ,"end":
// Before that: N (intro start digits)
// Before that: ,"skip":{"intro":{"start":

// Working backwards from the end for Group 0:
// Last 3 chars: }}} (positions ptLen-3 to ptLen-1)
// Before that: variable digits (outro end)
// Before digits: ,"end": (7 chars)
// Before that: variable digits (outro start)
// Before digits: },"outro":{"start": (20 chars)
// Before that: variable digits (intro end)
// Before digits: ,"end": (7 chars)
// Before that: variable digits (intro start)
// Before digits: ,"skip":{"intro":{"start": (27 chars, starting at pos 92)

// Total fixed chars in suffix: 1(") + 26(,"skip":{"intro":{"start":) + 7(,"end":) + 20(},"outro":{"start":) + 7(,"end":) + 3(}}}) = 64
// Variable: 4 numbers
// suffix_len = 64 + sum(digit_counts)
// ptLen = 38 + videoIdLen + suffix_len = 38 + 54 + 64 + digits = 156 + digits

// For ptLen=169: digits = 13
// For ptLen=179: digits = 23

// Let's work backwards from the end to find more fixed positions
console.log('\nWorking backwards from end...');

// For each sample, the last 3 chars are }}}
// Before that, we need to find where ,"end": starts (going backwards)
// The pattern before }}} is: DIGITS + }}}
// Before the digits: ,"end":
// Before that: DIGITS
// Before those digits: },"outro":{"start":

// Let's find the fixed chars by looking at constant bytes working backwards

// For Group 0 samples with ptLen=179 (the most common):
const g0_179 = g0.filter(s => s.ptLen === 179);
console.log(`\nGroup 0, ptLen=179: ${g0_179.length} samples`);

if (g0_179.length >= 3) {
  // Check each position from the end
  for (let posFromEnd = 0; posFromEnd < 50; posFromEnd++) {
    const pos = 178 - posFromEnd; // ptLen-1 = 178
    const cp = cipherPos(pos);
    const values = new Set();
    for (const s of g0_179) {
      if (cp < s.data.length) values.add(s.data[cp]);
    }
    if (values.size === 1) {
      console.log(`  pos ${pos} (end-${posFromEnd}): constant 0x${[...values][0].toString(16).padStart(2,'0')}`);
    } else {
      console.log(`  pos ${pos} (end-${posFromEnd}): ${values.size} values (variable)`);
    }
  }
}

// Count total entries
let totalEntries = 0;
for (const pos of Object.keys(tables)) {
  totalEntries += Object.keys(tables[pos]).length;
}
console.log(`\nTotal table entries so far: ${totalEntries}`);
console.log(`Positions covered: ${Object.keys(tables).length}`);

// Save the tables
const output = {
  timestamp: new Date().toISOString(),
  totalEntries,
  positionsCovered: Object.keys(tables).length,
  tables,
};
fs.writeFileSync('scripts/kai-tables-v7.json', JSON.stringify(output, null, 2));
console.log('Saved to scripts/kai-tables-v7.json');
