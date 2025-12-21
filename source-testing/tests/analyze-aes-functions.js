/**
 * Analyze AES Functions in WASM
 * 
 * Focus on func_58 and func_59 which have the most XOR operations.
 * These are likely the AES encryption/decryption functions.
 * 
 * Also analyze func_206 which handles fingerprinting and key derivation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WASM_PATH = 'source-testing/tests/wasm-analysis/img_data_bg.wasm';
const OUTPUT_DIR = 'source-testing/tests/wasm-analysis';

// Read the data section to find constants
function extractDataSection(buffer) {
  let offset = 8;
  
  while (offset < buffer.length) {
    const sectionId = buffer[offset++];
    
    let size = 0;
    let shift = 0;
    let byte;
    do {
      byte = buffer[offset++];
      size |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    if (sectionId === 11) { // Data section
      return buffer.slice(offset, offset + size);
    }
    
    offset += size;
  }
  
  return null;
}

function parseDataSegments(dataSection) {
  const segments = [];
  let offset = 0;
  
  // Number of segments
  let numSegments = 0;
  let shift = 0;
  let byte;
  do {
    byte = dataSection[offset++];
    numSegments |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  
  for (let i = 0; i < numSegments; i++) {
    const flags = dataSection[offset++];
    
    // Parse init expression
    let initOffset = 0;
    if (!(flags & 1)) {
      const opcode = dataSection[offset++];
      if (opcode === 0x41) { // i32.const
        let val = 0;
        shift = 0;
        do {
          byte = dataSection[offset++];
          val |= (byte & 0x7f) << shift;
          shift += 7;
        } while (byte & 0x80);
        // Sign extend
        if (shift < 32 && (byte & 0x40)) {
          val |= (~0 << shift);
        }
        initOffset = val;
      }
      offset++; // end opcode
    }
    
    // Data length
    let dataLen = 0;
    shift = 0;
    do {
      byte = dataSection[offset++];
      dataLen |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    const data = dataSection.slice(offset, offset + dataLen);
    segments.push({ initOffset, data });
    offset += dataLen;
  }
  
  return segments;
}

async function main() {
  console.log('=== AES Function Analysis ===\n');
  
  const buffer = fs.readFileSync(WASM_PATH);
  
  // Extract data section
  const dataSection = extractDataSection(buffer);
  const segments = parseDataSegments(dataSection);
  
  console.log(`Data segments: ${segments.length}`);
  for (const seg of segments) {
    console.log(`  Offset ${seg.initOffset}: ${seg.data.length} bytes`);
  }
  
  // Combine all data
  const allData = Buffer.concat(segments.map(s => s.data));
  const baseOffset = segments[0].initOffset;
  
  // Look for AES-related constants
  console.log('\n=== Looking for AES Constants ===\n');
  
  // AES S-box starts with: 0x63, 0x7c, 0x77, 0x7b
  const sboxStart = Buffer.from([0x63, 0x7c, 0x77, 0x7b]);
  let pos = allData.indexOf(sboxStart);
  if (pos !== -1) {
    console.log(`Found potential S-box at offset ${baseOffset + pos}`);
  }
  
  // Look for the embedded key we found earlier
  const embeddedKeyHex = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';
  const embeddedKey = Buffer.from(embeddedKeyHex, 'hex');
  pos = allData.indexOf(embeddedKey);
  if (pos !== -1) {
    console.log(`Found embedded key at offset ${baseOffset + pos}`);
  }
  
  // Look for base64 alphabet
  const base64Alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  pos = allData.indexOf(Buffer.from(base64Alpha));
  if (pos !== -1) {
    console.log(`Found base64 alphabet at offset ${baseOffset + pos}`);
  }
  
  // Look for specific strings
  const searchStrings = [
    'tmdb_session_id',
    'fingerprint',
    'canvas',
    'E55', // Mentioned in the crate path
    'E60',
    'E1',
    'E8',
    'E10',
  ];
  
  console.log('\nSearching for key strings:');
  for (const str of searchStrings) {
    pos = allData.indexOf(Buffer.from(str));
    if (pos !== -1) {
      // Get surrounding context
      const start = Math.max(0, pos - 20);
      const end = Math.min(allData.length, pos + str.length + 50);
      const context = allData.slice(start, end).toString('utf8').replace(/[^\x20-\x7e]/g, '.');
      console.log(`  "${str}" at ${baseOffset + pos}: ...${context}...`);
    }
  }
  
  // Analyze the structure around the embedded key location
  console.log('\n=== Analyzing Key Storage Area ===\n');
  
  // The embedded key is returned by get_img_key()
  // Let's find where it's stored
  
  // Search for 32-byte sequences that look like keys
  const potentialKeys = [];
  
  for (let i = 0; i <= allData.length - 32; i++) {
    const seq = allData.slice(i, i + 32);
    
    // Check if it looks like a hex-encoded key (all printable hex chars)
    const isHex = seq.every(b => 
      (b >= 0x30 && b <= 0x39) || // 0-9
      (b >= 0x41 && b <= 0x46) || // A-F
      (b >= 0x61 && b <= 0x66)    // a-f
    );
    
    if (isHex) {
      const hexStr = seq.toString('utf8');
      potentialKeys.push({
        offset: baseOffset + i,
        hex: hexStr,
        type: 'hex-string',
      });
    }
    
    // Check for high-entropy binary sequences
    const counts = new Array(256).fill(0);
    for (const b of seq) counts[b]++;
    let entropy = 0;
    for (const c of counts) {
      if (c > 0) {
        const p = c / 32;
        entropy -= p * Math.log2(p);
      }
    }
    
    if (entropy > 4.5 && new Set(seq).size > 24) {
      potentialKeys.push({
        offset: baseOffset + i,
        hex: seq.toString('hex'),
        type: 'binary',
        entropy,
      });
    }
  }
  
  // Deduplicate
  const seen = new Set();
  const uniqueKeys = potentialKeys.filter(k => {
    if (seen.has(k.hex)) return false;
    seen.add(k.hex);
    return true;
  });
  
  console.log('Potential keys found:');
  for (const key of uniqueKeys.slice(0, 20)) {
    console.log(`  [${key.offset}] ${key.type}: ${key.hex.slice(0, 64)}`);
  }
  
  // Look for the specific pattern used in fixslice32 AES
  console.log('\n=== Fixslice32 AES Analysis ===\n');
  
  // Fixslice32 uses bitsliced representation
  // It processes 32 blocks in parallel using 32-bit words
  // The S-box is implemented using boolean operations
  
  // Look for the round constants (rcon)
  const rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
  for (let i = 0; i <= allData.length - 10; i++) {
    let match = true;
    for (let j = 0; j < 10; j++) {
      if (allData[i + j] !== rcon[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`Found AES rcon at offset ${baseOffset + i}`);
    }
  }
  
  // The key derivation likely uses HMAC or HKDF
  // Let's look for HMAC-related constants
  
  // HMAC uses ipad (0x36) and opad (0x5c)
  const ipad = Buffer.alloc(64, 0x36);
  const opad = Buffer.alloc(64, 0x5c);
  
  pos = allData.indexOf(ipad);
  if (pos !== -1) {
    console.log(`Found HMAC ipad at offset ${baseOffset + pos}`);
  }
  
  pos = allData.indexOf(opad);
  if (pos !== -1) {
    console.log(`Found HMAC opad at offset ${baseOffset + pos}`);
  }
  
  // SHA-256 initial hash values
  const sha256Init = Buffer.from([
    0x67, 0xe6, 0x09, 0x6a, // H0
    0x85, 0xae, 0x67, 0xbb, // H1
    0x72, 0xf3, 0x6e, 0x3c, // H2
    0x3a, 0xf5, 0x4f, 0xa5, // H3
  ]);
  
  pos = allData.indexOf(sha256Init);
  if (pos !== -1) {
    console.log(`Found SHA-256 init values at offset ${baseOffset + pos}`);
  }
  
  // Look for the SHA-256 round constants (first few)
  const sha256K = Buffer.from([
    0x42, 0x8a, 0x2f, 0x98, // K0
    0x71, 0x37, 0x44, 0x91, // K1
    0xb5, 0xc0, 0xfb, 0xcf, // K2
    0xe9, 0xb5, 0xdb, 0xa5, // K3
  ]);
  
  pos = allData.indexOf(sha256K);
  if (pos !== -1) {
    console.log(`Found SHA-256 K constants at offset ${baseOffset + pos}`);
  }
  
  // Summary
  console.log('\n=== Summary ===\n');
  console.log('The WASM uses:');
  console.log('  - AES-256-CTR (fixslice32 implementation)');
  console.log('  - HMAC-SHA256 for authentication');
  console.log('  - Base64 for encoding');
  console.log('  - Browser fingerprinting for key derivation');
  console.log('');
  console.log('Key derivation likely involves:');
  console.log('  1. Collecting browser fingerprint (canvas, navigator, screen, etc.)');
  console.log('  2. Hashing fingerprint with embedded key');
  console.log('  3. Combining with API key');
  console.log('  4. Using result as AES key');
  console.log('');
  console.log('The IV/nonce is likely:');
  console.log('  - First 16 bytes of the encrypted response prefix');
  console.log('  - Or derived from the prefix using HMAC');
  
  // Save the data section for further analysis
  fs.writeFileSync(path.join(OUTPUT_DIR, 'data-section.bin'), allData);
  console.log(`\nData section saved to ${path.join(OUTPUT_DIR, 'data-section.bin')}`);
}

main().catch(console.error);
