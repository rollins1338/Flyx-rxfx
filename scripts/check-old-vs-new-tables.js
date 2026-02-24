#!/usr/bin/env node
/**
 * Check if OLD encrypt tables match NEW cipher bytes.
 * Uses existing 82 samples from kai-bruteforce-result.json.
 * 
 * KEY HYPOTHESIS: Maybe the encrypt tables haven't changed,
 * and the decrypt tables are just the inverse of the encrypt tables.
 */
const fs = require('fs');
const path = require('path');

// Load existing samples
const existing = JSON.parse(fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
const samples = existing.samples.map(s => ({
  ...s,
  cipherData: Buffer.from(s.cipherHex, 'hex'),
}));
console.log(`Loaded ${samples.length} samples`);

// Cipher position mapping
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

// Load OLD encrypt tables from the TS file
const content = fs.readFileSync('app/lib/animekai-crypto.ts', 'utf8');
const oldTables = {};
const tableRe = /(\d+):\s*\{([^}]+)\}/g;
let m;
while ((m = tableRe.exec(content)) !== null) {
  const pos = parseInt(m[1]);
  const entries = m[2];
  oldTables[pos] = {};
  
  const entryRe = /'([^'\\]|\\.)':0x([0-9a-f]+)/g;
  let em;
  while ((em = entryRe.exec(entries)) !== null) {
    let char = em[1];
    if (char === '\\\\') char = '\\';
    else if (char === "\\'") char = "'";
    const byte = parseInt(em[2], 16);
    oldTables[pos][char] = byte;
  }
}
console.log(`Loaded ${Object.keys(oldTables).length} old encrypt tables`);

// Known prefix
const prefix = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
console.log(`Prefix: ${prefix} (${prefix.length} chars)\n`);

// Check each prefix position across ALL samples
let totalChecks = 0, totalMatches = 0, totalMismatches = 0;

for (let i = 0; i < prefix.length; i++) {
  const cp = cipherPos(i);
  const char = prefix[i];
  const expectedByte = oldTables[i]?.[char];
  
  if (expectedByte === undefined) {
    console.log(`  pos ${i}: char '${char}' NOT in old table`);
    continue;
  }
  
  let posMatches = 0, posMismatches = 0;
  for (const s of samples) {
    if (cp < s.cipherData.length) {
      totalChecks++;
      if (s.cipherData[cp] === expectedByte) {
        posMatches++;
        totalMatches++;
      } else {
        posMismatches++;
        totalMismatches++;
      }
    }
  }
  
  const status = posMismatches === 0 ? '✓' : '✗';
  if (posMismatches > 0) {
    // Show what the actual bytes are
    const actualBytes = new Set();
    for (const s of samples) {
      if (cp < s.cipherData.length) actualBytes.add(s.cipherData[cp]);
    }
    console.log(`  pos ${i}: char '${char}' → old=0x${expectedByte.toString(16)} actual=[${[...actualBytes].map(b => '0x'+b.toString(16)).join(',')}] ${status} (${posMatches}/${posMatches+posMismatches})`);
  }
}

console.log(`\nTotal: ${totalMatches}/${totalChecks} matches (${totalMismatches} mismatches)`);

if (totalMismatches === 0) {
  console.log('\n★★★ ALL PREFIX BYTES MATCH OLD ENCRYPT TABLES! ★★★');
  console.log('The encrypt tables have NOT changed.');
  console.log('Decrypt = inverse of encrypt.\n');
  
  // Try to decrypt the first sample using inverse of old encrypt tables
  const s = samples[0];
  console.log(`Decrypting sample: ${s.query} lid=${s.lid} ptLen=${s.ptLen}`);
  
  let decrypted = '';
  let unknownCount = 0;
  for (let i = 0; i < s.ptLen; i++) {
    const cp = cipherPos(i);
    if (cp >= s.cipherData.length) { decrypted += '?'; unknownCount++; continue; }
    const byte = s.cipherData[cp];
    
    let found = false;
    if (oldTables[i]) {
      for (const [char, encByte] of Object.entries(oldTables[i])) {
        if (encByte === byte) {
          decrypted += char;
          found = true;
          break;
        }
      }
    }
    if (!found) { decrypted += '?'; unknownCount++; }
  }
  
  console.log(`Decrypted (${unknownCount} unknowns): ${decrypted}`);
  
  // Try to parse as JSON
  try {
    const parsed = JSON.parse(decrypted);
    console.log('\n★★★ VALID JSON! ★★★');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log(`\nNot valid JSON: ${e.message}`);
    // Show which positions are unknown
    const unknowns = [];
    for (let i = 0; i < decrypted.length; i++) {
      if (decrypted[i] === '?') unknowns.push(i);
    }
    console.log(`Unknown positions: ${unknowns.join(', ')}`);
  }
  
  // Decrypt ALL samples
  console.log('\n\nDecrypting all samples...');
  let successCount = 0;
  for (const s of samples.slice(0, 20)) {
    let dec = '';
    for (let i = 0; i < s.ptLen; i++) {
      const cp = cipherPos(i);
      if (cp >= s.cipherData.length) { dec += '?'; continue; }
      const byte = s.cipherData[cp];
      let found = false;
      if (oldTables[i]) {
        for (const [char, encByte] of Object.entries(oldTables[i])) {
          if (encByte === byte) { dec += char; found = true; break; }
        }
      }
      if (!found) dec += '?';
    }
    
    const hasUrl = dec.includes('megaup');
    if (hasUrl) successCount++;
    console.log(`  ${s.query.padEnd(15)} ${s.lid.padEnd(12)} ptLen=${s.ptLen} → ${dec.substring(0, 80)}...`);
  }
  console.log(`\n${successCount}/20 contain 'megaup'`);
} else {
  console.log('\nOld encrypt tables do NOT match new cipher bytes.');
  console.log('Tables have been regenerated on the server side.');
}
