/**
 * Exhaustive PRNG Testing
 * 
 * Test every possible PRNG algorithm that could generate the XOR constant
 */

const crypto = require('crypto');

const data = {
  timestamp: 1700000000,
  xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
  fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
};

const xorBuf = Buffer.from(data.xor, 'hex');
const fpHashBuf = Buffer.from(data.fpHash, 'hex');

console.log('=== Exhaustive PRNG Testing ===\n');
console.log('Target XOR:', data.xor);
console.log('Timestamp:', data.timestamp);
console.log('');

// ============================================
// PRNG Implementations
// ============================================

// Mulberry32
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0);
  };
}

// xorshift32
function xorshift32(seed) {
  let state = seed >>> 0;
  return function() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

// xorshift128
function xorshift128(seed) {
  let x = seed >>> 0;
  let y = (seed * 1103515245 + 12345) >>> 0;
  let z = (y * 1103515245 + 12345) >>> 0;
  let w = (z * 1103515245 + 12345) >>> 0;
  
  return function() {
    const t = x ^ (x << 11);
    x = y; y = z; z = w;
    w = w ^ (w >>> 19) ^ (t ^ (t >>> 8));
    return w >>> 0;
  };
}

// LCG (Linear Congruential Generator)
function lcg(seed, a = 1103515245, c = 12345, m = 0x80000000) {
  let state = seed >>> 0;
  return function() {
    state = (Math.imul(a, state) + c) >>> 0;
    return state % m;
  };
}

// Wichmann-Hill
function wichmannHill(seed) {
  let s1 = (seed % 30269) + 1;
  let s2 = ((seed * 2) % 30307) + 1;
  let s3 = ((seed * 3) % 30323) + 1;
  
  return function() {
    s1 = (171 * s1) % 30269;
    s2 = (172 * s2) % 30307;
    s3 = (170 * s3) % 30323;
    return ((s1 / 30269 + s2 / 30307 + s3 / 30323) % 1) * 0xFFFFFFFF >>> 0;
  };
}

// SplitMix64 (returns 32-bit values)
function splitmix64(seed) {
  let state = BigInt(seed);
  return function() {
    state += 0x9e3779b97f4a7c15n;
    state &= 0xffffffffffffffffn;
    let z = state;
    z = (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n;
    z &= 0xffffffffffffffffn;
    z = (z ^ (z >> 27n)) * 0x94d049bb133111ebn;
    z &= 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return Number(z & 0xffffffffn);
  };
}

// PCG32
function pcg32(seed, inc = 1) {
  let state = BigInt(seed);
  const incBig = BigInt(inc) | 1n;
  
  return function() {
    const oldstate = state;
    state = (oldstate * 6364136223846793005n + incBig) & 0xffffffffffffffffn;
    const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n);
    const rot = Number(oldstate >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  };
}

// WELL512
function well512(seed) {
  const state = new Uint32Array(16);
  for (let i = 0; i < 16; i++) {
    state[i] = (seed + i * 0x9e3779b9) >>> 0;
  }
  let index = 0;
  
  return function() {
    let a = state[index];
    let c = state[(index + 13) & 15];
    let b = a ^ c ^ (a << 16) ^ (c << 15);
    c = state[(index + 9) & 15];
    c ^= (c >>> 11);
    a = state[index] = b ^ c;
    let d = a ^ ((a << 5) & 0xDA442D24);
    index = (index + 15) & 15;
    a = state[index];
    state[index] = a ^ b ^ d ^ (a << 2) ^ (b << 18) ^ (c << 28);
    return state[index] >>> 0;
  };
}

// Generate 32 bytes from a PRNG
function generateBytes(rng, count = 32) {
  const bytes = Buffer.alloc(count);
  for (let i = 0; i < count; i += 4) {
    const val = rng();
    bytes.writeUInt32LE(val, i);
  }
  return bytes;
}

// Also try big-endian
function generateBytesBE(rng, count = 32) {
  const bytes = Buffer.alloc(count);
  for (let i = 0; i < count; i += 4) {
    const val = rng();
    bytes.writeUInt32BE(val, i);
  }
  return bytes;
}

// ============================================
// Test all PRNGs with various seeds
// ============================================

const prngs = [
  { name: 'mulberry32', fn: mulberry32 },
  { name: 'xorshift32', fn: xorshift32 },
  { name: 'xorshift128', fn: xorshift128 },
  { name: 'lcg', fn: lcg },
  { name: 'wichmannHill', fn: wichmannHill },
  { name: 'splitmix64', fn: splitmix64 },
  { name: 'pcg32', fn: pcg32 },
  { name: 'well512', fn: well512 },
];

const seeds = [
  { name: 'timestamp', seed: data.timestamp },
  { name: 'timestamp*1000', seed: data.timestamp * 1000 },
  { name: 'fpHash[0:4]LE', seed: fpHashBuf.readUInt32LE(0) },
  { name: 'fpHash[0:4]BE', seed: fpHashBuf.readUInt32BE(0) },
  { name: 'fpHash[4:8]LE', seed: fpHashBuf.readUInt32LE(4) },
  { name: 'fpHash[8:12]LE', seed: fpHashBuf.readUInt32LE(8) },
  { name: 'ts^fpHash[0:4]', seed: data.timestamp ^ fpHashBuf.readUInt32LE(0) },
  { name: 'ts+fpHash[0:4]', seed: (data.timestamp + fpHashBuf.readUInt32LE(0)) >>> 0 },
];

console.log('=== Testing PRNGs ===\n');

for (const { name: prngName, fn: prngFn } of prngs) {
  for (const { name: seedName, seed } of seeds) {
    // Test LE
    const rngLE = prngFn(seed);
    const bytesLE = generateBytes(rngLE);
    if (bytesLE.equals(xorBuf)) {
      console.log(`*** MATCH: ${prngName}(${seedName}) LE ***`);
    }
    
    // Test BE
    const rngBE = prngFn(seed);
    const bytesBE = generateBytesBE(rngBE);
    if (bytesBE.equals(xorBuf)) {
      console.log(`*** MATCH: ${prngName}(${seedName}) BE ***`);
    }
    
    // Test with some bytes skipped (common in crypto)
    for (const skip of [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]) {
      const rngSkip = prngFn(seed);
      for (let i = 0; i < skip; i++) rngSkip(); // Skip
      const bytesSkip = generateBytes(rngSkip);
      if (bytesSkip.equals(xorBuf)) {
        console.log(`*** MATCH: ${prngName}(${seedName}) skip ${skip} ***`);
      }
    }
  }
}

// ============================================
// Test ChaCha20 quarter round as PRNG
// ============================================

console.log('\n=== Testing ChaCha20-based derivation ===\n');

function chacha20Block(key, nonce, counter) {
  // ChaCha20 constants
  const state = new Uint32Array(16);
  state[0] = 0x61707865; // "expa"
  state[1] = 0x3320646e; // "nd 3"
  state[2] = 0x79622d32; // "2-by"
  state[3] = 0x6b206574; // "te k"
  
  // Key (8 words)
  for (let i = 0; i < 8; i++) {
    state[4 + i] = key.readUInt32LE(i * 4);
  }
  
  // Counter
  state[12] = counter;
  
  // Nonce (3 words)
  for (let i = 0; i < 3; i++) {
    state[13 + i] = nonce.readUInt32LE(i * 4);
  }
  
  // Copy state
  const working = new Uint32Array(state);
  
  // 20 rounds (10 double rounds)
  for (let i = 0; i < 10; i++) {
    // Column rounds
    quarterRound(working, 0, 4, 8, 12);
    quarterRound(working, 1, 5, 9, 13);
    quarterRound(working, 2, 6, 10, 14);
    quarterRound(working, 3, 7, 11, 15);
    // Diagonal rounds
    quarterRound(working, 0, 5, 10, 15);
    quarterRound(working, 1, 6, 11, 12);
    quarterRound(working, 2, 7, 8, 13);
    quarterRound(working, 3, 4, 9, 14);
  }
  
  // Add original state
  for (let i = 0; i < 16; i++) {
    working[i] = (working[i] + state[i]) >>> 0;
  }
  
  return Buffer.from(working.buffer);
}

function quarterRound(state, a, b, c, d) {
  state[a] = (state[a] + state[b]) >>> 0; state[d] = rotl(state[d] ^ state[a], 16);
  state[c] = (state[c] + state[d]) >>> 0; state[b] = rotl(state[b] ^ state[c], 12);
  state[a] = (state[a] + state[b]) >>> 0; state[d] = rotl(state[d] ^ state[a], 8);
  state[c] = (state[c] + state[d]) >>> 0; state[b] = rotl(state[b] ^ state[c], 7);
}

function rotl(v, n) {
  return ((v << n) | (v >>> (32 - n))) >>> 0;
}

// Test ChaCha20 with various key/nonce combinations
const keyVariants = [
  { name: 'fpHash', key: fpHashBuf },
  { name: 'zeros', key: Buffer.alloc(32) },
];

const nonceVariants = [
  { name: 'ts4||zeros', nonce: Buffer.concat([Buffer.from([data.timestamp & 0xff, (data.timestamp >> 8) & 0xff, (data.timestamp >> 16) & 0xff, (data.timestamp >> 24) & 0xff]), Buffer.alloc(8)]) },
  { name: 'zeros||ts4', nonce: Buffer.concat([Buffer.alloc(8), Buffer.from([data.timestamp & 0xff, (data.timestamp >> 8) & 0xff, (data.timestamp >> 16) & 0xff, (data.timestamp >> 24) & 0xff])]) },
  { name: 'zeros', nonce: Buffer.alloc(12) },
];

for (const { name: keyName, key } of keyVariants) {
  for (const { name: nonceName, nonce } of nonceVariants) {
    for (let counter = 0; counter <= 10; counter++) {
      const block = chacha20Block(key, nonce, counter);
      if (block.subarray(0, 32).equals(xorBuf)) {
        console.log(`*** MATCH: ChaCha20(${keyName}, ${nonceName}, counter=${counter}) ***`);
      }
    }
  }
}

// ============================================
// Test if XOR constant is in a lookup table indexed by timestamp
// ============================================

console.log('\n=== Testing timestamp-indexed derivation ===\n');

// Maybe XOR = SHA256(some_constant || timestamp)
const constants = [
  'tmdb_session_key',
  'flixer_key',
  'hexa_key',
  'img_data_key',
  'derive_key',
  'xor_constant',
  'session_xor',
];

for (const constant of constants) {
  const hash = crypto.createHash('sha256').update(constant + data.timestamp).digest();
  if (hash.equals(xorBuf)) {
    console.log(`*** MATCH: SHA256("${constant}" + timestamp) ***`);
  }
  
  const hash2 = crypto.createHash('sha256').update(data.timestamp + constant).digest();
  if (hash2.equals(xorBuf)) {
    console.log(`*** MATCH: SHA256(timestamp + "${constant}") ***`);
  }
}

// Try with binary timestamp
const ts4LE = Buffer.alloc(4);
ts4LE.writeUInt32LE(data.timestamp);

for (const constant of constants) {
  const hash = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(constant), ts4LE])).digest();
  if (hash.equals(xorBuf)) {
    console.log(`*** MATCH: SHA256("${constant}" || ts4LE) ***`);
  }
  
  const hash2 = crypto.createHash('sha256').update(Buffer.concat([ts4LE, Buffer.from(constant)])).digest();
  if (hash2.equals(xorBuf)) {
    console.log(`*** MATCH: SHA256(ts4LE || "${constant}") ***`);
  }
}

console.log('\n=== Summary ===');
console.log('No standard PRNG or derivation found.');
console.log('The WASM likely uses a custom algorithm.');
