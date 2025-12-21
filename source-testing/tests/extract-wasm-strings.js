/**
 * Extract strings from WASM data section
 */

const fs = require('fs');

const WASM_PATH = 'source-testing/tests/wasm-analysis/client-assets/img_data_bg.wasm';

// Read the WASM binary
const buffer = fs.readFileSync(WASM_PATH);

console.log(`WASM size: ${buffer.length} bytes\n`);

// Parse WASM sections
let offset = 8; // Skip magic number and version

function readLEB128(buffer, offset) {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  let byte;
  
  do {
    byte = buffer[offset + bytesRead];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    bytesRead++;
  } while (byte & 0x80);
  
  return { value: result, bytesRead };
}

while (offset < buffer.length) {
  const sectionId = buffer[offset++];
  const { value: size, bytesRead } = readLEB128(buffer, offset);
  offset += bytesRead;
  
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
  
  console.log(`Section ${sectionId} (${sectionNames[sectionId] || 'unknown'}): ${size} bytes at offset ${offset}`);
  
  if (sectionId === 11) {
    // Data section
    console.log('\n=== Data Section ===\n');
    
    let dataOffset = offset;
    const { value: numSegments, bytesRead: nb } = readLEB128(buffer, dataOffset);
    dataOffset += nb;
    
    console.log(`Number of data segments: ${numSegments}\n`);
    
    for (let i = 0; i < numSegments; i++) {
      const flags = buffer[dataOffset++];
      
      if (flags === 0) {
        // Active segment with memory index 0
        // Skip the init expression (i32.const followed by value)
        if (buffer[dataOffset] === 0x41) {
          dataOffset++; // Skip i32.const opcode
          const { value: memOffset, bytesRead: mb } = readLEB128(buffer, dataOffset);
          dataOffset += mb;
          dataOffset++; // Skip end opcode (0x0b)
          
          const { value: dataSize, bytesRead: db } = readLEB128(buffer, dataOffset);
          dataOffset += db;
          
          const data = buffer.slice(dataOffset, dataOffset + dataSize);
          dataOffset += dataSize;
          
          // Look for interesting offsets
          const interestingOffsets = [1050896, 1050945, 1050957, 1050984, 1050996, 1051180, 1051182, 1051184, 1051186, 1051188, 1051190, 1051192];
          
          for (const targetOffset of interestingOffsets) {
            if (targetOffset >= memOffset && targetOffset < memOffset + dataSize) {
              const localOffset = targetOffset - memOffset;
              // Extract string (null-terminated or fixed length)
              let str = '';
              for (let j = localOffset; j < Math.min(localOffset + 100, dataSize); j++) {
                const byte = data[j];
                if (byte === 0) break;
                if (byte >= 32 && byte < 127) {
                  str += String.fromCharCode(byte);
                } else {
                  str += '.';
                }
              }
              console.log(`Offset ${targetOffset}: "${str}"`);
            }
          }
          
          // Also look for readable strings
          if (dataSize > 0) {
            let str = '';
            let strStart = memOffset;
            for (let j = 0; j < dataSize; j++) {
              const byte = data[j];
              if (byte >= 32 && byte < 127) {
                if (str.length === 0) strStart = memOffset + j;
                str += String.fromCharCode(byte);
              } else {
                if (str.length > 10 && /[a-zA-Z]{4,}/.test(str)) {
                  // Check if it's an interesting string
                  if (str.includes('TMDB') || str.includes('Image') || str.includes('Enhancement') ||
                      str.includes('session') || str.includes('canvas') || str.includes('key') ||
                      str.includes('aes') || str.includes('hmac') || str.includes('sha') ||
                      str.includes('font') || str.includes('Arial') || str.includes('px')) {
                    console.log(`String at ${strStart}: "${str.slice(0, 100)}"`);
                  }
                }
                str = '';
              }
            }
          }
        }
      }
    }
  }
  
  offset += size;
}

// Also search for specific byte patterns
console.log('\n=== Searching for specific patterns ===\n');

// Search for "tmdb_session_id"
const searchStr = 'tmdb_session_id';
const searchBytes = Buffer.from(searchStr);
for (let i = 0; i < buffer.length - searchBytes.length; i++) {
  if (buffer.slice(i, i + searchBytes.length).equals(searchBytes)) {
    console.log(`Found "${searchStr}" at offset ${i}`);
    // Show surrounding context
    const start = Math.max(0, i - 20);
    const end = Math.min(buffer.length, i + searchBytes.length + 50);
    const context = buffer.slice(start, end).toString('utf8').replace(/[^\x20-\x7E]/g, '.');
    console.log(`Context: ${context}`);
  }
}

// Search for "TMDB"
const searchStr2 = 'TMDB';
const searchBytes2 = Buffer.from(searchStr2);
for (let i = 0; i < buffer.length - searchBytes2.length; i++) {
  if (buffer.slice(i, i + searchBytes2.length).equals(searchBytes2)) {
    console.log(`Found "${searchStr2}" at offset ${i}`);
    const start = Math.max(0, i - 10);
    const end = Math.min(buffer.length, i + 60);
    const context = buffer.slice(start, end).toString('utf8').replace(/[^\x20-\x7E]/g, '.');
    console.log(`Context: ${context}`);
  }
}

// Search for font strings
const searchStr3 = 'px ';
const searchBytes3 = Buffer.from(searchStr3);
for (let i = 0; i < buffer.length - searchBytes3.length; i++) {
  if (buffer.slice(i, i + searchBytes3.length).equals(searchBytes3)) {
    const start = Math.max(0, i - 10);
    const end = Math.min(buffer.length, i + 30);
    const context = buffer.slice(start, end).toString('utf8').replace(/[^\x20-\x7E]/g, '.');
    if (context.includes('Arial') || context.includes('sans') || context.includes('serif')) {
      console.log(`Font string at ${i}: ${context}`);
    }
  }
}

console.log('\nDone!');
