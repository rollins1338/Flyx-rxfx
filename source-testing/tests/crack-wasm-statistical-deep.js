/**
 * Deep statistical analysis of XOR constants
 * Looking for mathematical relationships between timestamp bytes and XOR bytes
 */

const fs = require('fs');

const samples = JSON.parse(fs.readFileSync('./xor-samples.json', 'utf8'));

console.log('=== Deep Statistical Analysis ===\n');

// Focus on consecutive samples
const consecutive = samples.filter(s => s.timestamp >= 1700000000 && s.timestamp <= 1700000019);

console.log(`Analyzing ${consecutive.length} consecutive samples\n`);

// Convert to arrays for analysis
const data = consecutive.map(s => ({
  ts: s.timestamp,
  tsLow: s.timestamp & 0xFFFFFFFF,
  xorBytes: Buffer.from(s.xor, 'hex'),
  fpHashBytes: Buffer.from(s.fpHash, 'hex'),
  keyBytes: Buffer.from(s.key, 'hex'),
}));

// Analyze each byte position
console.log('--- Per-Byte Analysis ---\n');

for (let bytePos = 0; bytePos < 32; bytePos++) {
  const xorValues = data.map(d => d.xorBytes[bytePos]);
  const fpHashValues = data.map(d => d.fpHashBytes[bytePos]);
  const keyValues = data.map(d => d.keyBytes[bytePos]);
  const timestamps = data.map(d => d.ts);
  
  // Check for linear relationship with timestamp
  // xor[i] = (a * ts + b) mod 256
  // Using least squares to find a and b
  
  const n = xorValues.length;
  let sumT = 0, sumX = 0, sumTX = 0, sumT2 = 0;
  
  for (let i = 0; i < n; i++) {
    const t = timestamps[i] - 1700000000; // Normalize
    const x = xorValues[i];
    sumT += t;
    sumX += x;
    sumTX += t * x;
    sumT2 += t * t;
  }
  
  const a = (n * sumTX - sumT * sumX) / (n * sumT2 - sumT * sumT);
  const b = (sumX - a * sumT) / n;
  
  // Check how well this fits
  let maxError = 0;
  for (let i = 0; i < n; i++) {
    const t = timestamps[i] - 1700000000;
    const predicted = Math.round(a * t + b) % 256;
    const actual = xorValues[i];
    const error = Math.abs(predicted - actual);
    maxError = Math.max(maxError, error);
  }
  
  if (maxError < 10) {
    console.log(`Byte ${bytePos}: Linear fit a=${a.toFixed(4)}, b=${b.toFixed(2)}, maxError=${maxError}`);
  }
}

// Check for XOR relationship between consecutive samples
console.log('\n--- Consecutive XOR Differences ---\n');

const xorDiffs = [];
for (let i = 1; i < data.length; i++) {
  const diff = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    diff[j] = data[i].xorBytes[j] ^ data[i-1].xorBytes[j];
  }
  xorDiffs.push(diff);
}

// Check if XOR diffs have any pattern
console.log('XOR diff patterns (first 5):');
for (let i = 0; i < Math.min(5, xorDiffs.length); i++) {
  console.log(`  Diff ${i}: ${xorDiffs[i].toString('hex').slice(0, 32)}...`);
}

// Check if XOR diffs are related to fpHash diffs
console.log('\n--- fpHash Difference Analysis ---\n');

const fpHashDiffs = [];
for (let i = 1; i < data.length; i++) {
  const diff = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    diff[j] = data[i].fpHashBytes[j] ^ data[i-1].fpHashBytes[j];
  }
  fpHashDiffs.push(diff);
}

// Check if xorDiff = fpHashDiff XOR something constant
console.log('Checking if xorDiff = fpHashDiff XOR constant...');
const mysteryConstant = Buffer.alloc(32);
for (let j = 0; j < 32; j++) {
  mysteryConstant[j] = xorDiffs[0][j] ^ fpHashDiffs[0][j];
}
console.log('Mystery constant (from diff 0):', mysteryConstant.toString('hex'));

// Verify against other diffs
let constantWorks = true;
for (let i = 1; i < Math.min(5, xorDiffs.length); i++) {
  const expected = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    expected[j] = fpHashDiffs[i][j] ^ mysteryConstant[j];
  }
  if (expected.toString('hex') !== xorDiffs[i].toString('hex')) {
    constantWorks = false;
    console.log(`  Diff ${i}: MISMATCH`);
  } else {
    console.log(`  Diff ${i}: MATCH`);
  }
}
console.log(`Constant hypothesis: ${constantWorks ? 'WORKS!' : 'FAILED'}`);

// Check if key diffs have a pattern
console.log('\n--- Key Difference Analysis ---\n');

const keyDiffs = [];
for (let i = 1; i < data.length; i++) {
  const diff = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    diff[j] = data[i].keyBytes[j] ^ data[i-1].keyBytes[j];
  }
  keyDiffs.push(diff);
}

// key = fpHash XOR xor, so keyDiff = fpHashDiff XOR xorDiff
console.log('Verifying: keyDiff = fpHashDiff XOR xorDiff');
for (let i = 0; i < Math.min(5, keyDiffs.length); i++) {
  const computed = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    computed[j] = fpHashDiffs[i][j] ^ xorDiffs[i][j];
  }
  const match = computed.toString('hex') === keyDiffs[i].toString('hex');
  console.log(`  Diff ${i}: ${match ? 'MATCH' : 'MISMATCH'}`);
}

// Analyze the relationship between timestamp and XOR more deeply
console.log('\n--- Timestamp to XOR Mapping ---\n');

// For each sample, compute: xor XOR fpHash = key
// We know this. But what is xor derived from?

// Let's look at the first 4 bytes of XOR as a 32-bit number
console.log('First 4 bytes of XOR as uint32:');
for (const d of data.slice(0, 10)) {
  const xor32 = d.xorBytes.readUInt32LE(0);
  const ts = d.ts;
  const diff = xor32 - ts;
  const xorVal = xor32 ^ ts;
  console.log(`  ts=${ts}, xor32=${xor32}, diff=${diff}, xor=${xorVal}`);
}

// Check if there's a polynomial relationship
console.log('\n--- Polynomial Analysis ---\n');

// For each byte position, try to find: xor[i] = f(ts, fpHash[i])
// where f is some simple function

for (let bytePos = 0; bytePos < 4; bytePos++) {
  console.log(`Byte ${bytePos}:`);
  
  for (const d of data.slice(0, 5)) {
    const xorByte = d.xorBytes[bytePos];
    const fpHashByte = d.fpHashBytes[bytePos];
    const tsByte = (d.ts >> (bytePos * 8)) & 0xFF;
    
    // Try various combinations
    const add = (fpHashByte + tsByte) & 0xFF;
    const xorOp = fpHashByte ^ tsByte;
    const sub = (fpHashByte - tsByte + 256) & 0xFF;
    const mul = (fpHashByte * tsByte) & 0xFF;
    
    console.log(`  ts=${d.ts}: xor=${xorByte}, fpHash=${fpHashByte}, tsByte=${tsByte}`);
    console.log(`    add=${add}, xor=${xorOp}, sub=${sub}, mul=${mul}`);
  }
}

// Try to find if XOR is a hash of (fpHash || counter)
console.log('\n--- Counter-based Hash Search ---\n');

const crypto = require('crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

// For each sample, try to find a counter that makes SHA256(fpHash || counter) = xor
for (const d of data.slice(0, 3)) {
  console.log(`Sample ts=${d.ts}:`);
  
  // Try counters 0-1000
  let found = false;
  for (let counter = 0; counter < 1000; counter++) {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32LE(counter);
    const hash = sha256(Buffer.concat([d.fpHashBytes, counterBuf]));
    
    if (hash.toString('hex') === d.xorBytes.toString('hex')) {
      console.log(`  FOUND! counter=${counter}`);
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log('  No counter found in range 0-999');
  }
}

// Try with timestamp as part of the counter
console.log('\n--- Timestamp-based Counter Search ---\n');

for (const d of data.slice(0, 3)) {
  console.log(`Sample ts=${d.ts}:`);
  
  // Try: SHA256(fpHash || ts_bytes)
  const tsBuf4 = Buffer.alloc(4);
  tsBuf4.writeUInt32LE(d.ts);
  const hash1 = sha256(Buffer.concat([d.fpHashBytes, tsBuf4]));
  console.log(`  SHA256(fpHash || ts_4LE): ${hash1.toString('hex').slice(0, 32)}...`);
  console.log(`  XOR:                      ${d.xorBytes.toString('hex').slice(0, 32)}...`);
  console.log(`  Match: ${hash1.toString('hex') === d.xorBytes.toString('hex') ? 'YES' : 'NO'}`);
  
  // Try: SHA256(ts_bytes || fpHash)
  const hash2 = sha256(Buffer.concat([tsBuf4, d.fpHashBytes]));
  console.log(`  SHA256(ts_4LE || fpHash): ${hash2.toString('hex').slice(0, 32)}...`);
  console.log(`  Match: ${hash2.toString('hex') === d.xorBytes.toString('hex') ? 'YES' : 'NO'}`);
}

// Analyze the mystery bytes at specific positions
console.log('\n--- Specific Byte Relationships ---\n');

// Check if certain bytes of XOR are derived from certain bytes of fpHash
for (let i = 0; i < 4; i++) {
  const xorByte0 = data[0].xorBytes[i];
  const fpHashByte0 = data[0].fpHashBytes[i];
  
  // Find what operation transforms fpHash[i] to xor[i]
  const diff = (xorByte0 - fpHashByte0 + 256) % 256;
  const xorOp = xorByte0 ^ fpHashByte0;
  
  console.log(`Byte ${i}: fpHash=${fpHashByte0.toString(16)}, xor=${xorByte0.toString(16)}, diff=${diff}, xorOp=${xorOp.toString(16)}`);
  
  // Check if this relationship holds for other samples
  let diffWorks = true;
  let xorWorks = true;
  
  for (const d of data.slice(1, 5)) {
    const expectedDiff = (d.fpHashBytes[i] + diff) % 256;
    const expectedXor = d.fpHashBytes[i] ^ xorOp;
    
    if (expectedDiff !== d.xorBytes[i]) diffWorks = false;
    if (expectedXor !== d.xorBytes[i]) xorWorks = false;
  }
  
  console.log(`  Constant diff works: ${diffWorks}`);
  console.log(`  Constant XOR works: ${xorWorks}`);
}

console.log('\n=== Summary ===');
console.log('The XOR constant derivation remains elusive.');
console.log('Key observations:');
console.log('1. No simple linear relationship between timestamp and XOR bytes');
console.log('2. XOR diffs are NOT fpHash diffs XOR a constant');
console.log('3. XOR is NOT SHA256(fpHash || counter) for small counters');
console.log('4. The algorithm is custom and obfuscated in WASM');
