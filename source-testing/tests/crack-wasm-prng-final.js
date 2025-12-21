/**
 * PRNG Final - Try various PRNG algorithms seeded with fingerprint data
 * 
 * The WASM might use a PRNG to generate the XOR constant
 */

const crypto = require('crypto');

// Sample data
const samples = [
  {
    timestamp: 1700000000,
    fpString: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
    fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
    key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
    xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
  },
  {
    timestamp: 1700000001,
    fpString: '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000001:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk',
    fpHash: '9651e9e4d5617929b3c7564252b3ee097b2eab17459500e0eac0f95e5105da3a',
    key: '800bb8714df5f8fcbdda7255429dcb109b87945987564b44ddc0303c183d234d',
    xor: '165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977',
  },
];

console.log('=== PRNG Analysis ===\n');

// Try xorshift128+ PRNG
function xorshift128plus(seed) {
  let s0 = BigInt('0x' + seed.slice(0, 16));
  let s1 = BigInt('0x' + seed.slice(16, 32));
  
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
  
  return results.map(r => r.toString(16).padStart(16, '0')).join('');
}

// Try splitmix64 PRNG
function splitmix64(seed) {
  let x = BigInt('0x' + seed.slice(0, 16));
  
  const results = [];
  for (let i = 0; i < 4; i++) {
    x += 0x9e3779b97f4a7c15n;
    x &= (1n << 64n) - 1n;
    let z = x;
    z = (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n;
    z &= (1n << 64n) - 1n;
    z = (z ^ (z >> 27n)) * 0x94d049bb133111ebn;
    z &= (1n << 64n) - 1n;
    z = z ^ (z >> 31n);
    results.push(z);
  }
  
  return results.map(r => r.toString(16).padStart(16, '0')).join('');
}

// Try PCG PRNG
function pcg32(seed) {
  let state = BigInt('0x' + seed.slice(0, 16));
  const inc = BigInt('0x' + seed.slice(16, 32)) | 1n;
  
  const results = [];
  for (let i = 0; i < 8; i++) {
    const oldstate = state;
    state = (oldstate * 6364136223846793005n + inc) & ((1n << 64n) - 1n);
    const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n);
    const rot = Number(oldstate >> 59n);
    const result = ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
    results.push(result);
  }
  
  return results.map(r => r.toString(16).padStart(8, '0')).join('');
}

for (const sample of samples) {
  console.log(`\n=== Timestamp: ${sample.timestamp} ===\n`);
  console.log(`Expected XOR: ${sample.xor}`);
  
  // Try xorshift128+ with fpHash as seed
  const xorshift = xorshift128plus(sample.fpHash);
  console.log(`xorshift128+(fpHash): ${xorshift}`);
  if (xorshift === sample.xor) console.log('*** MATCH ***');
  
  // Try splitmix64 with fpHash as seed
  const splitmix = splitmix64(sample.fpHash);
  console.log(`splitmix64(fpHash): ${splitmix}`);
  if (splitmix === sample.xor) console.log('*** MATCH ***');
  
  // Try PCG with fpHash as seed
  const pcg = pcg32(sample.fpHash);
  console.log(`pcg32(fpHash): ${pcg}`);
  if (pcg === sample.xor) console.log('*** MATCH ***');
  
  // Try with timestamp as additional input
  const fpHashWithTs = crypto.createHash('sha256').update(sample.fpHash + sample.timestamp).digest('hex');
  const xorshiftTs = xorshift128plus(fpHashWithTs);
  console.log(`xorshift128+(fpHash+ts): ${xorshiftTs}`);
  if (xorshiftTs === sample.xor) console.log('*** MATCH ***');
}

// Try to find if the key is derived differently
console.log('\n=== Alternative Key Derivation ===\n');

for (const sample of samples) {
  console.log(`\nTimestamp: ${sample.timestamp}`);
  
  const fpHashBuf = Buffer.from(sample.fpHash, 'hex');
  const keyBuf = Buffer.from(sample.key, 'hex');
  
  // Try: key = SHA256(fpString || timestamp as 4 bytes)
  const tsBuf = Buffer.alloc(4);
  tsBuf.writeUInt32LE(sample.timestamp);
  const key1 = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(sample.fpString), tsBuf])).digest();
  console.log(`SHA256(fpString || ts4LE): ${key1.toString('hex')}`);
  if (key1.equals(keyBuf)) console.log('*** MATCH ***');
  
  tsBuf.writeUInt32BE(sample.timestamp);
  const key2 = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(sample.fpString), tsBuf])).digest();
  console.log(`SHA256(fpString || ts4BE): ${key2.toString('hex')}`);
  if (key2.equals(keyBuf)) console.log('*** MATCH ***');
  
  // Try: key = SHA256(fpHash || timestamp as 4 bytes)
  tsBuf.writeUInt32LE(sample.timestamp);
  const key3 = crypto.createHash('sha256').update(Buffer.concat([fpHashBuf, tsBuf])).digest();
  console.log(`SHA256(fpHash || ts4LE): ${key3.toString('hex')}`);
  if (key3.equals(keyBuf)) console.log('*** MATCH ***');
  
  // Try: key = HMAC-SHA256(fpHash, timestamp as 4 bytes)
  const key4 = crypto.createHmac('sha256', fpHashBuf).update(tsBuf).digest();
  console.log(`HMAC(fpHash, ts4LE): ${key4.toString('hex')}`);
  if (key4.equals(keyBuf)) console.log('*** MATCH ***');
  
  // Try: key = HMAC-SHA256(timestamp as 4 bytes, fpHash)
  const key5 = crypto.createHmac('sha256', tsBuf).update(fpHashBuf).digest();
  console.log(`HMAC(ts4LE, fpHash): ${key5.toString('hex')}`);
  if (key5.equals(keyBuf)) console.log('*** MATCH ***');
  
  // Try: key = SHA256(SHA256(fpString))
  const key6 = crypto.createHash('sha256').update(fpHashBuf).digest();
  console.log(`SHA256(SHA256(fpString)): ${key6.toString('hex')}`);
  if (key6.equals(keyBuf)) console.log('*** MATCH ***');
  
  // Try: key = HKDF(fpString, timestamp, "", 32)
  try {
    const key7 = crypto.hkdfSync('sha256', sample.fpString, String(sample.timestamp), '', 32);
    console.log(`HKDF(fpString, ts, "", 32): ${Buffer.from(key7).toString('hex')}`);
    if (Buffer.from(key7).equals(keyBuf)) console.log('*** MATCH ***');
  } catch (e) {}
  
  // Try: key = HKDF(fpHash, timestamp, "", 32)
  try {
    const key8 = crypto.hkdfSync('sha256', fpHashBuf, String(sample.timestamp), '', 32);
    console.log(`HKDF(fpHash, ts, "", 32): ${Buffer.from(key8).toString('hex')}`);
    if (Buffer.from(key8).equals(keyBuf)) console.log('*** MATCH ***');
  } catch (e) {}
  
  // Try: key = PBKDF2(fpString, timestamp, 1, 32)
  const key9 = crypto.pbkdf2Sync(sample.fpString, String(sample.timestamp), 1, 32, 'sha256');
  console.log(`PBKDF2(fpString, ts, 1, 32): ${key9.toString('hex')}`);
  if (key9.equals(keyBuf)) console.log('*** MATCH ***');
  
  // Try: key = PBKDF2(fpHash, timestamp, 1, 32)
  const key10 = crypto.pbkdf2Sync(sample.fpHash, String(sample.timestamp), 1, 32, 'sha256');
  console.log(`PBKDF2(fpHash, ts, 1, 32): ${key10.toString('hex')}`);
  if (key10.equals(keyBuf)) console.log('*** MATCH ***');
}

console.log('\n=== Summary ===\n');
console.log('None of the standard algorithms match.');
console.log('The WASM likely uses a custom key derivation function.');
console.log('The Puppeteer solution remains the most reliable approach.');
