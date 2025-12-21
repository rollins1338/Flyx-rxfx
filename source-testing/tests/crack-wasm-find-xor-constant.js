/**
 * Find XOR Constant - Search for the XOR constant in WASM binary
 * and try to understand the key derivation
 */

const fs = require('fs');
const crypto = require('crypto');

// Known values from controlled test
const fpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
const actualKey = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';

// XOR of fpHash and actualKey
const xorConstant = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';

console.log('=== Searching for XOR Constant in WASM ===\n');

const wasmPath = 'wasm-analysis/client-assets/img_data_bg.wasm';
const wasm = fs.readFileSync(wasmPath);

console.log(`WASM size: ${wasm.length} bytes`);
console.log(`XOR constant: ${xorConstant}`);

const xorBuf = Buffer.from(xorConstant, 'hex');

// Search for the XOR constant directly
let found = false;
for (let i = 0; i < wasm.length - 32; i++) {
  if (wasm.slice(i, i + 32).equals(xorBuf)) {
    console.log(`\n*** FOUND XOR constant at offset ${i}! ***`);
    found = true;
  }
}

if (!found) {
  console.log('\nXOR constant not found directly in WASM');
}

// Search for parts of the XOR constant
console.log('\n=== Searching for Partial Matches ===\n');

for (let len = 16; len >= 8; len--) {
  const partial = xorBuf.slice(0, len);
  for (let i = 0; i < wasm.length - len; i++) {
    if (wasm.slice(i, i + len).equals(partial)) {
      console.log(`Found first ${len} bytes at offset ${i}`);
      // Show context
      const start = Math.max(0, i - 16);
      const end = Math.min(wasm.length, i + len + 16);
      console.log(`Context: ${wasm.slice(start, end).toString('hex')}`);
    }
  }
}

// Try to find what the XOR constant might be derived from
console.log('\n=== Analyzing XOR Constant ===\n');

// Check if it's a hash of something embedded in WASM
const testStrings = [];

// Extract all printable strings from WASM
let currentString = '';
for (let i = 0; i < wasm.length; i++) {
  const byte = wasm[i];
  if (byte >= 32 && byte < 127) {
    currentString += String.fromCharCode(byte);
  } else {
    if (currentString.length >= 8) {
      testStrings.push(currentString);
    }
    currentString = '';
  }
}

console.log(`Found ${testStrings.length} strings in WASM`);

// Check if XOR constant is hash of any string
for (const str of testStrings) {
  const hash = crypto.createHash('sha256').update(str).digest();
  if (hash.equals(xorBuf)) {
    console.log(`*** XOR constant is SHA256 of "${str}"! ***`);
  }
}

// Check if XOR constant is related to known crypto constants
console.log('\n=== Checking Crypto Relationships ===\n');

// SHA256 initial values
const sha256H = Buffer.from([
  0x6a, 0x09, 0xe6, 0x67, 0xbb, 0x67, 0xae, 0x85,
  0x3c, 0x6e, 0xf3, 0x72, 0xa5, 0x4f, 0xf5, 0x3a,
  0x51, 0x0e, 0x52, 0x7f, 0x9b, 0x05, 0x68, 0x8c,
  0x1f, 0x83, 0xd9, 0xab, 0x5b, 0xe0, 0xcd, 0x19
]);

const xorWithH = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  xorWithH[i] = xorBuf[i] ^ sha256H[i];
}
console.log(`XOR constant XOR SHA256_H: ${xorWithH.toString('hex')}`);

// Check if the key derivation might use a different input format
console.log('\n=== Testing Alternative Input Formats ===\n');

const fpString = '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';

// Try different encodings
const encodings = [
  { name: 'UTF-8', data: Buffer.from(fpString, 'utf8') },
  { name: 'UTF-16LE', data: Buffer.from(fpString, 'utf16le') },
  { name: 'ASCII', data: Buffer.from(fpString, 'ascii') },
];

for (const enc of encodings) {
  const hash = crypto.createHash('sha256').update(enc.data).digest();
  console.log(`SHA256(${enc.name}): ${hash.toString('hex')}`);
  
  // XOR with hash
  const xorResult = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorResult[i] = hash[i] ^ xorBuf[i];
  }
  console.log(`  XOR with constant: ${xorResult.toString('hex')}`);
  
  if (xorResult.equals(Buffer.from(actualKey, 'hex'))) {
    console.log(`  *** This produces the actual key! ***`);
  }
}

// Try with null terminator
const fpWithNull = Buffer.concat([Buffer.from(fpString), Buffer.from([0])]);
const hashWithNull = crypto.createHash('sha256').update(fpWithNull).digest();
console.log(`\nSHA256(fpString + null): ${hashWithNull.toString('hex')}`);

// Try with length prefix
const fpWithLen = Buffer.concat([Buffer.from([fpString.length]), Buffer.from(fpString)]);
const hashWithLen = crypto.createHash('sha256').update(fpWithLen).digest();
console.log(`SHA256(len + fpString): ${hashWithLen.toString('hex')}`);

// Try with 4-byte length prefix (little endian)
const lenBuf = Buffer.alloc(4);
lenBuf.writeUInt32LE(fpString.length);
const fpWithLen4 = Buffer.concat([lenBuf, Buffer.from(fpString)]);
const hashWithLen4 = crypto.createHash('sha256').update(fpWithLen4).digest();
console.log(`SHA256(len32LE + fpString): ${hashWithLen4.toString('hex')}`);

// Try with 4-byte length prefix (big endian)
const lenBufBE = Buffer.alloc(4);
lenBufBE.writeUInt32BE(fpString.length);
const fpWithLen4BE = Buffer.concat([lenBufBE, Buffer.from(fpString)]);
const hashWithLen4BE = crypto.createHash('sha256').update(fpWithLen4BE).digest();
console.log(`SHA256(len32BE + fpString): ${hashWithLen4BE.toString('hex')}`);

// Check if the transformation involves the session ID
console.log('\n=== Testing Session ID Involvement ===\n');

const sessionId = '1700000000.5000000';
const sessionHash = crypto.createHash('sha256').update(sessionId).digest();

// Try HMAC with session as key
const hmacSession = crypto.createHmac('sha256', sessionId).update(fpString).digest();
console.log(`HMAC(sessionId, fpString): ${hmacSession.toString('hex')}`);

// Try HMAC with fpString as key
const hmacFp = crypto.createHmac('sha256', fpString).update(sessionId).digest();
console.log(`HMAC(fpString, sessionId): ${hmacFp.toString('hex')}`);

// Try concatenation
const concat1 = crypto.createHash('sha256').update(fpString + sessionId).digest();
console.log(`SHA256(fpString + sessionId): ${concat1.toString('hex')}`);

const concat2 = crypto.createHash('sha256').update(sessionId + fpString).digest();
console.log(`SHA256(sessionId + fpString): ${concat2.toString('hex')}`);

// Check if any of these match the actual key
const keyBuf = Buffer.from(actualKey, 'hex');
const tests = [
  { name: 'HMAC(sessionId, fpString)', hash: hmacSession },
  { name: 'HMAC(fpString, sessionId)', hash: hmacFp },
  { name: 'SHA256(fpString + sessionId)', hash: concat1 },
  { name: 'SHA256(sessionId + fpString)', hash: concat2 },
];

for (const test of tests) {
  if (test.hash.equals(keyBuf)) {
    console.log(`\n*** ${test.name} matches the actual key! ***`);
  }
}

console.log('\n=== Summary ===\n');
console.log('The XOR constant is not directly embedded in the WASM.');
console.log('It may be derived at runtime or computed from other values.');
