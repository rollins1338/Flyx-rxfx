/**
 * Analyze the WASM binary to find the XOR constant derivation
 */

const fs = require('fs');
const crypto = require('crypto');

// Load the WASM binary
const wasmPath = 'wasm-analysis/img_data_bg.wasm';
const wasmBytes = fs.readFileSync(wasmPath);

console.log('=== WASM Binary Analysis ===');
console.log('Size:', wasmBytes.length, 'bytes');

// Known values
const xorConstant = Buffer.from('1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc', 'hex');
const fpHash = Buffer.from('54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e', 'hex');
const key = Buffer.from('48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2', 'hex');

// Search for XOR constant in binary
console.log('\n=== Searching for XOR constant ===');
for (let len = 32; len >= 4; len -= 4) {
  const pattern = xorConstant.slice(0, len);
  let found = false;
  for (let i = 0; i <= wasmBytes.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (wasmBytes[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`XOR constant first ${len} bytes found at offset ${i} (0x${i.toString(16)})`);
      console.log(`  Context: ${wasmBytes.slice(Math.max(0, i-16), i+len+16).toString('hex')}`);
      found = true;
    }
  }
  if (found) break;
}

// Search for fpHash in binary
console.log('\n=== Searching for fpHash ===');
for (let len = 32; len >= 4; len -= 4) {
  const pattern = fpHash.slice(0, len);
  let found = false;
  for (let i = 0; i <= wasmBytes.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (wasmBytes[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`fpHash first ${len} bytes found at offset ${i} (0x${i.toString(16)})`);
      found = true;
    }
  }
  if (found) break;
}

// Search for key in binary
console.log('\n=== Searching for key ===');
for (let len = 32; len >= 4; len -= 4) {
  const pattern = key.slice(0, len);
  let found = false;
  for (let i = 0; i <= wasmBytes.length - len; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (wasmBytes[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`key first ${len} bytes found at offset ${i} (0x${i.toString(16)})`);
      found = true;
    }
  }
  if (found) break;
}

// Look for SHA256 constants
console.log('\n=== Searching for SHA256 constants ===');
const sha256H = [
  Buffer.from([0x6a, 0x09, 0xe6, 0x67]),
  Buffer.from([0xbb, 0x67, 0xae, 0x85]),
  Buffer.from([0x3c, 0x6e, 0xf3, 0x72]),
  Buffer.from([0xa5, 0x4f, 0xf5, 0x3a]),
];

for (let h = 0; h < sha256H.length; h++) {
  const pattern = sha256H[h];
  for (let i = 0; i <= wasmBytes.length - 4; i++) {
    let match = true;
    for (let j = 0; j < 4; j++) {
      if (wasmBytes[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`SHA256 H[${h}] found at offset ${i} (0x${i.toString(16)})`);
      break;
    }
  }
}

// Look for data section
console.log('\n=== Analyzing data section ===');
// WASM section IDs: 11 = data section
// Find all potential data sections
const dataSections = [];
for (let i = 0; i < wasmBytes.length - 10; i++) {
  // Look for data section header pattern
  if (wasmBytes[i] === 0x0b) { // Section ID 11
    dataSections.push(i);
  }
}
console.log(`Found ${dataSections.length} potential data section markers`);

// Look for 32-byte sequences that could be constants
console.log('\n=== Searching for 32-byte constant candidates ===');
const candidates = [];

for (let i = 0; i < wasmBytes.length - 32; i++) {
  const slice = wasmBytes.slice(i, i + 32);
  
  // Check entropy (unique bytes)
  const unique = new Set(slice);
  if (unique.size < 20) continue; // Skip low entropy
  
  // Check if XORing with fpHash gives key
  const xored = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    xored[j] = slice[j] ^ fpHash[j];
  }
  
  if (xored.equals(key)) {
    console.log(`*** FOUND XOR CONSTANT at offset ${i} (0x${i.toString(16)}) ***`);
    console.log(`  Bytes: ${slice.toString('hex')}`);
    candidates.push({ offset: i, bytes: slice.toString('hex'), type: 'XOR_CONSTANT' });
  }
  
  // Also check if this could be a seed that generates the XOR constant
  // through common PRNGs
}

// Look for timestamp-related patterns
console.log('\n=== Searching for timestamp patterns ===');
const timestamp = 1700000000;
const tsBytes = Buffer.alloc(4);
tsBytes.writeUInt32LE(timestamp);
const tsBytesBE = Buffer.alloc(4);
tsBytesBE.writeUInt32BE(timestamp);

for (let i = 0; i <= wasmBytes.length - 4; i++) {
  if (wasmBytes.slice(i, i + 4).equals(tsBytes)) {
    console.log(`Timestamp (LE) found at offset ${i}`);
  }
  if (wasmBytes.slice(i, i + 4).equals(tsBytesBE)) {
    console.log(`Timestamp (BE) found at offset ${i}`);
  }
}

// Look for string patterns that might indicate the algorithm
console.log('\n=== Searching for algorithm-related strings ===');
const searchStrings = ['xor', 'prng', 'random', 'seed', 'derive', 'hmac', 'hkdf', 'pbkdf'];
const wasmStr = wasmBytes.toString('latin1').toLowerCase();

for (const str of searchStrings) {
  let idx = wasmStr.indexOf(str);
  while (idx !== -1) {
    console.log(`"${str}" found at offset ${idx}`);
    idx = wasmStr.indexOf(str, idx + 1);
  }
}

// Analyze the data section content
console.log('\n=== Data section content analysis ===');
// The data section typically starts after the code section
// Look for ASCII strings in the binary
const strings = [];
let currentString = '';
let stringStart = -1;

for (let i = 0; i < wasmBytes.length; i++) {
  const byte = wasmBytes[i];
  if (byte >= 32 && byte < 127) {
    if (currentString === '') stringStart = i;
    currentString += String.fromCharCode(byte);
  } else {
    if (currentString.length >= 8) {
      strings.push({ offset: stringStart, str: currentString });
    }
    currentString = '';
  }
}

console.log(`Found ${strings.length} ASCII strings (8+ chars)`);
// Show strings that might be relevant
const relevantStrings = strings.filter(s => 
  s.str.includes('key') || 
  s.str.includes('hash') || 
  s.str.includes('sha') ||
  s.str.includes('xor') ||
  s.str.includes('derive') ||
  s.str.includes('secret') ||
  s.str.includes('salt')
);
for (const s of relevantStrings) {
  console.log(`  ${s.offset}: "${s.str}"`);
}

// Try to find embedded lookup tables
console.log('\n=== Searching for lookup tables ===');
// AES S-box first bytes: 0x63, 0x7c, 0x77, 0x7b
const aesSbox = Buffer.from([0x63, 0x7c, 0x77, 0x7b]);
for (let i = 0; i <= wasmBytes.length - 4; i++) {
  if (wasmBytes.slice(i, i + 4).equals(aesSbox)) {
    console.log(`AES S-box found at offset ${i}`);
    // Check if full S-box is present
    const fullSbox = wasmBytes.slice(i, i + 256);
    console.log(`  First 32 bytes: ${fullSbox.slice(0, 32).toString('hex')}`);
  }
}

// Summary
console.log('\n=== Summary ===');
console.log('XOR constant candidates found:', candidates.length);
if (candidates.length > 0) {
  for (const c of candidates) {
    console.log(`  Offset ${c.offset}: ${c.type}`);
  }
}
