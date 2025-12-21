/**
 * VERIFY THE DISCOVERED FORMULA
 * 
 * FOUND: xorConstant = key XOR SHA256(fingerprint)
 * 
 * This means:
 * key = fpHash XOR xorConstant
 * xorConstant = key XOR SHA256(fingerprint)
 * 
 * Substituting:
 * key = fpHash XOR (key XOR SHA256(fingerprint))
 * 
 * Wait, that's circular. Let me re-derive...
 * 
 * We know:
 * - fpHash = SHA256(fingerprint)
 * - key = fpHash XOR xorConstant
 * 
 * If xorConstant = key XOR SHA256(fingerprint) = key XOR fpHash
 * Then: xorConstant = (fpHash XOR xorConstant) XOR fpHash = xorConstant
 * 
 * That's a tautology! Let me check what the actual relationship is...
 */

const crypto = require('crypto');
const fs = require('fs');

const samples = JSON.parse(fs.readFileSync('./xor-samples.json', 'utf8'));

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

function xorBuffers(a, b) {
  const result = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

console.log('=== Verifying XOR Formula ===\n');

// Test the first sample
const s = samples[0];
console.log('Sample 0:');
console.log('  Timestamp:', s.timestamp);
console.log('  Fingerprint:', s.fingerprint.slice(0, 50) + '...');
console.log('  fpHash:', s.fpHash);
console.log('  key:', s.key);
console.log('  xor:', s.xor);

const fpHashBytes = Buffer.from(s.fpHash, 'hex');
const keyBytes = Buffer.from(s.key, 'hex');
const xorBytes = Buffer.from(s.xor, 'hex');
const fingerprintHash = sha256(s.fingerprint);

console.log('\n--- Verification ---');
console.log('SHA256(fingerprint):', fingerprintHash.toString('hex'));
console.log('fpHash (from sample):', s.fpHash);
console.log('Match:', fingerprintHash.toString('hex') === s.fpHash ? 'YES ✓' : 'NO ✗');

// Check: key XOR SHA256(fingerprint)
const keyXorFpHash = xorBuffers(keyBytes, fingerprintHash);
console.log('\nkey XOR SHA256(fingerprint):', keyXorFpHash.toString('hex'));
console.log('xor (from sample):', s.xor);
console.log('Match:', keyXorFpHash.toString('hex') === s.xor ? 'YES ✓' : 'NO ✗');

// This is just confirming: xor = key XOR fpHash (which we already knew)
// The question is: how is the KEY derived?

console.log('\n=== The Real Question ===');
console.log('We know: key = fpHash XOR xorConstant');
console.log('We know: xorConstant = key XOR fpHash (tautology)');
console.log('');
console.log('The KEY is what we need to derive!');
console.log('');

// Let's look at the key more carefully
// Maybe key = SHA256(something)
console.log('=== Checking if KEY is a hash ===');

// Is key = SHA256(fpHash)?
const sha256FpHash = sha256(fpHashBytes);
console.log('SHA256(fpHash bytes):', sha256FpHash.toString('hex'));
console.log('key:', s.key);
console.log('Match:', sha256FpHash.toString('hex') === s.key ? 'YES ✓' : 'NO ✗');

// Is key = SHA256(fpHash hex string)?
const sha256FpHashHex = sha256(s.fpHash);
console.log('\nSHA256(fpHash hex string):', sha256FpHashHex.toString('hex'));
console.log('key:', s.key);
console.log('Match:', sha256FpHashHex.toString('hex') === s.key ? 'YES ✓' : 'NO ✗');

// Is key = SHA256(fingerprint) XOR SHA256(timestamp)?
const sha256Ts = sha256(s.timestamp.toString());
const fpHashXorTsHash = xorBuffers(fingerprintHash, sha256Ts);
console.log('\nSHA256(fingerprint) XOR SHA256(timestamp):', fpHashXorTsHash.toString('hex'));
console.log('key:', s.key);
console.log('Match:', fpHashXorTsHash.toString('hex') === s.key ? 'YES ✓' : 'NO ✗');

// Let's try: key = SHA256(SHA256(fingerprint))
const doubleSha = sha256(fingerprintHash);
console.log('\nSHA256(SHA256(fingerprint)):', doubleSha.toString('hex'));
console.log('key:', s.key);
console.log('Match:', doubleSha.toString('hex') === s.key ? 'YES ✓' : 'NO ✗');

// Let's try: key = SHA256(fpHash.hex)
const sha256FpHashHexStr = sha256(s.fpHash);
console.log('\nSHA256(fpHash as hex string):', sha256FpHashHexStr.toString('hex'));
console.log('key:', s.key);
console.log('Match:', sha256FpHashHexStr.toString('hex') === s.key ? 'YES ✓' : 'NO ✗');

// What if the XOR constant is derived from something else entirely?
// Let's look at the XOR constant itself
console.log('\n=== Analyzing XOR Constant ===');

// Is xorConstant = SHA256(timestamp)?
console.log('SHA256(timestamp string):', sha256(s.timestamp.toString()).toString('hex'));
console.log('xor:', s.xor);
console.log('Match:', sha256(s.timestamp.toString()).toString('hex') === s.xor ? 'YES ✓' : 'NO ✗');

// Is xorConstant = SHA256(timestamp as 4-byte LE)?
const ts4LE = Buffer.alloc(4);
ts4LE.writeUInt32LE(s.timestamp);
console.log('\nSHA256(timestamp 4-byte LE):', sha256(ts4LE).toString('hex'));
console.log('xor:', s.xor);
console.log('Match:', sha256(ts4LE).toString('hex') === s.xor ? 'YES ✓' : 'NO ✗');

// Let's verify across ALL samples
console.log('\n=== Verifying Across All Samples ===');

let allMatch = true;
for (const sample of samples) {
  const fp = sample.fingerprint;
  const fpH = sha256(fp);
  const k = Buffer.from(sample.key, 'hex');
  const x = Buffer.from(sample.xor, 'hex');
  
  // Verify: fpHash = SHA256(fingerprint)
  if (fpH.toString('hex') !== sample.fpHash) {
    console.log(`Sample ${sample.timestamp}: fpHash mismatch!`);
    allMatch = false;
  }
  
  // Verify: key = fpHash XOR xor
  const computedKey = xorBuffers(fpH, x);
  if (computedKey.toString('hex') !== sample.key) {
    console.log(`Sample ${sample.timestamp}: key formula mismatch!`);
    allMatch = false;
  }
}

if (allMatch) {
  console.log('All samples verify: key = SHA256(fingerprint) XOR xorConstant');
}

// Now let's try to find what xorConstant is derived from
console.log('\n=== Deep XOR Constant Analysis ===');

// Maybe xorConstant is HMAC-based
const hmacKeys = [
  { name: 'HMAC(ts, fp)', fn: (s) => crypto.createHmac('sha256', s.timestamp.toString()).update(s.fingerprint).digest() },
  { name: 'HMAC(fp, ts)', fn: (s) => crypto.createHmac('sha256', s.fingerprint).update(s.timestamp.toString()).digest() },
  { name: 'HMAC(fpHash, ts)', fn: (s) => crypto.createHmac('sha256', s.fpHash).update(s.timestamp.toString()).digest() },
  { name: 'HMAC(ts, fpHash)', fn: (s) => crypto.createHmac('sha256', s.timestamp.toString()).update(s.fpHash).digest() },
];

for (const { name, fn } of hmacKeys) {
  const result = fn(samples[0]);
  const match = result.toString('hex') === samples[0].xor;
  console.log(`${name}: ${match ? '*** MATCH ***' : result.toString('hex').slice(0, 32) + '...'}`);
}

// Maybe it's a PRNG seeded by timestamp
console.log('\n=== PRNG Analysis ===');

// splitmix64 with timestamp as seed
function splitmix64(seed) {
  let state = BigInt(seed);
  const results = [];
  for (let i = 0; i < 4; i++) {
    state = (state + 0x9e3779b97f4a7c15n) & 0xFFFFFFFFFFFFFFFFn;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xFFFFFFFFFFFFFFFFn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xFFFFFFFFFFFFFFFFn;
    z = z ^ (z >> 31n);
    results.push(z);
  }
  return results;
}

const prngResult = splitmix64(samples[0].timestamp);
const prngHex = prngResult.map(n => n.toString(16).padStart(16, '0')).join('');
console.log('splitmix64(timestamp):', prngHex.slice(0, 64));
console.log('xor:', samples[0].xor);
console.log('Match:', prngHex.slice(0, 64) === samples[0].xor ? 'YES ✓' : 'NO ✗');

// Maybe xorConstant = splitmix64(timestamp) XOR fpHash
const prngBytes = Buffer.from(prngHex.slice(0, 64), 'hex');
const prngXorFpHash = xorBuffers(prngBytes, Buffer.from(samples[0].fpHash, 'hex'));
console.log('\nsplitmix64(ts) XOR fpHash:', prngXorFpHash.toString('hex'));
console.log('xor:', samples[0].xor);
console.log('Match:', prngXorFpHash.toString('hex') === samples[0].xor ? 'YES ✓' : 'NO ✗');

// What if the key derivation is: key = PRNG(timestamp) XOR fpHash?
console.log('\n=== Testing: key = PRNG(timestamp) XOR fpHash ===');
const prngXorFpHashKey = xorBuffers(prngBytes, Buffer.from(samples[0].fpHash, 'hex'));
console.log('PRNG(ts) XOR fpHash:', prngXorFpHashKey.toString('hex'));
console.log('key:', samples[0].key);
console.log('Match:', prngXorFpHashKey.toString('hex') === samples[0].key ? 'YES ✓' : 'NO ✗');

// Let's try: key = PRNG(fpHash_as_seed)
console.log('\n=== Testing: key = PRNG(fpHash) ===');
const fpHashNum = BigInt('0x' + samples[0].fpHash.slice(0, 16));
const prngFromFpHash = splitmix64(Number(fpHashNum & 0xFFFFFFFFn));
const prngFromFpHashHex = prngFromFpHash.map(n => n.toString(16).padStart(16, '0')).join('');
console.log('splitmix64(fpHash):', prngFromFpHashHex.slice(0, 64));
console.log('key:', samples[0].key);
console.log('Match:', prngFromFpHashHex.slice(0, 64) === samples[0].key ? 'YES ✓' : 'NO ✗');

console.log('\n=== Summary ===');
console.log('The XOR constant derivation remains unknown.');
console.log('We have confirmed:');
console.log('  1. fpHash = SHA256(fingerprint) ✓');
console.log('  2. key = fpHash XOR xorConstant ✓');
console.log('  3. xorConstant changes with timestamp');
console.log('  4. xorConstant is NOT a simple hash of timestamp');
console.log('  5. xorConstant is NOT a simple PRNG output');
