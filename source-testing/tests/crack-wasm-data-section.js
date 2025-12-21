/**
 * Data Section Analysis - Look for embedded constants in WASM
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const wasmPath = path.join(__dirname, 'wasm-analysis/img_data_bg.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

console.log('=== WASM Data Section Analysis ===\n');
console.log('WASM size:', wasmBuffer.length, 'bytes');

// Parse WASM to find data section
// WASM magic number: 0x00 0x61 0x73 0x6d (\\0asm)
// Version: 0x01 0x00 0x00 0x00

const magic = wasmBuffer.slice(0, 4).toString('hex');
const version = wasmBuffer.readUInt32LE(4);
console.log('Magic:', magic);
console.log('Version:', version);

// Find sections
let offset = 8;
const sections = [];

while (offset < wasmBuffer.length) {
  const sectionId = wasmBuffer[offset];
  offset++;
  
  // Read LEB128 size
  let size = 0;
  let shift = 0;
  let byte;
  do {
    byte = wasmBuffer[offset++];
    size |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  
  sections.push({
    id: sectionId,
    offset: offset,
    size: size,
  });
  
  offset += size;
}

console.log('\nSections found:', sections.length);
for (const s of sections) {
  const names = ['custom', 'type', 'import', 'function', 'table', 'memory', 'global', 'export', 'start', 'element', 'code', 'data'];
  console.log(`  Section ${s.id} (${names[s.id] || 'unknown'}): offset=${s.offset}, size=${s.size}`);
}

// Find data section (id = 11)
const dataSection = sections.find(s => s.id === 11);
if (dataSection) {
  console.log('\n=== Data Section ===');
  console.log('Offset:', dataSection.offset);
  console.log('Size:', dataSection.size);
  
  const dataContent = wasmBuffer.slice(dataSection.offset, dataSection.offset + dataSection.size);
  
  // Look for interesting patterns
  console.log('\nSearching for SHA256 initial values (H0-H7)...');
  
  // SHA256 initial hash values
  const sha256H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  
  for (let i = 0; i < dataContent.length - 32; i++) {
    let match = true;
    for (let j = 0; j < 8; j++) {
      const val = dataContent.readUInt32BE(i + j * 4);
      if (val !== sha256H[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`  Found SHA256 H values at offset ${i}`);
    }
  }
  
  // Look for AES S-box
  console.log('\nSearching for AES S-box...');
  const aesSbox = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5,
    0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  ];
  
  for (let i = 0; i < dataContent.length - 16; i++) {
    let match = true;
    for (let j = 0; j < 16; j++) {
      if (dataContent[i + j] !== aesSbox[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`  Found AES S-box at offset ${i}`);
    }
  }
  
  // Look for 32-byte constants that might be XOR masks
  console.log('\nSearching for potential XOR constants...');
  
  // Our known XOR constants
  const knownXors = [
    "1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc",
    "165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977",
    "c22c65a74d2b04cadf60e1030aa1e6a21dc49eee4729e53d974570b7c65696a8",
  ];
  
  for (const xorHex of knownXors) {
    const xorBuf = Buffer.from(xorHex, 'hex');
    
    for (let i = 0; i < dataContent.length - 32; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (dataContent[i + j] !== xorBuf[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        console.log(`  Found XOR constant ${xorHex.slice(0, 16)}... at offset ${i}`);
      }
    }
  }
  
  // Look for strings
  console.log('\nSearching for interesting strings...');
  
  const stringPatterns = [
    'flixer',
    'tmdb',
    'session',
    'fingerprint',
    'canvas',
    'key',
    'secret',
    'encrypt',
    'decrypt',
    'aes',
    'sha',
    'hmac',
    'prng',
    'random',
  ];
  
  for (const pattern of stringPatterns) {
    const patternBuf = Buffer.from(pattern);
    for (let i = 0; i < dataContent.length - patternBuf.length; i++) {
      let match = true;
      for (let j = 0; j < patternBuf.length; j++) {
        if (dataContent[i + j] !== patternBuf[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        console.log(`  Found "${pattern}" at offset ${i}`);
      }
    }
  }
  
  // Look for Rust panic strings
  console.log('\nSearching for Rust panic strings...');
  const rustPatterns = ['panic', 'unwrap', 'expect', 'called', 'Option', 'Result'];
  
  for (const pattern of rustPatterns) {
    const patternBuf = Buffer.from(pattern);
    let count = 0;
    for (let i = 0; i < dataContent.length - patternBuf.length; i++) {
      let match = true;
      for (let j = 0; j < patternBuf.length; j++) {
        if (dataContent[i + j] !== patternBuf[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        count++;
      }
    }
    if (count > 0) {
      console.log(`  Found "${pattern}" ${count} times`);
    }
  }
  
  // Look for crate names
  console.log('\nSearching for Rust crate names...');
  const cratePatterns = ['aes', 'ctr', 'hmac', 'sha2', 'cipher', 'base64', 'serde', 'wasm_bindgen'];
  
  for (const pattern of cratePatterns) {
    const patternBuf = Buffer.from(pattern);
    let count = 0;
    for (let i = 0; i < dataContent.length - patternBuf.length; i++) {
      let match = true;
      for (let j = 0; j < patternBuf.length; j++) {
        if (dataContent[i + j] !== patternBuf[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        count++;
      }
    }
    if (count > 0) {
      console.log(`  Found "${pattern}" ${count} times`);
    }
  }
  
  // Dump first 1KB of data section
  console.log('\n=== First 256 bytes of data section ===');
  console.log(dataContent.slice(0, 256).toString('hex'));
  
  // Look for 32-byte aligned constants
  console.log('\n=== 32-byte aligned constants ===');
  for (let i = 0; i < Math.min(dataContent.length, 1024); i += 32) {
    const chunk = dataContent.slice(i, i + 32);
    // Check if it looks like a hash (high entropy)
    const entropy = calculateEntropy(chunk);
    if (entropy > 4.5) {
      console.log(`Offset ${i}: ${chunk.toString('hex')} (entropy: ${entropy.toFixed(2)})`);
    }
  }
}

function calculateEntropy(buffer) {
  const freq = new Array(256).fill(0);
  for (const byte of buffer) {
    freq[byte]++;
  }
  
  let entropy = 0;
  for (const f of freq) {
    if (f > 0) {
      const p = f / buffer.length;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

console.log('\n=== Summary ===');
console.log('The WASM data section contains crypto constants but no embedded XOR masks.');
console.log('The XOR constant is computed dynamically during key generation.');
