/**
 * Use pattern analysis on collected samples to find the XOR derivation
 * Look for mathematical relationships between timestamp, fpHash, and xorConstant
 */

const crypto = require('crypto');
const fs = require('fs');

// Load collected samples
let samples;
try {
  samples = JSON.parse(fs.readFileSync('xor-samples.json', 'utf8'));
} catch (e) {
  console.log('No samples file found, using hardcoded samples');
  samples = [
    { timestamp: 1700000000, fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e', key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2', xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc' },
    { timestamp: 1700000001, fpHash: '9651e9e4d5617929', key: '800bb8714df5f8fc', xor: '165a5195989481d5' },
  ];
}

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

console.log('=== Pattern Analysis on', samples.length, 'samples ===\n');

// Analyze each sample
for (const sample of samples.slice(0, 10)) {
  const ts = sample.timestamp;
  const fpHashBytes = hexToBytes(sample.fpHash.slice(0, 64));
  const xorBytes = hexToBytes(sample.xor.slice(0, 64));
  
  console.log(`Timestamp ${ts}:`);
  console.log(`  fpHash: ${sample.fpHash.slice(0, 32)}...`);
  console.log(`  xor:    ${sample.xor.slice(0, 32)}...`);
  
  // Try various derivations
  const tsStr = ts.toString();
  const tsBytes4LE = Buffer.alloc(4);
  tsBytes4LE.writeUInt32LE(ts);
  const tsBytes4BE = Buffer.alloc(4);
  tsBytes4BE.writeUInt32BE(ts);
  
  // SHA256 of timestamp
  const sha256Ts = crypto.createHash('sha256').update(tsStr).digest();
  
  // XOR fpHash with SHA256(timestamp)
  const fpXorSha256Ts = fpHashBytes.map((b, i) => b ^ sha256Ts[i]);
  console.log(`  fpHash XOR SHA256(ts): ${bytesToHex(fpXorSha256Ts).slice(0, 32)}...`);
  
  // HMAC-SHA256
  const hmac = crypto.createHmac('sha256', tsStr).update(Buffer.from(fpHashBytes)).digest();
  console.log(`  HMAC(ts, fpHash): ${hmac.toString('hex').slice(0, 32)}...`);
  
  // Check if xor = HMAC(something, something)
  const hmac2 = crypto.createHmac('sha256', Buffer.from(fpHashBytes)).update(tsStr).digest();
  console.log(`  HMAC(fpHash, ts): ${hmac2.toString('hex').slice(0, 32)}...`);
  
  // Check if xor = SHA256(fpHash || timestamp)
  const concat1 = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(fpHashBytes), Buffer.from(tsStr)])).digest();
  console.log(`  SHA256(fpHash || ts): ${concat1.toString('hex').slice(0, 32)}...`);
  
  // Check if xor = SHA256(timestamp || fpHash)
  const concat2 = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(tsStr), Buffer.from(fpHashBytes)])).digest();
  console.log(`  SHA256(ts || fpHash): ${concat2.toString('hex').slice(0, 32)}...`);
  
  // Check if xor = SHA256(fpHash.hex || timestamp)
  const concat3 = crypto.createHash('sha256').update(sample.fpHash + tsStr).digest();
  console.log(`  SHA256(fpHash.hex + ts): ${concat3.toString('hex').slice(0, 32)}...`);
  
  // Check if xor = SHA256(timestamp || fpHash.hex)
  const concat4 = crypto.createHash('sha256').update(tsStr + sample.fpHash).digest();
  console.log(`  SHA256(ts + fpHash.hex): ${concat4.toString('hex').slice(0, 32)}...`);
  
  // Check matches
  const xorHex = sample.xor.slice(0, 64);
  if (bytesToHex(fpXorSha256Ts) === xorHex) console.log('  *** MATCH: fpHash XOR SHA256(ts) ***');
  if (hmac.toString('hex') === xorHex) console.log('  *** MATCH: HMAC(ts, fpHash) ***');
  if (hmac2.toString('hex') === xorHex) console.log('  *** MATCH: HMAC(fpHash, ts) ***');
  if (concat1.toString('hex') === xorHex) console.log('  *** MATCH: SHA256(fpHash || ts) ***');
  if (concat2.toString('hex') === xorHex) console.log('  *** MATCH: SHA256(ts || fpHash) ***');
  if (concat3.toString('hex') === xorHex) console.log('  *** MATCH: SHA256(fpHash.hex + ts) ***');
  if (concat4.toString('hex') === xorHex) console.log('  *** MATCH: SHA256(ts + fpHash.hex) ***');
  
  console.log('');
}

// Try to find a pattern in the XOR constants themselves
console.log('=== XOR Constant Pattern Analysis ===\n');

// Check if consecutive XOR constants have a relationship
for (let i = 1; i < Math.min(samples.length, 10); i++) {
  const prev = samples[i - 1];
  const curr = samples[i];
  
  if (curr.timestamp === prev.timestamp + 1) {
    const prevXor = hexToBytes(prev.xor.slice(0, 64));
    const currXor = hexToBytes(curr.xor.slice(0, 64));
    
    // XOR difference
    const diff = prevXor.map((b, j) => b ^ currXor[j]);
    
    // Check if diff is related to timestamp difference
    const tsDiff = curr.timestamp - prev.timestamp; // Always 1 for consecutive
    
    console.log(`${prev.timestamp} -> ${curr.timestamp}:`);
    console.log(`  XOR diff: ${bytesToHex(diff).slice(0, 32)}...`);
    
    // Check if diff is SHA256 of something
    const sha256Diff = crypto.createHash('sha256').update(Buffer.from(diff)).digest('hex');
    console.log(`  SHA256(diff): ${sha256Diff.slice(0, 32)}...`);
    
    // Check if diff is constant
    const allSame = diff.every(b => b === diff[0]);
    if (allSame) console.log(`  Diff is constant: 0x${diff[0].toString(16)}`);
  }
}

// Try HKDF-like derivation
console.log('\n=== HKDF-like Derivation ===\n');

for (const sample of samples.slice(0, 3)) {
  const ts = sample.timestamp;
  const fpHashBytes = hexToBytes(sample.fpHash.slice(0, 64));
  const xorBytes = hexToBytes(sample.xor.slice(0, 64));
  
  // HKDF-Extract: PRK = HMAC-Hash(salt, IKM)
  // HKDF-Expand: OKM = HMAC-Hash(PRK, info || 0x01)
  
  // Try with timestamp as salt, fpHash as IKM
  const prk1 = crypto.createHmac('sha256', ts.toString()).update(Buffer.from(fpHashBytes)).digest();
  const okm1 = crypto.createHmac('sha256', prk1).update(Buffer.from([0x01])).digest();
  
  console.log(`Timestamp ${ts}:`);
  console.log(`  HKDF(salt=ts, ikm=fpHash): ${okm1.toString('hex').slice(0, 32)}...`);
  console.log(`  Expected xor: ${sample.xor.slice(0, 32)}...`);
  console.log(`  Match: ${okm1.toString('hex') === sample.xor.slice(0, 64)}`);
  
  // Try with fpHash as salt, timestamp as IKM
  const prk2 = crypto.createHmac('sha256', Buffer.from(fpHashBytes)).update(ts.toString()).digest();
  const okm2 = crypto.createHmac('sha256', prk2).update(Buffer.from([0x01])).digest();
  console.log(`  HKDF(salt=fpHash, ikm=ts): ${okm2.toString('hex').slice(0, 32)}...`);
  console.log(`  Match: ${okm2.toString('hex') === sample.xor.slice(0, 64)}`);
  
  // Try with empty salt
  const prk3 = crypto.createHmac('sha256', Buffer.alloc(32)).update(Buffer.from(fpHashBytes)).digest();
  const okm3 = crypto.createHmac('sha256', prk3).update(ts.toString()).digest();
  console.log(`  HKDF(salt=0, ikm=fpHash, info=ts): ${okm3.toString('hex').slice(0, 32)}...`);
  console.log(`  Match: ${okm3.toString('hex') === sample.xor.slice(0, 64)}`);
  
  console.log('');
}

// Try ChaCha20-like derivation
console.log('=== ChaCha20-like Derivation ===\n');

function quarterRound(a, b, c, d) {
  a = (a + b) >>> 0; d = (d ^ a) >>> 0; d = ((d << 16) | (d >>> 16)) >>> 0;
  c = (c + d) >>> 0; b = (b ^ c) >>> 0; b = ((b << 12) | (b >>> 20)) >>> 0;
  a = (a + b) >>> 0; d = (d ^ a) >>> 0; d = ((d << 8) | (d >>> 24)) >>> 0;
  c = (c + d) >>> 0; b = (b ^ c) >>> 0; b = ((b << 7) | (b >>> 25)) >>> 0;
  return [a, b, c, d];
}

for (const sample of samples.slice(0, 2)) {
  const ts = sample.timestamp;
  const fpHashBytes = hexToBytes(sample.fpHash.slice(0, 64));
  
  // Use fpHash as key, timestamp as nonce
  const state = new Uint32Array(16);
  // ChaCha20 constants
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  
  // Key from fpHash (8 words)
  for (let i = 0; i < 8; i++) {
    state[4 + i] = (fpHashBytes[i * 4] | (fpHashBytes[i * 4 + 1] << 8) | 
                   (fpHashBytes[i * 4 + 2] << 16) | (fpHashBytes[i * 4 + 3] << 24)) >>> 0;
  }
  
  // Counter and nonce
  state[12] = 0;
  state[13] = ts & 0xFFFFFFFF;
  state[14] = 0;
  state[15] = 0;
  
  // One round
  const [a, b, c, d] = quarterRound(state[0], state[4], state[8], state[12]);
  
  console.log(`Timestamp ${ts}:`);
  console.log(`  ChaCha QR output: ${a.toString(16)} ${b.toString(16)} ${c.toString(16)} ${d.toString(16)}`);
}

console.log('\n=== Summary ===');
console.log('No direct mathematical relationship found between timestamp, fpHash, and xorConstant.');
console.log('The XOR constant appears to be derived through a custom algorithm in the WASM.');
