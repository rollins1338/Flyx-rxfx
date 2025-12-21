/**
 * Deep Binary Analysis - Analyze the WASM binary to find the key derivation
 * 
 * Strategy:
 * 1. Find SHA256 constants in the binary
 * 2. Look for the key derivation function structure
 * 3. Find any additional constants or salts
 */

const fs = require('fs');
const crypto = require('crypto');

function analyzeWasmBinary() {
  console.log('=== Deep WASM Binary Analysis ===\n');
  
  const wasmPath = 'source-testing/tests/wasm-analysis/client-assets/img_data_bg.wasm';
  const wasm = fs.readFileSync(wasmPath);
  
  console.log(`WASM size: ${wasm.length} bytes`);
  
  // SHA256 initial hash values (H0-H7)
  const sha256H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  
  // SHA256 round constants (K)
  const sha256K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  ];
  
  // Search for SHA256 constants
  console.log('\n=== Searching for SHA256 Constants ===\n');
  
  for (let i = 0; i < wasm.length - 4; i++) {
    // Read as little-endian 32-bit
    const val = wasm.readUInt32LE(i);
    
    if (sha256H.includes(val)) {
      const idx = sha256H.indexOf(val);
      console.log(`Found SHA256 H${idx} (0x${val.toString(16)}) at offset ${i}`);
    }
    
    if (sha256K.includes(val)) {
      const idx = sha256K.indexOf(val);
      console.log(`Found SHA256 K${idx} (0x${val.toString(16)}) at offset ${i}`);
    }
  }
  
  // Search for interesting byte patterns
  console.log('\n=== Searching for Interesting Patterns ===\n');
  
  // Look for potential salt/key bytes (32-byte sequences that aren't all zeros)
  const potentialKeys = [];
  
  for (let i = 0; i < wasm.length - 32; i++) {
    const bytes = wasm.slice(i, i + 32);
    
    // Check if it looks like a key (not all zeros, not all same byte, has entropy)
    const uniqueBytes = new Set(bytes);
    if (uniqueBytes.size >= 16) { // High entropy
      // Check if it's not just incrementing bytes
      let isIncrementing = true;
      for (let j = 1; j < bytes.length; j++) {
        if (bytes[j] !== bytes[j-1] + 1) {
          isIncrementing = false;
          break;
        }
      }
      
      if (!isIncrementing) {
        // Check if it's in the data section (after code)
        if (i > 100000) { // Likely in data section
          potentialKeys.push({
            offset: i,
            hex: bytes.toString('hex'),
          });
        }
      }
    }
  }
  
  console.log(`Found ${potentialKeys.length} potential key/salt sequences`);
  
  // Show first 20
  for (const key of potentialKeys.slice(0, 20)) {
    console.log(`  [${key.offset}] ${key.hex}`);
  }
  
  // Search for format string patterns
  console.log('\n=== Searching for Format Patterns ===\n');
  
  // Look for sequences of colons (the separator in our fingerprint)
  const colonPattern = Buffer.from(':::');
  for (let i = 0; i < wasm.length - colonPattern.length; i++) {
    if (wasm.slice(i, i + colonPattern.length).equals(colonPattern)) {
      // Found multiple colons, extract context
      const start = Math.max(0, i - 50);
      const end = Math.min(wasm.length, i + 50);
      const context = wasm.slice(start, end).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
      console.log(`Found colons at ${i}: ${context}`);
    }
  }
  
  // Look for "{}:{}" pattern (Rust format string)
  const formatPattern = Buffer.from('{}:{}');
  for (let i = 0; i < wasm.length - formatPattern.length; i++) {
    if (wasm.slice(i, i + formatPattern.length).equals(formatPattern)) {
      const start = Math.max(0, i - 20);
      const end = Math.min(wasm.length, i + 50);
      const context = wasm.slice(start, end).toString('ascii').replace(/[^\x20-\x7E]/g, '.');
      console.log(`Found format pattern at ${i}: ${context}`);
    }
  }
  
  // Search for the data section
  console.log('\n=== Analyzing Data Section ===\n');
  
  // The data section typically starts after the code section
  // Look for the "data" section marker
  const dataMarker = Buffer.from([0x0b]); // data section ID
  
  // Find all printable ASCII strings > 20 chars
  const strings = [];
  let currentString = '';
  let currentStart = -1;
  
  for (let i = 0; i < wasm.length; i++) {
    const byte = wasm[i];
    if (byte >= 32 && byte < 127) {
      if (currentStart === -1) currentStart = i;
      currentString += String.fromCharCode(byte);
    } else {
      if (currentString.length >= 20) {
        strings.push({ offset: currentStart, str: currentString });
      }
      currentString = '';
      currentStart = -1;
    }
  }
  
  console.log(`Found ${strings.length} strings >= 20 chars`);
  
  // Look for strings that might be related to key derivation
  const keyRelatedStrings = strings.filter(s => 
    s.str.includes('key') ||
    s.str.includes('hash') ||
    s.str.includes('sha') ||
    s.str.includes('derive') ||
    s.str.includes('fingerprint') ||
    s.str.includes('session') ||
    s.str.includes('canvas') ||
    s.str.includes('{}') ||
    s.str.includes('format')
  );
  
  console.log('\nKey-related strings:');
  for (const s of keyRelatedStrings) {
    console.log(`  [${s.offset}] ${s.str.slice(0, 100)}`);
  }
  
  // Look for the specific format we found
  console.log('\n=== Looking for Format Template ===\n');
  
  // The format might be stored as a template string
  // Look for patterns like "{}:{}:{}:{}:{}:{}:{}"
  const templatePatterns = [
    '{}:{}:{}:{}:{}:{}:{}',
    '{}|{}|{}|{}|{}|{}|{}',
    '{0}:{1}:{2}:{3}:{4}:{5}:{6}',
  ];
  
  for (const pattern of templatePatterns) {
    const patternBuf = Buffer.from(pattern);
    for (let i = 0; i < wasm.length - patternBuf.length; i++) {
      if (wasm.slice(i, i + patternBuf.length).equals(patternBuf)) {
        console.log(`Found template "${pattern}" at offset ${i}`);
      }
    }
  }
  
  // Look for numeric constants that might be used in key derivation
  console.log('\n=== Looking for Numeric Constants ===\n');
  
  // Common constants in crypto
  const cryptoConstants = [
    { name: 'SHA256 block size', value: 64 },
    { name: 'SHA256 digest size', value: 32 },
    { name: 'AES block size', value: 16 },
    { name: 'AES-256 key size', value: 32 },
    { name: 'HMAC iterations', value: 1000 },
    { name: 'PBKDF2 iterations', value: 10000 },
  ];
  
  // Look for i32.const instructions with these values
  // i32.const is encoded as 0x41 followed by LEB128 value
  for (let i = 0; i < wasm.length - 2; i++) {
    if (wasm[i] === 0x41) { // i32.const
      // Read LEB128 value
      let value = 0;
      let shift = 0;
      let j = i + 1;
      while (j < wasm.length) {
        const byte = wasm[j];
        value |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) break;
        shift += 7;
        j++;
      }
      
      // Check if it's an interesting value
      if (value === 131) { // Our fingerprint string length!
        console.log(`Found i32.const 131 (fingerprint length) at offset ${i}`);
      }
      if (value === 50) { // Truncation length
        console.log(`Found i32.const 50 (truncation length) at offset ${i}`);
      }
    }
  }
  
  // Save analysis results
  const results = {
    wasmSize: wasm.length,
    stringsFound: strings.length,
    keyRelatedStrings: keyRelatedStrings,
    potentialKeys: potentialKeys.slice(0, 50),
  };
  
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/binary-analysis.json',
    JSON.stringify(results, null, 2)
  );
  
  console.log('\nResults saved to: source-testing/tests/wasm-analysis/binary-analysis.json');
}

analyzeWasmBinary();
