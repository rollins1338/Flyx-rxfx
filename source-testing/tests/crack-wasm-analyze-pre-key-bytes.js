/**
 * Analyze the bytes found before the key in memory
 * These might be intermediate values in the key derivation
 */

const crypto = require('crypto');

// Known values for timestamp=1700000000
const fpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
const key = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
const xorConstant = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';

// Bytes found at 1047776-1047840 (96 bytes before key)
// From the output:
// 1047776: 00 00 00 00 00 00 00 00 00 00 00 00 00 02 00 00 84 a4 a7 85 71 a7 9b e5 b8 11 d3 62 cc 41 08 42
// 1047808: 4a 9d 30 9b a0 6e 31 4c b1 8c 8c 51 d4 bd d3 be 1f 95 12 1e d4 c2 8a 49 87 44 77 a8 2f e8 ae 83
// 1047840: 45 ca 89 d7 bf ba 02 e0 be 16 1f fd e2 27 24 a9 64 35 37 31 31 30 30 65 91 ff 0f 00 3f 00 00 00

const preKeyBytes1 = '84a4a78571a79be5b811d362cc410842';
const preKeyBytes2 = '4a9d309ba06e314cb18c8c51d4bdd3be';
const preKeyBytes3 = '1f95121ed4c28a498744 77a82fe8ae83';
const preKeyBytes4 = '45ca89d7bfba02e0be161ffde22724a9';

// Clean up
const bytes1 = preKeyBytes1.replace(/\s/g, '');
const bytes2 = preKeyBytes2.replace(/\s/g, '');
const bytes3 = preKeyBytes3.replace(/\s/g, '');
const bytes4 = preKeyBytes4.replace(/\s/g, '');

console.log('Pre-key bytes analysis:');
console.log('Bytes 1 (16):', bytes1);
console.log('Bytes 2 (16):', bytes2);
console.log('Bytes 3 (16):', bytes3);
console.log('Bytes 4 (16):', bytes4);

// Combine into 32-byte sequences
const combined12 = bytes1 + bytes2;
const combined34 = bytes3 + bytes4;

console.log('\nCombined 1+2 (32 bytes):', combined12);
console.log('Combined 3+4 (32 bytes):', combined34);

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

const fpHashBytes = hexToBytes(fpHash);
const keyBytes = hexToBytes(key);
const xorBytes = hexToBytes(xorConstant);
const combined12Bytes = hexToBytes(combined12);
const combined34Bytes = hexToBytes(combined34);

console.log('\n=== XOR Analysis ===');

// XOR combined12 with fpHash
const c12XorFp = combined12Bytes.map((b, i) => b ^ fpHashBytes[i]);
console.log('combined12 XOR fpHash:', c12XorFp.map(b => b.toString(16).padStart(2, '0')).join(''));

// XOR combined12 with key
const c12XorKey = combined12Bytes.map((b, i) => b ^ keyBytes[i]);
console.log('combined12 XOR key:', c12XorKey.map(b => b.toString(16).padStart(2, '0')).join(''));

// XOR combined12 with xorConstant
const c12XorXor = combined12Bytes.map((b, i) => b ^ xorBytes[i]);
console.log('combined12 XOR xorConstant:', c12XorXor.map(b => b.toString(16).padStart(2, '0')).join(''));

// XOR combined34 with fpHash
const c34XorFp = combined34Bytes.map((b, i) => b ^ fpHashBytes[i]);
console.log('combined34 XOR fpHash:', c34XorFp.map(b => b.toString(16).padStart(2, '0')).join(''));

// XOR combined34 with key
const c34XorKey = combined34Bytes.map((b, i) => b ^ keyBytes[i]);
console.log('combined34 XOR key:', c34XorKey.map(b => b.toString(16).padStart(2, '0')).join(''));

// XOR combined34 with xorConstant
const c34XorXor = combined34Bytes.map((b, i) => b ^ xorBytes[i]);
console.log('combined34 XOR xorConstant:', c34XorXor.map(b => b.toString(16).padStart(2, '0')).join(''));

console.log('\n=== SHA256 Analysis ===');

// Check if any of these are SHA256 of something
const sha256Combined12 = crypto.createHash('sha256').update(Buffer.from(combined12Bytes)).digest('hex');
const sha256Combined34 = crypto.createHash('sha256').update(Buffer.from(combined34Bytes)).digest('hex');

console.log('SHA256(combined12):', sha256Combined12);
console.log('SHA256(combined34):', sha256Combined34);

// Check if combined12 or combined34 equals any known hash
console.log('\n=== Match Check ===');
console.log('combined12 == fpHash?', combined12 === fpHash);
console.log('combined12 == key?', combined12 === key);
console.log('combined12 == xorConstant?', combined12 === xorConstant);
console.log('combined34 == fpHash?', combined34 === fpHash);
console.log('combined34 == key?', combined34 === key);
console.log('combined34 == xorConstant?', combined34 === xorConstant);

// Check if these are SHA256 intermediate state (H values)
console.log('\n=== SHA256 State Analysis ===');

// SHA256 initial H values
const sha256H = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

// Convert combined12 to 32-bit words (big-endian)
function toWords(bytes) {
  const words = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push((bytes[i] << 24) | (bytes[i+1] << 16) | (bytes[i+2] << 8) | bytes[i+3]);
  }
  return words;
}

const words12 = toWords(combined12Bytes);
const words34 = toWords(combined34Bytes);

console.log('combined12 as words:', words12.map(w => '0x' + (w >>> 0).toString(16).padStart(8, '0')));
console.log('combined34 as words:', words34.map(w => '0x' + (w >>> 0).toString(16).padStart(8, '0')));

// XOR with SHA256 H values
const xorWithH12 = words12.map((w, i) => (w ^ sha256H[i]) >>> 0);
const xorWithH34 = words34.map((w, i) => (w ^ sha256H[i]) >>> 0);

console.log('combined12 XOR SHA256_H:', xorWithH12.map(w => '0x' + w.toString(16).padStart(8, '0')));
console.log('combined34 XOR SHA256_H:', xorWithH34.map(w => '0x' + w.toString(16).padStart(8, '0')));

// Also check the ASCII string "d5711300e" found at 1047856
console.log('\n=== ASCII Analysis ===');
const asciiBytes = [0x64, 0x35, 0x37, 0x31, 0x31, 0x30, 0x30, 0x65]; // "d5711300e" partial
console.log('ASCII at 1047856:', Buffer.from(asciiBytes).toString('utf8'));

// This looks like part of a hex string - could be part of the fingerprint hash or session ID
// Let's check if "5711300" appears in any of our known values
console.log('fpHash contains "5711"?', fpHash.includes('5711'));
console.log('key contains "5711"?', key.includes('5711'));
console.log('xorConstant contains "5711"?', xorConstant.includes('5711'));

// The timestamp is 1700000000, which in hex is 0x6553F100
console.log('\nTimestamp 1700000000 in hex:', (1700000000).toString(16));
