/**
 * Extract constants from WASM data section
 * 
 * Looking for the values at offsets:
 * - 1050664 (8 bytes)
 * - 1050672 (8 bytes)
 * - 1050680 (8 bytes)
 * - 1050688 (8 bytes)
 * 
 * These are likely SHA256 initial hash values or HMAC constants
 */

const fs = require('fs');

const WASM_PATH = 'source-testing/tests/wasm-analysis/client-assets/img_data_bg.wasm';

// Read the WASM binary
const buffer = fs.readFileSync(WASM_PATH);

console.log(`WASM size: ${buffer.length} bytes\n`);

// Parse WASM to find data section
let offset = 8;

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
  
  if (sectionId === 11) {
    // Data section
    let dataOffset = offset;
    const { value: numSegments, bytesRead: nb } = readLEB128(buffer, dataOffset);
    dataOffset += nb;
    
    for (let i = 0; i < numSegments; i++) {
      const flags = buffer[dataOffset++];
      
      if (flags === 0) {
        if (buffer[dataOffset] === 0x41) {
          dataOffset++;
          const { value: memOffset, bytesRead: mb } = readLEB128(buffer, dataOffset);
          dataOffset += mb;
          dataOffset++;
          
          const { value: dataSize, bytesRead: db } = readLEB128(buffer, dataOffset);
          dataOffset += db;
          
          const data = buffer.slice(dataOffset, dataOffset + dataSize);
          dataOffset += dataSize;
          
          // Check if our target offsets are in this segment
          const targetOffsets = [1050664, 1050672, 1050680, 1050688, 1051108];
          
          for (const target of targetOffsets) {
            if (target >= memOffset && target < memOffset + dataSize) {
              const localOffset = target - memOffset;
              
              // Read 8 bytes as i64
              const bytes = data.slice(localOffset, localOffset + 8);
              const hex = bytes.toString('hex');
              
              // Also read as two i32s
              const low = data.readUInt32LE(localOffset);
              const high = data.readUInt32LE(localOffset + 4);
              
              console.log(`Offset ${target}:`);
              console.log(`  Hex: ${hex}`);
              console.log(`  Low i32: 0x${low.toString(16)} (${low})`);
              console.log(`  High i32: 0x${high.toString(16)} (${high})`);
              
              // Check if it looks like SHA256 constants
              // SHA256 initial hash values (H0-H7):
              // 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a
              // 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
              const sha256H = [
                0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
              ];
              
              if (sha256H.includes(low) || sha256H.includes(high)) {
                console.log(`  *** Matches SHA256 initial hash value! ***`);
              }
              
              console.log();
            }
          }
          
          // Also look for the format string at 1051108
          if (1051108 >= memOffset && 1051108 < memOffset + dataSize) {
            const localOffset = 1051108 - memOffset;
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
            console.log(`Format string at 1051108: "${str}"`);
          }
        }
      }
    }
  }
  
  offset += size;
}

// SHA256 constants for reference
console.log('\n=== SHA256 Initial Hash Values (for reference) ===');
const sha256H = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];
for (let i = 0; i < sha256H.length; i++) {
  console.log(`  H${i}: 0x${sha256H[i].toString(16)}`);
}

// HMAC uses ipad (0x36) and opad (0x5c)
console.log('\n=== HMAC Constants ===');
console.log('  ipad: 0x36 repeated');
console.log('  opad: 0x5c repeated');
