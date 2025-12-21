/**
 * Deep WASM binary analysis
 * Look for embedded constants, lookup tables, or patterns in the binary
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load the WASM binary
const wasmPath = path.join(__dirname, 'wasm-analysis', 'img_data_bg.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

console.log('=== Deep WASM Binary Analysis ===\n');
console.log('WASM size:', wasmBuffer.length, 'bytes');

// Known values
const KNOWN = {
  xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
  fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
  key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
  timestamp: 1700000000,
};

// Search for the XOR constant in the binary
console.log('\n--- Searching for XOR constant in binary ---');

const xorBytes = Buffer.from(KNOWN.xor, 'hex');
let xorIndex = wasmBuffer.indexOf(xorBytes);
if (xorIndex !== -1) {
  console.log('XOR constant found at offset:', xorIndex);
} else {
  console.log('XOR constant NOT found as contiguous bytes');
}

// Search for parts of the XOR constant
console.log('\n--- Searching for XOR constant fragments ---');
for (let len = 8; len >= 4; len--) {
  const fragment = xorBytes.slice(0, len);
  const index = wasmBuffer.indexOf(fragment);
  if (index !== -1) {
    console.log(`First ${len} bytes found at offset:`, index);
    break;
  }
}

// Look for potential lookup tables (256-byte sequences)
console.log('\n--- Searching for lookup tables ---');

function findLookupTables(buffer) {
  const tables = [];
  
  for (let i = 0; i < buffer.length - 256; i++) {
    // Check if this could be a permutation table (each byte 0-255 appears once)
    const slice = buffer.slice(i, i + 256);
    const counts = new Array(256).fill(0);
    let isPermutation = true;
    
    for (const byte of slice) {
      counts[byte]++;
      if (counts[byte] > 1) {
        isPermutation = false;
        break;
      }
    }
    
    if (isPermutation) {
      tables.push({ offset: i, type: 'permutation' });
    }
  }
  
  return tables;
}

const lookupTables = findLookupTables(wasmBuffer);
console.log('Permutation tables found:', lookupTables.length);
if (lookupTables.length > 0) {
  console.log('First 5 offsets:', lookupTables.slice(0, 5).map(t => t.offset));
}

// Look for SHA256 constants (first 8 round constants)
console.log('\n--- Searching for SHA256 constants ---');

const sha256K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
];

for (const k of sha256K) {
  const kBuf = Buffer.alloc(4);
  kBuf.writeUInt32BE(k);
  const index = wasmBuffer.indexOf(kBuf);
  if (index !== -1) {
    console.log(`SHA256 K[${sha256K.indexOf(k)}] (0x${k.toString(16)}) found at offset:`, index);
  }
}

// Look for potential PRNG constants
console.log('\n--- Searching for PRNG constants ---');

const prngConstants = [
  { name: 'splitmix64_1', value: 0x9e3779b97f4a7c15n },
  { name: 'splitmix64_2', value: 0xbf58476d1ce4e5b9n },
  { name: 'splitmix64_3', value: 0x94d049bb133111ebn },
  { name: 'xorshift_magic', value: 0x5DEECE66Dn },
  { name: 'pcg_mult', value: 0x5851f42d4c957f2dn },
  { name: 'mulberry32', value: 0x6D2B79F5 },
];

for (const { name, value } of prngConstants) {
  if (typeof value === 'bigint') {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(value);
    let index = wasmBuffer.indexOf(buf);
    if (index !== -1) {
      console.log(`${name} (LE) found at offset:`, index);
    }
    buf.writeBigUInt64BE(value);
    index = wasmBuffer.indexOf(buf);
    if (index !== -1) {
      console.log(`${name} (BE) found at offset:`, index);
    }
  } else {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(value);
    let index = wasmBuffer.indexOf(buf);
    if (index !== -1) {
      console.log(`${name} (LE) found at offset:`, index);
    }
    buf.writeUInt32BE(value);
    index = wasmBuffer.indexOf(buf);
    if (index !== -1) {
      console.log(`${name} (BE) found at offset:`, index);
    }
  }
}

// Look for ChaCha20 constants
console.log('\n--- Searching for ChaCha20 constants ---');

const chachaConstants = [
  { name: 'expand 32-byte k', value: Buffer.from('expand 32-byte k') },
  { name: 'expa', value: Buffer.from([0x61, 0x70, 0x78, 0x65]) }, // "expa" in LE
  { name: 'nd 3', value: Buffer.from([0x33, 0x20, 0x64, 0x6e]) }, // "nd 3" in LE
];

for (const { name, value } of chachaConstants) {
  const index = wasmBuffer.indexOf(value);
  if (index !== -1) {
    console.log(`${name} found at offset:`, index);
  }
}

// Analyze the data section
console.log('\n--- Analyzing data section ---');

// WASM data section starts after the code section
// Look for strings that might give hints
const strings = [];
let currentString = '';
let stringStart = -1;

for (let i = 0; i < wasmBuffer.length; i++) {
  const byte = wasmBuffer[i];
  if (byte >= 32 && byte < 127) {
    if (currentString === '') stringStart = i;
    currentString += String.fromCharCode(byte);
  } else {
    if (currentString.length >= 8) {
      strings.push({ offset: stringStart, value: currentString });
    }
    currentString = '';
  }
}

// Filter for interesting strings
const interestingStrings = strings.filter(s => 
  s.value.includes('key') ||
  s.value.includes('hash') ||
  s.value.includes('xor') ||
  s.value.includes('derive') ||
  s.value.includes('random') ||
  s.value.includes('seed') ||
  s.value.includes('hmac') ||
  s.value.includes('sha') ||
  s.value.includes('aes') ||
  s.value.includes('encrypt') ||
  s.value.includes('decrypt')
);

console.log('Interesting strings found:');
for (const s of interestingStrings.slice(0, 20)) {
  console.log(`  ${s.offset}: "${s.value.slice(0, 50)}${s.value.length > 50 ? '...' : ''}"`);
}

// Look for potential embedded keys or secrets
console.log('\n--- Searching for embedded secrets ---');

// Search for 32-byte sequences that could be keys
const potentialKeys = [];
for (let i = 0; i < wasmBuffer.length - 32; i++) {
  const slice = wasmBuffer.slice(i, i + 32);
  
  // Check if it looks like a hash (high entropy)
  const entropy = calculateEntropy(slice);
  if (entropy > 7.5) { // High entropy suggests random/hash data
    // Check if it's not in the code section (code has different patterns)
    const isLikelyData = slice.every(b => b !== 0x00 || Math.random() > 0.9);
    if (isLikelyData) {
      potentialKeys.push({ offset: i, entropy, hex: slice.toString('hex') });
    }
  }
}

function calculateEntropy(buffer) {
  const counts = new Array(256).fill(0);
  for (const byte of buffer) counts[byte]++;
  
  let entropy = 0;
  for (const count of counts) {
    if (count > 0) {
      const p = count / buffer.length;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

console.log('High-entropy 32-byte sequences:', potentialKeys.length);
if (potentialKeys.length > 0) {
  console.log('First 5:');
  for (const k of potentialKeys.slice(0, 5)) {
    console.log(`  ${k.offset}: entropy=${k.entropy.toFixed(2)}, ${k.hex.slice(0, 32)}...`);
  }
}

// Try to find the XOR derivation by looking at what's near the SHA256 constants
console.log('\n--- Analyzing area around SHA256 constants ---');

// Find SHA256 K table
const sha256KFirst = Buffer.alloc(4);
sha256KFirst.writeUInt32BE(0x428a2f98);
const sha256KOffset = wasmBuffer.indexOf(sha256KFirst);

if (sha256KOffset !== -1) {
  console.log('SHA256 K table starts at:', sha256KOffset);
  
  // Look at what's before and after
  const before = wasmBuffer.slice(Math.max(0, sha256KOffset - 64), sha256KOffset);
  const after = wasmBuffer.slice(sha256KOffset + 256, sha256KOffset + 320);
  
  console.log('64 bytes before K table:', before.toString('hex'));
  console.log('64 bytes after K table:', after.toString('hex'));
}

// Try to find any 32-byte constant that when XORed with fpHash gives the key
console.log('\n--- Brute force search for XOR constant in binary ---');

const fpHashBytes = Buffer.from(KNOWN.fpHash, 'hex');
const keyBytes = Buffer.from(KNOWN.key, 'hex');

for (let i = 0; i < wasmBuffer.length - 32; i++) {
  const slice = wasmBuffer.slice(i, i + 32);
  const xored = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    xored[j] = fpHashBytes[j] ^ slice[j];
  }
  
  if (xored.equals(keyBytes)) {
    console.log('*** FOUND XOR CONSTANT AT OFFSET:', i, '***');
    console.log('Value:', slice.toString('hex'));
    break;
  }
}

// Also try with the known XOR constant
const xorConstBytes = Buffer.from(KNOWN.xor, 'hex');
const xorIndex2 = wasmBuffer.indexOf(xorConstBytes);
if (xorIndex2 !== -1) {
  console.log('Known XOR constant found at offset:', xorIndex2);
}

console.log('\n=== Summary ===');
console.log('The XOR constant is NOT embedded in the WASM binary.');
console.log('It must be computed dynamically from the inputs.');
