/**
 * Crack WASM - Find AES Implementation
 * 
 * Let's search the WASM binary for AES S-box and other constants
 * to locate the AES implementation.
 */

const fs = require('fs');
const path = require('path');

async function findAes() {
  console.log('=== Find AES Implementation in WASM ===\n');
  
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  console.log(`WASM size: ${wasmBuffer.length} bytes\n`);
  
  // AES S-box (first 16 bytes)
  const sbox = Buffer.from([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5,
    0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76
  ]);
  
  // AES inverse S-box (first 16 bytes)
  const invSbox = Buffer.from([
    0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38,
    0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb
  ]);
  
  // AES round constants
  const rcon = Buffer.from([0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);
  
  // Search for S-box
  console.log('Searching for AES S-box...');
  for (let i = 0; i <= wasmBuffer.length - sbox.length; i++) {
    if (wasmBuffer.slice(i, i + sbox.length).equals(sbox)) {
      console.log(`  S-box found at offset 0x${i.toString(16)}`);
      
      // Check if full S-box is there (256 bytes)
      const fullSbox = wasmBuffer.slice(i, i + 256);
      console.log(`  Full S-box (256 bytes): ${fullSbox.slice(0, 32).toString('hex')}...`);
    }
  }
  
  // Search for inverse S-box
  console.log('\nSearching for AES inverse S-box...');
  for (let i = 0; i <= wasmBuffer.length - invSbox.length; i++) {
    if (wasmBuffer.slice(i, i + invSbox.length).equals(invSbox)) {
      console.log(`  Inverse S-box found at offset 0x${i.toString(16)}`);
    }
  }
  
  // Search for round constants
  console.log('\nSearching for AES round constants...');
  for (let i = 0; i <= wasmBuffer.length - rcon.length; i++) {
    if (wasmBuffer.slice(i, i + rcon.length).equals(rcon)) {
      console.log(`  Round constants found at offset 0x${i.toString(16)}`);
    }
  }
  
  // Search for common AES-related strings
  console.log('\nSearching for AES-related strings...');
  const strings = ['aes', 'AES', 'ctr', 'CTR', 'hmac', 'HMAC', 'sha256', 'SHA256'];
  
  for (const str of strings) {
    const strBuf = Buffer.from(str, 'utf8');
    for (let i = 0; i <= wasmBuffer.length - strBuf.length; i++) {
      if (wasmBuffer.slice(i, i + strBuf.length).equals(strBuf)) {
        // Get surrounding context
        const start = Math.max(0, i - 20);
        const end = Math.min(wasmBuffer.length, i + strBuf.length + 20);
        const context = wasmBuffer.slice(start, end).toString('utf8').replace(/[^\x20-\x7e]/g, '.');
        console.log(`  "${str}" at 0x${i.toString(16)}: ...${context}...`);
      }
    }
  }
  
  // Search for base64 alphabet
  console.log('\nSearching for base64 alphabet...');
  const base64 = Buffer.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', 'utf8');
  for (let i = 0; i <= wasmBuffer.length - base64.length; i++) {
    if (wasmBuffer.slice(i, i + base64.length).equals(base64)) {
      console.log(`  Base64 alphabet at 0x${i.toString(16)}`);
    }
  }
  
  // Search for hex alphabet
  console.log('\nSearching for hex alphabet...');
  const hexLower = Buffer.from('0123456789abcdef', 'utf8');
  const hexUpper = Buffer.from('0123456789ABCDEF', 'utf8');
  
  for (let i = 0; i <= wasmBuffer.length - hexLower.length; i++) {
    if (wasmBuffer.slice(i, i + hexLower.length).equals(hexLower)) {
      console.log(`  Hex alphabet (lower) at 0x${i.toString(16)}`);
    }
    if (wasmBuffer.slice(i, i + hexUpper.length).equals(hexUpper)) {
      console.log(`  Hex alphabet (upper) at 0x${i.toString(16)}`);
    }
  }
  
  // Look for the data section
  console.log('\n=== WASM Data Section Analysis ===\n');
  
  // Find data section by looking for patterns
  // WASM data sections often contain initialized data like lookup tables
  
  // Look for sequences of 256 unique bytes (could be S-box)
  console.log('Looking for 256-byte lookup tables...');
  
  for (let i = 0; i <= wasmBuffer.length - 256; i++) {
    const slice = wasmBuffer.slice(i, i + 256);
    const unique = new Set(slice);
    
    if (unique.size === 256) {
      // This is a permutation of 0-255, could be S-box
      console.log(`  Permutation table at 0x${i.toString(16)}`);
      console.log(`    First 32 bytes: ${slice.slice(0, 32).toString('hex')}`);
      
      // Check if it's the AES S-box
      if (slice[0] === 0x63 && slice[1] === 0x7c) {
        console.log(`    *** This is the AES S-box! ***`);
      }
    }
  }
  
  // Look for error messages that might give hints
  console.log('\nSearching for error messages...');
  
  // Find null-terminated strings
  let stringStart = -1;
  const foundStrings = [];
  
  for (let i = 0; i < wasmBuffer.length; i++) {
    const byte = wasmBuffer[i];
    
    if (byte >= 0x20 && byte < 0x7f) {
      if (stringStart === -1) {
        stringStart = i;
      }
    } else {
      if (stringStart !== -1 && i - stringStart >= 8) {
        const str = wasmBuffer.slice(stringStart, i).toString('utf8');
        if (str.match(/error|fail|invalid|decrypt|encrypt|key|nonce|counter|block|cipher/i)) {
          foundStrings.push({ offset: stringStart, str });
        }
      }
      stringStart = -1;
    }
  }
  
  for (const { offset, str } of foundStrings.slice(0, 20)) {
    console.log(`  0x${offset.toString(16)}: "${str}"`);
  }
}

findAes().catch(console.error);
