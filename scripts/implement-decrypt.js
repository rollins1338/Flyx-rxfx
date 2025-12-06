/**
 * Implement the full decryption algorithm
 * 
 * Transformation functions found:
 * - D(a): rotate left 5 bits
 * - b(a): rotate right 4 bits  
 * - P(a): rotate right 3 bits
 * - z(a): rotate left 3 bits
 * - w(a): add 48 mod 256
 * - I(a): XOR with 227
 * - U(a): XOR with 1
 * - F(a): XOR with 131
 * 
 * The decryption applies transformation based on position % 10
 * Then XORs with key[position % 32]
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Implementing Full Decryption ===\n');

// Transformation functions
const transforms = {
  D: a => ((a << 5) | (a >>> 3)) & 0xFF,  // rotate left 5
  b: a => ((a >>> 4) | (a << 4)) & 0xFF,  // rotate right 4
  P: a => ((a >>> 3) | (a << 5)) & 0xFF,  // rotate right 3
  z: a => ((a << 3) | (a >>> 5)) & 0xFF,  // rotate left 3
  w: a => (a + 48) % 256,                  // add 48
  I: a => 227 ^ a,                         // XOR 227
  U: a => 1 ^ a,                           // XOR 1
  F: a => 131 ^ a,                         // XOR 131
  N: a => ((a << 4) | (a >>> 4)) & 0xFF,  // rotate left 4
  V: a => ((a >>> 5) | (a << 3)) & 0xFF,  // rotate right 5
  s: a => ((a << 2) | (a >>> 6)) & 0xFF,  // rotate left 2
  B: a => ((a << 5) | (a >>> 3)) & 0xFF,  // rotate left 5 (same as D)
  n: a => ((a << 4) | (a >>> 4)) & 0xFF,  // rotate left 4 (same as N)
  p: a => ((a >>> 4) | (a << 4)) & 0xFF,  // rotate right 4 (same as b)
  W: a => ((a >>> 5) | (a << 3)) & 0xFF,  // rotate right 5 (same as V)
  identity: a => a,
};

// Inverse transforms (for decryption we need to reverse the operations)
const inverseTransforms = {
  D: a => ((a >>> 5) | (a << 3)) & 0xFF,  // rotate right 5
  b: a => ((a << 4) | (a >>> 4)) & 0xFF,  // rotate left 4
  P: a => ((a << 3) | (a >>> 5)) & 0xFF,  // rotate left 3
  z: a => ((a >>> 3) | (a << 5)) & 0xFF,  // rotate right 3
  w: a => (a - 48 + 256) % 256,           // subtract 48
  I: a => 227 ^ a,                         // XOR 227 (self-inverse)
  U: a => 1 ^ a,                           // XOR 1 (self-inverse)
  F: a => 131 ^ a,                         // XOR 131 (self-inverse)
  N: a => ((a >>> 4) | (a << 4)) & 0xFF,  // rotate right 4
  V: a => ((a << 5) | (a >>> 3)) & 0xFF,  // rotate left 5
  s: a => ((a >>> 2) | (a << 6)) & 0xFF,  // rotate right 2
  identity: a => a,
};

// From the code analysis, the sequence based on r = position % 10:
// Looking at the case statements in T(a):
// case 0: some operation
// case 1: b
// case 2: b (again)
// case 3: ?
// case 4: U
// case 5: F
// case 6: ?
// case 7: ?
// case 8: D
// case 9: I

// Let's try different sequences
const sequences = [
  // Sequence 1: Based on code analysis
  ['identity', 'b', 'b', 'w', 'U', 'F', 'P', 'I', 'D', 'I'],
  // Sequence 2: All identity (no transform)
  ['identity', 'identity', 'identity', 'identity', 'identity', 'identity', 'identity', 'identity', 'identity', 'identity'],
  // Sequence 3: Just XOR operations
  ['identity', 'identity', 'identity', 'identity', 'U', 'F', 'identity', 'identity', 'identity', 'I'],
  // Sequence 4: Rotations only
  ['z', 'b', 'P', 'D', 'z', 'b', 'P', 'D', 'z', 'b'],
  // Sequence 5: Based on the order in the code
  ['w', 'b', 'b', 'w', 'U', 'F', 'P', 'I', 'D', 'I'],
];

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);

// Build key from embed path
const embedPath = '/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const cleanPath = embedPath.replace(/[^A-Z0-9]/gi, '').toUpperCase();
const key = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  key[i] = cleanPath.charCodeAt(i % cleanPath.length);
}

console.log(`PAGE_DATA: ${pageData}`);
console.log(`Decoded length: ${decoded.length} bytes`);
console.log(`Key: ${key.toString('ascii')}`);
console.log('');

// Try decryption with different sequences
function decrypt(data, key, sequence, useInverse = true) {
  const result = Buffer.alloc(data.length);
  const transformSet = useInverse ? inverseTransforms : transforms;
  
  for (let i = 0; i < data.length; i++) {
    let byte = data[i];
    
    // XOR with key first
    byte ^= key[i % key.length];
    
    // Apply inverse transformation
    const transformName = sequence[i % sequence.length];
    const transform = transformSet[transformName] || transformSet.identity;
    byte = transform(byte);
    
    result[i] = byte & 0xFF;
  }
  return result;
}

// Also try transform first, then XOR
function decryptTransformFirst(data, key, sequence, useInverse = true) {
  const result = Buffer.alloc(data.length);
  const transformSet = useInverse ? inverseTransforms : transforms;
  
  for (let i = 0; i < data.length; i++) {
    let byte = data[i];
    
    // Apply inverse transformation first
    const transformName = sequence[i % sequence.length];
    const transform = transformSet[transformName] || transformSet.identity;
    byte = transform(byte);
    
    // Then XOR with key
    byte ^= key[i % key.length];
    
    result[i] = byte & 0xFF;
  }
  return result;
}

console.log('=== Trying different sequences ===\n');

sequences.forEach((seq, idx) => {
  // Try XOR first, then inverse transform
  let result = decrypt(decoded, key, seq, true);
  let str = result.toString('utf8');
  console.log(`Seq ${idx + 1} (XOR first, inverse): ${str.substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);
  
  // Try transform first, then XOR
  result = decryptTransformFirst(decoded, key, seq, true);
  str = result.toString('utf8');
  console.log(`Seq ${idx + 1} (transform first, inverse): ${str.substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);
  
  // Try forward transforms
  result = decrypt(decoded, key, seq, false);
  str = result.toString('utf8');
  console.log(`Seq ${idx + 1} (XOR first, forward): ${str.substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);
  
  result = decryptTransformFirst(decoded, key, seq, false);
  str = result.toString('utf8');
  console.log(`Seq ${idx + 1} (transform first, forward): ${str.substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);
  
  console.log('');
});

// The key might be different - let's try the embed ID directly
console.log('=== Trying with embed ID as key ===\n');

const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const key2 = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  key2[i] = embedId.charCodeAt(i % embedId.length);
}

sequences.forEach((seq, idx) => {
  let result = decrypt(decoded, key2, seq, true);
  let str = result.toString('utf8');
  if (str.includes('http') || str.includes('.m3u8')) {
    console.log(`Seq ${idx + 1} with embedId: SUCCESS!`);
    console.log(str);
  }
});

// Try without any transformation, just XOR
console.log('\n=== Simple XOR with different keys ===\n');

const keys = [
  { name: 'cleanPath', key: key },
  { name: 'embedId', key: key2 },
  { name: 'md5(embedId)', key: crypto.createHash('md5').update(embedId).digest() },
  { name: 'md5(cleanPath)', key: crypto.createHash('md5').update(cleanPath).digest() },
];

keys.forEach(({ name, key }) => {
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i % key.length];
  }
  const str = result.toString('utf8');
  console.log(`${name}: ${str.substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);
});

// The PAGE_DATA might have a header that we need to skip
console.log('\n=== Trying with header skip ===\n');

// First 19 bytes are identical between samples, might be header
const header = decoded.slice(0, 19);
const encData = decoded.slice(19);

console.log(`Header (19 bytes): ${header.toString('hex')}`);
console.log(`Encrypted data (37 bytes): ${encData.toString('hex')}`);

// Try decrypting just the encrypted part
keys.forEach(({ name, key }) => {
  const result = Buffer.alloc(encData.length);
  for (let i = 0; i < encData.length; i++) {
    result[i] = encData[i] ^ key[i % key.length];
  }
  const str = result.toString('utf8');
  console.log(`${name} (data only): ${str.replace(/[^\x20-\x7e]/g, '.')}`);
});

console.log('\n=== Done ===');
