/**
 * Analyze the mystery 32-byte sequence found at offset 1048280
 * Check if it's related to the key derivation
 */

const crypto = require('crypto');

// Known values for timestamp=1700000000
const fpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
const key = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
const xorConstant = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';

// Mystery bytes found at offset 1048280 (112 bytes before key)
const mysteryBytes = '0d5ea4ad9a3e9de4851c97cd28c776478d7495f9b084ebd0833154 8e10207fd1';

// Clean up and parse
const mysteryHex = mysteryBytes.replace(/\s/g, '');
console.log('Mystery bytes:', mysteryHex);
console.log('Length:', mysteryHex.length / 2, 'bytes');

// Convert to bytes
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
const mystery = hexToBytes(mysteryHex);

console.log('\n=== XOR Analysis ===');

// XOR mystery with fpHash
const mysteryXorFpHash = mystery.map((b, i) => b ^ fpHashBytes[i]);
console.log('mystery XOR fpHash:', mysteryXorFpHash.map(b => b.toString(16).padStart(2, '0')).join(''));

// XOR mystery with key
const mysteryXorKey = mystery.map((b, i) => b ^ keyBytes[i]);
console.log('mystery XOR key:', mysteryXorKey.map(b => b.toString(16).padStart(2, '0')).join(''));

// XOR mystery with xorConstant
const mysteryXorXor = mystery.map((b, i) => b ^ xorBytes[i]);
console.log('mystery XOR xorConstant:', mysteryXorXor.map(b => b.toString(16).padStart(2, '0')).join(''));

// Check if mystery is SHA256 of something
console.log('\n=== SHA256 Analysis ===');

// SHA256 of fpHash bytes
const sha256FpHashBytes = crypto.createHash('sha256').update(Buffer.from(fpHashBytes)).digest('hex');
console.log('SHA256(fpHash bytes):', sha256FpHashBytes);

// SHA256 of fpHash hex string
const sha256FpHashHex = crypto.createHash('sha256').update(fpHash).digest('hex');
console.log('SHA256(fpHash hex):', sha256FpHashHex);

// SHA256 of key bytes
const sha256KeyBytes = crypto.createHash('sha256').update(Buffer.from(keyBytes)).digest('hex');
console.log('SHA256(key bytes):', sha256KeyBytes);

// SHA256 of key hex string
const sha256KeyHex = crypto.createHash('sha256').update(key).digest('hex');
console.log('SHA256(key hex):', sha256KeyHex);

// SHA256 of xorConstant bytes
const sha256XorBytes = crypto.createHash('sha256').update(Buffer.from(xorBytes)).digest('hex');
console.log('SHA256(xorConstant bytes):', sha256XorBytes);

// Check if mystery equals any of these
console.log('\n=== Match Check ===');
console.log('mystery == SHA256(fpHash bytes)?', mysteryHex === sha256FpHashBytes);
console.log('mystery == SHA256(fpHash hex)?', mysteryHex === sha256FpHashHex);
console.log('mystery == SHA256(key bytes)?', mysteryHex === sha256KeyBytes);
console.log('mystery == SHA256(key hex)?', mysteryHex === sha256KeyHex);

// Check byte-reversed versions
const mysteryReversed = mystery.slice().reverse();
console.log('\nmystery reversed:', mysteryReversed.map(b => b.toString(16).padStart(2, '0')).join(''));

// XOR reversed mystery with fpHash
const reversedXorFpHash = mysteryReversed.map((b, i) => b ^ fpHashBytes[i]);
console.log('reversed XOR fpHash:', reversedXorFpHash.map(b => b.toString(16).padStart(2, '0')).join(''));
console.log('Is this the key?', reversedXorFpHash.map(b => b.toString(16).padStart(2, '0')).join('') === key);

// Check if mystery is related to the key in little-endian format
console.log('\n=== Little Endian Analysis ===');

// Split into 4-byte words and reverse each
function toLittleEndian32(bytes) {
  const result = [];
  for (let i = 0; i < bytes.length; i += 4) {
    result.push(bytes[i + 3], bytes[i + 2], bytes[i + 1], bytes[i]);
  }
  return result;
}

const mysteryLE = toLittleEndian32(mystery);
console.log('mystery (LE32):', mysteryLE.map(b => b.toString(16).padStart(2, '0')).join(''));

const mysteryLEXorFpHash = mysteryLE.map((b, i) => b ^ fpHashBytes[i]);
console.log('mystery(LE32) XOR fpHash:', mysteryLEXorFpHash.map(b => b.toString(16).padStart(2, '0')).join(''));
console.log('Is this the key?', mysteryLEXorFpHash.map(b => b.toString(16).padStart(2, '0')).join('') === key);

// Also check the bytes at offset 1047896 (8 bytes before key hex string)
// From the output: 8f bf 42 84 ... 7a a3 47 f2
// These look like parts of the key in different order!
console.log('\n=== Key Parts Analysis ===');
console.log('Key:', key);
console.log('Key bytes:', keyBytes.map(b => b.toString(16).padStart(2, '0')).join(' '));

// The bytes 8f bf 42 84 appear at position 20-23 of the key
// The bytes 7a a3 47 f2 appear at position 28-31 of the key
// This suggests the key is stored in multiple places or in different formats

// Check if the mystery bytes are the second SHA256 hash
// According to Ghidra analysis, the algorithm does:
// 1. SHA256(fingerprint) -> hash1
// 2. Format hash1 as hex string
// 3. SHA256(hex string) -> hash2
// 4. Format hash2 as hex string -> return

// So let's check if mystery is hash2 (before formatting)
console.log('\n=== Double SHA256 Check ===');

// We know fpHash is SHA256(fingerprint)
// So SHA256(fpHash as hex string) should give us something
const doubleHash = crypto.createHash('sha256').update(fpHash).digest('hex');
console.log('SHA256(fpHash hex string):', doubleHash);
console.log('Is this the key?', doubleHash === key);
console.log('Is this the mystery?', doubleHash === mysteryHex);

// What if the XOR happens AFTER the double hash?
// key = SHA256(SHA256(fp).hex) XOR xorConstant
const doubleHashBytes = hexToBytes(doubleHash);
const doubleHashXorXor = doubleHashBytes.map((b, i) => b ^ xorBytes[i]);
console.log('SHA256(fpHash hex) XOR xorConstant:', doubleHashXorXor.map(b => b.toString(16).padStart(2, '0')).join(''));
console.log('Is this the key?', doubleHashXorXor.map(b => b.toString(16).padStart(2, '0')).join('') === key);

// What if fpHash XOR xorConstant = key, and mystery is something else?
const fpHashXorXor = fpHashBytes.map((b, i) => b ^ xorBytes[i]);
console.log('\nfpHash XOR xorConstant:', fpHashXorXor.map(b => b.toString(16).padStart(2, '0')).join(''));
console.log('Is this the key?', fpHashXorXor.map(b => b.toString(16).padStart(2, '0')).join('') === key);

// Verify our known relationship
console.log('\n=== Verify Known Relationship ===');
const computedXor = keyBytes.map((b, i) => b ^ fpHashBytes[i]);
console.log('key XOR fpHash:', computedXor.map(b => b.toString(16).padStart(2, '0')).join(''));
console.log('Expected xorConstant:', xorConstant);
console.log('Match?', computedXor.map(b => b.toString(16).padStart(2, '0')).join('') === xorConstant);
