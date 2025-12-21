/**
 * Find XOR Formula - Analyze the XOR constants to find the derivation
 * 
 * From controlled tests:
 * - Test 1: timestamp=1700000000, XOR=1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc
 * - Test 3: timestamp=1700001000, XOR=c498b531891bfa7c2640ddbd3e952829cf0006c66be1ff19c7085d8480db6217
 * 
 * The random part doesn't affect the key, only the timestamp does.
 */

const crypto = require('crypto');

// Known data from controlled tests
const samples = [
  {
    timestamp: '1700000000',
    sessionId: '1700000000.5000000',
    key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
    fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
    xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
    canvasBase64First50: 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
    fpString: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  },
  {
    timestamp: '1700001000',
    sessionId: '1700001000.5000000',
    key: '9c9d9493fcedc4f268dfc17b8988a8d2cf6d4a28d85a44613adfd210609dd660',
    fpHash: '580521a275f63e8e4e9f1cc6b71d80fb006d4ceeb3bbbb78fdd78f94e046b477',
    xor: 'c498b531891bfa7c2640ddbd3e952829cf0006c66be1ff19c7085d8480db6217',
    canvasBase64First50: 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
    fpString: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700001000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  },
];

console.log('=== Finding XOR Formula ===\n');

// The XOR constant changes with timestamp
// Let's see if it's derived from the timestamp or fpString

for (const s of samples) {
  console.log(`\n=== Timestamp: ${s.timestamp} ===\n`);
  
  const xorBuf = Buffer.from(s.xor, 'hex');
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const keyBuf = Buffer.from(s.key, 'hex');
  
  // Test various derivations
  const tests = [];
  
  // SHA256 of various inputs
  tests.push({ name: 'SHA256(timestamp)', hash: crypto.createHash('sha256').update(s.timestamp).digest() });
  tests.push({ name: 'SHA256(fpString)', hash: crypto.createHash('sha256').update(s.fpString).digest() });
  tests.push({ name: 'SHA256(canvas50)', hash: crypto.createHash('sha256').update(s.canvasBase64First50).digest() });
  tests.push({ name: 'SHA256(fpHash)', hash: crypto.createHash('sha256').update(fpHashBuf).digest() });
  tests.push({ name: 'SHA256(fpHashHex)', hash: crypto.createHash('sha256').update(s.fpHash).digest() });
  
  // HMAC variations
  tests.push({ name: 'HMAC(timestamp, fpString)', hash: crypto.createHmac('sha256', s.timestamp).update(s.fpString).digest() });
  tests.push({ name: 'HMAC(fpString, timestamp)', hash: crypto.createHmac('sha256', s.fpString).update(s.timestamp).digest() });
  tests.push({ name: 'HMAC(canvas50, timestamp)', hash: crypto.createHmac('sha256', s.canvasBase64First50).update(s.timestamp).digest() });
  tests.push({ name: 'HMAC(timestamp, canvas50)', hash: crypto.createHmac('sha256', s.timestamp).update(s.canvasBase64First50).digest() });
  tests.push({ name: 'HMAC(fpHash, timestamp)', hash: crypto.createHmac('sha256', fpHashBuf).update(s.timestamp).digest() });
  tests.push({ name: 'HMAC(timestamp, fpHash)', hash: crypto.createHmac('sha256', s.timestamp).update(fpHashBuf).digest() });
  tests.push({ name: 'HMAC(fpHashHex, timestamp)', hash: crypto.createHmac('sha256', s.fpHash).update(s.timestamp).digest() });
  tests.push({ name: 'HMAC(timestamp, fpHashHex)', hash: crypto.createHmac('sha256', s.timestamp).update(s.fpHash).digest() });
  
  // Concatenation variations
  tests.push({ name: 'SHA256(timestamp + fpString)', hash: crypto.createHash('sha256').update(s.timestamp + s.fpString).digest() });
  tests.push({ name: 'SHA256(fpString + timestamp)', hash: crypto.createHash('sha256').update(s.fpString + s.timestamp).digest() });
  tests.push({ name: 'SHA256(timestamp + canvas50)', hash: crypto.createHash('sha256').update(s.timestamp + s.canvasBase64First50).digest() });
  tests.push({ name: 'SHA256(canvas50 + timestamp)', hash: crypto.createHash('sha256').update(s.canvasBase64First50 + s.timestamp).digest() });
  tests.push({ name: 'SHA256(timestamp + fpHash)', hash: crypto.createHash('sha256').update(s.timestamp + s.fpHash).digest() });
  tests.push({ name: 'SHA256(fpHash + timestamp)', hash: crypto.createHash('sha256').update(s.fpHash + s.timestamp).digest() });
  
  // Double hash
  tests.push({ name: 'SHA256(SHA256(fpString))', hash: crypto.createHash('sha256').update(fpHashBuf).digest() });
  
  // Check if any match the XOR constant
  console.log('Testing if XOR matches any derivation:');
  for (const test of tests) {
    if (test.hash.equals(xorBuf)) {
      console.log(`  *** MATCH: XOR = ${test.name} ***`);
    }
  }
  
  // Check if any match the key directly
  console.log('\nTesting if key matches any derivation:');
  for (const test of tests) {
    if (test.hash.equals(keyBuf)) {
      console.log(`  *** MATCH: key = ${test.name} ***`);
    }
  }
  
  // Try XOR combinations
  console.log('\nTesting XOR combinations:');
  
  // key = fpHash XOR something
  const canvasHash = crypto.createHash('sha256').update(s.canvasBase64First50).digest();
  const timestampHash = crypto.createHash('sha256').update(s.timestamp).digest();
  
  // fpHash XOR canvasHash
  const xor1 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor1[i] = fpHashBuf[i] ^ canvasHash[i];
  if (xor1.equals(keyBuf)) console.log('  *** MATCH: key = fpHash XOR canvasHash ***');
  
  // fpHash XOR timestampHash
  const xor2 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor2[i] = fpHashBuf[i] ^ timestampHash[i];
  if (xor2.equals(keyBuf)) console.log('  *** MATCH: key = fpHash XOR timestampHash ***');
  
  // fpHash XOR HMAC(canvas, timestamp)
  const hmacCT = crypto.createHmac('sha256', s.canvasBase64First50).update(s.timestamp).digest();
  const xor3 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor3[i] = fpHashBuf[i] ^ hmacCT[i];
  if (xor3.equals(keyBuf)) console.log('  *** MATCH: key = fpHash XOR HMAC(canvas, timestamp) ***');
  
  // fpHash XOR HMAC(timestamp, canvas)
  const hmacTC = crypto.createHmac('sha256', s.timestamp).update(s.canvasBase64First50).digest();
  const xor4 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor4[i] = fpHashBuf[i] ^ hmacTC[i];
  if (xor4.equals(keyBuf)) console.log('  *** MATCH: key = fpHash XOR HMAC(timestamp, canvas) ***');
}

// Try to find a pattern in the XOR constants
console.log('\n=== XOR Pattern Analysis ===\n');

const xor1 = Buffer.from(samples[0].xor, 'hex');
const xor2 = Buffer.from(samples[1].xor, 'hex');

// XOR the two XOR constants
const xorDiff = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  xorDiff[i] = xor1[i] ^ xor2[i];
}
console.log(`XOR1 XOR XOR2: ${xorDiff.toString('hex')}`);

// Check if this is related to the timestamp difference
const ts1 = parseInt(samples[0].timestamp);
const ts2 = parseInt(samples[1].timestamp);
console.log(`Timestamp diff: ${ts2 - ts1}`);

// Check if XOR diff is hash of timestamp diff
const tsDiffHash = crypto.createHash('sha256').update(String(ts2 - ts1)).digest();
console.log(`SHA256(tsDiff): ${tsDiffHash.toString('hex')}`);
if (tsDiffHash.equals(xorDiff)) console.log('*** XOR diff = SHA256(timestamp diff) ***');

// Check if XOR diff is XOR of timestamp hashes
const ts1Hash = crypto.createHash('sha256').update(samples[0].timestamp).digest();
const ts2Hash = crypto.createHash('sha256').update(samples[1].timestamp).digest();
const tsHashXor = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  tsHashXor[i] = ts1Hash[i] ^ ts2Hash[i];
}
console.log(`SHA256(ts1) XOR SHA256(ts2): ${tsHashXor.toString('hex')}`);
if (tsHashXor.equals(xorDiff)) console.log('*** XOR diff = SHA256(ts1) XOR SHA256(ts2) ***');

// Check if XOR diff is XOR of fpHashes
const fp1Hash = Buffer.from(samples[0].fpHash, 'hex');
const fp2Hash = Buffer.from(samples[1].fpHash, 'hex');
const fpHashXor = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  fpHashXor[i] = fp1Hash[i] ^ fp2Hash[i];
}
console.log(`fpHash1 XOR fpHash2: ${fpHashXor.toString('hex')}`);
if (fpHashXor.equals(xorDiff)) console.log('*** XOR diff = fpHash1 XOR fpHash2 ***');

// The XOR diff should equal fpHash XOR because:
// key1 = fpHash1 XOR xor1
// key2 = fpHash2 XOR xor2
// If the XOR constant is derived from fpHash, then:
// xor1 XOR xor2 = (fpHash1 XOR key1) XOR (fpHash2 XOR key2)

const key1 = Buffer.from(samples[0].key, 'hex');
const key2 = Buffer.from(samples[1].key, 'hex');
const keyXor = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  keyXor[i] = key1[i] ^ key2[i];
}
console.log(`key1 XOR key2: ${keyXor.toString('hex')}`);

// Check: xorDiff = fpHashXor XOR keyXor?
const check = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  check[i] = fpHashXor[i] ^ keyXor[i];
}
console.log(`fpHashXor XOR keyXor: ${check.toString('hex')}`);
if (check.equals(xorDiff)) console.log('*** xorDiff = fpHashXor XOR keyXor (expected) ***');

// Since xorDiff = fpHashXor XOR keyXor, and we know fpHashXor,
// we can check if keyXor has a pattern
console.log('\n=== Key XOR Analysis ===\n');
console.log(`keyXor: ${keyXor.toString('hex')}`);

// Check if keyXor is a hash of something
const keyXorTests = [
  { name: 'SHA256(ts1 + ts2)', hash: crypto.createHash('sha256').update(samples[0].timestamp + samples[1].timestamp).digest() },
  { name: 'SHA256(ts2 - ts1)', hash: crypto.createHash('sha256').update(String(ts2 - ts1)).digest() },
];

for (const test of keyXorTests) {
  if (test.hash.equals(keyXor)) {
    console.log(`*** keyXor = ${test.name} ***`);
  }
}

console.log('\n=== Summary ===\n');
console.log('The key derivation involves:');
console.log('1. Building fingerprint string with timestamp');
console.log('2. Hashing the fingerprint string (SHA256)');
console.log('3. XORing with some value derived from the fingerprint/timestamp');
console.log('');
console.log('The XOR constant is NOT a simple hash of timestamp or canvas.');
console.log('It may be derived through a more complex process in the WASM.');
