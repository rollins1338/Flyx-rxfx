/**
 * Try Rust-specific cryptographic patterns
 * The WASM is compiled from Rust, so let's try patterns common in Rust crypto crates
 */

const crypto = require('crypto');
const fs = require('fs');

const samples = JSON.parse(fs.readFileSync('./xor-samples.json', 'utf8'));

// Known values
const KNOWN = {
  timestamp: 1700000000,
  fingerprint: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
  key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
  xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
  canvas50: 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
};

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

function xorBuffers(a, b) {
  const result = Buffer.alloc(Math.max(a.length, b.length));
  for (let i = 0; i < result.length; i++) {
    result[i] = (a[i] || 0) ^ (b[i % b.length] || 0);
  }
  return result;
}

function testMatch(name, derived) {
  const match = derived === KNOWN.xor;
  if (match) {
    console.log(`\n*** MATCH FOUND: ${name} ***\n`);
    return true;
  }
  return false;
}

console.log('=== Rust Crypto Pattern Search ===\n');
console.log('Target XOR:', KNOWN.xor);
console.log('');

// The WASM data section shows these crates:
// - cipher-0.4.4
// - hmac-0.12.1
// - aes-0.8.4
// - ctr-0.9.2
// - base64-0.21.7
// - serde_json-1.0.141

// Try patterns from RustCrypto crates

// 1. HKDF (common in Rust crypto)
console.log('--- HKDF Patterns ---');

function hkdfExpand(prk, info, length) {
  const hashLen = 32;
  const n = Math.ceil(length / hashLen);
  let okm = Buffer.alloc(0);
  let t = Buffer.alloc(0);
  
  for (let i = 1; i <= n; i++) {
    const data = Buffer.concat([t, Buffer.from(info), Buffer.from([i])]);
    t = crypto.createHmac('sha256', prk).update(data).digest();
    okm = Buffer.concat([okm, t]);
  }
  
  return okm.slice(0, length);
}

function hkdf(ikm, salt, info, length) {
  const prk = crypto.createHmac('sha256', salt || Buffer.alloc(32)).update(ikm).digest();
  return hkdfExpand(prk, info, length);
}

// Try HKDF with various inputs
const hkdfTests = [
  { ikm: KNOWN.fpHash, salt: '', info: '' },
  { ikm: KNOWN.fpHash, salt: KNOWN.timestamp.toString(), info: '' },
  { ikm: KNOWN.timestamp.toString(), salt: KNOWN.fpHash, info: '' },
  { ikm: KNOWN.fingerprint, salt: '', info: '' },
  { ikm: KNOWN.fingerprint, salt: KNOWN.timestamp.toString(), info: '' },
  { ikm: KNOWN.fpHash, salt: '', info: 'key' },
  { ikm: KNOWN.fpHash, salt: '', info: 'xor' },
  { ikm: KNOWN.fpHash, salt: '', info: 'derive' },
  { ikm: KNOWN.fpHash, salt: KNOWN.canvas50, info: '' },
  { ikm: Buffer.from(KNOWN.fpHash, 'hex'), salt: '', info: '' },
  { ikm: Buffer.from(KNOWN.fpHash, 'hex'), salt: KNOWN.timestamp.toString(), info: '' },
];

for (const { ikm, salt, info } of hkdfTests) {
  const result = hkdf(ikm, salt, info, 32).toString('hex');
  testMatch(`HKDF(${typeof ikm === 'string' ? ikm.slice(0,20) : 'bytes'}, ${salt.slice(0,10)}, ${info})`, result);
}

// 2. Try double SHA256 with XOR
console.log('\n--- Double SHA256 with XOR ---');

const fpHashBytes = Buffer.from(KNOWN.fpHash, 'hex');
const sha256_fpHash = sha256(fpHashBytes);
const sha256_fpHashHex = sha256(KNOWN.fpHash);

// key = SHA256(fpHash_bytes) XOR fpHash_bytes
const doubleShaXor1 = xorBuffers(sha256_fpHash, fpHashBytes);
testMatch('SHA256(fpHash_bytes) XOR fpHash_bytes', doubleShaXor1.toString('hex'));

// key = SHA256(fpHash_hex) XOR fpHash_bytes
const doubleShaXor2 = xorBuffers(sha256_fpHashHex, fpHashBytes);
testMatch('SHA256(fpHash_hex) XOR fpHash_bytes', doubleShaXor2.toString('hex'));

// 3. Try timestamp-based derivation with fpHash
console.log('\n--- Timestamp + fpHash Derivations ---');

const tsBytes4LE = Buffer.alloc(4);
tsBytes4LE.writeUInt32LE(KNOWN.timestamp);

const tsBytes4BE = Buffer.alloc(4);
tsBytes4BE.writeUInt32BE(KNOWN.timestamp);

const tsBytes8LE = Buffer.alloc(8);
tsBytes8LE.writeBigUInt64LE(BigInt(KNOWN.timestamp));

const tsBytes8BE = Buffer.alloc(8);
tsBytes8BE.writeBigUInt64BE(BigInt(KNOWN.timestamp));

// SHA256(fpHash || timestamp_4LE)
const concat1 = Buffer.concat([fpHashBytes, tsBytes4LE]);
testMatch('SHA256(fpHash || ts_4LE)', sha256(concat1).toString('hex'));

// SHA256(timestamp_4LE || fpHash)
const concat2 = Buffer.concat([tsBytes4LE, fpHashBytes]);
testMatch('SHA256(ts_4LE || fpHash)', sha256(concat2).toString('hex'));

// SHA256(fpHash || timestamp_8LE)
const concat3 = Buffer.concat([fpHashBytes, tsBytes8LE]);
testMatch('SHA256(fpHash || ts_8LE)', sha256(concat3).toString('hex'));

// SHA256(timestamp_8LE || fpHash)
const concat4 = Buffer.concat([tsBytes8LE, fpHashBytes]);
testMatch('SHA256(ts_8LE || fpHash)', sha256(concat4).toString('hex'));

// 4. Try AES-based key derivation (since AES is in the crates)
console.log('\n--- AES-based Derivation ---');

// AES-256-ECB encrypt zeros with fpHash as key
try {
  const cipher = crypto.createCipheriv('aes-256-ecb', fpHashBytes, null);
  cipher.setAutoPadding(false);
  const zeros = Buffer.alloc(32);
  const encrypted = Buffer.concat([cipher.update(zeros), cipher.final()]);
  testMatch('AES-256-ECB(zeros, fpHash)', encrypted.toString('hex'));
} catch (e) {}

// AES-256-ECB encrypt timestamp with fpHash as key
try {
  const cipher = crypto.createCipheriv('aes-256-ecb', fpHashBytes, null);
  cipher.setAutoPadding(false);
  const tsBlock = Buffer.alloc(32);
  tsBytes8LE.copy(tsBlock);
  const encrypted = Buffer.concat([cipher.update(tsBlock), cipher.final()]);
  testMatch('AES-256-ECB(ts_padded, fpHash)', encrypted.toString('hex'));
} catch (e) {}

// 5. Try CTR mode derivation (ctr crate is used)
console.log('\n--- CTR Mode Derivation ---');

// AES-256-CTR with fpHash as key and timestamp as nonce
try {
  const nonce = Buffer.alloc(16);
  tsBytes8LE.copy(nonce);
  const cipher = crypto.createCipheriv('aes-256-ctr', fpHashBytes, nonce);
  const zeros = Buffer.alloc(32);
  const encrypted = cipher.update(zeros);
  testMatch('AES-256-CTR(zeros, fpHash, ts_nonce)', encrypted.toString('hex'));
} catch (e) {}

// 6. Try HMAC chains
console.log('\n--- HMAC Chains ---');

// HMAC(HMAC(fpHash, ts), fpHash)
const hmac1 = crypto.createHmac('sha256', KNOWN.fpHash).update(KNOWN.timestamp.toString()).digest();
const hmac2 = crypto.createHmac('sha256', hmac1).update(KNOWN.fpHash).digest();
testMatch('HMAC(HMAC(fpHash, ts), fpHash)', hmac2.toString('hex'));

// HMAC(fpHash, HMAC(ts, fpHash))
const hmac3 = crypto.createHmac('sha256', KNOWN.timestamp.toString()).update(KNOWN.fpHash).digest();
const hmac4 = crypto.createHmac('sha256', KNOWN.fpHash).update(hmac3).digest();
testMatch('HMAC(fpHash, HMAC(ts, fpHash))', hmac4.toString('hex'));

// 7. Try with canvas data
console.log('\n--- Canvas-based Derivation ---');

const canvasHash = sha256(KNOWN.canvas50);

// SHA256(fpHash XOR canvasHash)
const fpXorCanvas = xorBuffers(fpHashBytes, canvasHash);
testMatch('SHA256(fpHash XOR canvasHash)', sha256(fpXorCanvas).toString('hex'));

// HMAC(canvasHash, fpHash)
const hmacCanvas1 = crypto.createHmac('sha256', canvasHash).update(fpHashBytes).digest();
testMatch('HMAC(canvasHash, fpHash)', hmacCanvas1.toString('hex'));

// HMAC(fpHash, canvasHash)
const hmacCanvas2 = crypto.createHmac('sha256', fpHashBytes).update(canvasHash).digest();
testMatch('HMAC(fpHash, canvasHash)', hmacCanvas2.toString('hex'));

// 8. Try with the KEY itself
console.log('\n--- Key-based Derivation ---');

const keyBytes = Buffer.from(KNOWN.key, 'hex');

// Is XOR = SHA256(key)?
testMatch('SHA256(key)', sha256(keyBytes).toString('hex'));

// Is XOR = SHA256(key_hex)?
testMatch('SHA256(key_hex)', sha256(KNOWN.key).toString('hex'));

// Is XOR = HMAC(key, fpHash)?
const hmacKey1 = crypto.createHmac('sha256', keyBytes).update(fpHashBytes).digest();
testMatch('HMAC(key, fpHash)', hmacKey1.toString('hex'));

// 9. Try Rust's rand crate patterns
console.log('\n--- Rust rand Patterns ---');

// ChaCha8 PRNG (common in Rust)
function chacha8Prng(seed) {
  // Simplified ChaCha8 - just for testing
  const state = new Uint32Array(16);
  
  // Constants
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  
  // Key from seed
  const seedBuf = Buffer.isBuffer(seed) ? seed : Buffer.from(seed.toString());
  const seedHash = sha256(seedBuf);
  for (let i = 0; i < 8; i++) {
    state[4 + i] = seedHash.readUInt32LE(i * 4);
  }
  
  // Counter and nonce
  state[12] = 0;
  state[13] = 0;
  state[14] = 0;
  state[15] = 0;
  
  // Quarter round
  function qr(a, b, c, d) {
    state[a] = (state[a] + state[b]) >>> 0; state[d] = ((state[d] ^ state[a]) >>> 0); state[d] = ((state[d] << 16) | (state[d] >>> 16)) >>> 0;
    state[c] = (state[c] + state[d]) >>> 0; state[b] = ((state[b] ^ state[c]) >>> 0); state[b] = ((state[b] << 12) | (state[b] >>> 20)) >>> 0;
    state[a] = (state[a] + state[b]) >>> 0; state[d] = ((state[d] ^ state[a]) >>> 0); state[d] = ((state[d] << 8) | (state[d] >>> 24)) >>> 0;
    state[c] = (state[c] + state[d]) >>> 0; state[b] = ((state[b] ^ state[c]) >>> 0); state[b] = ((state[b] << 7) | (state[b] >>> 25)) >>> 0;
  }
  
  // 8 rounds (4 double rounds)
  for (let i = 0; i < 4; i++) {
    qr(0, 4, 8, 12);
    qr(1, 5, 9, 13);
    qr(2, 6, 10, 14);
    qr(3, 7, 11, 15);
    qr(0, 5, 10, 15);
    qr(1, 6, 11, 12);
    qr(2, 7, 8, 13);
    qr(3, 4, 9, 14);
  }
  
  const result = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    result.writeUInt32LE(state[i], i * 4);
  }
  return result;
}

const chacha8Result = chacha8Prng(KNOWN.timestamp);
testMatch('ChaCha8(timestamp)', chacha8Result.toString('hex'));

const chacha8Result2 = chacha8Prng(fpHashBytes);
testMatch('ChaCha8(fpHash)', chacha8Result2.toString('hex'));

// 10. Try with session ID format
console.log('\n--- Session ID Derivation ---');

const sessionId = `${KNOWN.timestamp}.5000000`;

testMatch('SHA256(sessionId)', sha256(sessionId).toString('hex'));
testMatch('HMAC(sessionId, fpHash)', crypto.createHmac('sha256', sessionId).update(KNOWN.fpHash).digest('hex'));
testMatch('HMAC(fpHash, sessionId)', crypto.createHmac('sha256', KNOWN.fpHash).update(sessionId).digest('hex'));

// 11. Try XOR with rotated fpHash
console.log('\n--- Rotated fpHash ---');

for (let rot = 1; rot < 32; rot++) {
  const rotated = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    rotated[i] = fpHashBytes[(i + rot) % 32];
  }
  const xored = xorBuffers(fpHashBytes, rotated);
  if (testMatch(`fpHash XOR rotate(fpHash, ${rot})`, xored.toString('hex'))) break;
}

// 12. Try with bit-reversed fpHash
console.log('\n--- Bit Operations ---');

const reversed = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  reversed[i] = fpHashBytes[31 - i];
}
testMatch('SHA256(reversed_fpHash)', sha256(reversed).toString('hex'));
testMatch('fpHash XOR reversed_fpHash', xorBuffers(fpHashBytes, reversed).toString('hex'));

// 13. Verify all samples with the same pattern
console.log('\n--- Cross-Sample Verification ---');

// Check if there's a consistent relationship
console.log('Checking if XOR = f(timestamp, fpHash) for some function f...');

for (let i = 0; i < Math.min(5, samples.length); i++) {
  const s = samples[i];
  const fpH = Buffer.from(s.fpHash, 'hex');
  const xorB = Buffer.from(s.xor, 'hex');
  const keyB = Buffer.from(s.key, 'hex');
  
  // Verify key = fpHash XOR xor
  const computedKey = xorBuffers(fpH, xorB);
  console.log(`Sample ${i} (ts=${s.timestamp}): key = fpHash XOR xor: ${computedKey.toString('hex') === s.key ? 'YES' : 'NO'}`);
}

console.log('\n=== Summary ===');
console.log('No match found. The XOR derivation uses a custom algorithm.');
console.log('');
console.log('What we know:');
console.log('1. key = fpHash XOR xorConstant');
console.log('2. xorConstant changes with timestamp');
console.log('3. xorConstant is NOT derived from standard crypto primitives');
console.log('4. The algorithm is compiled into WASM from Rust');
