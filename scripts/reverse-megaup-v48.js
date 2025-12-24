#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v48
 * 
 * NEW THEORY: Self-modifying cipher
 * 
 * The keystream at position i might be computed as:
 * keystream[i] = base_keystream[i] XOR f(plaintext[i])
 * 
 * Or more likely, there's a BASE keystream that's modified by plaintext feedback.
 * 
 * Let's test: if we XOR the two keystrams, do we get something related to
 * the XOR of the two plaintexts?
 */

const fs = require('fs');

const working = JSON.parse(fs.readFileSync('megaup-keystream-working.json', 'utf8'));
const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));

const wKs = working.keystream;
const fKs = failing.keystream;
const wDec = Buffer.from(working.decrypted, 'utf8');
const fDec = Buffer.from(failing.decrypted, 'utf8');

console.log('=== Testing self-modifying cipher theory ===\n');

// Compute keystream XOR and plaintext XOR
console.log('Position | ks_w XOR ks_f | plain_w XOR plain_f | Match?');
console.log('---------|---------------|---------------------|-------');

for (let i = 33; i < 60; i++) {
  const ksXor = wKs[i] ^ fKs[i];
  const plainXor = wDec[i] ^ fDec[i];
  const match = ksXor === plainXor ? 'YES' : '';
  
  console.log(`   ${i.toString().padStart(3)}   |     0x${ksXor.toString(16).padStart(2,'0')}      |       0x${plainXor.toString(16).padStart(2,'0')}        | ${match}`);
}

// Hmm, let's try a different approach.
// What if the keystream difference is the CUMULATIVE XOR of plaintext differences?

console.log('\n=== Testing cumulative XOR theory ===\n');

let cumXor = 0;
console.log('Position | ks_w XOR ks_f | Cumulative plain XOR | Match?');
console.log('---------|---------------|----------------------|-------');

for (let i = 33; i < 60; i++) {
  const ksXor = wKs[i] ^ fKs[i];
  cumXor ^= (wDec[i] ^ fDec[i]);
  const match = ksXor === cumXor ? 'YES' : '';
  
  console.log(`   ${i.toString().padStart(3)}   |     0x${ksXor.toString(16).padStart(2,'0')}      |        0x${cumXor.toString(16).padStart(2,'0')}         | ${match}`);
}

// Let's try cumulative ADD
console.log('\n=== Testing cumulative ADD theory ===\n');

let cumAdd = 0;
console.log('Position | ks_w - ks_f | Cumulative plain diff | Match?');
console.log('---------|-------------|----------------------|-------');

for (let i = 33; i < 60; i++) {
  const ksDiff = (wKs[i] - fKs[i] + 256) & 0xFF;
  cumAdd = (cumAdd + (wDec[i] - fDec[i] + 256)) & 0xFF;
  const match = ksDiff === cumAdd ? 'YES' : '';
  
  console.log(`   ${i.toString().padStart(3)}   |    0x${ksDiff.toString(16).padStart(2,'0')}     |        0x${cumAdd.toString(16).padStart(2,'0')}         | ${match}`);
}

// Let's look at the relationship between consecutive keystream differences
console.log('\n=== Analyzing keystream difference propagation ===\n');

console.log('Position | ks_diff[i] | ks_diff[i-1] | plain_diff[i-1] | Relationship');
console.log('---------|------------|--------------|-----------------|-------------');

for (let i = 34; i < 60; i++) {
  const ksDiff_i = (wKs[i] - fKs[i] + 256) & 0xFF;
  const ksDiff_prev = (wKs[i-1] - fKs[i-1] + 256) & 0xFF;
  const plainDiff_prev = (wDec[i-1] - fDec[i-1] + 256) & 0xFF;
  
  // Test various relationships
  const xor = ksDiff_prev ^ plainDiff_prev;
  const add = (ksDiff_prev + plainDiff_prev) & 0xFF;
  const sub = (ksDiff_prev - plainDiff_prev + 256) & 0xFF;
  
  let rel = '';
  if (ksDiff_i === xor) rel = 'XOR';
  else if (ksDiff_i === add) rel = 'ADD';
  else if (ksDiff_i === sub) rel = 'SUB';
  else if (ksDiff_i === plainDiff_prev) rel = 'PLAIN';
  else if (ksDiff_i === ksDiff_prev) rel = 'SAME';
  
  console.log(`   ${i.toString().padStart(3)}   |   0x${ksDiff_i.toString(16).padStart(2,'0')}    |    0x${ksDiff_prev.toString(16).padStart(2,'0')}      |      0x${plainDiff_prev.toString(16).padStart(2,'0')}       | ${rel}`);
}

// Let's try yet another approach: look at the actual keystream values
console.log('\n=== Looking at keystream values directly ===\n');

// Maybe the keystream is: base_ks[i] + sum(plaintext[0:i]) mod 256
// Or: base_ks[i] XOR xor(plaintext[0:i])

// First, let's compute what the "base keystream" would be if we subtract the plaintext sum
console.log('Testing: keystream[i] = base[i] + sum(plaintext[0:i-1]) mod 256\n');

let wSum = 0, fSum = 0;
let baseKsMatches = 0;

for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  // Compute what base[i] would be for each video
  const wBase = (wKs[i] - wSum + 256) & 0xFF;
  const fBase = (fKs[i] - fSum + 256) & 0xFF;
  
  if (wBase === fBase) baseKsMatches++;
  
  if (i >= 30 && i < 45) {
    console.log(`i=${i.toString().padStart(2)}: wKs=0x${wKs[i].toString(16).padStart(2,'0')} fKs=0x${fKs[i].toString(16).padStart(2,'0')} wSum=0x${wSum.toString(16).padStart(2,'0')} fSum=0x${fSum.toString(16).padStart(2,'0')} wBase=0x${wBase.toString(16).padStart(2,'0')} fBase=0x${fBase.toString(16).padStart(2,'0')} ${wBase === fBase ? 'MATCH' : ''}`);
  }
  
  // Update sums
  wSum = (wSum + wDec[i]) & 0xFF;
  fSum = (fSum + fDec[i]) & 0xFF;
}

console.log(`\nBase keystream matches: ${baseKsMatches}/${Math.min(wKs.length, fKs.length)}`);

// Try XOR instead of ADD
console.log('\n\nTesting: keystream[i] = base[i] XOR xor(plaintext[0:i-1])\n');

let wXor = 0, fXor = 0;
let baseKsXorMatches = 0;

for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  const wBase = wKs[i] ^ wXor;
  const fBase = fKs[i] ^ fXor;
  
  if (wBase === fBase) baseKsXorMatches++;
  
  if (i >= 30 && i < 45) {
    console.log(`i=${i.toString().padStart(2)}: wKs=0x${wKs[i].toString(16).padStart(2,'0')} fKs=0x${fKs[i].toString(16).padStart(2,'0')} wXor=0x${wXor.toString(16).padStart(2,'0')} fXor=0x${fXor.toString(16).padStart(2,'0')} wBase=0x${wBase.toString(16).padStart(2,'0')} fBase=0x${fBase.toString(16).padStart(2,'0')} ${wBase === fBase ? 'MATCH' : ''}`);
  }
  
  wXor ^= wDec[i];
  fXor ^= fDec[i];
}

console.log(`\nBase keystream (XOR) matches: ${baseKsXorMatches}/${Math.min(wKs.length, fKs.length)}`);
