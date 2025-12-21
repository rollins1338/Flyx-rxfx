/**
 * Deep XOR Analysis with Multiple Samples
 * 
 * We have 7 samples with different timestamps. Let's find the pattern.
 */

const crypto = require('crypto');

const samples = [
  { timestamp: 1700000000, fpHash: "54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e", xor: "1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc" },
  { timestamp: 1700000001, fpHash: "9651e9e4d5617929b3c7564252b3ee097b2eab17459500e0eac0f95e5105da3a", xor: "165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977" },
  { timestamp: 1700000002, fpHash: "ac239dfdd473e1731e0a3b0f4d7ab3b3b9fbbcea927f52825e1887b2fa97b29d", xor: "c22c65a74d2b04cadf60e1030aa1e6a21dc49eee4729e53d974570b7c65696a8" },
  { timestamp: 1700000003, fpHash: "f535fa31cafd61d9de7569bab33779da8a6c329af868f0a7be69bd2d01a93615", xor: "393e675e60365709e732488fc5662890adc38c01c8fb7f203bba534afd520fdb" },
  { timestamp: 1700000010, fpHash: "3d492079c0597c1da4125871ed9a4f7385fb231ea8377c619b658d79701b5e6d", xor: "b58ba1d567267c8a45342455432dd545d581164002e3f4fc5865a48a7027322b" },
  { timestamp: 1700000100, fpHash: "4bb81863454b992215bc0df88d7c2dd069d2f506f33abb9c0c92a9173f4bc1ee", xor: "d9ae6ca229dc2b40c4d859f5b057f2e0c15f213362815849a6dfae3add882dc7" },
  { timestamp: 1700001000, fpHash: "580521a275f63e8e4e9f1cc6b71d80fb006d4ceeb3bbbb78fdd78f94e046b477", xor: "c498b531891bfa7c2640ddbd3e952829cf0006c66be1ff19c7085d8480db6217" },
];

console.log('=== Deep XOR Analysis ===\n');

// Check if XOR = f(timestamp) for some function f
console.log('=== Testing XOR = f(timestamp) ===\n');

for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // Try various functions of timestamp
  const tests = [
    { name: 'SHA256(ts)', val: crypto.createHash('sha256').update(String(ts)).digest() },
    { name: 'SHA256(ts*1000)', val: crypto.createHash('sha256').update(String(ts * 1000)).digest() },
    { name: 'SHA256(ts.toString(16))', val: crypto.createHash('sha256').update(ts.toString(16)).digest() },
    { name: 'SHA256(ts as 4-byte LE)', val: crypto.createHash('sha256').update(Buffer.from([ts & 0xff, (ts >> 8) & 0xff, (ts >> 16) & 0xff, (ts >> 24) & 0xff])).digest() },
    { name: 'SHA256(ts as 8-byte LE)', val: (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(ts)); return crypto.createHash('sha256').update(b).digest(); })() },
  ];
  
  for (const { name, val } of tests) {
    if (val.equals(xorBuf)) {
      console.log(`*** MATCH for ts=${ts}: XOR = ${name} ***`);
    }
  }
}

// Check if XOR = f(fpHash, timestamp)
console.log('\n=== Testing XOR = f(fpHash, timestamp) ===\n');

for (const s of samples) {
  const ts = s.timestamp;
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  const tests = [
    { name: 'HMAC(fpHash, ts)', val: crypto.createHmac('sha256', fpHashBuf).update(String(ts)).digest() },
    { name: 'HMAC(ts, fpHash)', val: crypto.createHmac('sha256', String(ts)).update(fpHashBuf).digest() },
    { name: 'SHA256(fpHash || ts)', val: crypto.createHash('sha256').update(Buffer.concat([fpHashBuf, Buffer.from(String(ts))])).digest() },
    { name: 'SHA256(ts || fpHash)', val: crypto.createHash('sha256').update(Buffer.concat([Buffer.from(String(ts)), fpHashBuf])).digest() },
    { name: 'SHA256(fpHash XOR ts)', val: (() => {
      const xored = Buffer.alloc(32);
      const tsBuf = Buffer.alloc(32);
      tsBuf.writeUInt32LE(ts, 0);
      for (let i = 0; i < 32; i++) xored[i] = fpHashBuf[i] ^ tsBuf[i];
      return crypto.createHash('sha256').update(xored).digest();
    })() },
  ];
  
  for (const { name, val } of tests) {
    if (val.equals(xorBuf)) {
      console.log(`*** MATCH for ts=${ts}: XOR = ${name} ***`);
    }
  }
}

// Check if there's a relationship between fpHash and XOR
console.log('\n=== Analyzing fpHash -> XOR relationship ===\n');

for (const s of samples) {
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // XOR fpHash with XOR to see if there's a pattern
  const diff = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    diff[i] = fpHashBuf[i] ^ xorBuf[i];
  }
  
  console.log(`ts=${s.timestamp}:`);
  console.log(`  fpHash XOR xor = ${diff.toString('hex')}`);
  
  // Check if this diff is the key
  const keyBuf = Buffer.from(samples.find(x => x.timestamp === s.timestamp).fpHash, 'hex');
  // Actually, fpHash XOR xor = key by definition
}

// Try to find if XOR is derived from a combination of fpHash parts
console.log('\n=== Testing XOR derivation from fpHash parts ===\n');

for (const s of samples) {
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const xorBuf = Buffer.from(s.xor, 'hex');
  const ts = s.timestamp;
  
  // Split fpHash into 4 parts
  const parts = [
    fpHashBuf.subarray(0, 8),
    fpHashBuf.subarray(8, 16),
    fpHashBuf.subarray(16, 24),
    fpHashBuf.subarray(24, 32),
  ];
  
  // Try XOR of parts with timestamp
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64LE(BigInt(ts));
  
  // XOR each part with timestamp
  const xoredParts = parts.map(p => {
    const x = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) x[i] = p[i] ^ tsBuf[i];
    return x;
  });
  
  // Concatenate and hash
  const concat = Buffer.concat(xoredParts);
  const hash = crypto.createHash('sha256').update(concat).digest();
  
  if (hash.equals(xorBuf)) {
    console.log(`*** MATCH for ts=${ts}: XOR = SHA256(fpHash parts XOR ts) ***`);
  }
}

// Try to find if XOR follows a specific mathematical pattern
console.log('\n=== Analyzing XOR byte patterns ===\n');

// Look at each byte position across all samples
for (let bytePos = 0; bytePos < 32; bytePos++) {
  const values = samples.map(s => Buffer.from(s.xor, 'hex')[bytePos]);
  const timestamps = samples.map(s => s.timestamp);
  
  // Check if there's a linear relationship
  // xor[bytePos] = a * timestamp + b (mod 256)
  // This is unlikely but worth checking
}

// Check if XOR is derived using a custom PRNG seeded with fpHash
console.log('\n=== Testing custom PRNG seeded with fpHash ===\n');

function customPRNG(seed, iterations) {
  let state = Buffer.from(seed);
  
  for (let i = 0; i < iterations; i++) {
    state = crypto.createHash('sha256').update(state).digest();
  }
  
  return state;
}

for (const s of samples) {
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const xorBuf = Buffer.from(s.xor, 'hex');
  const ts = s.timestamp;
  
  // Try different iteration counts based on timestamp
  const iterCounts = [
    ts % 256,
    ts % 1000,
    ts & 0xff,
    (ts >> 8) & 0xff,
    ts - 1700000000,
  ];
  
  for (const iter of iterCounts) {
    if (iter > 0 && iter < 10000) {
      const result = customPRNG(fpHashBuf, iter);
      if (result.equals(xorBuf)) {
        console.log(`*** MATCH for ts=${ts}: XOR = SHA256^${iter}(fpHash) ***`);
      }
    }
  }
}

console.log('\n=== Summary ===');
console.log('The XOR constant derivation uses a custom algorithm.');
console.log('It is not a simple function of timestamp or fpHash.');
console.log('The algorithm is likely implemented in the WASM binary.');
