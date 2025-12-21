/**
 * Crack WASM - Find AES T-Tables
 * 
 * The aes-0.8.4 crate uses "soft" implementation which might use T-tables
 * or bitsliced implementation. Let's search for these.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate AES T-tables for comparison
function generateTTables() {
  // AES S-box
  const sbox = [
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
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ];
  
  return Buffer.from(sbox);
}

async function findTables() {
  console.log('=== Find AES Tables in WASM ===\n');
  
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  console.log(`WASM size: ${wasmBuffer.length} bytes\n`);
  
  // Generate S-box
  const sbox = generateTTables();
  
  // Search for S-box
  console.log('Searching for AES S-box (256 bytes)...');
  for (let i = 0; i <= wasmBuffer.length - 256; i++) {
    if (wasmBuffer.slice(i, i + 256).equals(sbox)) {
      console.log(`  S-box found at offset 0x${i.toString(16)}`);
    }
  }
  
  // Search for partial S-box matches
  console.log('\nSearching for partial S-box matches (first 32 bytes)...');
  const sboxPartial = sbox.slice(0, 32);
  for (let i = 0; i <= wasmBuffer.length - 32; i++) {
    if (wasmBuffer.slice(i, i + 32).equals(sboxPartial)) {
      console.log(`  Partial S-box match at offset 0x${i.toString(16)}`);
    }
  }
  
  // The "soft" AES implementation in Rust might use fixsliced implementation
  // Let's look for the "fixs" string we saw earlier
  console.log('\nSearching for "fixslice" implementation markers...');
  
  const markers = ['fixslice', 'fixs', 'soft', 'bitslice'];
  for (const marker of markers) {
    const markerBuf = Buffer.from(marker, 'utf8');
    for (let i = 0; i <= wasmBuffer.length - markerBuf.length; i++) {
      if (wasmBuffer.slice(i, i + markerBuf.length).equals(markerBuf)) {
        const start = Math.max(0, i - 30);
        const end = Math.min(wasmBuffer.length, i + markerBuf.length + 30);
        const context = wasmBuffer.slice(start, end).toString('utf8').replace(/[^\x20-\x7e]/g, '.');
        console.log(`  "${marker}" at 0x${i.toString(16)}: ${context}`);
      }
    }
  }
  
  // Look for CTR mode specific patterns
  console.log('\nSearching for CTR mode patterns...');
  
  // CTR mode typically has counter increment logic
  // Look for patterns like "ctr32" which we saw in the strings
  const ctrMarkers = ['ctr32', 'ctr64', 'counter', 'nonce'];
  for (const marker of ctrMarkers) {
    const markerBuf = Buffer.from(marker, 'utf8');
    for (let i = 0; i <= wasmBuffer.length - markerBuf.length; i++) {
      if (wasmBuffer.slice(i, i + markerBuf.length).equals(markerBuf)) {
        const start = Math.max(0, i - 30);
        const end = Math.min(wasmBuffer.length, i + markerBuf.length + 30);
        const context = wasmBuffer.slice(start, end).toString('utf8').replace(/[^\x20-\x7e]/g, '.');
        console.log(`  "${marker}" at 0x${i.toString(16)}: ${context}`);
      }
    }
  }
  
  // Look for the data section of the WASM
  console.log('\n=== Analyzing WASM Structure ===\n');
  
  // WASM magic number
  const magic = wasmBuffer.slice(0, 4);
  console.log(`Magic: ${magic.toString('hex')} (expected: 0061736d)`);
  
  // WASM version
  const version = wasmBuffer.readUInt32LE(4);
  console.log(`Version: ${version}`);
  
  // Parse sections
  let offset = 8;
  while (offset < wasmBuffer.length) {
    const sectionId = wasmBuffer[offset];
    offset++;
    
    // Read LEB128 size
    let size = 0;
    let shift = 0;
    while (true) {
      const byte = wasmBuffer[offset++];
      size |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    
    const sectionNames = {
      0: 'custom',
      1: 'type',
      2: 'import',
      3: 'function',
      4: 'table',
      5: 'memory',
      6: 'global',
      7: 'export',
      8: 'start',
      9: 'element',
      10: 'code',
      11: 'data',
      12: 'data count',
    };
    
    console.log(`Section ${sectionId} (${sectionNames[sectionId] || 'unknown'}): offset=0x${(offset).toString(16)}, size=${size}`);
    
    // If this is the data section, analyze it
    if (sectionId === 11) {
      console.log('\n  === Data Section Contents ===');
      const dataSection = wasmBuffer.slice(offset, offset + size);
      
      // Look for interesting patterns in data section
      console.log(`  Data section size: ${dataSection.length} bytes`);
      console.log(`  First 64 bytes: ${dataSection.slice(0, 64).toString('hex')}`);
      
      // Search for S-box in data section
      for (let i = 0; i <= dataSection.length - 256; i++) {
        if (dataSection.slice(i, i + 256).equals(sbox)) {
          console.log(`  S-box found in data section at offset ${i}`);
        }
      }
    }
    
    offset += size;
    
    if (offset >= wasmBuffer.length) break;
  }
}

findTables().catch(console.error);
