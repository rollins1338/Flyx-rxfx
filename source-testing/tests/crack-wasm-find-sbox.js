/**
 * Crack WASM - Find AES S-Box and Key Schedule
 * 
 * The WASM uses fixslice32 AES implementation. Let's find the S-box
 * and try to understand the key schedule.
 */

const fs = require('fs');
const crypto = require('crypto');

// Standard AES S-box
const AES_SBOX = Buffer.from([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

// AES round constants
const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

async function analyzeWasm() {
  console.log('=== Analyze WASM Binary ===\n');
  
  const wasmPath = 'source-testing/tests/flixer_img_data.wasm';
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  console.log(`WASM size: ${wasmBuffer.length} bytes\n`);
  
  // Search for AES S-box in the binary
  console.log('Searching for AES S-box...');
  
  // The S-box might be stored in different formats
  // 1. Direct byte array
  let sboxPos = wasmBuffer.indexOf(AES_SBOX);
  if (sboxPos !== -1) {
    console.log(`  Found standard S-box at offset ${sboxPos}`);
  }
  
  // 2. Search for partial S-box (first 16 bytes)
  const sboxPartial = AES_SBOX.subarray(0, 16);
  let pos = 0;
  while ((pos = wasmBuffer.indexOf(sboxPartial, pos)) !== -1) {
    console.log(`  Found partial S-box match at offset ${pos}`);
    pos++;
  }
  
  // 3. Search for S-box in 32-bit format (fixslice uses this)
  // In fixslice, the S-box is represented differently
  
  // Search for known constants
  console.log('\nSearching for known constants...');
  
  // Base64 alphabet (used for decoding)
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  pos = wasmBuffer.indexOf(Buffer.from(base64Chars));
  if (pos !== -1) {
    console.log(`  Found Base64 alphabet at offset ${pos}`);
  }
  
  // Search for "aes" or "ctr" strings
  const searchStrings = ['aes', 'ctr', 'hmac', 'cipher', 'fixslice', 'encrypt', 'decrypt'];
  for (const str of searchStrings) {
    pos = 0;
    while ((pos = wasmBuffer.indexOf(Buffer.from(str), pos)) !== -1) {
      console.log(`  Found "${str}" at offset ${pos}`);
      pos++;
    }
  }
  
  // Look for the data section
  console.log('\nAnalyzing data section...');
  
  // WASM data section starts with 0x0b
  // Let's find large constant arrays
  const dataMatches = [];
  for (let i = 0; i < wasmBuffer.length - 256; i++) {
    // Look for sequences of non-zero bytes that could be lookup tables
    let nonZeroCount = 0;
    for (let j = 0; j < 256; j++) {
      if (wasmBuffer[i + j] !== 0) nonZeroCount++;
    }
    if (nonZeroCount > 200) {
      // Check if this looks like a lookup table
      const values = new Set();
      for (let j = 0; j < 256; j++) {
        values.add(wasmBuffer[i + j]);
      }
      if (values.size > 100) {
        dataMatches.push({ offset: i, uniqueValues: values.size });
      }
    }
  }
  
  console.log(`  Found ${dataMatches.length} potential lookup tables`);
  for (const match of dataMatches.slice(0, 5)) {
    console.log(`    Offset ${match.offset}: ${match.uniqueValues} unique values`);
  }
  
  // Look for the embedded key mentioned in get_img_key()
  console.log('\nSearching for embedded keys...');
  
  // The get_img_key function returns a constant string
  // Let's look for hex-like patterns
  const hexPattern = /[0-9a-f]{32,64}/gi;
  const wasmText = wasmBuffer.toString('latin1');
  const hexMatches = wasmText.match(hexPattern);
  if (hexMatches) {
    console.log(`  Found ${hexMatches.length} hex-like patterns`);
    for (const match of hexMatches.slice(0, 5)) {
      console.log(`    ${match.slice(0, 64)}...`);
    }
  }
  
  // Analyze the structure of the encrypted response
  console.log('\n=== Response Structure Analysis ===\n');
  
  // The overhead is 195 bytes. Let's think about what this could be:
  // - 16 bytes: IV/nonce
  // - 32 bytes: HMAC-SHA256
  // - 147 bytes: ???
  
  // Or:
  // - 12 bytes: GCM nonce
  // - 16 bytes: GCM tag
  // - 167 bytes: ???
  
  // Or:
  // - 195 bytes could be: 12 * 16 + 3 = 195 (12 blocks + 3 bytes)
  // - Or: 6 * 32 + 3 = 195 (6 SHA256 hashes + 3 bytes)
  
  console.log('Possible overhead structures:');
  console.log('  195 = 16 + 32 + 147 (IV + HMAC + ???)');
  console.log('  195 = 12 + 16 + 167 (GCM nonce + tag + ???)');
  console.log('  195 = 16 * 12 + 3 (12 AES blocks + 3)');
  console.log('  195 = 32 * 6 + 3 (6 SHA256 + 3)');
  console.log('  195 = 16 + 16 + 163 (IV + encrypted IV + ???)');
  console.log('  195 = 1 + 16 + 16 + 32 + 130 (version + IV + encrypted key + HMAC + ???)');
  
  // The ciphertext is 200 bytes, which is:
  // - 200 = 16 * 12 + 8 (12 full blocks + 8 bytes)
  // - 200 = 16 * 13 - 8 (13 blocks - 8 bytes)
  
  console.log('\nCiphertext structure:');
  console.log('  200 = 16 * 12 + 8 (12 full AES blocks + 8 bytes)');
  console.log('  200 bytes of JSON = ~200 chars');
}

analyzeWasm().catch(console.error);
