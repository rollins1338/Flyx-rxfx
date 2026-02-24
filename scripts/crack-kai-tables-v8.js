#!/usr/bin/env node
/**
 * Crack AnimeKai tables v8 — Complete table builder
 * 
 * Strategy: Map the ENTIRE suffix structure by working from both ends.
 * We know the suffix is: ","skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
 * 
 * The fixed parts give us table entries. The variable parts (digits) give us
 * entries for digit characters (0-9) at those positions.
 * 
 * Combined with the prefix (38 entries), this should give us 100+ entries.
 * For the video ID positions, we'll use a different approach.
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
const g0 = sortedGroups[0]; // shorter ptLen (video ID = 54 chars)
const g1 = sortedGroups[1]; // longer ptLen (video ID = 56 chars)

// ═══════════════════════════════════════════════════════════
// Build tables from ALL known plaintext positions
// ═══════════════════════════════════════════════════════════

// tables[pos] = Map<cipherByte, plainChar>
const tables = {};

function addEntry(pos, plainChar, cipherByte) {
  if (!tables[pos]) tables[pos] = {};
  const ex = tables[pos][cipherByte];
  if (ex !== undefined && ex !== plainChar) {
    // Conflict — skip
    return false;
  }
  tables[pos][cipherByte] = plainChar;
  return true;
}

// ─── PREFIX (positions 0-37) ────────────────────────────
const prefix = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
for (let i = 0; i < prefix.length; i++) {
  const cp = cipherPos(i);
  for (const s of samples) {
    if (cp < s.data.length) {
      addEntry(i, prefix[i], s.data[cp]);
    }
  }
}

// ─── SUFFIX from Group 0 ───────────────────────────────
// Group 0: video ID is 54 chars (pos 38-91)
// Suffix starts at pos 92
// Full suffix: ","skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
// 
// Fixed part 1: ","skip":{"intro":{"start": (27 chars, pos 92-118)
// Variable: intro_start digits
// Fixed part 2: ,"end": (7 chars)
// Variable: intro_end digits
// Fixed part 3: },"outro":{"start": (20 chars)
// Variable: outro_start digits
// Fixed part 4: ,"end": (7 chars)
// Variable: outro_end digits
// Fixed part 5: }}} (3 chars)

// Add fixed part 1 from Group 0
const fixedPart1 = '","skip":{"intro":{"start":';
for (let i = 0; i < fixedPart1.length; i++) {
  const pos = 92 + i;
  const cp = cipherPos(pos);
  for (const s of g0) {
    if (cp < s.data.length) {
      addEntry(pos, fixedPart1[i], s.data[cp]);
    }
  }
}

// Add fixed part 1 from Group 1 (offset +2)
for (let i = 0; i < fixedPart1.length; i++) {
  const pos = 94 + i;
  const cp = cipherPos(pos);
  for (const s of g1) {
    if (cp < s.data.length) {
      addEntry(pos, fixedPart1[i], s.data[cp]);
    }
  }
}

// ─── Work backwards from the end ───────────────────────
// For each sample, we know the last 3 chars are }}}
// Working backwards:
// end-0, end-1, end-2: }}}
// end-3 to end-N: outro_end digits
// Then: ,"end": (7 chars)
// Then: outro_start digits
// Then: },"outro":{"start": (20 chars)
// Then: intro_end digits
// Then: ,"end": (7 chars)
// Then: intro_start digits
// Then: ,"skip":{"intro":{"start": (already covered from front)

// For each sample, let's figure out where the fixed parts are
// by using the ptLen and the known suffix structure.

// Total fixed chars in suffix: 27 + 7 + 20 + 7 + 3 = 64
// Total suffix length = 64 + sum(4 digit counts)
// suffix_len = ptLen - 92 (for g0) or ptLen - 94 (for g1)
// sum(digits) = suffix_len - 64

// We need to figure out the individual digit counts.
// The intro start/end and outro start/end values determine the digit counts.
// 
// For anime episodes, typical values:
// intro: start=0, end=90 (or similar)
// outro: start=1300, end=1400 (or similar)
// 
// But we don't know the exact values. However, we can figure out the
// digit boundaries by looking at which positions are constant vs variable
// within samples of the same ptLen.

// Let's take a different approach: for each sample, we know the total
// digit count. We can try all possible distributions of digits across
// the 4 numbers and check which one produces consistent table entries.

// Actually, let's be smarter. We know the fixed parts. Let's find them
// by scanning from the end.

console.log('=== Mapping suffix structure per sample ===\n');

function mapSuffix(s, videoIdLen) {
  const suffixStart = 38 + videoIdLen; // 92 for g0, 94 for g1
  const suffixLen = s.ptLen - suffixStart;
  const totalDigits = suffixLen - 64;
  
  // The suffix structure from the front:
  // [0..26]: ","skip":{"intro":{"start":  (27 chars)
  // [27..27+d1-1]: intro_start digits (d1 digits)
  // [27+d1..33+d1]: ,"end":  (7 chars)
  // [34+d1..34+d1+d2-1]: intro_end digits (d2 digits)
  // [34+d1+d2..53+d1+d2]: },"outro":{"start":  (20 chars)
  // [54+d1+d2..54+d1+d2+d3-1]: outro_start digits (d3 digits)
  // [54+d1+d2+d3..60+d1+d2+d3]: ,"end":  (7 chars)
  // [61+d1+d2+d3..61+d1+d2+d3+d4-1]: outro_end digits (d4 digits)
  // [61+d1+d2+d3+d4..63+d1+d2+d3+d4]: }}}  (3 chars)
  
  // Total: 64 + d1 + d2 + d3 + d4 = suffixLen
  // d1 + d2 + d3 + d4 = totalDigits
  
  return { suffixStart, suffixLen, totalDigits };
}

// For each sample, try to determine the digit distribution
// by checking which positions have digit-like cipher bytes

// Actually, let's use a much simpler approach:
// We know the fixed parts. For each sample, we can determine the
// digit boundaries by finding where the fixed parts are.
// 
// The key insight: after the intro_start digits, the next char is ','
// After the intro_end digits, the next char is '}'
// After the outro_start digits, the next char is ','
// After the outro_end digits, the next char is '}'
// 
// So we need to find where ',' and '}' appear in the suffix.
// But we don't know the table entries for ',' and '}' at those positions yet!
// 
// HOWEVER: we DO know the table entries for ',' at position 93 (from the prefix)
// and for '}' at various end positions. And the tables are position-dependent,
// so we can't directly reuse them.
//
// Let's try yet another approach: use the KNOWN fixed parts to determine
// the digit boundaries.

// From the front, we know positions 92-118 (or 94-120 for g1) are fixed.
// Position 119 (or 121 for g1) is the first digit of intro_start.
// 
// From the end, we know the last 3 positions are }}}.
// Before that are the outro_end digits.
// Before those digits is ,"end": (7 chars).
// 
// So the fixed part ,"end": ends at position (ptLen - 3 - d4 - 1) and
// starts at position (ptLen - 3 - d4 - 7).
// 
// We don't know d4, but we can try d4 = 1,2,3,4 and check which one
// produces consistent results.

// Let's try this for Group 0, ptLen=179 samples
const g0_179 = g0.filter(s => s.ptLen === 179);
console.log(`Testing with Group 0, ptLen=179 (${g0_179.length} samples)`);

// For ptLen=179, suffixLen = 179 - 92 = 87, totalDigits = 87 - 64 = 23
// d1 + d2 + d3 + d4 = 23
// Typical anime: intro 0-90s, outro 1300-1400s
// d1 (intro start): 1-3 digits (0-999)
// d2 (intro end): 1-3 digits (0-999)  
// d3 (outro start): 3-4 digits (100-9999)
// d4 (outro end): 3-4 digits (100-9999)

// Working backwards from end:
// pos 178,177,176: }}}
// pos 175...(175-d4+1): outro_end digits
// pos (175-d4)...(175-d4-6): ,"end":  (7 chars)
// pos (175-d4-7)...(175-d4-7-d3+1): outro_start digits
// pos (175-d4-7-d3)...(175-d4-7-d3-19): },"outro":{"start":  (20 chars)

// Let's try d4=4 (outro end is 4 digits, like 1400):
// outro_end digits: pos 172-175
// ,"end": pos 165-171
// 
// Check if pos 165-171 are constant across g0_179 samples:
for (let d4 = 1; d4 <= 5; d4++) {
  const endFixedStart = 176 - d4 - 7 + 1; // ,"end": starts here
  const endFixedEnd = 176 - d4; // ,"end": ends here
  
  let allConstant = true;
  for (let pos = endFixedStart; pos <= endFixedEnd; pos++) {
    const cp = cipherPos(pos);
    const values = new Set();
    for (const s of g0_179) {
      if (cp < s.data.length) values.add(s.data[cp]);
    }
    if (values.size > 1) { allConstant = false; break; }
  }
  
  if (allConstant) {
    console.log(`  d4=${d4}: ,"end": at pos ${endFixedStart}-${endFixedEnd} → ALL CONSTANT ✓`);
    
    // Now check the },"outro":{"start": before the outro_start digits
    // outro_start digits end at endFixedStart - 1
    // We need to find d3. Try different values.
    for (let d3 = 1; d3 <= 5; d3++) {
      const outroFixedStart = endFixedStart - d3 - 20; // },"outro":{"start": starts here
      const outroFixedEnd = endFixedStart - d3 - 1; // },"outro":{"start": ends here
      
      let outroConstant = true;
      for (let pos = outroFixedStart; pos <= outroFixedEnd; pos++) {
        const cp = cipherPos(pos);
        const values = new Set();
        for (const s of g0_179) {
          if (cp < s.data.length) values.add(s.data[cp]);
        }
        if (values.size > 1) { outroConstant = false; break; }
      }
      
      if (outroConstant) {
        // Check ,"end": before intro_end digits
        const d1d2 = 23 - d3 - d4;
        // Try different d2 values
        for (let d2 = 1; d2 <= Math.min(5, d1d2 - 1); d2++) {
          const d1 = d1d2 - d2;
          if (d1 < 1 || d1 > 5) continue;
          
          const introEndFixedStart = 92 + 27 + d1; // ,"end": starts after intro_start digits
          const introEndFixedEnd = introEndFixedStart + 6; // ,"end": is 7 chars
          
          let introEndConstant = true;
          for (let pos = introEndFixedStart; pos <= introEndFixedEnd; pos++) {
            const cp = cipherPos(pos);
            const values = new Set();
            for (const s of g0_179) {
              if (cp < s.data.length) values.add(s.data[cp]);
            }
            if (values.size > 1) { introEndConstant = false; break; }
          }
          
          if (introEndConstant) {
            console.log(`    d1=${d1}, d2=${d2}, d3=${d3}, d4=${d4} → ALL FIXED PARTS CONSTANT ✓✓✓`);
            
            // Map out the full suffix
            const map = [];
            let pos = 92;
            
            // Part 1: ","skip":{"intro":{"start":
            const p1 = '","skip":{"intro":{"start":';
            for (const ch of p1) { map.push({ pos: pos++, char: ch, type: 'fixed' }); }
            
            // Intro start digits
            for (let j = 0; j < d1; j++) { map.push({ pos: pos++, char: '?', type: 'digit' }); }
            
            // Part 2: ,"end":
            const p2 = ',"end":';
            for (const ch of p2) { map.push({ pos: pos++, char: ch, type: 'fixed' }); }
            
            // Intro end digits
            for (let j = 0; j < d2; j++) { map.push({ pos: pos++, char: '?', type: 'digit' }); }
            
            // Part 3: },"outro":{"start":
            const p3 = '},"outro":{"start":';
            for (const ch of p3) { map.push({ pos: pos++, char: ch, type: 'fixed' }); }
            
            // Outro start digits
            for (let j = 0; j < d3; j++) { map.push({ pos: pos++, char: '?', type: 'digit' }); }
            
            // Part 4: ,"end":
            const p4 = ',"end":';
            for (const ch of p4) { map.push({ pos: pos++, char: ch, type: 'fixed' }); }
            
            // Outro end digits
            for (let j = 0; j < d4; j++) { map.push({ pos: pos++, char: '?', type: 'digit' }); }
            
            // Part 5: }}}
            const p5 = '}}}';
            for (const ch of p5) { map.push({ pos: pos++, char: ch, type: 'fixed' }); }
            
            // Add all fixed entries to tables
            let newEntries = 0;
            for (const m of map) {
              if (m.type === 'fixed') {
                const cp = cipherPos(m.pos);
                for (const s of g0_179) {
                  if (cp < s.data.length) {
                    if (addEntry(m.pos, m.char, s.data[cp])) newEntries++;
                  }
                }
              }
            }
            console.log(`      Added ${newEntries} new entries from this mapping`);
            
            // Now try to determine the digit values
            // For each digit position, the cipher byte should map to a digit (0-9)
            for (const m of map) {
              if (m.type === 'digit') {
                const cp = cipherPos(m.pos);
                const values = new Set();
                for (const s of g0_179) {
                  if (cp < s.data.length) values.add(s.data[cp]);
                }
                console.log(`      Digit pos ${m.pos}: ${values.size} unique bytes [${[...values].map(v => '0x'+v.toString(16).padStart(2,'0')).join(',')}]`);
              }
            }
          }
        }
      }
    }
  } else {
    console.log(`  d4=${d4}: ,"end": at pos ${endFixedStart}-${endFixedEnd} → NOT constant`);
  }
}

// Count total entries
let totalEntries = 0;
let totalPositions = 0;
for (const pos of Object.keys(tables)) {
  const count = Object.keys(tables[pos]).length;
  totalEntries += count;
  totalPositions++;
}
console.log(`\nFinal: ${totalEntries} entries across ${totalPositions} positions`);

// Save
fs.writeFileSync('scripts/kai-tables-v8.json', JSON.stringify({ tables, totalEntries, totalPositions }, null, 2));
console.log('Saved to scripts/kai-tables-v8.json');
