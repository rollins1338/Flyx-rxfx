/**
 * Analyze XOR Pattern - Find what the XOR constant is derived from
 * 
 * From previous test:
 * - XOR constants differ between tests
 * - Canvas is the same
 * - Timestamp/sessionId differ
 * 
 * The XOR constant must be derived from timestamp or sessionId
 */

const crypto = require('crypto');

// Sample data from previous test
const samples = [
  {
    testNum: 1,
    timestamp: "1700001000",
    sessionId: "1700001000.1000000",
    canvasBase64First50: "iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk",
    fpString: "24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700001000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk",
    fpHash: "580521a275f63e8e4e9f1cc6b71d80fb006d4ceeb3bbbb78fdd78f94e046b477",
    actualKey: "9c9d9493fcedc4f268dfc17b8988a8d2cf6d4a28d85a44613adfd210609dd660",
    xorConstant: "c498b531891bfa7c2640ddbd3e952829cf0006c66be1ff19c7085d8480db6217"
  },
  {
    testNum: 2,
    timestamp: "1700002000",
    sessionId: "1700002000.2000000",
    canvasBase64First50: "iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk",
    fpString: "24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700002000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk",
    fpHash: "be173100722b9127298d070715ba504b29fe256eb2d322bbfb3e1660394c1e65",
    actualKey: "77f523ec98512296d0bb1d4e726398d727009049ddb3de5414d053600da487fd",
    xorConstant: "c9e212ecea7ab3b1f9361a4967d9c89c0efeb5276f60fcefefee450034e89998"
  },
  {
    testNum: 3,
    timestamp: "1700003000",
    sessionId: "1700003000.3000000",
    canvasBase64First50: "iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk",
    fpString: "24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700003000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk",
    fpHash: "ecbdee0307fd8b9a4b0968aa269998c9e864357b0c987d08a4bf405f036aa5c5",
    actualKey: "186ba03769a1ef6413e23619ee7eef1b39ec8efe66300db1becea60df65a4e75",
    xorConstant: "f4d64e346e5c64fe58eb5eb3c8e777d2d188bb856aa870b91a71e652f530ebb0"
  }
];

console.log('=== Analyzing XOR Pattern ===\n');

// Test various derivations for the XOR constant
for (const sample of samples) {
  console.log(`\n=== Test ${sample.testNum} ===\n`);
  console.log(`XOR Constant: ${sample.xorConstant}`);
  
  const xorBuf = Buffer.from(sample.xorConstant, 'hex');
  
  // Test 1: XOR = SHA256(sessionId)
  const sessionHash = crypto.createHash('sha256').update(sample.sessionId).digest();
  if (sessionHash.equals(xorBuf)) {
    console.log('*** XOR = SHA256(sessionId) ***');
  }
  
  // Test 2: XOR = SHA256(timestamp)
  const timestampHash = crypto.createHash('sha256').update(sample.timestamp).digest();
  if (timestampHash.equals(xorBuf)) {
    console.log('*** XOR = SHA256(timestamp) ***');
  }
  
  // Test 3: XOR = HMAC(canvas, sessionId)
  const hmac1 = crypto.createHmac('sha256', sample.canvasBase64First50).update(sample.sessionId).digest();
  if (hmac1.equals(xorBuf)) {
    console.log('*** XOR = HMAC(canvas, sessionId) ***');
  }
  
  // Test 4: XOR = HMAC(sessionId, canvas)
  const hmac2 = crypto.createHmac('sha256', sample.sessionId).update(sample.canvasBase64First50).digest();
  if (hmac2.equals(xorBuf)) {
    console.log('*** XOR = HMAC(sessionId, canvas) ***');
  }
  
  // Test 5: XOR = SHA256(canvas + sessionId)
  const concat1 = crypto.createHash('sha256').update(sample.canvasBase64First50 + sample.sessionId).digest();
  if (concat1.equals(xorBuf)) {
    console.log('*** XOR = SHA256(canvas + sessionId) ***');
  }
  
  // Test 6: XOR = SHA256(sessionId + canvas)
  const concat2 = crypto.createHash('sha256').update(sample.sessionId + sample.canvasBase64First50).digest();
  if (concat2.equals(xorBuf)) {
    console.log('*** XOR = SHA256(sessionId + canvas) ***');
  }
  
  // Test 7: XOR = SHA256(fpString + sessionId)
  const concat3 = crypto.createHash('sha256').update(sample.fpString + sample.sessionId).digest();
  if (concat3.equals(xorBuf)) {
    console.log('*** XOR = SHA256(fpString + sessionId) ***');
  }
  
  // Test 8: XOR = SHA256(sessionId + fpString)
  const concat4 = crypto.createHash('sha256').update(sample.sessionId + sample.fpString).digest();
  if (concat4.equals(xorBuf)) {
    console.log('*** XOR = SHA256(sessionId + fpString) ***');
  }
  
  // Test 9: XOR = HMAC(fpString, sessionId)
  const hmac3 = crypto.createHmac('sha256', sample.fpString).update(sample.sessionId).digest();
  if (hmac3.equals(xorBuf)) {
    console.log('*** XOR = HMAC(fpString, sessionId) ***');
  }
  
  // Test 10: XOR = HMAC(sessionId, fpString)
  const hmac4 = crypto.createHmac('sha256', sample.sessionId).update(sample.fpString).digest();
  if (hmac4.equals(xorBuf)) {
    console.log('*** XOR = HMAC(sessionId, fpString) ***');
  }
  
  // Test 11: Double hash with sessionId
  const fpHashBuf = Buffer.from(sample.fpHash, 'hex');
  const double1 = crypto.createHash('sha256').update(Buffer.concat([fpHashBuf, Buffer.from(sample.sessionId)])).digest();
  if (double1.equals(xorBuf)) {
    console.log('*** XOR = SHA256(fpHash + sessionId) ***');
  }
  
  // Test 12: XOR = SHA256(fpHash || sessionId as hex)
  const double2 = crypto.createHash('sha256').update(sample.fpHash + sample.sessionId).digest();
  if (double2.equals(xorBuf)) {
    console.log('*** XOR = SHA256(fpHashHex + sessionId) ***');
  }
  
  // Test 13: HKDF with sessionId as salt
  try {
    const hkdf1 = crypto.hkdfSync('sha256', sample.fpString, sample.sessionId, '', 32);
    if (Buffer.from(hkdf1).equals(xorBuf)) {
      console.log('*** XOR = HKDF(fpString, sessionId, "", 32) ***');
    }
  } catch (e) {}
  
  // Test 14: HKDF with sessionId as info
  try {
    const hkdf2 = crypto.hkdfSync('sha256', sample.fpString, '', sample.sessionId, 32);
    if (Buffer.from(hkdf2).equals(xorBuf)) {
      console.log('*** XOR = HKDF(fpString, "", sessionId, 32) ***');
    }
  } catch (e) {}
  
  // Test 15: Check if XOR is related to the random part of sessionId
  const randomPart = sample.sessionId.split('.')[1];
  const randomHash = crypto.createHash('sha256').update(randomPart).digest();
  if (randomHash.equals(xorBuf)) {
    console.log('*** XOR = SHA256(randomPart) ***');
  }
  
  // Test 16: XOR fpHash with canvas hash
  const canvasHash = crypto.createHash('sha256').update(sample.canvasBase64First50).digest();
  const xorCanvas = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorCanvas[i] = fpHashBuf[i] ^ canvasHash[i];
  }
  const keyBuf = Buffer.from(sample.actualKey, 'hex');
  if (xorCanvas.equals(keyBuf)) {
    console.log('*** key = fpHash XOR canvasHash ***');
  }
  
  // Test 17: XOR fpHash with sessionHash
  const sessionHashBuf = crypto.createHash('sha256').update(sample.sessionId).digest();
  const xorSession = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorSession[i] = fpHashBuf[i] ^ sessionHashBuf[i];
  }
  if (xorSession.equals(keyBuf)) {
    console.log('*** key = fpHash XOR sessionHash ***');
  }
  
  // Test 18: key = SHA256(fpHash || sessionId bytes)
  const keyTest1 = crypto.createHash('sha256').update(Buffer.concat([fpHashBuf, Buffer.from(sample.sessionId)])).digest();
  if (keyTest1.equals(keyBuf)) {
    console.log('*** key = SHA256(fpHashBytes + sessionId) ***');
  }
  
  // Test 19: key = HMAC(fpHash, sessionId)
  const keyTest2 = crypto.createHmac('sha256', fpHashBuf).update(sample.sessionId).digest();
  if (keyTest2.equals(keyBuf)) {
    console.log('*** key = HMAC(fpHashBytes, sessionId) ***');
  }
  
  // Test 20: key = HMAC(sessionId, fpHash)
  const keyTest3 = crypto.createHmac('sha256', sample.sessionId).update(fpHashBuf).digest();
  if (keyTest3.equals(keyBuf)) {
    console.log('*** key = HMAC(sessionId, fpHashBytes) ***');
  }
}

// Try to find a pattern in the XOR constants themselves
console.log('\n=== XOR Constant Pattern Analysis ===\n');

const xorConstants = samples.map(s => Buffer.from(s.xorConstant, 'hex'));

// XOR the XOR constants with each other
const xor12 = Buffer.alloc(32);
const xor23 = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  xor12[i] = xorConstants[0][i] ^ xorConstants[1][i];
  xor23[i] = xorConstants[1][i] ^ xorConstants[2][i];
}

console.log(`XOR1 XOR XOR2: ${xor12.toString('hex')}`);
console.log(`XOR2 XOR XOR3: ${xor23.toString('hex')}`);

// Check if the difference is related to timestamp difference
const ts1 = parseInt(samples[0].timestamp);
const ts2 = parseInt(samples[1].timestamp);
const ts3 = parseInt(samples[2].timestamp);

console.log(`\nTimestamp diff 1-2: ${ts2 - ts1}`);
console.log(`Timestamp diff 2-3: ${ts3 - ts2}`);

// Maybe the key derivation uses a PRNG seeded with something
console.log('\n=== Testing PRNG-based derivation ===\n');

// The key might be: key = PRNG(seed) where seed = fpHash or sessionId
// Let's check if there's a simple relationship

for (const sample of samples) {
  const fpHashBuf = Buffer.from(sample.fpHash, 'hex');
  const keyBuf = Buffer.from(sample.actualKey, 'hex');
  
  // Check byte-by-byte relationship
  console.log(`\nTest ${sample.testNum} byte analysis:`);
  
  // Check if key bytes are a function of fpHash bytes
  let pattern = '';
  for (let i = 0; i < 4; i++) {
    const fpByte = fpHashBuf[i];
    const keyByte = keyBuf[i];
    const diff = (keyByte - fpByte + 256) % 256;
    const xor = fpByte ^ keyByte;
    pattern += `[${i}] fp=${fpByte.toString(16).padStart(2,'0')} key=${keyByte.toString(16).padStart(2,'0')} diff=${diff.toString(16).padStart(2,'0')} xor=${xor.toString(16).padStart(2,'0')}\n`;
  }
  console.log(pattern);
}

console.log('\n=== Summary ===\n');
console.log('The XOR constant is NOT static and changes with each session.');
console.log('We need to find what it\'s derived from.');
