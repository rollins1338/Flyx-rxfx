/**
 * Analyze WASM Data Section for embedded constants
 * 
 * The XOR constant might be derived from embedded data in the WASM
 */

const fs = require('fs');
const crypto = require('crypto');

// Read the data section
const dataSection = fs.readFileSync('source-testing/tests/wasm-analysis/data-section.bin');
console.log('Data section size:', dataSection.length, 'bytes');

// Known XOR constants
const xorConstants = [
  { ts: 1700000000, xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc' },
  { ts: 1700000001, xor: '165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977' },
];

// Search for the XOR constants in the data section
console.log('\n=== Searching for XOR constants in data section ===\n');

for (const { ts, xor } of xorConstants) {
  const xorBuf = Buffer.from(xor, 'hex');
  const idx = dataSection.indexOf(xorBuf);
  if (idx !== -1) {
    console.log(`Found XOR constant for ts=${ts} at offset ${idx}`);
  } else {
    console.log(`XOR constant for ts=${ts} NOT found in data section`);
  }
}

// Search for SHA256 initial values (H0-H7)
console.log('\n=== Searching for SHA256 constants ===\n');

const sha256H = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

for (let i = 0; i < sha256H.length; i++) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(sha256H[i]);
  const idx = dataSection.indexOf(buf);
  if (idx !== -1) {
    console.log(`Found SHA256 H${i} (${sha256H[i].toString(16)}) at offset ${idx}`);
  }
  
  // Also try little-endian
  buf.writeUInt32LE(sha256H[i]);
  const idxLE = dataSection.indexOf(buf);
  if (idxLE !== -1) {
    console.log(`Found SHA256 H${i} LE (${sha256H[i].toString(16)}) at offset ${idxLE}`);
  }
}

// Search for AES S-box
console.log('\n=== Searching for AES S-box ===\n');

const aesSbox = Buffer.from([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76
]);

const sboxIdx = dataSection.indexOf(aesSbox);
if (sboxIdx !== -1) {
  console.log(`Found AES S-box at offset ${sboxIdx}`);
} else {
  console.log('AES S-box not found (might be using fixslice implementation)');
}

// Look for any 32-byte sequences that could be keys
console.log('\n=== Analyzing 32-byte sequences ===\n');

// Find all 32-byte sequences that look like they could be cryptographic constants
const potentialConstants = [];

for (let i = 0; i < dataSection.length - 32; i++) {
  const seq = dataSection.subarray(i, i + 32);
  
  // Check if it looks random (high entropy)
  const counts = new Array(256).fill(0);
  for (let j = 0; j < 32; j++) counts[seq[j]]++;
  
  let entropy = 0;
  for (let j = 0; j < 256; j++) {
    if (counts[j] > 0) {
      const p = counts[j] / 32;
      entropy -= p * Math.log2(p);
    }
  }
  
  // High entropy sequences (> 4 bits per byte) might be keys
  if (entropy > 4) {
    // Check if this sequence XORed with any fpHash gives a known key
    for (const { ts, xor } of xorConstants) {
      const xorBuf = Buffer.from(xor, 'hex');
      if (seq.equals(xorBuf)) {
        console.log(`Found exact XOR constant at offset ${i} for ts=${ts}`);
      }
    }
  }
}

// Look for strings that might indicate the algorithm
console.log('\n=== Searching for algorithm-related strings ===\n');

const searchStrings = [
  'xor', 'XOR', 'key', 'KEY', 'derive', 'DERIVE',
  'prng', 'PRNG', 'random', 'RANDOM', 'seed', 'SEED',
  'hmac', 'HMAC', 'hkdf', 'HKDF', 'pbkdf', 'PBKDF',
  'chacha', 'CHACHA', 'salsa', 'SALSA',
  'timestamp', 'TIMESTAMP', 'time', 'TIME',
  'fingerprint', 'FINGERPRINT', 'canvas', 'CANVAS'
];

for (const str of searchStrings) {
  const buf = Buffer.from(str);
  let idx = 0;
  while ((idx = dataSection.indexOf(buf, idx)) !== -1) {
    // Get context around the match
    const start = Math.max(0, idx - 20);
    const end = Math.min(dataSection.length, idx + str.length + 20);
    const context = dataSection.subarray(start, end).toString('utf8').replace(/[^\x20-\x7E]/g, '.');
    console.log(`Found "${str}" at offset ${idx}: ...${context}...`);
    idx++;
  }
}

// Look for Rust panic strings that might reveal function names
console.log('\n=== Searching for Rust panic strings ===\n');

const rustPatterns = [
  'called `Option::unwrap()`',
  'called `Result::unwrap()`',
  'index out of bounds',
  'assertion failed',
  '.rs:',
  'panicked at',
];

for (const pattern of rustPatterns) {
  const buf = Buffer.from(pattern);
  let idx = 0;
  while ((idx = dataSection.indexOf(buf, idx)) !== -1) {
    const start = Math.max(0, idx - 50);
    const end = Math.min(dataSection.length, idx + pattern.length + 100);
    const context = dataSection.subarray(start, end).toString('utf8').replace(/[^\x20-\x7E\n]/g, '.');
    console.log(`Found Rust pattern at offset ${idx}:`);
    console.log(context);
    console.log('---');
    idx++;
  }
}

// Look for any embedded 64-char hex strings (potential keys)
console.log('\n=== Searching for embedded hex strings ===\n');

const hexPattern = /[0-9a-f]{64}/gi;
const dataStr = dataSection.toString('utf8');
let match;
while ((match = hexPattern.exec(dataStr)) !== null) {
  console.log(`Found 64-char hex at offset ${match.index}: ${match[0]}`);
}
