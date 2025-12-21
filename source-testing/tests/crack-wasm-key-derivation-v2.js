/**
 * Crack WASM Key Derivation v2 - Focus on timestamp-based derivation
 * 
 * KNOWN FACTS:
 * 1. key = SHA256(fpString) XOR xorConstant
 * 2. xorConstant changes with timestamp but NOT with random part
 * 3. fpString format: {colorDepth}:{userAgent.slice(0,50)}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64.slice(0,50)}
 * 
 * The xorConstant must be derived from something that includes the timestamp
 * but NOT the random part of the sessionId.
 */

const crypto = require('crypto');

// Real samples from controlled tests
const samples = [
  {
    timestamp: 1700000000,
    fpString: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
    fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
    key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
    xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
    canvas50: 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  },
  {
    timestamp: 1700000001,
    fpString: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000001:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
    fpHash: '9651e9e4d5617929b3c7564252b3ee097b2eab17459500e0eac0f95e5105da3a',
    key: '800bb8714df5f8fcbdda7255429dcb109b87945987564b44ddc0303c183d234d',
    xor: '165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977',
    canvas50: 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
  },
];

console.log('=== WASM Key Derivation Analysis v2 ===\n');

// First, verify our fpHash calculation is correct
for (const s of samples) {
  const calculatedHash = crypto.createHash('sha256').update(s.fpString).digest('hex');
  console.log(`Timestamp ${s.timestamp}:`);
  console.log(`  Expected fpHash: ${s.fpHash}`);
  console.log(`  Calculated:      ${calculatedHash}`);
  console.log(`  Match: ${calculatedHash === s.fpHash}`);
  console.log('');
}

// The XOR constant is different for each timestamp
// Let's analyze what could produce these XOR values

console.log('=== XOR Constant Analysis ===\n');

for (const s of samples) {
  const xorBuf = Buffer.from(s.xor, 'hex');
  const ts = s.timestamp;
  const tsStr = String(ts);
  
  console.log(`\nTimestamp: ${ts}`);
  console.log(`XOR constant: ${s.xor}`);
  
  // Try various derivations of the XOR constant
  const derivations = [];
  
  // Simple hashes of timestamp
  derivations.push({ name: 'SHA256(ts)', val: crypto.createHash('sha256').update(tsStr).digest() });
  derivations.push({ name: 'SHA256(ts as 4-byte LE)', val: crypto.createHash('sha256').update(Buffer.from([ts & 0xff, (ts >> 8) & 0xff, (ts >> 16) & 0xff, (ts >> 24) & 0xff])).digest() });
  derivations.push({ name: 'SHA256(ts as 4-byte BE)', val: crypto.createHash('sha256').update(Buffer.from([(ts >> 24) & 0xff, (ts >> 16) & 0xff, (ts >> 8) & 0xff, ts & 0xff])).digest() });
  
  // Hash of timestamp + canvas
  derivations.push({ name: 'SHA256(ts + canvas50)', val: crypto.createHash('sha256').update(tsStr + s.canvas50).digest() });
  derivations.push({ name: 'SHA256(canvas50 + ts)', val: crypto.createHash('sha256').update(s.canvas50 + tsStr).digest() });
  
  // HMAC variations
  derivations.push({ name: 'HMAC(ts, canvas50)', val: crypto.createHmac('sha256', tsStr).update(s.canvas50).digest() });
  derivations.push({ name: 'HMAC(canvas50, ts)', val: crypto.createHmac('sha256', s.canvas50).update(tsStr).digest() });
  
  // Double hash
  derivations.push({ name: 'SHA256(SHA256(ts))', val: crypto.createHash('sha256').update(crypto.createHash('sha256').update(tsStr).digest()).digest() });
  
  // Hash of fpString without timestamp
  const fpWithoutTs = s.fpString.replace(`:${ts}:`, '::');
  derivations.push({ name: 'SHA256(fpWithoutTs)', val: crypto.createHash('sha256').update(fpWithoutTs).digest() });
  
  // Hash of just the static parts
  const staticParts = '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0';
  derivations.push({ name: 'SHA256(staticParts)', val: crypto.createHash('sha256').update(staticParts).digest() });
  derivations.push({ name: 'SHA256(staticParts + ts)', val: crypto.createHash('sha256').update(staticParts + tsStr).digest() });
  
  // HMAC with fpHash as key
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  derivations.push({ name: 'HMAC(fpHash, ts)', val: crypto.createHmac('sha256', fpHashBuf).update(tsStr).digest() });
  derivations.push({ name: 'HMAC(ts, fpHash)', val: crypto.createHmac('sha256', tsStr).update(fpHashBuf).digest() });
  
  // XOR of two hashes
  const tsHash = crypto.createHash('sha256').update(tsStr).digest();
  const canvasHash = crypto.createHash('sha256').update(s.canvas50).digest();
  const xorTsCanvas = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xorTsCanvas[i] = tsHash[i] ^ canvasHash[i];
  derivations.push({ name: 'SHA256(ts) XOR SHA256(canvas50)', val: xorTsCanvas });
  
  // Try with timestamp as 8-byte value
  const ts8LE = Buffer.alloc(8);
  ts8LE.writeBigUInt64LE(BigInt(ts));
  derivations.push({ name: 'SHA256(ts as 8-byte LE)', val: crypto.createHash('sha256').update(ts8LE).digest() });
  
  const ts8BE = Buffer.alloc(8);
  ts8BE.writeBigUInt64BE(BigInt(ts));
  derivations.push({ name: 'SHA256(ts as 8-byte BE)', val: crypto.createHash('sha256').update(ts8BE).digest() });
  
  // Try HKDF
  try {
    derivations.push({ name: 'HKDF(ts, canvas50, "")', val: Buffer.from(crypto.hkdfSync('sha256', tsStr, s.canvas50, '', 32)) });
    derivations.push({ name: 'HKDF(canvas50, ts, "")', val: Buffer.from(crypto.hkdfSync('sha256', s.canvas50, tsStr, '', 32)) });
    derivations.push({ name: 'HKDF(fpHash, ts, "")', val: Buffer.from(crypto.hkdfSync('sha256', fpHashBuf, tsStr, '', 32)) });
  } catch (e) {}
  
  // Check each derivation
  for (const { name, val } of derivations) {
    if (val.equals(xorBuf)) {
      console.log(`  *** MATCH: ${name} ***`);
    }
  }
}

// Now let's try to find a pattern between the two XOR constants
console.log('\n=== XOR Constant Relationship ===\n');

const xor1 = Buffer.from(samples[0].xor, 'hex');
const xor2 = Buffer.from(samples[1].xor, 'hex');

// XOR the two XOR constants
const xorDiff = Buffer.alloc(32);
for (let i = 0; i < 32; i++) xorDiff[i] = xor1[i] ^ xor2[i];
console.log('XOR1 XOR XOR2:', xorDiff.toString('hex'));

// Check if the difference is related to timestamp difference
const tsDiff = samples[1].timestamp - samples[0].timestamp;
console.log('Timestamp difference:', tsDiff);

// Try to find if XOR constant is derived from a counter/PRNG seeded with timestamp
console.log('\n=== PRNG-based Derivation ===\n');

// Mulberry32 PRNG
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0);
  };
}

// Generate 32 bytes from mulberry32
function mulberry32Bytes(seed) {
  const rng = mulberry32(seed);
  const bytes = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    const val = rng();
    bytes.writeUInt32LE(val, i * 4);
  }
  return bytes;
}

for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // Try mulberry32 with timestamp as seed
  const mb32 = mulberry32Bytes(ts);
  if (mb32.equals(xorBuf)) {
    console.log(`*** MATCH: mulberry32(${ts}) ***`);
  }
  
  // Try with timestamp * 1000
  const mb32_1000 = mulberry32Bytes(ts * 1000);
  if (mb32_1000.equals(xorBuf)) {
    console.log(`*** MATCH: mulberry32(${ts} * 1000) ***`);
  }
}

// xorshift128+ PRNG
function xorshift128plus(seed0, seed1) {
  let s0 = BigInt(seed0);
  let s1 = BigInt(seed1);
  
  const results = [];
  for (let i = 0; i < 4; i++) {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23n;
    x ^= x >> 17n;
    x ^= y ^ (y >> 26n);
    s1 = x;
    results.push((s0 + s1) & ((1n << 64n) - 1n));
  }
  
  const bytes = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    bytes.writeBigUInt64LE(results[i], i * 8);
  }
  return bytes;
}

for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // Try xorshift128+ with timestamp as both seeds
  const xs = xorshift128plus(ts, ts);
  if (xs.equals(xorBuf)) {
    console.log(`*** MATCH: xorshift128+(${ts}, ${ts}) ***`);
  }
  
  // Try with fpHash as seed
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const seed0 = fpHashBuf.readBigUInt64LE(0);
  const seed1 = fpHashBuf.readBigUInt64LE(8);
  const xs2 = xorshift128plus(Number(seed0 & 0xffffffffn), Number(seed1 & 0xffffffffn));
  if (xs2.equals(xorBuf)) {
    console.log(`*** MATCH: xorshift128+(fpHash[0:8], fpHash[8:16]) ***`);
  }
}

console.log('\n=== Summary ===');
console.log('No standard derivation found. The WASM likely uses a custom algorithm.');
console.log('Next step: Deep analysis of the WASM binary to find the exact derivation.');
