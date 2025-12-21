/**
 * Verify if the key is SHA256(SHA256(fingerprint).hex)
 * Based on the Ghidra decompilation showing two SHA256 operations
 */

const crypto = require('crypto');

// Known fingerprint for timestamp=1700000000
const fingerprint = '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';

// Known values
const expectedFpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
const expectedKey = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
const expectedXor = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';

console.log('=== Fingerprint ===');
console.log('Fingerprint:', fingerprint);
console.log('Length:', fingerprint.length);

// Step 1: SHA256(fingerprint)
const hash1 = crypto.createHash('sha256').update(fingerprint).digest('hex');
console.log('\n=== Step 1: SHA256(fingerprint) ===');
console.log('hash1:', hash1);
console.log('Expected fpHash:', expectedFpHash);
console.log('Match:', hash1 === expectedFpHash);

// Step 2: SHA256(hash1 as hex string)
const hash2 = crypto.createHash('sha256').update(hash1).digest('hex');
console.log('\n=== Step 2: SHA256(hash1.hex) ===');
console.log('hash2:', hash2);
console.log('Expected key:', expectedKey);
console.log('Match:', hash2 === expectedKey);

// If hash2 is NOT the key, then there's an XOR operation
if (hash2 !== expectedKey) {
  console.log('\n=== XOR Analysis ===');
  console.log('hash2 is NOT the key, so there must be an XOR operation');
  
  // What would we need to XOR hash2 with to get the key?
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
  
  const hash2Bytes = hexToBytes(hash2);
  const keyBytes = hexToBytes(expectedKey);
  const neededXor = hash2Bytes.map((b, i) => b ^ keyBytes[i]);
  
  console.log('hash2 XOR key =', bytesToHex(neededXor));
  console.log('This is what we need to XOR hash2 with to get the key');
  
  // Check if this equals fpHash
  console.log('\nIs this fpHash?', bytesToHex(neededXor) === expectedFpHash);
  
  // Check if this equals expectedXor
  console.log('Is this expectedXor?', bytesToHex(neededXor) === expectedXor);
  
  // What if the algorithm is: key = hash1 XOR hash2?
  const hash1Bytes = hexToBytes(hash1);
  const hash1XorHash2 = hash1Bytes.map((b, i) => b ^ hash2Bytes[i]);
  console.log('\nhash1 XOR hash2 =', bytesToHex(hash1XorHash2));
  console.log('Is this the key?', bytesToHex(hash1XorHash2) === expectedKey);
}

// Let's also try: key = fpHash XOR SHA256(fpHash.hex)
console.log('\n=== Alternative: fpHash XOR SHA256(fpHash.hex) ===');
const fpHashBytes = crypto.createHash('sha256').update(fingerprint).digest();
const doubleHashBytes = crypto.createHash('sha256').update(hash1).digest();

const xorResult = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  xorResult[i] = fpHashBytes[i] ^ doubleHashBytes[i];
}
console.log('fpHash XOR SHA256(fpHash.hex) =', xorResult.toString('hex'));
console.log('Is this the key?', xorResult.toString('hex') === expectedKey);

// What if the XOR constant is embedded in the WASM?
// Let's check if it's a constant that doesn't change
console.log('\n=== XOR Constant Analysis ===');
console.log('Expected XOR constant:', expectedXor);

// The XOR constant might be derived from something static
// Let's try some possibilities

// 1. SHA256 of a static string
const staticStrings = [
  'tmdb_session_id',
  'TMDB Image Enhancement',
  'Processing capabilities test',
  'canvas2d',
  'top',
  '14px Arial',
  '11px Arial',
];

for (const str of staticStrings) {
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  if (hash === expectedXor) {
    console.log(`*** FOUND: SHA256("${str}") = XOR constant ***`);
  }
}

// 2. What if the XOR constant is derived from the WASM binary itself?
// This would require reading the WASM file

// 3. What if it's a hardcoded constant in the WASM?
// We'd need to search the WASM data section

console.log('\n=== Summary ===');
console.log('The key derivation appears to be:');
console.log('1. fpHash = SHA256(fingerprint)');
console.log('2. hash2 = SHA256(fpHash.hex)');
console.log('3. key = fpHash XOR xorConstant');
console.log('');
console.log('The xorConstant is NOT:');
console.log('  - hash2 (SHA256 of fpHash hex)');
console.log('  - fpHash XOR hash2');
console.log('  - SHA256 of any known static string');
