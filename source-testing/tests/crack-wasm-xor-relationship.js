/**
 * Analyze the mathematical relationship between XOR constants
 * for consecutive timestamps to find a pattern
 */

const crypto = require('crypto');

// Known samples from previous tests
const samples = [
  { ts: 1700000000, xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc' },
  { ts: 1700000001, xor: '165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977' },
  { ts: 1700000002, xor: 'c22c65a74d2b04cadf60e1030aa1e6a21dc49eee4729e53d974570b7c65696a8' },
  { ts: 1700000003, xor: '393e675e60365709e732488fc5662890adc38c01c8fb7f203bba534afd520fdb' },
  { ts: 1700000004, xor: 'b6573092fdf85bcf12a62bb520aebe8430e5d49fe893dcf2d5dbe60f74d6feea' },
];

console.log('=== XOR Constant Analysis ===\n');

// Convert to buffers
const xorBuffers = samples.map(s => ({
  ts: s.ts,
  buf: Buffer.from(s.xor, 'hex'),
}));

// Analyze byte-by-byte differences
console.log('Byte-by-byte analysis (first 8 bytes):');
for (let i = 0; i < 8; i++) {
  const values = xorBuffers.map(x => x.buf[i]);
  console.log(`Byte ${i}: ${values.map(v => v.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Check if there's a linear relationship
  const diffs = [];
  for (let j = 1; j < values.length; j++) {
    diffs.push(values[j] - values[j-1]);
  }
  console.log(`  Diffs: ${diffs.join(' ')}`);
}

// XOR consecutive samples
console.log('\n=== XOR Between Consecutive Samples ===\n');
for (let i = 1; i < xorBuffers.length; i++) {
  const prev = xorBuffers[i-1];
  const curr = xorBuffers[i];
  
  const xored = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    xored[j] = prev.buf[j] ^ curr.buf[j];
  }
  
  console.log(`XOR[${prev.ts}] ^ XOR[${curr.ts}]:`);
  console.log(`  ${xored.toString('hex')}`);
  
  // Check if this is a hash of the timestamp difference
  const tsDiff = curr.ts - prev.ts;
  const tsDiffHash = crypto.createHash('sha256').update(tsDiff.toString()).digest('hex');
  console.log(`  SHA256(${tsDiff}): ${tsDiffHash}`);
  console.log(`  Match: ${xored.toString('hex') === tsDiffHash}`);
}

// Try to find if XOR constants follow a PRNG pattern
console.log('\n=== PRNG Pattern Analysis ===\n');

// Check if XOR[n+1] can be derived from XOR[n]
for (let i = 1; i < xorBuffers.length; i++) {
  const prev = xorBuffers[i-1];
  const curr = xorBuffers[i];
  
  // Try various transformations
  // 1. Simple XOR with constant
  const xorDiff = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    xorDiff[j] = prev.buf[j] ^ curr.buf[j];
  }
  
  // 2. Check if xorDiff is constant across all pairs
  if (i === 1) {
    console.log('XOR difference (first pair):', xorDiff.toString('hex'));
  } else {
    const prevPair = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      prevPair[j] = xorBuffers[i-2].buf[j] ^ xorBuffers[i-1].buf[j];
    }
    console.log(`XOR diff pair ${i-1}->${i}: ${xorDiff.toString('hex').slice(0, 32)}...`);
    console.log(`  Same as prev: ${xorDiff.equals(prevPair)}`);
  }
}

// Try to find a hash chain
console.log('\n=== Hash Chain Analysis ===\n');

// Check if XOR[n+1] = SHA256(XOR[n])
for (let i = 1; i < xorBuffers.length; i++) {
  const prev = xorBuffers[i-1];
  const curr = xorBuffers[i];
  
  const hashOfPrev = crypto.createHash('sha256').update(prev.buf).digest();
  console.log(`SHA256(XOR[${prev.ts}]): ${hashOfPrev.toString('hex').slice(0, 32)}...`);
  console.log(`XOR[${curr.ts}]:         ${curr.buf.toString('hex').slice(0, 32)}...`);
  console.log(`Match: ${hashOfPrev.equals(curr.buf)}`);
  console.log();
}

// Try HMAC chain
console.log('=== HMAC Chain Analysis ===\n');

for (let i = 1; i < xorBuffers.length; i++) {
  const prev = xorBuffers[i-1];
  const curr = xorBuffers[i];
  
  // HMAC with timestamp as key
  const hmac = crypto.createHmac('sha256', curr.ts.toString()).update(prev.buf).digest();
  console.log(`HMAC(${curr.ts}, XOR[${prev.ts}]): ${hmac.toString('hex').slice(0, 32)}...`);
  console.log(`XOR[${curr.ts}]:                   ${curr.buf.toString('hex').slice(0, 32)}...`);
  console.log(`Match: ${hmac.equals(curr.buf)}`);
  console.log();
}

// Analyze as 32-bit integers
console.log('=== 32-bit Integer Analysis ===\n');

for (const sample of xorBuffers) {
  const ints = [];
  for (let i = 0; i < 32; i += 4) {
    ints.push(sample.buf.readUInt32LE(i));
  }
  console.log(`ts=${sample.ts}: ${ints.map(i => i.toString(16).padStart(8, '0')).join(' ')}`);
}

// Check if any integer is related to timestamp
console.log('\n=== Timestamp Relationship ===\n');

for (const sample of xorBuffers) {
  const ts = sample.ts;
  const firstInt = sample.buf.readUInt32LE(0);
  const firstIntBE = sample.buf.readUInt32BE(0);
  
  console.log(`ts=${ts}:`);
  console.log(`  First 4 bytes (LE): 0x${firstInt.toString(16)} (${firstInt})`);
  console.log(`  First 4 bytes (BE): 0x${firstIntBE.toString(16)} (${firstIntBE})`);
  console.log(`  ts XOR first (LE): 0x${(ts ^ firstInt).toString(16)}`);
  console.log(`  ts XOR first (BE): 0x${(ts ^ firstIntBE).toString(16)}`);
}
