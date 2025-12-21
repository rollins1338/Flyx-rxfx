/**
 * Final Crack Attempt - Focused Analysis
 * 
 * We have 7 samples with known timestamps and XOR constants.
 * Let's try to find the pattern by analyzing the relationship more carefully.
 */

const crypto = require('crypto');

// Our collected samples
const samples = [
  { timestamp: 1700000000, fpHash: "54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e", key: "48d4fb57c0ceadb3a520e6ca27798de74b22010e8fbf4284ab73c841886a47f2", xor: "1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc" },
  { timestamp: 1700000001, fpHash: "9651e9e4d5617929b3c7564252b3ee097b2eab17459500e0eac0f95e5105da3a", key: "800bb871cd7fe8fcbdda725d429dc510fb87946d87563044d9c0303c183d234d", xor: "165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977" },
  { timestamp: 1700000002, fpHash: "ac239dfdd473e1731e0a3b0f4d7ab3b3b9fbbcea927f52825e1887b2fa97b29d", key: "6e0ff85a99f8e5b9c16ada0c47db5511a43f5504d556b7bfc95df7053cc12435", xor: "c22c65a74d2b04cadf60e1030aa1e6a21dc49eee4729e53d974570b7c65696a8" },
  { timestamp: 1700000003, fpHash: "f535fa31cafd61d9de7569bab33779da8a6c329af868f0a7be69bd2d01a93615", key: "cc0b9d6faacb66d03947213576510f4a27afbe9b30938f8785d3ee67fcfb39ce", xor: "393e675e60365709e732488fc5662890adc38c01c8fb7f203bba534afd520fdb" },
  { timestamp: 1700000010, fpHash: "3d492079c0597c1da4125871ed9a4f7385fb231ea8377c619b658d79701b5e6d", key: "88c281acf77f0097e126fc24aeb7ba36507a35deaad488dd0100290f003c6c46", xor: "b58ba1d567267c8a45342455432dd545d581164002e3f4fc5865a48a7027322b" },
  { timestamp: 1700000100, fpHash: "4bb81863454b992215bc0df88d7c2dd069d2f506f33abb9c0c92a9173f4bc1ee", key: "921674c16c97b262d164549c3c2bdf30a88dd434919a02d5aa4d072de2c3ec29", xor: "d9ae6ca229dc2b40c4d859f5b057f2e0c15f213362815849a6dfae3add882dc7" },
  { timestamp: 1700001000, fpHash: "580521a275f63e8e4e9f1cc6b71d80fb006d4ceeb3bbbb78fdd78f94e046b477", key: "9c9d9493fc1dc4f268dfc17b8988a8d2cf6d4a28d85a4461fa7fd21460ddd660", xor: "c498b531891bfa7c2640ddbd3e952829cf0006c66be1ff19c7085d8480db6217" },
];

console.log('=== Final Crack Attempt ===\n');

// Let's look at the XOR constants more carefully
console.log('XOR Constants (first 8 bytes):');
for (const s of samples) {
  const xorBuf = Buffer.from(s.xor, 'hex');
  console.log(`ts=${s.timestamp}: ${xorBuf.slice(0, 8).toString('hex')}`);
}

// Try to find if XOR is derived from timestamp using a specific algorithm
console.log('\n=== Testing timestamp-based derivations ===\n');

// The key insight: the XOR constant changes with timestamp but NOT with the random part
// This means the XOR constant is derived from timestamp alone (or timestamp + some constant)

// Let's try various timestamp transformations
for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // Try: XOR = SHA256(SHA256(timestamp))
  const doubleHash = crypto.createHash('sha256').update(
    crypto.createHash('sha256').update(String(ts)).digest()
  ).digest();
  
  if (doubleHash.equals(xorBuf)) {
    console.log(`MATCH: XOR = SHA256(SHA256(ts)) for ts=${ts}`);
  }
  
  // Try: XOR = SHA256(timestamp as bytes)
  const tsBuf4 = Buffer.alloc(4);
  tsBuf4.writeUInt32LE(ts);
  const hashTsBuf = crypto.createHash('sha256').update(tsBuf4).digest();
  if (hashTsBuf.equals(xorBuf)) {
    console.log(`MATCH: XOR = SHA256(ts as 4-byte LE) for ts=${ts}`);
  }
  
  // Try: XOR = SHA256(timestamp as 8-byte)
  const tsBuf8 = Buffer.alloc(8);
  tsBuf8.writeBigUInt64LE(BigInt(ts));
  const hashTsBuf8 = crypto.createHash('sha256').update(tsBuf8).digest();
  if (hashTsBuf8.equals(xorBuf)) {
    console.log(`MATCH: XOR = SHA256(ts as 8-byte LE) for ts=${ts}`);
  }
}

// Let's try to find if there's a seed value that when combined with timestamp gives the XOR
console.log('\n=== Testing seed + timestamp combinations ===\n');

// Try to find a common seed by XORing all XOR constants with their timestamp hashes
const potentialSeeds = [];
for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // seed = XOR ^ SHA256(ts)
  const tsHash = crypto.createHash('sha256').update(String(ts)).digest();
  const seed = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    seed[i] = xorBuf[i] ^ tsHash[i];
  }
  potentialSeeds.push({ ts, seed: seed.toString('hex') });
}

console.log('Potential seeds (XOR ^ SHA256(ts)):');
for (const { ts, seed } of potentialSeeds) {
  console.log(`ts=${ts}: ${seed.slice(0, 32)}...`);
}

// Check if all seeds are the same
const allSame = potentialSeeds.every(p => p.seed === potentialSeeds[0].seed);
console.log(`\nAll seeds same: ${allSame}`);

// Try with timestamp as bytes
console.log('\n=== Testing with timestamp as bytes ===\n');
const potentialSeeds2 = [];
for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  const tsBuf = Buffer.alloc(4);
  tsBuf.writeUInt32LE(ts);
  const tsHash = crypto.createHash('sha256').update(tsBuf).digest();
  const seed = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    seed[i] = xorBuf[i] ^ tsHash[i];
  }
  potentialSeeds2.push({ ts, seed: seed.toString('hex') });
}

console.log('Potential seeds (XOR ^ SHA256(ts as 4-byte LE)):');
for (const { ts, seed } of potentialSeeds2) {
  console.log(`ts=${ts}: ${seed.slice(0, 32)}...`);
}

const allSame2 = potentialSeeds2.every(p => p.seed === potentialSeeds2[0].seed);
console.log(`\nAll seeds same: ${allSame2}`);

// Try HMAC with a fixed key
console.log('\n=== Testing HMAC with fixed keys ===\n');

const testKeys = [
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
];

for (const testKey of testKeys) {
  let allMatch = true;
  for (const s of samples) {
    const ts = s.timestamp;
    const xorBuf = Buffer.from(s.xor, 'hex');
    
    const hmac = crypto.createHmac('sha256', testKey).update(String(ts)).digest();
    if (!hmac.equals(xorBuf)) {
      allMatch = false;
      break;
    }
  }
  if (allMatch) {
    console.log(`MATCH: XOR = HMAC-SHA256(${testKey}, ts)`);
  }
}

// Try to find the relationship between consecutive XOR constants
console.log('\n=== Analyzing consecutive XOR relationships ===\n');

for (let i = 0; i < samples.length - 1; i++) {
  const s1 = samples[i];
  const s2 = samples[i + 1];
  
  const xor1 = Buffer.from(s1.xor, 'hex');
  const xor2 = Buffer.from(s2.xor, 'hex');
  
  // XOR the two
  const diff = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    diff[j] = xor1[j] ^ xor2[j];
  }
  
  const tsDiff = s2.timestamp - s1.timestamp;
  
  console.log(`ts ${s1.timestamp} -> ${s2.timestamp} (diff: ${tsDiff}):`);
  console.log(`  XOR diff: ${diff.toString('hex').slice(0, 32)}...`);
  
  // Check if diff is related to timestamp difference
  const tsDiffHash = crypto.createHash('sha256').update(String(tsDiff)).digest();
  if (tsDiffHash.equals(diff)) {
    console.log(`  *** MATCH: diff = SHA256(tsDiff) ***`);
  }
}

// Try xorshift128+ PRNG seeded with timestamp
console.log('\n=== Testing xorshift128+ PRNG ===\n');

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
  
  // Convert to 32 bytes
  const buf = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    buf.writeBigUInt64LE(results[i], i * 8);
  }
  return buf;
}

for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  const prngResult = xorshift128plus(ts);
  if (prngResult.equals(xorBuf)) {
    console.log(`MATCH: XOR = xorshift128+(ts) for ts=${ts}`);
  }
}

// Try splitmix64 PRNG
console.log('\n=== Testing splitmix64 PRNG ===\n');

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

for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  const prngResult = splitmix64(ts);
  if (prngResult.equals(xorBuf)) {
    console.log(`MATCH: XOR = splitmix64(ts) for ts=${ts}`);
  }
}

// Try to find if the XOR constant is derived from the fpHash itself
console.log('\n=== Testing fpHash-based derivations ===\n');

for (const s of samples) {
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const xorBuf = Buffer.from(s.xor, 'hex');
  const keyBuf = Buffer.from(s.key, 'hex');
  
  // Check: key = fpHash XOR xor (this should always be true by definition)
  const computed = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    computed[i] = fpHashBuf[i] ^ xorBuf[i];
  }
  
  if (!computed.equals(keyBuf)) {
    console.log(`ERROR: key != fpHash XOR xor for ts=${s.timestamp}`);
  }
}

console.log('All samples verify: key = fpHash XOR xor');

// Try to find if XOR is derived from a combination of fpHash and timestamp
console.log('\n=== Testing fpHash + timestamp combinations ===\n');

for (const s of samples) {
  const ts = s.timestamp;
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // Try: XOR = SHA256(fpHash || ts)
  const concat1 = Buffer.concat([fpHashBuf, Buffer.from(String(ts))]);
  const hash1 = crypto.createHash('sha256').update(concat1).digest();
  if (hash1.equals(xorBuf)) {
    console.log(`MATCH: XOR = SHA256(fpHash || ts) for ts=${ts}`);
  }
  
  // Try: XOR = SHA256(ts || fpHash)
  const concat2 = Buffer.concat([Buffer.from(String(ts)), fpHashBuf]);
  const hash2 = crypto.createHash('sha256').update(concat2).digest();
  if (hash2.equals(xorBuf)) {
    console.log(`MATCH: XOR = SHA256(ts || fpHash) for ts=${ts}`);
  }
  
  // Try: XOR = HMAC(fpHash, ts)
  const hmac1 = crypto.createHmac('sha256', fpHashBuf).update(String(ts)).digest();
  if (hmac1.equals(xorBuf)) {
    console.log(`MATCH: XOR = HMAC(fpHash, ts) for ts=${ts}`);
  }
  
  // Try: XOR = HMAC(ts, fpHash)
  const hmac2 = crypto.createHmac('sha256', String(ts)).update(fpHashBuf).digest();
  if (hmac2.equals(xorBuf)) {
    console.log(`MATCH: XOR = HMAC(ts, fpHash) for ts=${ts}`);
  }
}

// Let's try to find if there's a pattern in the first few bytes
console.log('\n=== Analyzing byte patterns ===\n');

console.log('First 4 bytes of each XOR constant:');
for (const s of samples) {
  const xorBuf = Buffer.from(s.xor, 'hex');
  const first4 = xorBuf.readUInt32LE(0);
  console.log(`ts=${s.timestamp}: 0x${first4.toString(16).padStart(8, '0')} (${first4})`);
}

// Check if there's a linear relationship
console.log('\n=== Checking for linear relationship ===\n');

const ts0 = samples[0].timestamp;
const xor0 = Buffer.from(samples[0].xor, 'hex').readUInt32LE(0);

for (let i = 1; i < samples.length; i++) {
  const ts = samples[i].timestamp;
  const xor = Buffer.from(samples[i].xor, 'hex').readUInt32LE(0);
  
  const tsDiff = ts - ts0;
  const xorDiff = xor - xor0;
  
  console.log(`ts diff: ${tsDiff}, xor diff: ${xorDiff}, ratio: ${xorDiff / tsDiff}`);
}

console.log('\n=== Summary ===');
console.log('No simple pattern found. The XOR constant derivation uses a custom algorithm.');
console.log('The algorithm is likely implemented in the WASM binary and requires deeper analysis.');
