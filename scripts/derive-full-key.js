/**
 * Derive the full decryption key
 * 
 * We know:
 * 1. Output starts with "https://"
 * 2. First 8 key bytes are: b7 77 7a 5c 80 b8 39 b5
 * 3. The key is likely 32 bytes (from %32 in the code)
 * 
 * The URL probably follows a pattern like:
 * https://domain.com/path/to/video.m3u8
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Deriving Full Key ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);

console.log('Decoded PAGE_DATA:');
console.log(`  Hex: ${decoded.toString('hex')}`);
console.log('');

// We know the output starts with "https://"
// Let's try common URL patterns

const urlPatterns = [
  'https://rapidshare.cc/',
  'https://rapidairmax.site/',
  'https://cdn.',
  'https://stream.',
  'https://video.',
  'https://play.',
  'https://hls.',
  'https://m3u8.',
];

console.log('=== Trying URL patterns ===\n');

urlPatterns.forEach(pattern => {
  const patternBytes = Buffer.from(pattern);
  const derivedKey = Buffer.alloc(patternBytes.length);
  
  for (let i = 0; i < patternBytes.length; i++) {
    derivedKey[i] = decoded[i] ^ patternBytes[i];
  }
  
  console.log(`Pattern: "${pattern}"`);
  console.log(`  Key: ${derivedKey.toString('hex')}`);
  console.log(`  Key ASCII: ${derivedKey.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}`);
  
  // Check if key looks like it could be derived from embed ID or path
  const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
  const cleanPath = 'E2MVVBNGOWS2JCOLZFLPK7RXPCQ';
  
  // Check similarity
  let matchEmbed = 0;
  let matchPath = 0;
  for (let i = 0; i < derivedKey.length; i++) {
    if (derivedKey[i] === embedId.charCodeAt(i % embedId.length)) matchEmbed++;
    if (derivedKey[i] === cleanPath.charCodeAt(i % cleanPath.length)) matchPath++;
  }
  
  if (matchEmbed > 2 || matchPath > 2) {
    console.log(`  Matches embedId: ${matchEmbed}/${derivedKey.length}`);
    console.log(`  Matches cleanPath: ${matchPath}/${derivedKey.length}`);
  }
  console.log('');
});

// The key might be XOR of embed ID with something
console.log('=== Analyzing key derivation ===\n');

// First 8 bytes of key when output is "https://"
const knownKey = Buffer.from([0xb7, 0x77, 0x7a, 0x5c, 0x80, 0xb8, 0x39, 0xb5]);
console.log(`Known key bytes: ${knownKey.toString('hex')}`);

// XOR with embed ID to see what constant might be used
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const embedBytes = Buffer.from(embedId);

console.log('\nXOR of known key with embed ID:');
for (let i = 0; i < knownKey.length; i++) {
  const xored = knownKey[i] ^ embedBytes[i % embedBytes.length];
  console.log(`  ${i}: 0x${knownKey[i].toString(16)} ^ '${embedId[i]}' (0x${embedBytes[i].toString(16)}) = 0x${xored.toString(16)} ('${String.fromCharCode(xored).replace(/[^\x20-\x7e]/g, '.')}')`);
}

// The key might be derived from MD5 or SHA of something
console.log('\n=== Trying hash-based keys ===\n');

const hashInputs = [
  embedId,
  embedId.toUpperCase(),
  embedId.toLowerCase(),
  'E2MVVBNGOWS2JCOLZFLPK7RXPCQ',
  '2MvvbnGoWS2JcOLzFLpK7RXpCQ',
  '/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ',
  'rapidshare.cc',
  'rapidairmax.site',
  embedId + 'rapidshare',
  'rapidshare' + embedId,
];

hashInputs.forEach(input => {
  const md5 = crypto.createHash('md5').update(input).digest();
  const sha1 = crypto.createHash('sha1').update(input).digest();
  const sha256 = crypto.createHash('sha256').update(input).digest();
  
  // Check if first 8 bytes match
  let md5Match = true;
  let sha1Match = true;
  let sha256Match = true;
  
  for (let i = 0; i < 8; i++) {
    if (md5[i] !== knownKey[i]) md5Match = false;
    if (sha1[i] !== knownKey[i]) sha1Match = false;
    if (sha256[i] !== knownKey[i]) sha256Match = false;
  }
  
  if (md5Match) console.log(`MD5(${input}) matches!`);
  if (sha1Match) console.log(`SHA1(${input}) matches!`);
  if (sha256Match) console.log(`SHA256(${input}) matches!`);
});

// The key might be built character by character
// Let's try to find a pattern in the known key bytes
console.log('\n=== Key pattern analysis ===\n');

console.log('Known key bytes:');
for (let i = 0; i < knownKey.length; i++) {
  const byte = knownKey[i];
  console.log(`  ${i}: 0x${byte.toString(16).padStart(2, '0')} = ${byte} = '${String.fromCharCode(byte).replace(/[^\x20-\x7e]/g, '.')}'`);
}

// Check if key bytes follow a pattern
console.log('\nDifferences between consecutive bytes:');
for (let i = 1; i < knownKey.length; i++) {
  const diff = knownKey[i] - knownKey[i-1];
  console.log(`  ${i}: ${diff}`);
}

// The key might be derived from the decoded embed ID
const decodedEmbedId = urlSafeBase64Decode(embedId);
console.log(`\nDecoded embed ID: ${decodedEmbedId.toString('hex')}`);

// XOR known key with decoded embed ID
console.log('\nXOR of known key with decoded embed ID:');
for (let i = 0; i < knownKey.length; i++) {
  const xored = knownKey[i] ^ decodedEmbedId[i % decodedEmbedId.length];
  console.log(`  ${i}: 0x${xored.toString(16).padStart(2, '0')} = '${String.fromCharCode(xored).replace(/[^\x20-\x7e]/g, '.')}'`);
}

// Try to find the full key by assuming the URL continues with common patterns
console.log('\n=== Extending key with URL assumptions ===\n');

// Assume URL is like: https://rapidshare.cc/stream/...
const assumedUrl = 'https://rapidshare.cc/stream/';
const assumedBytes = Buffer.from(assumedUrl);
const extendedKey = Buffer.alloc(assumedBytes.length);

for (let i = 0; i < assumedBytes.length; i++) {
  extendedKey[i] = decoded[i] ^ assumedBytes[i];
}

console.log(`Assumed URL: ${assumedUrl}`);
console.log(`Extended key: ${extendedKey.toString('hex')}`);
console.log(`Extended key ASCII: ${extendedKey.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}`);

// Now use this extended key to decrypt more
const fullResult = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  fullResult[i] = decoded[i] ^ extendedKey[i % extendedKey.length];
}
console.log(`Full decryption: ${fullResult.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try other URL patterns
const urlBases = [
  'https://rapidshare.cc/e/',
  'https://rapidshare.cc/v/',
  'https://rapidshare.cc/p/',
  'https://cdn.rapidshare.cc/',
  'https://stream.rapidshare.cc/',
];

urlBases.forEach(base => {
  const baseBytes = Buffer.from(base);
  const key = Buffer.alloc(baseBytes.length);
  
  for (let i = 0; i < baseBytes.length; i++) {
    key[i] = decoded[i] ^ baseBytes[i];
  }
  
  // Decrypt with this key
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i % key.length];
  }
  
  const str = result.toString('utf8');
  if (str.includes('.m3u8') || str.includes('.mp4') || /^https?:\/\/[a-z0-9.-]+\//i.test(str)) {
    console.log(`\nBase: ${base}`);
    console.log(`Result: ${str}`);
  }
});

console.log('\n=== Done ===');
