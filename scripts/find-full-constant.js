/**
 * Find the full constant used in key derivation
 * 
 * We know:
 * - key = embedId XOR constant
 * - First 8 bytes of constant: 853a0c2ae2d67eda
 * - This produces "https://" when decrypting
 * 
 * The constant might be:
 * 1. A repeating 8-byte pattern
 * 2. A longer constant (16, 32 bytes)
 * 3. Derived from MD5 or other hash
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Finding Full Constant ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const embedBytes = Buffer.from(embedId);

// Known constant (first 8 bytes)
const knownConstant = Buffer.from('853a0c2ae2d67eda', 'hex');

console.log(`Embed ID: ${embedId}`);
console.log(`Known constant: ${knownConstant.toString('hex')}`);

// We know the output starts with "https://rapidshare.cc/stream/"
// Let's derive more of the constant
const expectedOutput = 'https://rapidshare.cc/stream/';
const expectedBytes = Buffer.from(expectedOutput);

console.log(`\nExpected output: ${expectedOutput}`);
console.log(`Expected length: ${expectedBytes.length}`);

// Derive the full key for the expected output
const derivedKey = Buffer.alloc(expectedBytes.length);
for (let i = 0; i < expectedBytes.length; i++) {
  derivedKey[i] = decoded[i] ^ expectedBytes[i];
}

console.log(`\nDerived key: ${derivedKey.toString('hex')}`);

// Now derive the constant: constant = key XOR embedId
const derivedConstant = Buffer.alloc(derivedKey.length);
for (let i = 0; i < derivedKey.length; i++) {
  derivedConstant[i] = derivedKey[i] ^ embedBytes[i % embedBytes.length];
}

console.log(`Derived constant: ${derivedConstant.toString('hex')}`);
console.log(`Constant ASCII: ${derivedConstant.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}`);

// Check if constant has a repeating pattern
console.log('\n=== Checking for patterns ===\n');

for (let period = 1; period <= 16; period++) {
  let repeats = true;
  for (let i = period; i < derivedConstant.length; i++) {
    if (derivedConstant[i] !== derivedConstant[i % period]) {
      repeats = false;
      break;
    }
  }
  if (repeats) {
    console.log(`Period ${period}: ${derivedConstant.slice(0, period).toString('hex')}`);
  }
}

// Try extending the constant with different patterns
console.log('\n=== Trying to extend constant ===\n');

// Method 1: Repeat the derived constant
const fullConstant1 = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  fullConstant1[i] = derivedConstant[i % derivedConstant.length];
}

const fullKey1 = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  fullKey1[i] = embedBytes[i % embedBytes.length] ^ fullConstant1[i];
}

let result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ fullKey1[i];
}

console.log(`Method 1 (repeat constant): ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '?')}`);

// Method 2: The constant might be MD5 of something
// Let's find what MD5 produces our constant
console.log('\n=== Looking for MD5 source ===\n');

// The constant might be MD5 of embedId or path
const md5EmbedId = crypto.createHash('md5').update(embedId).digest();
const md5Path = crypto.createHash('md5').update('/e/' + embedId).digest();

console.log(`MD5(embedId): ${md5EmbedId.toString('hex')}`);
console.log(`MD5(path): ${md5Path.toString('hex')}`);
console.log(`Derived constant: ${derivedConstant.toString('hex')}`);

// Check if any MD5 matches
const md5Sources = [
  embedId,
  '/e/' + embedId,
  'rapidshare',
  'rapidairmax',
  'stream',
  embedId.toUpperCase(),
  embedId.toLowerCase(),
];

md5Sources.forEach(src => {
  const md5 = crypto.createHash('md5').update(src).digest();
  
  // Check first 8 bytes
  let match8 = true;
  for (let i = 0; i < 8; i++) {
    if (md5[i] !== derivedConstant[i]) {
      match8 = false;
      break;
    }
  }
  
  if (match8) {
    console.log(`MD5(${src}) matches first 8 bytes!`);
  }
});

// The constant might be XOR of two MD5s
console.log('\n=== Trying XOR of MD5s ===\n');

const md5Pairs = [
  ['embedId', 'rapidshare'],
  ['embedId', 'stream'],
  ['path', 'rapidshare'],
  [embedId, embedId.toUpperCase()],
];

md5Pairs.forEach(([src1, src2]) => {
  const md5_1 = crypto.createHash('md5').update(src1).digest();
  const md5_2 = crypto.createHash('md5').update(src2).digest();
  
  const xored = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    xored[i] = md5_1[i] ^ md5_2[i];
  }
  
  // Check if this matches our constant
  let match = true;
  for (let i = 0; i < Math.min(derivedConstant.length, 16); i++) {
    if (xored[i] !== derivedConstant[i]) {
      match = false;
      break;
    }
  }
  
  if (match) {
    console.log(`MD5(${src1}) XOR MD5(${src2}) matches!`);
  }
});

// Let's try to find the full URL by guessing the hash part
console.log('\n=== Guessing full URL ===\n');

// The URL is: https://rapidshare.cc/stream/[hash].m3u8
// Total length is 56 bytes
// "https://rapidshare.cc/stream/" is 29 bytes
// ".m3u8" is 5 bytes
// So hash is 56 - 29 - 5 = 22 characters

const hashLen = decoded.length - 29 - 5;
console.log(`Hash length: ${hashLen} characters`);

// The hash might be:
// 1. The embed ID (26 chars - too long)
// 2. Part of embed ID
// 3. MD5 hash (32 chars - too long)
// 4. Some other encoding

// Try embed ID truncated
const truncatedId = embedId.slice(0, hashLen);
const fullUrl1 = 'https://rapidshare.cc/stream/' + truncatedId + '.m3u8';
console.log(`Trying: ${fullUrl1}`);

if (fullUrl1.length === decoded.length) {
  const urlBytes = Buffer.from(fullUrl1);
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = decoded[i] ^ urlBytes[i];
  }
  
  // Derive constant
  const constant = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    constant[i] = key[i] ^ embedBytes[i % embedBytes.length];
  }
  
  console.log(`Key: ${key.toString('hex')}`);
  console.log(`Constant: ${constant.toString('hex')}`);
  
  // Check if constant has pattern
  let hasPattern = true;
  for (let i = 8; i < constant.length; i++) {
    if (constant[i] !== constant[i % 8]) {
      hasPattern = false;
      break;
    }
  }
  console.log(`Constant has 8-byte pattern: ${hasPattern}`);
}

// Try different hash formats
const hashFormats = [
  embedId.slice(0, hashLen),
  embedId.slice(-hashLen),
  crypto.createHash('md5').update(embedId).digest('hex').slice(0, hashLen),
  crypto.createHash('sha1').update(embedId).digest('hex').slice(0, hashLen),
];

hashFormats.forEach(hash => {
  const url = 'https://rapidshare.cc/stream/' + hash + '.m3u8';
  if (url.length !== decoded.length) return;
  
  const urlBytes = Buffer.from(url);
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = decoded[i] ^ urlBytes[i];
  }
  
  // Check if key follows a pattern
  const constant = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    constant[i] = key[i] ^ embedBytes[i % embedBytes.length];
  }
  
  // Check for repeating pattern
  for (let period = 1; period <= 16; period++) {
    let repeats = true;
    for (let i = period; i < constant.length; i++) {
      if (constant[i] !== constant[i % period]) {
        repeats = false;
        break;
      }
    }
    if (repeats) {
      console.log(`\nHash: ${hash}`);
      console.log(`URL: ${url}`);
      console.log(`Constant period ${period}: ${constant.slice(0, period).toString('hex')}`);
    }
  }
});

console.log('\n=== Done ===');
