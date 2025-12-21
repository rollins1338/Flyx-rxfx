/**
 * Analyze Relationship - Find the transformation from fpHash to key
 */

const crypto = require('crypto');

// Known values from controlled test
const fpString = '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';
const fpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
const actualKey = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';

console.log('=== Analyze Relationship ===\n');
console.log(`FP String: ${fpString}`);
console.log(`FP Hash:   ${fpHash}`);
console.log(`Actual Key: ${actualKey}`);

const fpHashBuf = Buffer.from(fpHash, 'hex');
const keyBuf = Buffer.from(actualKey, 'hex');

// XOR the two to find the transformation
const xorResult = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  xorResult[i] = fpHashBuf[i] ^ keyBuf[i];
}
console.log(`\nXOR result: ${xorResult.toString('hex')}`);

// Check if XOR result is a known constant
const xorHex = xorResult.toString('hex');
console.log(`XOR as ASCII: ${xorResult.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}`);

// Check if it's a hash of something
const testStrings = [
  'flixer',
  'tmdb',
  'image',
  'key',
  'session',
  'fingerprint',
  'canvas',
  '1700000000',
  '0.5000000',
  '1700000000.5000000',
  fpString,
];

console.log('\n=== Testing if XOR is hash of known string ===\n');

for (const str of testStrings) {
  const hash = crypto.createHash('sha256').update(str).digest();
  if (hash.equals(xorResult)) {
    console.log(`*** XOR is SHA256 of "${str}"! ***`);
  }
}

// Check if key is double hash
console.log('\n=== Testing Double Hash ===\n');

const doubleHash = crypto.createHash('sha256').update(fpHashBuf).digest();
console.log(`SHA256(fpHash): ${doubleHash.toString('hex')}`);
if (doubleHash.equals(keyBuf)) {
  console.log('*** Key is SHA256(SHA256(fpString))! ***');
}

// Check if key is HMAC
console.log('\n=== Testing HMAC ===\n');

const hmacKeys = ['flixer', 'tmdb', 'key', 'image', 'session', '1700000000', '0.5000000'];

for (const key of hmacKeys) {
  const hmac = crypto.createHmac('sha256', key).update(fpString).digest();
  if (hmac.equals(keyBuf)) {
    console.log(`*** Key is HMAC(${key}, fpString)! ***`);
  }
  
  const hmac2 = crypto.createHmac('sha256', fpString).update(key).digest();
  if (hmac2.equals(keyBuf)) {
    console.log(`*** Key is HMAC(fpString, ${key})! ***`);
  }
}

// Check byte-level transformations
console.log('\n=== Byte-Level Analysis ===\n');

// Check if there's a simple byte transformation
let allSameXor = true;
const firstXor = fpHashBuf[0] ^ keyBuf[0];
for (let i = 1; i < 32; i++) {
  if ((fpHashBuf[i] ^ keyBuf[i]) !== firstXor) {
    allSameXor = false;
    break;
  }
}
console.log(`All bytes XOR to same value: ${allSameXor}`);
if (allSameXor) {
  console.log(`XOR value: 0x${firstXor.toString(16)}`);
}

// Check if bytes are rotated
for (let rot = 1; rot < 32; rot++) {
  const rotated = Buffer.concat([fpHashBuf.slice(rot), fpHashBuf.slice(0, rot)]);
  if (rotated.equals(keyBuf)) {
    console.log(`*** Key is fpHash rotated by ${rot} bytes! ***`);
  }
}

// Check if bytes are reversed
const reversed = Buffer.from(fpHashBuf).reverse();
if (reversed.equals(keyBuf)) {
  console.log('*** Key is fpHash reversed! ***');
}

// Check if it's a different hash algorithm
console.log('\n=== Testing Different Algorithms ===\n');

const algorithms = ['sha256', 'sha384', 'sha512', 'sha1', 'md5', 'sha3-256', 'blake2b512', 'blake2s256'];

for (const algo of algorithms) {
  try {
    const hash = crypto.createHash(algo).update(fpString).digest();
    const first32 = hash.slice(0, 32);
    if (first32.equals(keyBuf)) {
      console.log(`*** Key is ${algo}(fpString)! ***`);
    }
  } catch (e) {}
}

// Check HKDF
console.log('\n=== Testing HKDF ===\n');

const hkdfSalts = ['', 'flixer', 'tmdb', 'key', '1700000000'];
const hkdfInfos = ['', 'key', 'image', 'session'];

for (const salt of hkdfSalts) {
  for (const info of hkdfInfos) {
    try {
      const derived = crypto.hkdfSync('sha256', fpString, salt, info, 32);
      if (Buffer.from(derived).equals(keyBuf)) {
        console.log(`*** Key is HKDF(sha256, fpString, "${salt}", "${info}", 32)! ***`);
      }
    } catch (e) {}
  }
}

// Check if the XOR constant is embedded in WASM
console.log('\n=== XOR Constant Analysis ===\n');
console.log(`XOR constant: ${xorHex}`);

// Try to find pattern in XOR
const xorBytes = Array.from(xorResult);
console.log(`XOR bytes: ${xorBytes.join(', ')}`);

// Check if XOR is related to canvas or session
const canvasBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';
const canvasHash = crypto.createHash('sha256').update(canvasBase64).digest();
console.log(`Canvas hash: ${canvasHash.toString('hex')}`);

const sessionId = '1700000000.5000000';
const sessionHash = crypto.createHash('sha256').update(sessionId).digest();
console.log(`Session hash: ${sessionHash.toString('hex')}`);

// XOR fpHash with canvas hash
const xorCanvas = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  xorCanvas[i] = fpHashBuf[i] ^ canvasHash[i];
}
console.log(`fpHash XOR canvasHash: ${xorCanvas.toString('hex')}`);
if (xorCanvas.equals(keyBuf)) {
  console.log('*** Key is fpHash XOR canvasHash! ***');
}

// XOR fpHash with session hash
const xorSession = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  xorSession[i] = fpHashBuf[i] ^ sessionHash[i];
}
console.log(`fpHash XOR sessionHash: ${xorSession.toString('hex')}`);
if (xorSession.equals(keyBuf)) {
  console.log('*** Key is fpHash XOR sessionHash! ***');
}

console.log('\n=== Summary ===\n');
console.log('The key derivation uses a transformation we haven\'t identified yet.');
console.log('The XOR constant might be embedded in the WASM or derived from another source.');
