/**
 * Test if the XOR constant is derived from double SHA256
 * Based on Ghidra decompilation showing two SHA256 operations
 */

const crypto = require('crypto');

// Known values for timestamp=1700000000
const fpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
const key = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
const xorConstant = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes) {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function xorBytes(a, b) {
  return a.map((byte, i) => byte ^ b[i]);
}

const fpHashBytes = hexToBytes(fpHash);
const keyBytes = hexToBytes(key);
const xorBytes_ = hexToBytes(xorConstant);

console.log('=== Known Values ===');
console.log('fpHash:', fpHash);
console.log('key:', key);
console.log('xorConstant:', xorConstant);

// Verify: fpHash XOR xorConstant = key
const computed = xorBytes(fpHashBytes, xorBytes_);
console.log('\nVerify fpHash XOR xorConstant = key:', bytesToHex(computed) === key);

console.log('\n=== Double SHA256 Tests ===');

// Test 1: SHA256(fpHash hex string)
const doubleHash1 = crypto.createHash('sha256').update(fpHash).digest('hex');
console.log('SHA256(fpHash hex):', doubleHash1);
console.log('Is this the key?', doubleHash1 === key);
console.log('Is this the xorConstant?', doubleHash1 === xorConstant);

// Test 2: SHA256(fpHash bytes)
const doubleHash2 = crypto.createHash('sha256').update(Buffer.from(fpHashBytes)).digest('hex');
console.log('\nSHA256(fpHash bytes):', doubleHash2);
console.log('Is this the key?', doubleHash2 === key);
console.log('Is this the xorConstant?', doubleHash2 === xorConstant);

// Test 3: What if key = SHA256(fpHash hex) XOR fpHash?
const doubleHashBytes = hexToBytes(doubleHash1);
const keyFromDoubleXorFp = xorBytes(doubleHashBytes, fpHashBytes);
console.log('\nSHA256(fpHash hex) XOR fpHash:', bytesToHex(keyFromDoubleXorFp));
console.log('Is this the key?', bytesToHex(keyFromDoubleXorFp) === key);

// Test 4: What if xorConstant = SHA256(fpHash hex) XOR something?
const xorFromDoubleAndKey = xorBytes(doubleHashBytes, keyBytes);
console.log('\nSHA256(fpHash hex) XOR key:', bytesToHex(xorFromDoubleAndKey));

// Test 5: What if the algorithm is:
// hash1 = SHA256(fingerprint)
// hash2 = SHA256(hash1.hex)
// key = hash1 XOR hash2
const keyFromXorHashes = xorBytes(fpHashBytes, doubleHashBytes);
console.log('\nfpHash XOR SHA256(fpHash hex):', bytesToHex(keyFromXorHashes));
console.log('Is this the key?', bytesToHex(keyFromXorHashes) === key);

// Test 6: What if xorConstant = SHA256(something with timestamp)?
const timestamp = '1700000000';
const hashTimestamp = crypto.createHash('sha256').update(timestamp).digest('hex');
console.log('\nSHA256(timestamp):', hashTimestamp);
console.log('Is this the xorConstant?', hashTimestamp === xorConstant);

// Test 7: SHA256(fpHash + timestamp)
const hashFpTimestamp = crypto.createHash('sha256').update(fpHash + timestamp).digest('hex');
console.log('\nSHA256(fpHash + timestamp):', hashFpTimestamp);
console.log('Is this the xorConstant?', hashFpTimestamp === xorConstant);

// Test 8: SHA256(timestamp + fpHash)
const hashTimestampFp = crypto.createHash('sha256').update(timestamp + fpHash).digest('hex');
console.log('\nSHA256(timestamp + fpHash):', hashTimestampFp);
console.log('Is this the xorConstant?', hashTimestampFp === xorConstant);

// Test 9: What if the second hash uses a different input?
// Maybe it's SHA256(formatted string with hash)
const formatted1 = `${fpHash}`;
const formatted2 = `0x${fpHash}`;
const formatted3 = fpHash.toUpperCase();

console.log('\n=== Formatted Hash Tests ===');
console.log('SHA256(fpHash):', crypto.createHash('sha256').update(formatted1).digest('hex'));
console.log('SHA256(0x+fpHash):', crypto.createHash('sha256').update(formatted2).digest('hex'));
console.log('SHA256(fpHash.upper):', crypto.createHash('sha256').update(formatted3).digest('hex'));

// Test 10: What if the XOR constant is derived from the canvas data?
// We know canvas base64 starts with: iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk
const canvasPrefix = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';
const hashCanvas = crypto.createHash('sha256').update(canvasPrefix).digest('hex');
console.log('\nSHA256(canvas prefix):', hashCanvas);
console.log('Is this the xorConstant?', hashCanvas === xorConstant);

// Test 11: XOR constant from canvas hash XOR fpHash
const canvasHashBytes = hexToBytes(hashCanvas);
const xorFromCanvas = xorBytes(canvasHashBytes, fpHashBytes);
console.log('\nSHA256(canvas) XOR fpHash:', bytesToHex(xorFromCanvas));
console.log('Is this the key?', bytesToHex(xorFromCanvas) === key);

// Test 12: What if the algorithm uses HMAC?
const hmac1 = crypto.createHmac('sha256', fpHash).update(timestamp).digest('hex');
console.log('\nHMAC-SHA256(fpHash, timestamp):', hmac1);
console.log('Is this the xorConstant?', hmac1 === xorConstant);

const hmac2 = crypto.createHmac('sha256', timestamp).update(fpHash).digest('hex');
console.log('\nHMAC-SHA256(timestamp, fpHash):', hmac2);
console.log('Is this the xorConstant?', hmac2 === xorConstant);

// Test 13: What if the XOR constant is derived from session ID?
const sessionId = '1700000000.5000000';
const hashSession = crypto.createHash('sha256').update(sessionId).digest('hex');
console.log('\nSHA256(sessionId):', hashSession);
console.log('Is this the xorConstant?', hashSession === xorConstant);

// Test 14: Combine session ID with fpHash
const hashSessionFp = crypto.createHash('sha256').update(sessionId + fpHash).digest('hex');
console.log('\nSHA256(sessionId + fpHash):', hashSessionFp);
console.log('Is this the xorConstant?', hashSessionFp === xorConstant);

console.log('\n=== Summary ===');
console.log('The XOR constant derivation remains unknown.');
console.log('It is NOT:');
console.log('  - SHA256(fpHash hex)');
console.log('  - SHA256(fpHash bytes)');
console.log('  - SHA256(timestamp)');
console.log('  - SHA256(sessionId)');
console.log('  - HMAC-SHA256 with various keys');
console.log('  - Simple XOR of known hashes');
