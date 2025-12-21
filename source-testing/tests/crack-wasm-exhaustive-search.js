/**
 * Exhaustive XOR constant derivation search
 * Try EVERY possible combination of inputs and algorithms
 */

const crypto = require('crypto');
const fs = require('fs');

// Load samples
const samples = JSON.parse(fs.readFileSync('./xor-samples.json', 'utf8'));

// Known values for timestamp=1700000000
const KNOWN = {
  timestamp: '1700000000',
  fingerprint: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
  key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
  xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
  canvas50: 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  userAgent50: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb',
};

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

function sha256Hex(data) {
  return sha256(data).toString('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function xorBuffers(a, b) {
  const result = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    result[i] = a[i] ^ b[i % b.length];
  }
  return result;
}

// Convert timestamp to various byte formats
function timestampToBytes(ts) {
  const num = parseInt(ts);
  return {
    le4: Buffer.alloc(4).tap(b => b.writeUInt32LE(num)),
    be4: Buffer.alloc(4).tap(b => b.writeUInt32BE(num)),
    le8: Buffer.alloc(8).tap(b => b.writeBigUInt64LE(BigInt(num))),
    be8: Buffer.alloc(8).tap(b => b.writeBigUInt64BE(BigInt(num))),
  };
}

// Add tap method to Buffer
Buffer.prototype.tap = function(fn) { fn(this); return this; };

function testDerivation(name, derivedHex) {
  if (derivedHex === KNOWN.xor) {
    console.log(`\n*** MATCH FOUND: ${name} ***\n`);
    return true;
  }
  return false;
}

console.log('=== Exhaustive XOR Constant Derivation Search ===\n');
console.log('Target XOR:', KNOWN.xor);
console.log('');

let found = false;

// ============================================
// SECTION 1: Simple hashes of single inputs
// ============================================
console.log('--- Section 1: Simple Hashes ---');

const inputs = {
  'timestamp': KNOWN.timestamp,
  'fingerprint': KNOWN.fingerprint,
  'fpHash': KNOWN.fpHash,
  'key': KNOWN.key,
  'canvas50': KNOWN.canvas50,
  'userAgent50': KNOWN.userAgent50,
  'colorDepth': '24',
  'platform': 'Win32',
  'language': 'en-US',
  'timezone': '0',
};

for (const [name, value] of Object.entries(inputs)) {
  // SHA256 of string
  found = testDerivation(`SHA256(${name})`, sha256Hex(value)) || found;
  // SHA256 of bytes (if hex)
  if (/^[0-9a-f]+$/i.test(value) && value.length === 64) {
    found = testDerivation(`SHA256(${name}_bytes)`, sha256Hex(Buffer.from(value, 'hex'))) || found;
  }
}

// ============================================
// SECTION 2: Double hashes
// ============================================
console.log('--- Section 2: Double Hashes ---');

for (const [name, value] of Object.entries(inputs)) {
  const h1 = sha256(value);
  const h2 = sha256(h1);
  found = testDerivation(`SHA256(SHA256(${name}))`, h2.toString('hex')) || found;
  
  // SHA256 of hex string of hash
  const h1Hex = h1.toString('hex');
  found = testDerivation(`SHA256(SHA256(${name}).hex)`, sha256Hex(h1Hex)) || found;
}

// ============================================
// SECTION 3: Timestamp byte formats
// ============================================
console.log('--- Section 3: Timestamp Byte Formats ---');

const tsBytes = timestampToBytes(KNOWN.timestamp);
for (const [format, bytes] of Object.entries(tsBytes)) {
  found = testDerivation(`SHA256(ts_${format})`, sha256Hex(bytes)) || found;
  
  // Concatenate with fpHash
  found = testDerivation(`SHA256(ts_${format} + fpHash)`, sha256Hex(Buffer.concat([bytes, Buffer.from(KNOWN.fpHash, 'hex')]))) || found;
  found = testDerivation(`SHA256(fpHash + ts_${format})`, sha256Hex(Buffer.concat([Buffer.from(KNOWN.fpHash, 'hex'), bytes]))) || found;
}

// ============================================
// SECTION 4: XOR combinations
// ============================================
console.log('--- Section 4: XOR Combinations ---');

const fpHashBytes = Buffer.from(KNOWN.fpHash, 'hex');
const keyBytes = Buffer.from(KNOWN.key, 'hex');

// XOR fpHash with various hashes
for (const [name, value] of Object.entries(inputs)) {
  const h = sha256(value);
  const xored = xorBuffers(fpHashBytes, h);
  found = testDerivation(`fpHash XOR SHA256(${name})`, xored.toString('hex')) || found;
}

// XOR key with various hashes
for (const [name, value] of Object.entries(inputs)) {
  const h = sha256(value);
  const xored = xorBuffers(keyBytes, h);
  found = testDerivation(`key XOR SHA256(${name})`, xored.toString('hex')) || found;
}

// ============================================
// SECTION 5: HMAC combinations
// ============================================
console.log('--- Section 5: HMAC Combinations ---');

const hmacKeys = ['timestamp', 'fingerprint', 'fpHash', 'canvas50', 'userAgent50'];
const hmacData = ['timestamp', 'fingerprint', 'fpHash', 'canvas50', 'userAgent50'];

for (const keyName of hmacKeys) {
  for (const dataName of hmacData) {
    if (keyName === dataName) continue;
    const h = hmacSha256(inputs[keyName], inputs[dataName]);
    found = testDerivation(`HMAC(${keyName}, ${dataName})`, h.toString('hex')) || found;
  }
}

// ============================================
// SECTION 6: Concatenation hashes
// ============================================
console.log('--- Section 6: Concatenation Hashes ---');

const concatPairs = [
  ['timestamp', 'fpHash'],
  ['fpHash', 'timestamp'],
  ['timestamp', 'canvas50'],
  ['canvas50', 'timestamp'],
  ['timestamp', 'fingerprint'],
  ['fingerprint', 'timestamp'],
  ['fpHash', 'canvas50'],
  ['canvas50', 'fpHash'],
  ['fpHash', 'key'],
  ['key', 'fpHash'],
];

for (const [a, b] of concatPairs) {
  // String concat
  found = testDerivation(`SHA256(${a} + ${b})`, sha256Hex(inputs[a] + inputs[b])) || found;
  // With separator
  found = testDerivation(`SHA256(${a}:${b})`, sha256Hex(inputs[a] + ':' + inputs[b])) || found;
  found = testDerivation(`SHA256(${a}|${b})`, sha256Hex(inputs[a] + '|' + inputs[b])) || found;
}

// ============================================
// SECTION 7: HKDF-like derivations
// ============================================
console.log('--- Section 7: HKDF-like Derivations ---');

const salts = ['', 'flixer', 'tmdb', 'img_data', 'encryption', KNOWN.timestamp, KNOWN.canvas50];
const infos = ['', 'key', 'xor', 'derive', 'encryption', KNOWN.timestamp, KNOWN.fpHash];

for (const salt of salts) {
  for (const info of infos) {
    // Simple HKDF-like: HMAC(HMAC(salt, ikm), info)
    const prk = hmacSha256(salt || Buffer.alloc(32), KNOWN.fpHash);
    const okm = hmacSha256(prk, info + '\x01');
    found = testDerivation(`HKDF(fpHash, salt="${salt.slice(0,10)}", info="${info.slice(0,10)}")`, okm.toString('hex')) || found;
  }
}

// ============================================
// SECTION 8: Counter-based derivations
// ============================================
console.log('--- Section 8: Counter-based Derivations ---');

// Maybe XOR is SHA256(fpHash || counter) for some counter
for (let counter = 0; counter <= 100; counter++) {
  const counterBuf = Buffer.alloc(4);
  counterBuf.writeUInt32LE(counter);
  const h = sha256(Buffer.concat([fpHashBytes, counterBuf]));
  if (testDerivation(`SHA256(fpHash || counter_${counter})`, h.toString('hex'))) {
    found = true;
    break;
  }
}

// ============================================
// SECTION 9: Bit manipulation
// ============================================
console.log('--- Section 9: Bit Manipulation ---');

// Rotate fpHash bytes
for (let shift = 1; shift < 32; shift++) {
  const rotated = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    rotated[i] = fpHashBytes[(i + shift) % 32];
  }
  const h = sha256(rotated);
  found = testDerivation(`SHA256(rotate_fpHash_${shift})`, h.toString('hex')) || found;
}

// ============================================
// SECTION 10: Timestamp arithmetic
// ============================================
console.log('--- Section 10: Timestamp Arithmetic ---');

const ts = parseInt(KNOWN.timestamp);
const tsVariants = [
  ts,
  ts * 1000,
  ts / 1000,
  ts + 1,
  ts - 1,
  ts ^ 0xFFFFFFFF,
  ts & 0xFFFF,
  ts >> 16,
  Math.floor(ts / 86400), // days
  Math.floor(ts / 3600),  // hours
];

for (const variant of tsVariants) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(Math.floor(variant)));
  found = testDerivation(`SHA256(ts_variant_${variant})`, sha256Hex(buf)) || found;
}

// ============================================
// SECTION 11: Cross-sample analysis
// ============================================
console.log('\n--- Section 11: Cross-Sample Analysis ---');

// Check if XOR constants have any relationship
console.log('\nAnalyzing XOR constant patterns across samples...');

// Check for constant difference
const xorDiffs = [];
for (let i = 1; i < samples.length; i++) {
  const prev = Buffer.from(samples[i-1].xor, 'hex');
  const curr = Buffer.from(samples[i].xor, 'hex');
  const diff = xorBuffers(prev, curr);
  xorDiffs.push(diff.toString('hex'));
}

// Check if any diff is constant
const uniqueDiffs = [...new Set(xorDiffs)];
console.log(`Unique XOR diffs: ${uniqueDiffs.length} (out of ${xorDiffs.length})`);

// Check if XOR is related to fpHash difference
console.log('\nChecking XOR vs fpHash relationship...');
for (let i = 0; i < Math.min(5, samples.length); i++) {
  const s = samples[i];
  const fpHashBytes = Buffer.from(s.fpHash, 'hex');
  const xorBytes = Buffer.from(s.xor, 'hex');
  
  // Is XOR = SHA256(fpHash) XOR something constant?
  const sha256FpHash = sha256(fpHashBytes);
  const mystery = xorBuffers(xorBytes, sha256FpHash);
  console.log(`Sample ${i}: mystery = XOR ^ SHA256(fpHash) = ${mystery.toString('hex').slice(0, 32)}...`);
}

// ============================================
// SECTION 12: PRNG with multiple seeds
// ============================================
console.log('\n--- Section 12: PRNG with Multiple Seeds ---');

// xorshift128+ with fpHash as seed
function xorshift128plus(seed) {
  let s0 = seed.readBigUInt64LE(0);
  let s1 = seed.readBigUInt64LE(8);
  
  const result = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    const r = s0 + s1;
    result.writeBigUInt64LE(r & 0xFFFFFFFFFFFFFFFFn, i * 8);
    
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23n;
    s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n);
  }
  return result;
}

// Try xorshift with fpHash as seed
const fpHashPadded = Buffer.concat([fpHashBytes, Buffer.alloc(16)]).slice(0, 16);
const xorshiftResult = xorshift128plus(fpHashPadded);
found = testDerivation('xorshift128+(fpHash)', xorshiftResult.toString('hex')) || found;

// ============================================
// SECTION 13: AES-based derivation
// ============================================
console.log('--- Section 13: AES-based Derivation ---');

// Maybe XOR is AES-ECB(fpHash, key=timestamp_padded)
try {
  const tsPadded = Buffer.alloc(16);
  tsPadded.write(KNOWN.timestamp);
  
  // AES-128-ECB encrypt fpHash with timestamp as key
  const cipher = crypto.createCipheriv('aes-128-ecb', tsPadded, null);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(fpHashBytes.slice(0, 16)), cipher.final()]);
  found = testDerivation('AES-ECB(fpHash[:16], ts_padded)', encrypted.toString('hex').padEnd(64, '0')) || found;
} catch (e) {}

// ============================================
// SECTION 14: Check if XOR is embedded in WASM
// ============================================
console.log('--- Section 14: Static Analysis ---');

// The XOR might be derived from a static value in WASM XORed with timestamp
// Let's compute what that static value would need to be
const staticCandidate = xorBuffers(Buffer.from(KNOWN.xor, 'hex'), sha256(KNOWN.timestamp));
console.log(`If XOR = static XOR SHA256(ts), static would be: ${staticCandidate.toString('hex')}`);

// Check if this static value works for other samples
let staticWorks = true;
for (const s of samples.slice(0, 5)) {
  const expectedXor = xorBuffers(staticCandidate, sha256(s.timestamp.toString()));
  if (expectedXor.toString('hex') !== s.xor) {
    staticWorks = false;
    break;
  }
}
console.log(`Static XOR hypothesis: ${staticWorks ? 'WORKS!' : 'FAILED'}`);

// ============================================
// SECTION 15: Polynomial/modular arithmetic
// ============================================
console.log('--- Section 15: Polynomial Arithmetic ---');

// Maybe XOR bytes are computed as polynomial evaluation
// XOR[i] = (fpHash[i] * ts + canvas[i]) mod 256
const canvas50Bytes = Buffer.from(KNOWN.canvas50);
const tsNum = parseInt(KNOWN.timestamp);

const polyResult = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  polyResult[i] = (fpHashBytes[i] * tsNum + (canvas50Bytes[i % canvas50Bytes.length] || 0)) & 0xFF;
}
found = testDerivation('poly(fpHash * ts + canvas)', polyResult.toString('hex')) || found;

// ============================================
// FINAL SUMMARY
// ============================================
console.log('\n=== SUMMARY ===');
if (found) {
  console.log('*** A MATCH WAS FOUND! Check output above. ***');
} else {
  console.log('No match found in exhaustive search.');
  console.log('\nThe XOR constant derivation uses a custom algorithm.');
  console.log('Next steps:');
  console.log('1. Deep WASM disassembly with Ghidra');
  console.log('2. Dynamic analysis with WASM debugger');
  console.log('3. Look for patterns in the XOR constant bytes themselves');
}
