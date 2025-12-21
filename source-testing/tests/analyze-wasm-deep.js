/**
 * Deep WASM Analysis - Find the Encryption Algorithm
 * 
 * We know:
 * 1. Uses AES-CTR (from crate versions)
 * 2. Has authentication (modifying any byte fails)
 * 3. 195 bytes overhead
 * 4. Counter blocks are random per-request
 * 
 * The WASM must:
 * 1. Extract nonce from the encrypted data
 * 2. Verify authentication
 * 3. Decrypt using AES-CTR with the nonce
 * 
 * Let's search the WASM binary for clues about the structure.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function deepWasmAnalysis() {
  console.log('=== Deep WASM Binary Analysis ===\n');
  
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  console.log(`WASM size: ${wasmBuffer.length} bytes\n`);
  
  // Search for interesting byte patterns
  console.log('=== Searching for Patterns ===\n');
  
  // Look for constants that might indicate the algorithm
  // AES S-box first row: 63 7c 77 7b f2 6b 6f c5
  const sboxPattern = Buffer.from([0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5]);
  let sboxIndex = wasmBuffer.indexOf(sboxPattern);
  if (sboxIndex !== -1) {
    console.log(`AES S-box found at offset ${sboxIndex}`);
  }
  
  // Look for common magic numbers
  const magicNumbers = {
    'SHA256 init H0': Buffer.from([0x6a, 0x09, 0xe6, 0x67]),
    'SHA256 init H1': Buffer.from([0xbb, 0x67, 0xae, 0x85]),
    'HMAC ipad': Buffer.from([0x36, 0x36, 0x36, 0x36]),
    'HMAC opad': Buffer.from([0x5c, 0x5c, 0x5c, 0x5c]),
  };
  
  for (const [name, pattern] of Object.entries(magicNumbers)) {
    const index = wasmBuffer.indexOf(pattern);
    if (index !== -1) {
      console.log(`${name} found at offset ${index}`);
    }
  }
  
  // Search for strings that might indicate the algorithm
  console.log('\n=== Searching for Algorithm Strings ===\n');
  
  const algorithmStrings = [
    'aes', 'ctr', 'gcm', 'cbc', 'ecb',
    'sha', 'hmac', 'poly1305', 'chacha',
    'encrypt', 'decrypt', 'nonce', 'iv', 'tag',
    'verify', 'auth', 'mac', 'signature',
    'base64', 'hex', 'utf8',
  ];
  
  const wasmStr = wasmBuffer.toString('utf8');
  for (const str of algorithmStrings) {
    const regex = new RegExp(str, 'gi');
    const matches = wasmStr.match(regex);
    if (matches) {
      console.log(`"${str}": ${matches.length} occurrences`);
    }
  }
  
  // Look for numeric constants that might indicate sizes
  console.log('\n=== Looking for Size Constants ===\n');
  
  // Common sizes: 16 (AES block), 32 (SHA256), 12 (GCM nonce), 195 (our overhead)
  const sizes = [12, 16, 24, 32, 48, 64, 128, 195, 200, 395];
  
  for (const size of sizes) {
    // Count occurrences of the size as a 32-bit little-endian integer
    let count = 0;
    for (let i = 0; i < wasmBuffer.length - 4; i++) {
      if (wasmBuffer.readUInt32LE(i) === size) {
        count++;
      }
    }
    if (count > 0 && count < 100) {
      console.log(`Size ${size}: ${count} occurrences as u32`);
    }
  }
  
  // Let's also look at the structure of the encrypted data more carefully
  console.log('\n=== Analyzing Encrypted Data Structure ===\n');
  
  // The overhead is 195 bytes. Let's think about what this could be:
  // 
  // Possibility 1: [nonce (16)] [ciphertext (200)] [hmac (32)] = 248 bytes (not 395)
  // Possibility 2: [nonce (16)] [compressed_ciphertext] [hmac (32)]
  //                If plaintext is 200 bytes and compresses to ~147 bytes:
  //                16 + 147 + 32 = 195 bytes overhead... wait, that's the overhead!
  //
  // So the structure might be:
  // [nonce (16)] [compressed_ciphertext (200)] [hmac (32)] = 248 bytes
  // But we have 395 bytes...
  //
  // Let me recalculate:
  // encrypted = 395 bytes
  // decrypted = 200 bytes
  // overhead = 195 bytes
  //
  // If structure is [nonce][ciphertext][hmac]:
  // ciphertext = encrypted - nonce - hmac = 395 - 16 - 32 = 347 bytes
  // But decrypted is only 200 bytes...
  //
  // Unless the ciphertext is compressed!
  // compressed_plaintext = 347 bytes -> decompressed = 200 bytes? No, compression makes things smaller.
  //
  // Wait, maybe the plaintext is PADDED before encryption?
  // Or maybe there's additional metadata in the ciphertext?
  
  // Let's think about this differently:
  // The server sends 395 bytes
  // The WASM decrypts to 200 bytes
  // The extra 195 bytes must be: nonce + padding + MAC + possibly other metadata
  
  // Let's try to find the exact structure by looking at the WASM code
  
  // Search for function signatures that might indicate the decryption process
  console.log('\n=== Looking for Function Patterns ===\n');
  
  // In WASM, function calls often have specific patterns
  // Let's look for sequences that might indicate crypto operations
  
  // Look for the process_img_data function
  // It takes two strings (encrypted data and key) and returns a Promise
  
  // The WASM exports show:
  // - process_img_data: the main decryption function
  // - get_img_key: generates an API key
  
  // Let's see if we can find any clues about the key derivation
  console.log('Looking for key derivation patterns...');
  
  // HKDF uses specific labels
  const hkdfLabels = ['expand', 'extract', 'info', 'salt', 'prk', 'okm'];
  for (const label of hkdfLabels) {
    const index = wasmStr.indexOf(label);
    if (index !== -1) {
      console.log(`HKDF label "${label}" found at offset ${index}`);
    }
  }
  
  // Look for base64 alphabet (might indicate encoding/decoding)
  const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const b64Index = wasmStr.indexOf(base64Alphabet);
  if (b64Index !== -1) {
    console.log(`Base64 alphabet found at offset ${b64Index}`);
  }
  
  // Look for error messages that might give clues
  console.log('\n=== Looking for Error Messages ===\n');
  
  const errorPatterns = [
    /invalid/gi,
    /error/gi,
    /failed/gi,
    /decrypt/gi,
    /verify/gi,
    /tag/gi,
    /mac/gi,
  ];
  
  for (const pattern of errorPatterns) {
    const matches = wasmStr.match(pattern);
    if (matches) {
      console.log(`Pattern ${pattern}: ${matches.length} matches`);
    }
  }
  
  // Extract all readable strings longer than 10 characters
  console.log('\n=== Readable Strings (>10 chars) ===\n');
  
  const stringPattern = /[\x20-\x7e]{10,}/g;
  const strings = wasmStr.match(stringPattern);
  if (strings) {
    const uniqueStrings = [...new Set(strings)].filter(s => 
      !s.match(/^[0-9a-f]+$/i) && // Not just hex
      !s.match(/^[A-Za-z0-9+/=]+$/) && // Not just base64
      s.length < 100
    );
    console.log(`Found ${uniqueStrings.length} unique strings:`);
    uniqueStrings.slice(0, 30).forEach(s => console.log(`  "${s}"`));
  }
}

deepWasmAnalysis().catch(console.error);
