/**
 * PRNG Search - Try to find the PRNG algorithm used
 * 
 * We have 10 samples. Let's try various PRNG algorithms seeded with timestamp.
 */

const crypto = require('crypto');

const samples = [
  { timestamp: 1700000000, xor: "1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc" },
  { timestamp: 1700000001, xor: "165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977" },
  { timestamp: 1700000002, xor: "c22c65a74d2b04cadf60e1030aa1e6a21dc49eee4729e53d974570b7c65696a8" },
  { timestamp: 1700000003, xor: "393e675e60365709e732488fc5662890adc38c01c8fb7f203bba534afd520fdb" },
  { timestamp: 1700000004, xor: "b6573092fdf85bcf12a62bb520aebe8430e5d49fe893dcf2d5dbe60f74d6feea" },
  { timestamp: 1700000005, xor: "ca30ee60d757f707c9d0f6e15b6b659a241707d18b8fa656b9268817ea9c0a83" },
  { timestamp: 1700000010, xor: "b58ba1d567267c8a45342455432dd545d581164002e3f4fc5865a48a7027322b" },
  { timestamp: 1700000100, xor: "d9ae6ca229dc2b40c4d859f5b057f2e0c15f213362815849a6dfae3add882dc7" },
  { timestamp: 1700001000, xor: "c498b531891bfa7c2640ddbd3e952829cf0006c66be1ff19c7085d8480db6217" },
  { timestamp: 1700010000, xor: "0097696b2c842200073b9161bb25d7b1af157fb31775e2b86eb88b588648522d" },
];

console.log('=== PRNG Search ===\n');

// Try various PRNG algorithms

// 1. xorshift128+
function xorshift128plus(seed) {
  let s0 = BigInt(seed);
  let s1 = BigInt(seed) * 0x9e3779b97f4a7c15n;
  
  const results = [];
  for (let i = 0; i < 4; i++) {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23n;
    s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n);
    results.push((s1 + y) & 0xffffffffffffffffn);
  }
  
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    buf.writeBigUInt64LE(results[i], i * 8);
  }
  return buf;
}

// 2. splitmix64
function splitmix64(seed) {
  let state = BigInt(seed);
  
  const results = [];
  for (let i = 0; i < 4; i++) {
    state += 0x9e3779b97f4a7c15n;
    let z = state;
    z = (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n;
    z = (z ^ (z >> 27n)) * 0x94d049bb133111ebn;
    z = z ^ (z >> 31n);
    results.push(z & 0xffffffffffffffffn);
  }
  
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    buf.writeBigUInt64LE(results[i], i * 8);
  }
  return buf;
}

// 3. PCG32
function pcg32(seed) {
  let state = BigInt(seed);
  const inc = 0x14057b7ef767814fn;
  
  const results = [];
  for (let i = 0; i < 8; i++) {
    const oldstate = state;
    state = oldstate * 6364136223846793005n + inc;
    const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
    const rot = Number(oldstate >> 59n);
    results.push(((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0);
  }
  
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    buf.writeUInt32LE(results[i], i * 4);
  }
  return buf;
}

// 4. Mulberry32
function mulberry32(seed) {
  let state = seed >>> 0;
  
  const results = [];
  for (let i = 0; i < 8; i++) {
    let t = state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    results.push((t ^ t >>> 14) >>> 0);
  }
  
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    buf.writeUInt32LE(results[i], i * 4);
  }
  return buf;
}

// 5. xorshift32
function xorshift32(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 1;
  
  const results = [];
  for (let i = 0; i < 8; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    results.push(state >>> 0);
  }
  
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    buf.writeUInt32LE(results[i], i * 4);
  }
  return buf;
}

// 6. LCG (Linear Congruential Generator)
function lcg(seed) {
  let state = BigInt(seed);
  const a = 6364136223846793005n;
  const c = 1442695040888963407n;
  const m = 2n ** 64n;
  
  const results = [];
  for (let i = 0; i < 4; i++) {
    state = (a * state + c) % m;
    results.push(state);
  }
  
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    buf.writeBigUInt64LE(results[i], i * 8);
  }
  return buf;
}

// Test all PRNGs
const prngs = [
  { name: 'xorshift128+', fn: xorshift128plus },
  { name: 'splitmix64', fn: splitmix64 },
  { name: 'pcg32', fn: pcg32 },
  { name: 'mulberry32', fn: mulberry32 },
  { name: 'xorshift32', fn: xorshift32 },
  { name: 'lcg', fn: lcg },
];

for (const { name, fn } of prngs) {
  console.log(`Testing ${name}...`);
  let matches = 0;
  
  for (const s of samples) {
    const xorBuf = Buffer.from(s.xor, 'hex');
    
    // Try with timestamp directly
    const result1 = fn(s.timestamp);
    if (result1.equals(xorBuf)) {
      console.log(`  MATCH for ts=${s.timestamp} with seed=ts`);
      matches++;
    }
    
    // Try with timestamp * 1000
    const result2 = fn(s.timestamp * 1000);
    if (result2.equals(xorBuf)) {
      console.log(`  MATCH for ts=${s.timestamp} with seed=ts*1000`);
      matches++;
    }
    
    // Try with timestamp + offset
    for (const offset of [0, 1, -1, 1000, -1000]) {
      const result3 = fn(s.timestamp + offset);
      if (result3.equals(xorBuf)) {
        console.log(`  MATCH for ts=${s.timestamp} with seed=ts+${offset}`);
        matches++;
      }
    }
  }
  
  if (matches === 0) {
    console.log(`  No matches`);
  }
  console.log('');
}

// Try SHA256-based PRNG
console.log('Testing SHA256-based PRNG...');
function sha256Prng(seed) {
  let state = crypto.createHash('sha256').update(String(seed)).digest();
  return state;
}

for (const s of samples) {
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // Try various seeds
  const seeds = [
    s.timestamp,
    s.timestamp * 1000,
    `${s.timestamp}`,
    `${s.timestamp}.5000000`,
  ];
  
  for (const seed of seeds) {
    const result = sha256Prng(seed);
    if (result.equals(xorBuf)) {
      console.log(`  MATCH for ts=${s.timestamp} with seed=${seed}`);
    }
  }
}
console.log('');

// Try HMAC-based derivation
console.log('Testing HMAC-based derivation...');
const hmacKeys = [
  'flixer',
  'tmdb',
  'img_data',
  'session',
  'key',
  'secret',
  'wasm',
  'rust',
  'aes',
  'encryption',
  'fingerprint',
  'canvas',
  'browser',
  'client',
  'api',
];

for (const key of hmacKeys) {
  let matches = 0;
  for (const s of samples) {
    const xorBuf = Buffer.from(s.xor, 'hex');
    
    const hmac = crypto.createHmac('sha256', key).update(String(s.timestamp)).digest();
    if (hmac.equals(xorBuf)) {
      console.log(`  MATCH for ts=${s.timestamp} with key=${key}`);
      matches++;
    }
  }
  if (matches > 0) {
    console.log(`  Total matches for key=${key}: ${matches}`);
  }
}
console.log('');

// Try to find a common XOR mask
console.log('=== Looking for common XOR mask ===\n');

// XOR all XOR constants together
let combined = Buffer.alloc(32, 0);
for (const s of samples) {
  const xorBuf = Buffer.from(s.xor, 'hex');
  for (let i = 0; i < 32; i++) {
    combined[i] ^= xorBuf[i];
  }
}
console.log('XOR of all XOR constants:', combined.toString('hex'));

// Try to find if XOR = SHA256(ts) XOR mask
console.log('\nTrying XOR = SHA256(ts) XOR mask...');
for (const s of samples) {
  const xorBuf = Buffer.from(s.xor, 'hex');
  const tsHash = crypto.createHash('sha256').update(String(s.timestamp)).digest();
  
  const mask = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    mask[i] = xorBuf[i] ^ tsHash[i];
  }
  console.log(`ts=${s.timestamp}: mask = ${mask.toString('hex').slice(0, 32)}...`);
}

// Check if all masks are the same
const masks = samples.map(s => {
  const xorBuf = Buffer.from(s.xor, 'hex');
  const tsHash = crypto.createHash('sha256').update(String(s.timestamp)).digest();
  
  const mask = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    mask[i] = xorBuf[i] ^ tsHash[i];
  }
  return mask.toString('hex');
});

const allMasksSame = masks.every(m => m === masks[0]);
console.log(`\nAll masks same: ${allMasksSame}`);

console.log('\n=== Summary ===');
console.log('No simple PRNG or hash-based derivation found.');
console.log('The XOR constant is derived through a custom algorithm in the WASM.');
