/**
 * Analyze the bytes after the key in memory
 * These might contain clues about the derivation
 */

const crypto = require('crypto');

// Known values
const key = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
const fpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
const xorConst = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';

// Bytes after key from memory dump
const afterKey = '40000000080011004000000001000000000000008442bf8f4148738bf247a37a0100000000000000800000000000000000000000000000000000000000000000';

console.log('=== Analyzing Bytes After Key ===\n');

const afterBytes = Buffer.from(afterKey, 'hex');
const keyBytes = Buffer.from(key, 'hex');
const fpHashBytes = Buffer.from(fpHash, 'hex');
const xorBytes = Buffer.from(xorConst, 'hex');

console.log('After key bytes:', afterKey);
console.log('Length:', afterBytes.length, 'bytes');

// Parse as different data types
console.log('\n--- Parsing as integers ---');
console.log('First 4 bytes as uint32 LE:', afterBytes.readUInt32LE(0));
console.log('Bytes 4-8 as uint32 LE:', afterBytes.readUInt32LE(4));
console.log('Bytes 8-12 as uint32 LE:', afterBytes.readUInt32LE(8));
console.log('Bytes 12-16 as uint32 LE:', afterBytes.readUInt32LE(12));

// The interesting part: 8442bf8f4148738bf247a37a
const interestingPart = '8442bf8f4148738bf247a37a';
console.log('\n--- Interesting bytes: 8442bf8f4148738bf247a37a ---');
const interestingBytes = Buffer.from(interestingPart, 'hex');
console.log('As hex:', interestingPart);
console.log('Length:', interestingBytes.length, 'bytes');

// Check if this is related to key or fpHash
console.log('\n--- Checking relationships ---');

// XOR with key bytes
const xoredWithKey = Buffer.alloc(interestingBytes.length);
for (let i = 0; i < interestingBytes.length; i++) {
  xoredWithKey[i] = interestingBytes[i] ^ keyBytes[i];
}
console.log('XOR with key[:12]:', xoredWithKey.toString('hex'));

// XOR with fpHash bytes
const xoredWithFpHash = Buffer.alloc(interestingBytes.length);
for (let i = 0; i < interestingBytes.length; i++) {
  xoredWithFpHash[i] = interestingBytes[i] ^ fpHashBytes[i];
}
console.log('XOR with fpHash[:12]:', xoredWithFpHash.toString('hex'));

// Check if it's a reversed or rotated version
console.log('\n--- Checking for reversed/rotated patterns ---');
const reversed = Buffer.from(interestingBytes).reverse();
console.log('Reversed:', reversed.toString('hex'));

// Check if any part matches key or fpHash
console.log('\n--- Checking for partial matches ---');
for (let i = 0; i < 32 - interestingBytes.length; i++) {
  const keySlice = keyBytes.slice(i, i + interestingBytes.length);
  if (keySlice.equals(interestingBytes)) {
    console.log(`Found in key at offset ${i}`);
  }
  
  const fpHashSlice = fpHashBytes.slice(i, i + interestingBytes.length);
  if (fpHashSlice.equals(interestingBytes)) {
    console.log(`Found in fpHash at offset ${i}`);
  }
}

// The bytes look like: 8442bf8f 4148738b f247a37a
// Let's check if these are related to the key computation
console.log('\n--- Checking if bytes are key-related ---');

// Maybe these are intermediate SHA256 state values?
// SHA256 initial hash values (first 8 words)
const sha256H = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

console.log('SHA256 initial H values:', sha256H.map(h => h.toString(16)));

// Check if the interesting bytes are related to SHA256 state
const word1 = afterBytes.readUInt32LE(24); // 8442bf8f
const word2 = afterBytes.readUInt32LE(28); // 4148738b
const word3 = afterBytes.readUInt32LE(32); // f247a37a

console.log('\nWords from after-key region:');
console.log('Word 1 (LE):', word1.toString(16));
console.log('Word 2 (LE):', word2.toString(16));
console.log('Word 3 (LE):', word3.toString(16));

// Try big-endian
const word1BE = afterBytes.readUInt32BE(24);
const word2BE = afterBytes.readUInt32BE(28);
const word3BE = afterBytes.readUInt32BE(32);

console.log('\nWords from after-key region (BE):');
console.log('Word 1 (BE):', word1BE.toString(16));
console.log('Word 2 (BE):', word2BE.toString(16));
console.log('Word 3 (BE):', word3BE.toString(16));

// Check if the key itself contains any pattern
console.log('\n--- Analyzing key structure ---');
console.log('Key as 8 uint32 LE:');
for (let i = 0; i < 8; i++) {
  console.log(`  Word ${i}: ${keyBytes.readUInt32LE(i * 4).toString(16)}`);
}

console.log('\nKey as 8 uint32 BE:');
for (let i = 0; i < 8; i++) {
  console.log(`  Word ${i}: ${keyBytes.readUInt32BE(i * 4).toString(16)}`);
}

// Check XOR constant structure
console.log('\n--- Analyzing XOR constant structure ---');
console.log('XOR as 8 uint32 LE:');
for (let i = 0; i < 8; i++) {
  console.log(`  Word ${i}: ${xorBytes.readUInt32LE(i * 4).toString(16)}`);
}

// Check if XOR constant words have any relationship to timestamp
const timestamp = 1700000000;
console.log('\n--- Timestamp relationships ---');
console.log('Timestamp:', timestamp);
console.log('Timestamp hex:', timestamp.toString(16));

for (let i = 0; i < 8; i++) {
  const xorWord = xorBytes.readUInt32LE(i * 4);
  const diff = xorWord - timestamp;
  const xorVal = xorWord ^ timestamp;
  console.log(`  XOR word ${i}: ${xorWord.toString(16)}, diff from ts: ${diff}, xor with ts: ${xorVal.toString(16)}`);
}

// Try to find a pattern in how XOR constant relates to fpHash
console.log('\n--- XOR constant vs fpHash relationship ---');
for (let i = 0; i < 8; i++) {
  const xorWord = xorBytes.readUInt32LE(i * 4);
  const fpWord = fpHashBytes.readUInt32LE(i * 4);
  const keyWord = keyBytes.readUInt32LE(i * 4);
  
  console.log(`  Word ${i}: fpHash=${fpWord.toString(16)}, xor=${xorWord.toString(16)}, key=${keyWord.toString(16)}`);
  console.log(`           fpHash XOR xor = ${(fpWord ^ xorWord).toString(16)} (should be key: ${keyWord.toString(16)})`);
}

console.log('\n=== Summary ===');
console.log('The XOR constant is NOT stored in memory.');
console.log('The fpHash is NOT stored in memory.');
console.log('Only the final key is stored.');
console.log('The XOR operation must happen during computation without storing intermediates.');
