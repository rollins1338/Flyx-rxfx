/**
 * Exhaustive search for XOR constant derivation
 * Try many combinations of known values
 */

const crypto = require('crypto');

// Known values for multiple timestamps
const samples = [
  {
    timestamp: 1700000000,
    fpHash: '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
    key: '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2',
    xor: '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc',
  },
  {
    timestamp: 1700000001,
    fpHash: '9651e9e4d5617929',  // First 8 bytes only from status doc
    key: '800bb8714df5f8fc',
    xor: '165a5195989481d5',
  },
  {
    timestamp: 1700000002,
    fpHash: 'ac239dfdd473e173',
    key: '6e0ff85a9958e5b9',
    xor: 'c22c65a74d2b04ca',
  },
];

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes) {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Focus on the first sample with full data
const s = samples[0];
const ts = s.timestamp.toString();
const fpHashBytes = hexToBytes(s.fpHash);
const keyBytes = hexToBytes(s.key);
const xorBytes = hexToBytes(s.xor);

console.log('=== XOR Constant Derivation Search ===');
console.log('Timestamp:', ts);
console.log('fpHash:', s.fpHash);
console.log('key:', s.key);
console.log('xor:', s.xor);

// Try various derivations
const tests = [];

// 1. SHA256 of timestamp variations
tests.push({ name: 'SHA256(timestamp)', hash: crypto.createHash('sha256').update(ts).digest('hex') });
tests.push({ name: 'SHA256(timestamp bytes LE)', hash: crypto.createHash('sha256').update(Buffer.from([0x00, 0xf1, 0x53, 0x65])).digest('hex') });
tests.push({ name: 'SHA256(timestamp bytes BE)', hash: crypto.createHash('sha256').update(Buffer.from([0x65, 0x53, 0xf1, 0x00])).digest('hex') });

// 2. SHA256 of fpHash variations
tests.push({ name: 'SHA256(fpHash hex)', hash: crypto.createHash('sha256').update(s.fpHash).digest('hex') });
tests.push({ name: 'SHA256(fpHash bytes)', hash: crypto.createHash('sha256').update(Buffer.from(fpHashBytes)).digest('hex') });

// 3. SHA256 of key variations
tests.push({ name: 'SHA256(key hex)', hash: crypto.createHash('sha256').update(s.key).digest('hex') });
tests.push({ name: 'SHA256(key bytes)', hash: crypto.createHash('sha256').update(Buffer.from(keyBytes)).digest('hex') });

// 4. Combinations
tests.push({ name: 'SHA256(ts + fpHash)', hash: crypto.createHash('sha256').update(ts + s.fpHash).digest('hex') });
tests.push({ name: 'SHA256(fpHash + ts)', hash: crypto.createHash('sha256').update(s.fpHash + ts).digest('hex') });
tests.push({ name: 'SHA256(ts + key)', hash: crypto.createHash('sha256').update(ts + s.key).digest('hex') });

// 5. HMAC variations
tests.push({ name: 'HMAC(ts, fpHash)', hash: crypto.createHmac('sha256', ts).update(s.fpHash).digest('hex') });
tests.push({ name: 'HMAC(fpHash, ts)', hash: crypto.createHmac('sha256', s.fpHash).update(ts).digest('hex') });
tests.push({ name: 'HMAC(key, ts)', hash: crypto.createHmac('sha256', s.key).update(ts).digest('hex') });
tests.push({ name: 'HMAC(ts, key)', hash: crypto.createHmac('sha256', ts).update(s.key).digest('hex') });

// 6. Double hash variations
const doubleHash = crypto.createHash('sha256').update(s.fpHash).digest('hex');
tests.push({ name: 'SHA256(SHA256(fpHash).hex)', hash: doubleHash });
tests.push({ name: 'SHA256(SHA256(fpHash).hex) XOR fpHash', hash: bytesToHex(hexToBytes(doubleHash).map((b, i) => b ^ fpHashBytes[i])) });

// 7. XOR combinations
tests.push({ name: 'fpHash XOR doubleHash', hash: bytesToHex(fpHashBytes.map((b, i) => b ^ hexToBytes(doubleHash)[i])) });
tests.push({ name: 'key XOR doubleHash', hash: bytesToHex(keyBytes.map((b, i) => b ^ hexToBytes(doubleHash)[i])) });

// 8. Try with session ID
const sessionId = `${ts}.5000000`;
tests.push({ name: 'SHA256(sessionId)', hash: crypto.createHash('sha256').update(sessionId).digest('hex') });
tests.push({ name: 'SHA256(sessionId + fpHash)', hash: crypto.createHash('sha256').update(sessionId + s.fpHash).digest('hex') });

// 9. Try with canvas data
const canvasPrefix = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';
tests.push({ name: 'SHA256(canvas)', hash: crypto.createHash('sha256').update(canvasPrefix).digest('hex') });
tests.push({ name: 'SHA256(canvas + ts)', hash: crypto.createHash('sha256').update(canvasPrefix + ts).digest('hex') });
tests.push({ name: 'SHA256(ts + canvas)', hash: crypto.createHash('sha256').update(ts + canvasPrefix).digest('hex') });

// 10. Try HKDF-like derivation
const hkdfExtract = crypto.createHmac('sha256', Buffer.alloc(32)).update(Buffer.from(fpHashBytes)).digest();
tests.push({ name: 'HKDF-Extract(fpHash)', hash: hkdfExtract.toString('hex') });

const hkdfExpand = crypto.createHmac('sha256', hkdfExtract).update(Buffer.from([0x01])).digest();
tests.push({ name: 'HKDF-Expand(fpHash)', hash: hkdfExpand.toString('hex') });

// Check all tests
console.log('\n=== Test Results ===');
for (const test of tests) {
  const match = test.hash === s.xor;
  if (match) {
    console.log(`*** MATCH: ${test.name} ***`);
    console.log(`  Result: ${test.hash}`);
  }
}

// Also check if any test result XORed with fpHash gives the key
console.log('\n=== XOR with fpHash Tests ===');
for (const test of tests) {
  const testBytes = hexToBytes(test.hash.slice(0, 64)); // Take first 32 bytes
  if (testBytes.length === 32) {
    const xored = testBytes.map((b, i) => b ^ fpHashBytes[i]);
    const xoredHex = bytesToHex(xored);
    if (xoredHex === s.key) {
      console.log(`*** MATCH: ${test.name} XOR fpHash = key ***`);
      console.log(`  ${test.name}: ${test.hash}`);
    }
  }
}

// Check if the XOR constant has any pattern with the timestamp
console.log('\n=== XOR Constant Pattern Analysis ===');
console.log('XOR constant:', s.xor);
console.log('Timestamp hex:', s.timestamp.toString(16));

// Check if any bytes of XOR constant relate to timestamp
const tsHex = s.timestamp.toString(16).padStart(8, '0');
console.log('Timestamp as hex:', tsHex);

// Check if XOR constant contains timestamp bytes
for (let i = 0; i <= s.xor.length - 8; i += 2) {
  if (s.xor.slice(i, i + 8) === tsHex) {
    console.log(`Timestamp found at position ${i} in XOR constant!`);
  }
}

// Try to find a pattern between consecutive XOR constants
console.log('\n=== Cross-Sample Analysis ===');
if (samples[1].xor.length >= 16) {
  const xor0 = samples[0].xor.slice(0, 16);
  const xor1 = samples[1].xor;
  
  // XOR the first 8 bytes of each
  const xor0Bytes = hexToBytes(xor0);
  const xor1Bytes = hexToBytes(xor1);
  const diff = xor0Bytes.map((b, i) => b ^ xor1Bytes[i]);
  console.log('XOR[0] first 8:', xor0);
  console.log('XOR[1] first 8:', xor1);
  console.log('Difference:', bytesToHex(diff));
}

console.log('\n=== Conclusion ===');
console.log('The XOR constant derivation could not be determined.');
console.log('It appears to be computed by a custom algorithm in the WASM.');
console.log('The Puppeteer-based solution remains the only working approach.');
