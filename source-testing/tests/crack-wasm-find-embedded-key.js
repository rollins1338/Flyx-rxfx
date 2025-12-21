/**
 * Search for embedded key material in WASM
 * 
 * The XOR constant might be derived from embedded data in the WASM binary
 */

const fs = require('fs');
const crypto = require('crypto');

// Read the WASM binary
const wasmBinary = fs.readFileSync('source-testing/tests/wasm-analysis/img_data_bg.wasm');
console.log('WASM binary size:', wasmBinary.length, 'bytes');

const data = {
  timestamp: 1700000000,
  xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
  fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
  key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
};

const xorBuf = Buffer.from(data.xor, 'hex');
const fpHashBuf = Buffer.from(data.fpHash, 'hex');
const keyBuf = Buffer.from(data.key, 'hex');

console.log('\n=== Searching for XOR constant in WASM ===\n');

// Search for the XOR constant directly
let idx = wasmBinary.indexOf(xorBuf);
if (idx !== -1) {
  console.log(`Found XOR constant at offset ${idx}`);
} else {
  console.log('XOR constant not found directly in WASM');
}

// Search for the key
idx = wasmBinary.indexOf(keyBuf);
if (idx !== -1) {
  console.log(`Found key at offset ${idx}`);
} else {
  console.log('Key not found directly in WASM');
}

// Search for fpHash
idx = wasmBinary.indexOf(fpHashBuf);
if (idx !== -1) {
  console.log(`Found fpHash at offset ${idx}`);
} else {
  console.log('fpHash not found directly in WASM');
}

console.log('\n=== Searching for potential key derivation constants ===\n');

// Look for 32-byte sequences that could be used in key derivation
const potentialKeys = [];

for (let i = 0; i < wasmBinary.length - 32; i++) {
  const seq = wasmBinary.subarray(i, i + 32);
  
  // Check if XORing this with fpHash gives the key
  const xored = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    xored[j] = seq[j] ^ fpHashBuf[j];
  }
  
  if (xored.equals(keyBuf)) {
    console.log(`Found potential XOR constant at offset ${i}:`);
    console.log(`  Value: ${seq.toString('hex')}`);
    console.log(`  fpHash XOR this = key ✓`);
    potentialKeys.push({ offset: i, value: seq.toString('hex') });
  }
}

if (potentialKeys.length === 0) {
  console.log('No embedded XOR constant found that produces the key');
}

console.log('\n=== Analyzing WASM data section ===\n');

// The data section typically starts after the code section
// Let's look for patterns that might indicate key material

// Search for sequences of high-entropy bytes (potential keys)
const highEntropyRegions = [];

for (let i = 0; i < wasmBinary.length - 32; i += 32) {
  const seq = wasmBinary.subarray(i, i + 32);
  
  // Calculate entropy
  const counts = new Array(256).fill(0);
  for (let j = 0; j < 32; j++) counts[seq[j]]++;
  
  let entropy = 0;
  for (let j = 0; j < 256; j++) {
    if (counts[j] > 0) {
      const p = counts[j] / 32;
      entropy -= p * Math.log2(p);
    }
  }
  
  // High entropy (> 4.5 bits per byte) might be key material
  if (entropy > 4.5) {
    highEntropyRegions.push({ offset: i, entropy, value: seq.toString('hex') });
  }
}

console.log(`Found ${highEntropyRegions.length} high-entropy 32-byte regions`);

// Check if any of these XORed with fpHash gives the key
for (const region of highEntropyRegions) {
  const seq = Buffer.from(region.value, 'hex');
  const xored = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    xored[j] = seq[j] ^ fpHashBuf[j];
  }
  
  if (xored.equals(keyBuf)) {
    console.log(`\n*** FOUND: XOR constant at offset ${region.offset} ***`);
    console.log(`  Value: ${region.value}`);
    console.log(`  Entropy: ${region.entropy.toFixed(2)}`);
  }
}

console.log('\n=== Testing if XOR constant is derived from WASM hash ===\n');

// Maybe the XOR constant is derived from a hash of the WASM itself
const wasmHash = crypto.createHash('sha256').update(wasmBinary).digest();
console.log('SHA256(WASM):', wasmHash.toString('hex'));

if (wasmHash.equals(xorBuf)) {
  console.log('*** MATCH: XOR = SHA256(WASM) ***');
}

// Try HMAC with WASM hash
const hmac1 = crypto.createHmac('sha256', wasmHash).update(String(data.timestamp)).digest();
if (hmac1.equals(xorBuf)) {
  console.log('*** MATCH: XOR = HMAC(SHA256(WASM), timestamp) ***');
}

const hmac2 = crypto.createHmac('sha256', String(data.timestamp)).update(wasmHash).digest();
if (hmac2.equals(xorBuf)) {
  console.log('*** MATCH: XOR = HMAC(timestamp, SHA256(WASM)) ***');
}

// XOR WASM hash with timestamp hash
const tsHash = crypto.createHash('sha256').update(String(data.timestamp)).digest();
const xorWasmTs = Buffer.alloc(32);
for (let i = 0; i < 32; i++) xorWasmTs[i] = wasmHash[i] ^ tsHash[i];
if (xorWasmTs.equals(xorBuf)) {
  console.log('*** MATCH: XOR = SHA256(WASM) XOR SHA256(timestamp) ***');
}

console.log('\n=== Summary ===');
console.log('The XOR constant derivation remains unknown.');
console.log('It is likely computed dynamically within the WASM using a custom algorithm.');
