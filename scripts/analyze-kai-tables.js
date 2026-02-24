#!/usr/bin/env node
/**
 * Analyze AnimeKai tables from existing 82 samples.
 * No network requests — pure analysis.
 */
const fs = require('fs');
const path = require('path');

const existing = JSON.parse(fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
const samples = existing.samples.map(s => ({
  ...s,
  cipherData: Buffer.from(s.cipherHex, 'hex'),
}));

const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

console.log(`Samples: ${samples.length}`);
const minPtL = Math.min(...samples.map(s => s.ptLen));
const maxPtL = Math.max(...samples.map(s => s.ptLen));
console.log(`ptLen range: ${minPtL}-${maxPtL}`);

// Find constant positions
const constPos = new Map();
for (let pos = 0; pos < minPtL; pos++) {
  const cp = cipherPos(pos);
  const bytes = new Set();
  for (const s of samples) {
    if (cp < s.cipherData.length) bytes.add(s.cipherData[cp]);
  }
  if (bytes.size === 1) constPos.set(pos, [...bytes][0]);
}

// Find runs
const runs = [];
let runStart = null;
for (let pos = 0; pos <= minPtL; pos++) {
  if (constPos.has(pos)) {
    if (runStart === null) runStart = pos;
  } else {
    if (runStart !== null) {
      runs.push({ start: runStart, end: pos - 1, len: pos - runStart });
      runStart = null;
    }
  }
}

console.log(`\nConstant runs:`);
for (const r of runs) console.log(`  ${r.start}-${r.end} (${r.len} chars)`);

const prefix = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
console.log(`\nExpected prefix length: ${prefix.length}`);
console.log(`Run 1 length: ${runs[0]?.len}`);

if (runs.length >= 2) {
  const videoIdStart = prefix.length;
  const videoIdEnd = runs[1].start - 1;
  const videoIdLen = videoIdEnd - videoIdStart + 1;
  console.log(`Video ID: positions ${videoIdStart}-${videoIdEnd} (${videoIdLen} chars)`);
  
  const suffix1 = '","skip":{"intro":[';
  console.log(`Suffix1 run: ${runs[1].start}-${runs[1].end} (${runs[1].len} chars, expected ${suffix1.length})`);
  
  if (runs.length >= 3) {
    const suffix2 = '],"outro":[';
    console.log(`Suffix2 run: ${runs[2].start}-${runs[2].end} (${runs[2].len} chars, expected ${suffix2.length})`);
    
    const introStart = runs[1].end + 1;
    const introEnd = runs[2].start - 1;
    console.log(`Intro numbers: ${introStart}-${introEnd} (${introEnd - introStart + 1} chars)`);
    
    const outroStart = runs[2].end + 1;
    console.log(`Outro numbers start: ${outroStart}`);
    console.log(`Outro numbers end: ptLen-4 (varies per sample)`);
  }
}

// Build tables from known plaintext
const tables = {};
function addEntry(pos, byte, char) {
  if (!tables[pos]) tables[pos] = {};
  tables[pos][byte] = char;
}

// Prefix
for (let i = 0; i < prefix.length; i++) {
  const cp = cipherPos(i);
  for (const s of samples) {
    if (cp < s.cipherData.length) addEntry(i, s.cipherData[cp], prefix[i]);
  }
}

// Suffix parts
if (runs.length >= 2) {
  const suffix1 = '","skip":{"intro":[';
  for (let i = 0; i < suffix1.length && i < runs[1].len; i++) {
    const pos = runs[1].start + i;
    const cp = cipherPos(pos);
    for (const s of samples) {
      if (cp < s.cipherData.length && pos < s.ptLen) addEntry(pos, s.cipherData[cp], suffix1[i]);
    }
  }
}

if (runs.length >= 3) {
  const suffix2 = '],"outro":[';
  for (let i = 0; i < suffix2.length && i < runs[2].len; i++) {
    const pos = runs[2].start + i;
    const cp = cipherPos(pos);
    for (const s of samples) {
      if (cp < s.cipherData.length && pos < s.ptLen) addEntry(pos, s.cipherData[cp], suffix2[i]);
    }
  }
}

// End: ]}}
for (const s of samples) {
  const endChars = [']', '}', '}'];
  for (let offset = 0; offset < 3; offset++) {
    const pos = s.ptLen - 3 + offset;
    const cp = cipherPos(pos);
    if (cp < s.cipherData.length) addEntry(pos, s.cipherData[cp], endChars[offset]);
  }
}

// Count
let totalEntries = 0;
const positionsWithEntries = [];
for (let pos = 0; pos < 183; pos++) {
  const t = tables[pos] || {};
  const count = Object.keys(t).length;
  totalEntries += count;
  if (count > 0) positionsWithEntries.push(pos);
}

console.log(`\nPositions with entries: ${positionsWithEntries.length}/183`);
console.log(`Total entries: ${totalEntries}`);
console.log(`Positions covered: ${positionsWithEntries.join(', ')}`);

// Show what we have per position
console.log('\nTable entries per position:');
for (const pos of positionsWithEntries) {
  const t = tables[pos];
  const chars = [...new Set(Object.values(t))].sort().join('');
  console.log(`  pos ${pos.toString().padStart(3)}: ${Object.keys(t).length.toString().padStart(2)} entries → chars: ${chars}`);
}

// Now the KEY question: can we figure out the video IDs?
// Let's look at the byte patterns at video ID positions
console.log('\n═══════════════════════════════════════════════════════');
console.log('  VIDEO ID BYTE ANALYSIS');
console.log('═══════════════════════════════════════════════════════\n');

if (runs.length >= 2) {
  const videoIdStart = prefix.length;
  const videoIdEnd = runs[1].start - 1;
  
  // Group samples by their video ID bytes
  const groups = {};
  for (let si = 0; si < samples.length; si++) {
    const s = samples[si];
    const bytes = [];
    for (let pos = videoIdStart; pos <= videoIdEnd && pos < s.ptLen; pos++) {
      const cp = cipherPos(pos);
      if (cp < s.cipherData.length) bytes.push(s.cipherData[cp]);
    }
    const key = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    if (!groups[key]) groups[key] = [];
    groups[key].push({ idx: si, query: s.query, lid: s.lid });
  }
  
  console.log(`Unique video IDs: ${Object.keys(groups).length}`);
  for (const [key, members] of Object.entries(groups)) {
    console.log(`  ${key.substring(0, 40)}... → ${members.map(m => `${m.query}(${m.lid})`).join(', ').substring(0, 80)}`);
  }
}
