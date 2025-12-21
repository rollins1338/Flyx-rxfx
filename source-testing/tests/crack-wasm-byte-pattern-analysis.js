/**
 * Deep byte-level pattern analysis of XOR constants
 * Looking for mathematical relationships between timestamp and XOR bytes
 */

const crypto = require('crypto');
const fs = require('fs');

const samples = JSON.parse(fs.readFileSync('./xor-samples.json', 'utf8'));

console.log('=== Deep Byte Pattern Analysis ===\n');

// Extract just the consecutive timestamp samples (0-19)
const consecutiveSamples = samples.filter(s => s.timestamp >= 1700000000 && s.timestamp <= 1700000019);

console.log(`Analyzing ${consecutiveSamples.length} consecutive samples\n`);

// Analyze each byte position across samples
console.log('--- Byte Position Analysis ---');

for (let bytePos = 0; bytePos < 32; bytePos++) {
  const byteValues = consecutiveSamples.map(s => parseInt(s.xor.slice(bytePos * 2, bytePos * 2 + 2), 16));
  const timestamps = consecutiveSamples.map(s => s.timestamp);
  
  // Check for linear relationship: byte = a * timestamp + b (mod 256)
  // Using first two points to find a and b
  const t0 = timestamps[0];
  const t1 = timestamps[1];
  const b0 = byteValues[0];
  const b1 = byteValues[1];
  
  // a = (b1 - b0) / (t1 - t0) mod 256
  const diff = (b1 - b0 + 256) % 256;
  
  // Check if this linear relationship holds for all samples
  let linearMatch = true;
  for (let i = 2; i < consecutiveSamples.length; i++) {
    const expected = (b0 + diff * (timestamps[i] - t0)) % 256;
    const actual = byteValues[i];
    if (expected !== actual) {
      linearMatch = false;
      break;
    }
  }
  
  if (linearMatch && diff !== 0) {
    console.log(`Byte ${bytePos}: LINEAR pattern found! diff=${diff}`);
  }
}

// Check for XOR patterns between consecutive XOR constants
console.log('\n--- XOR Difference Analysis ---');

const xorDiffs = [];
for (let i = 1; i < consecutiveSamples.length; i++) {
  const prev = Buffer.from(consecutiveSamples[i-1].xor, 'hex');
  const curr = Buffer.from(consecutiveSamples[i].xor, 'hex');
  const diff = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    diff[j] = prev[j] ^ curr[j];
  }
  xorDiffs.push(diff.toString('hex'));
}

// Check if XOR diffs are related to timestamp diffs
console.log('XOR diff[0] (ts 0->1):', xorDiffs[0]);
console.log('XOR diff[1] (ts 1->2):', xorDiffs[1]);

// Are the diffs themselves hashes of something?
const ts0 = consecutiveSamples[0].timestamp.toString();
const ts1 = consecutiveSamples[1].timestamp.toString();
console.log('\nSHA256(ts0):', crypto.createHash('sha256').update(ts0).digest('hex'));
console.log('SHA256(ts1):', crypto.createHash('sha256').update(ts1).digest('hex'));
console.log('XOR diff[0]:', xorDiffs[0]);

// Check if XOR diff = SHA256(ts0) XOR SHA256(ts1)
const sha256_ts0 = crypto.createHash('sha256').update(ts0).digest();
const sha256_ts1 = crypto.createHash('sha256').update(ts1).digest();
const sha256Diff = Buffer.alloc(32);
for (let i = 0; i < 32; i++) sha256Diff[i] = sha256_ts0[i] ^ sha256_ts1[i];
console.log('SHA256(ts0) XOR SHA256(ts1):', sha256Diff.toString('hex'));
console.log('Match with XOR diff[0]:', sha256Diff.toString('hex') === xorDiffs[0] ? 'YES' : 'NO');

// Analyze the structure of XOR constants
console.log('\n--- XOR Constant Structure ---');

// Check if XOR constants have any repeating patterns
const xor0 = consecutiveSamples[0].xor;
console.log('XOR[0] as 4-byte chunks:');
for (let i = 0; i < 8; i++) {
  console.log(`  Chunk ${i}: ${xor0.slice(i*8, i*8+8)}`);
}

// Check if any chunks are related to timestamp
const ts = consecutiveSamples[0].timestamp;
console.log('\nTimestamp:', ts);
console.log('Timestamp hex:', ts.toString(16));
console.log('Timestamp hex padded:', ts.toString(16).padStart(8, '0'));

// Check if timestamp appears in XOR constant
const tsHex = ts.toString(16).padStart(8, '0');
if (xor0.includes(tsHex)) {
  console.log('Timestamp found in XOR constant!');
}

// Try different PRNG algorithms
console.log('\n--- PRNG Algorithm Search ---');

// Mulberry32
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0);
  };
}

// Generate 8 32-bit values from mulberry32
const mb = mulberry32(ts);
const mbResult = [];
for (let i = 0; i < 8; i++) {
  mbResult.push(mb().toString(16).padStart(8, '0'));
}
console.log('mulberry32(ts):', mbResult.join(''));
console.log('XOR[0]:', xor0);
console.log('Match:', mbResult.join('') === xor0 ? 'YES' : 'NO');

// xorshift32
function xorshift32(seed) {
  let x = seed;
  return function() {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
}

const xs = xorshift32(ts);
const xsResult = [];
for (let i = 0; i < 8; i++) {
  xsResult.push(xs().toString(16).padStart(8, '0'));
}
console.log('\nxorshift32(ts):', xsResult.join(''));
console.log('XOR[0]:', xor0);
console.log('Match:', xsResult.join('') === xor0 ? 'YES' : 'NO');

// PCG32
function pcg32(seed) {
  let state = BigInt(seed);
  const multiplier = 6364136223846793005n;
  const increment = 1442695040888963407n;
  
  return function() {
    const oldState = state;
    state = (oldState * multiplier + increment) & 0xFFFFFFFFFFFFFFFFn;
    const xorshifted = Number(((oldState >> 18n) ^ oldState) >> 27n) >>> 0;
    const rot = Number(oldState >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  };
}

const pcg = pcg32(ts);
const pcgResult = [];
for (let i = 0; i < 8; i++) {
  pcgResult.push(pcg().toString(16).padStart(8, '0'));
}
console.log('\npcg32(ts):', pcgResult.join(''));
console.log('XOR[0]:', xor0);
console.log('Match:', pcgResult.join('') === xor0 ? 'YES' : 'NO');

// Try with fpHash as additional seed
console.log('\n--- PRNG with fpHash seed ---');

const fpHash0 = consecutiveSamples[0].fpHash;
const fpHashNum = parseInt(fpHash0.slice(0, 8), 16);

const mb2 = mulberry32(ts ^ fpHashNum);
const mb2Result = [];
for (let i = 0; i < 8; i++) {
  mb2Result.push(mb2().toString(16).padStart(8, '0'));
}
console.log('mulberry32(ts XOR fpHash[:4]):', mb2Result.join(''));
console.log('XOR[0]:', xor0);
console.log('Match:', mb2Result.join('') === xor0 ? 'YES' : 'NO');

// Try ChaCha20 quarter round
console.log('\n--- ChaCha20-like derivation ---');

function quarterRound(a, b, c, d) {
  a = (a + b) >>> 0; d = ((d ^ a) >>> 0); d = ((d << 16) | (d >>> 16)) >>> 0;
  c = (c + d) >>> 0; b = ((b ^ c) >>> 0); b = ((b << 12) | (b >>> 20)) >>> 0;
  a = (a + b) >>> 0; d = ((d ^ a) >>> 0); d = ((d << 8) | (d >>> 24)) >>> 0;
  c = (c + d) >>> 0; b = ((b ^ c) >>> 0); b = ((b << 7) | (b >>> 25)) >>> 0;
  return [a, b, c, d];
}

// Initialize state with timestamp and fpHash
const state = new Uint32Array(8);
state[0] = ts;
state[1] = ts >>> 0;
state[2] = parseInt(fpHash0.slice(0, 8), 16);
state[3] = parseInt(fpHash0.slice(8, 16), 16);
state[4] = parseInt(fpHash0.slice(16, 24), 16);
state[5] = parseInt(fpHash0.slice(24, 32), 16);
state[6] = parseInt(fpHash0.slice(32, 40), 16);
state[7] = parseInt(fpHash0.slice(40, 48), 16);

// Apply quarter rounds
[state[0], state[1], state[2], state[3]] = quarterRound(state[0], state[1], state[2], state[3]);
[state[4], state[5], state[6], state[7]] = quarterRound(state[4], state[5], state[6], state[7]);

const chachaResult = Array.from(state).map(n => n.toString(16).padStart(8, '0')).join('');
console.log('ChaCha-like(ts, fpHash):', chachaResult);
console.log('XOR[0]:', xor0);
console.log('Match:', chachaResult === xor0 ? 'YES' : 'NO');

// Try BLAKE2-like compression
console.log('\n--- BLAKE2-like derivation ---');

// BLAKE2 uses XOR, rotation, and addition
function blake2Like(ts, fpHash) {
  const v = new Uint32Array(8);
  v[0] = ts;
  v[1] = parseInt(fpHash.slice(0, 8), 16);
  v[2] = parseInt(fpHash.slice(8, 16), 16);
  v[3] = parseInt(fpHash.slice(16, 24), 16);
  v[4] = 0x6A09E667; // BLAKE2 IV
  v[5] = 0xBB67AE85;
  v[6] = 0x3C6EF372;
  v[7] = 0xA54FF53A;
  
  // Mix
  for (let i = 0; i < 10; i++) {
    v[0] = (v[0] + v[4]) >>> 0;
    v[1] = (v[1] + v[5]) >>> 0;
    v[2] = (v[2] + v[6]) >>> 0;
    v[3] = (v[3] + v[7]) >>> 0;
    v[4] = v[4] ^ v[0];
    v[5] = v[5] ^ v[1];
    v[6] = v[6] ^ v[2];
    v[7] = v[7] ^ v[3];
  }
  
  return Array.from(v).map(n => n.toString(16).padStart(8, '0')).join('');
}

const blake2Result = blake2Like(ts, fpHash0);
console.log('BLAKE2-like(ts, fpHash):', blake2Result);
console.log('XOR[0]:', xor0);
console.log('Match:', blake2Result === xor0 ? 'YES' : 'NO');

// Analyze correlation between fpHash and XOR
console.log('\n--- fpHash to XOR Correlation ---');

for (let i = 0; i < 5; i++) {
  const s = consecutiveSamples[i];
  const fpH = Buffer.from(s.fpHash, 'hex');
  const xorB = Buffer.from(s.xor, 'hex');
  
  // XOR fpHash with XOR constant
  const mystery = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    mystery[j] = fpH[j] ^ xorB[j];
  }
  
  console.log(`Sample ${i}: fpHash XOR xor = ${mystery.toString('hex').slice(0, 32)}...`);
  console.log(`           key             = ${s.key.slice(0, 32)}...`);
  console.log(`           Match: ${mystery.toString('hex') === s.key ? 'YES (expected)' : 'NO'}`);
}

// Try to find if XOR is derived from a combination of canvas and timestamp
console.log('\n--- Canvas + Timestamp Derivation ---');

const canvas50 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';

// SHA256(canvas + timestamp)
const canvasTsHash = crypto.createHash('sha256').update(canvas50 + ts.toString()).digest('hex');
console.log('SHA256(canvas + ts):', canvasTsHash);
console.log('XOR[0]:', xor0);
console.log('Match:', canvasTsHash === xor0 ? 'YES' : 'NO');

// HMAC(canvas, timestamp)
const hmacCanvasTs = crypto.createHmac('sha256', canvas50).update(ts.toString()).digest('hex');
console.log('\nHMAC(canvas, ts):', hmacCanvasTs);
console.log('XOR[0]:', xor0);
console.log('Match:', hmacCanvasTs === xor0 ? 'YES' : 'NO');

// Try PBKDF2
console.log('\n--- PBKDF2 Derivation ---');

for (const iterations of [1, 2, 10, 100, 1000]) {
  const pbkdf2Result = crypto.pbkdf2Sync(ts.toString(), fpHash0, iterations, 32, 'sha256').toString('hex');
  const match = pbkdf2Result === xor0;
  console.log(`PBKDF2(ts, fpHash, ${iterations}): ${match ? '*** MATCH ***' : pbkdf2Result.slice(0, 32) + '...'}`);
}

for (const iterations of [1, 2, 10, 100, 1000]) {
  const pbkdf2Result = crypto.pbkdf2Sync(fpHash0, ts.toString(), iterations, 32, 'sha256').toString('hex');
  const match = pbkdf2Result === xor0;
  console.log(`PBKDF2(fpHash, ts, ${iterations}): ${match ? '*** MATCH ***' : pbkdf2Result.slice(0, 32) + '...'}`);
}

// Try scrypt-like
console.log('\n--- scrypt-like Derivation ---');

try {
  const scryptResult = crypto.scryptSync(ts.toString(), fpHash0, 32, { N: 2, r: 1, p: 1 }).toString('hex');
  console.log('scrypt(ts, fpHash, N=2):', scryptResult);
  console.log('XOR[0]:', xor0);
  console.log('Match:', scryptResult === xor0 ? 'YES' : 'NO');
} catch (e) {
  console.log('scrypt error:', e.message);
}

console.log('\n=== Summary ===');
console.log('No pattern found yet. The XOR constant derivation is custom.');
