/**
 * Brute force key derivation
 * 
 * We know:
 * 1. Output starts with "https://rapidshare.cc/stream/"
 * 2. The key is 32 bytes (from %32 in code)
 * 3. The key is derived from pathname and possibly other sources
 * 
 * Let's try all possible combinations of known values
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Brute Force Key Derivation ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const embedPath = '/e/' + embedId;
const cleanedPath = embedPath.replace(/[^A-Z0-9]/gi, '').toUpperCase();
const decodedEmbedId = urlSafeBase64Decode(embedId);

// Known output prefix
const knownOutput = 'https://rapidshare.cc/stream/';
const knownBytes = Buffer.from(knownOutput);

// Derive the key for known output
const knownKey = Buffer.alloc(knownBytes.length);
for (let i = 0; i < knownBytes.length; i++) {
  knownKey[i] = decoded[i] ^ knownBytes[i];
}

console.log('Known key (29 bytes):');
console.log(`  Hex: ${knownKey.toString('hex')}`);

// The key might be built from multiple XOR operations
// key = source1 XOR source2 XOR source3 ...

// Let's try all combinations of known sources
const sources = {
  'embedId': Buffer.from(embedId),
  'cleanedPath': Buffer.from(cleanedPath),
  'decodedEmbedId': decodedEmbedId,
  'md5(embedId)': crypto.createHash('md5').update(embedId).digest(),
  'md5(cleanedPath)': crypto.createHash('md5').update(cleanedPath).digest(),
  'md5(embedPath)': crypto.createHash('md5').update(embedPath).digest(),
  'md5(rapidshare)': crypto.createHash('md5').update('rapidshare').digest(),
  'md5(stream)': crypto.createHash('md5').update('stream').digest(),
  'sha1(embedId)': crypto.createHash('sha1').update(embedId).digest(),
};

console.log('\n=== Testing single sources ===\n');

Object.entries(sources).forEach(([name, source]) => {
  // Build key by repeating source
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = source[i % source.length];
  }
  
  // Decrypt
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i];
  }
  
  const str = result.toString('utf8');
  if (str.startsWith('https://')) {
    console.log(`${name}: ${str}`);
  }
});

console.log('\n=== Testing XOR combinations ===\n');

// Try XOR of two sources
const sourceNames = Object.keys(sources);
for (let i = 0; i < sourceNames.length; i++) {
  for (let j = i + 1; j < sourceNames.length; j++) {
    const name1 = sourceNames[i];
    const name2 = sourceNames[j];
    const src1 = sources[name1];
    const src2 = sources[name2];
    
    // Build key by XORing sources
    const key = Buffer.alloc(decoded.length);
    for (let k = 0; k < decoded.length; k++) {
      key[k] = src1[k % src1.length] ^ src2[k % src2.length];
    }
    
    // Decrypt
    const result = Buffer.alloc(decoded.length);
    for (let k = 0; k < decoded.length; k++) {
      result[k] = decoded[k] ^ key[k];
    }
    
    const str = result.toString('utf8');
    if (str.startsWith('https://')) {
      console.log(`${name1} XOR ${name2}: ${str}`);
    }
  }
}

console.log('\n=== Testing with transformations ===\n');

// The key might involve bit rotations
function rotateLeft(byte, bits) {
  return ((byte << bits) | (byte >>> (8 - bits))) & 0xFF;
}

function rotateRight(byte, bits) {
  return ((byte >>> bits) | (byte << (8 - bits))) & 0xFF;
}

// Try rotating the source before XOR
Object.entries(sources).forEach(([name, source]) => {
  for (let rot = 1; rot <= 7; rot++) {
    // Rotate left
    const rotatedL = Buffer.from(source.map(b => rotateLeft(b, rot)));
    let key = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      key[i] = rotatedL[i % rotatedL.length];
    }
    
    let result = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      result[i] = decoded[i] ^ key[i];
    }
    
    let str = result.toString('utf8');
    if (str.startsWith('https://')) {
      console.log(`${name} ROL ${rot}: ${str}`);
    }
    
    // Rotate right
    const rotatedR = Buffer.from(source.map(b => rotateRight(b, rot)));
    key = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      key[i] = rotatedR[i % rotatedR.length];
    }
    
    result = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      result[i] = decoded[i] ^ key[i];
    }
    
    str = result.toString('utf8');
    if (str.startsWith('https://')) {
      console.log(`${name} ROR ${rot}: ${str}`);
    }
  }
});

console.log('\n=== Testing with constants ===\n');

// The key might be source XOR constant
// Try common constants
const constants = [
  0x00, 0x55, 0xAA, 0xFF,
  0x85, 0x3a, 0x0c, 0x2a, // From our earlier analysis
];

Object.entries(sources).forEach(([name, source]) => {
  constants.forEach(constant => {
    const key = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      key[i] = source[i % source.length] ^ constant;
    }
    
    const result = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      result[i] = decoded[i] ^ key[i];
    }
    
    const str = result.toString('utf8');
    if (str.startsWith('https://')) {
      console.log(`${name} XOR 0x${constant.toString(16)}: ${str}`);
    }
  });
});

console.log('\n=== Testing position-based keys ===\n');

// The key might be built differently for each position
// key[i] = f(source, i)

// Try: key[i] = source[i % len] XOR i
Object.entries(sources).forEach(([name, source]) => {
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = source[i % source.length] ^ (i & 0xFF);
  }
  
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i];
  }
  
  const str = result.toString('utf8');
  if (str.startsWith('https://')) {
    console.log(`${name} XOR position: ${str}`);
  }
});

// Try: key[i] = source[i % len] + i (mod 256)
Object.entries(sources).forEach(([name, source]) => {
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = (source[i % source.length] + i) & 0xFF;
  }
  
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i];
  }
  
  const str = result.toString('utf8');
  if (str.startsWith('https://')) {
    console.log(`${name} + position: ${str}`);
  }
});

console.log('\n=== Done ===');
