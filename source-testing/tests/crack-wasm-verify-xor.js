/**
 * Verify XOR Calculation
 * 
 * Let's verify the XOR constant calculation is correct.
 */

const crypto = require('crypto');

// Our collected samples
const samples = [
  { timestamp: 1700000000, fpHash: "54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e", key: "48d4fb57c0ceadb3a520e6ca27798de74b22010e8fbf4284ab73c841886a47f2" },
  { timestamp: 1700000001, fpHash: "9651e9e4d5617929b3c7564252b3ee097b2eab17459500e0eac0f95e5105da3a", key: "800bb871cd7fe8fcbdda725d429dc510fb87946d87563044d9c0303c183d234d" },
  { timestamp: 1700000002, fpHash: "ac239dfdd473e1731e0a3b0f4d7ab3b3b9fbbcea927f52825e1887b2fa97b29d", key: "6e0ff85a99f8e5b9c16ada0c47db5511a43f5504d556b7bfc95df7053cc12435" },
  { timestamp: 1700000003, fpHash: "f535fa31cafd61d9de7569bab33779da8a6c329af868f0a7be69bd2d01a93615", key: "cc0b9d6faacb66d03947213576510f4a27afbe9b30938f8785d3ee67fcfb39ce" },
  { timestamp: 1700000010, fpHash: "3d492079c0597c1da4125871ed9a4f7385fb231ea8377c619b658d79701b5e6d", key: "88c281acf77f0097e126fc24aeb7ba36507a35deaad488dd0100290f003c6c46" },
  { timestamp: 1700000100, fpHash: "4bb81863454b992215bc0df88d7c2dd069d2f506f33abb9c0c92a9173f4bc1ee", key: "921674c16c97b262d164549c3c2bdf30a88dd434919a02d5aa4d072de2c3ec29" },
  { timestamp: 1700001000, fpHash: "580521a275f63e8e4e9f1cc6b71d80fb006d4ceeb3bbbb78fdd78f94e046b477", key: "9c9d9493fc1dc4f268dfc17b8988a8d2cf6d4a28d85a4461fa7fd21460ddd660" },
];

console.log('=== Verifying XOR Calculation ===\n');

for (const s of samples) {
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const keyBuf = Buffer.from(s.key, 'hex');
  
  // Calculate XOR constant: xor = fpHash XOR key
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  
  console.log(`ts=${s.timestamp}:`);
  console.log(`  fpHash: ${s.fpHash}`);
  console.log(`  key:    ${s.key}`);
  console.log(`  xor:    ${xorBuf.toString('hex')}`);
  
  // Verify: key = fpHash XOR xor
  const verifyBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    verifyBuf[i] = fpHashBuf[i] ^ xorBuf[i];
  }
  console.log(`  verify: ${verifyBuf.toString('hex')}`);
  console.log(`  match:  ${verifyBuf.equals(keyBuf)}`);
  console.log('');
}

// Now let's analyze the correct XOR constants
console.log('\n=== Analyzing Correct XOR Constants ===\n');

const correctedSamples = samples.map(s => {
  const fpHashBuf = Buffer.from(s.fpHash, 'hex');
  const keyBuf = Buffer.from(s.key, 'hex');
  
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  
  return {
    timestamp: s.timestamp,
    fpHash: s.fpHash,
    key: s.key,
    xor: xorBuf.toString('hex'),
  };
});

console.log('Corrected XOR constants:');
for (const s of correctedSamples) {
  console.log(`ts=${s.timestamp}: ${s.xor}`);
}

// Now let's try to find the pattern with the correct XOR constants
console.log('\n=== Testing with Correct XOR Constants ===\n');

// Try: XOR = SHA256(timestamp)
console.log('Testing XOR = SHA256(timestamp):');
for (const s of correctedSamples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  const tsHash = crypto.createHash('sha256').update(String(ts)).digest();
  if (tsHash.equals(xorBuf)) {
    console.log(`  MATCH for ts=${ts}`);
  } else {
    console.log(`  NO MATCH for ts=${ts}`);
  }
}

// Try: XOR = SHA256(timestamp as 4-byte LE)
console.log('\nTesting XOR = SHA256(timestamp as 4-byte LE):');
for (const s of correctedSamples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  const tsBuf = Buffer.alloc(4);
  tsBuf.writeUInt32LE(ts);
  const tsHash = crypto.createHash('sha256').update(tsBuf).digest();
  if (tsHash.equals(xorBuf)) {
    console.log(`  MATCH for ts=${ts}`);
  } else {
    console.log(`  NO MATCH for ts=${ts}`);
  }
}

// Try: XOR = SHA256(timestamp as 4-byte BE)
console.log('\nTesting XOR = SHA256(timestamp as 4-byte BE):');
for (const s of correctedSamples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  const tsBuf = Buffer.alloc(4);
  tsBuf.writeUInt32BE(ts);
  const tsHash = crypto.createHash('sha256').update(tsBuf).digest();
  if (tsHash.equals(xorBuf)) {
    console.log(`  MATCH for ts=${ts}`);
  } else {
    console.log(`  NO MATCH for ts=${ts}`);
  }
}

// Try: XOR = SHA256(timestamp.toString())
console.log('\nTesting XOR = SHA256(timestamp.toString()):');
for (const s of correctedSamples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  const tsHash = crypto.createHash('sha256').update(ts.toString()).digest();
  if (tsHash.equals(xorBuf)) {
    console.log(`  MATCH for ts=${ts}`);
  } else {
    console.log(`  NO MATCH for ts=${ts}`);
  }
}

// Try: XOR = SHA256(sessionId) where sessionId = timestamp.random
console.log('\nTesting XOR = SHA256(sessionId):');
for (const s of correctedSamples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // We used Math.random() = 0.5, so random part is 5000000
  const sessionId = `${ts}.5000000`;
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest();
  if (sessionHash.equals(xorBuf)) {
    console.log(`  MATCH for ts=${ts}`);
  } else {
    console.log(`  NO MATCH for ts=${ts}`);
  }
}

// Let's look at the relationship between consecutive XOR constants
console.log('\n=== Analyzing Consecutive XOR Relationships ===\n');

for (let i = 0; i < correctedSamples.length - 1; i++) {
  const s1 = correctedSamples[i];
  const s2 = correctedSamples[i + 1];
  
  const xor1 = Buffer.from(s1.xor, 'hex');
  const xor2 = Buffer.from(s2.xor, 'hex');
  
  // XOR the two
  const diff = Buffer.alloc(32);
  for (let j = 0; j < 32; j++) {
    diff[j] = xor1[j] ^ xor2[j];
  }
  
  const tsDiff = s2.timestamp - s1.timestamp;
  
  console.log(`ts ${s1.timestamp} -> ${s2.timestamp} (diff: ${tsDiff}):`);
  console.log(`  XOR diff: ${diff.toString('hex')}`);
}

// Output the corrected samples for further analysis
console.log('\n=== Corrected Samples JSON ===\n');
console.log(JSON.stringify(correctedSamples, null, 2));
