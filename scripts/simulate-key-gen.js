/**
 * Simulate the key generation based on code analysis
 * 
 * From the code:
 * 1. f() returns location.pathname cleaned (only A-Z, 0-9) and sliced(-30)
 * 2. M() returns something.toString(16) - likely a hash
 * 3. i3() builds a 32-byte key from these
 * 
 * The key building loop:
 * r[9][r[6]]=r[7][j3](r[6]%r[7][W3.N4F(380)])
 * This is: key[i] = pathname.charCodeAt(i % pathname.length)
 * 
 * But there's also:
 * r[9][r[6]]=r[9][r[6]+2]
 * This shifts the key: key[i] = key[i+2]
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Simulating Key Generation ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const embedPath = '/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';

// f() function: clean pathname and slice(-30)
function f(pathname) {
  // Remove non-alphanumeric, uppercase
  const cleaned = pathname.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // Slice last 30 characters
  return cleaned.slice(-30);
}

const cleanedPath = f(embedPath);
console.log(`Cleaned path: ${cleanedPath}`);
console.log(`Length: ${cleanedPath.length}`);

// Build key method 1: Simple charCodeAt
function buildKey1(str, len = 32) {
  const key = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    key[i] = str.charCodeAt(i % str.length);
  }
  return key;
}

// Build key method 2: With shift (key[i] = key[i+2])
function buildKey2(str, len = 32) {
  // First build extended key
  const extended = Buffer.alloc(len + 10);
  for (let i = 0; i < extended.length; i++) {
    extended[i] = str.charCodeAt(i % str.length);
  }
  // Then shift: key[i] = key[i+2]
  const key = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    key[i] = extended[i + 2];
  }
  return key;
}

// Build key method 3: XOR with something
function buildKey3(str, xorVal, len = 32) {
  const key = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    key[i] = str.charCodeAt(i % str.length) ^ xorVal;
  }
  return key;
}

// Test different key building methods
const keyMethods = [
  { name: 'Simple charCodeAt', key: buildKey1(cleanedPath) },
  { name: 'With shift +2', key: buildKey2(cleanedPath) },
  { name: 'XOR 0x85', key: buildKey3(cleanedPath, 0x85) },
  { name: 'XOR 0xb7', key: buildKey3(cleanedPath, 0xb7) },
  { name: 'Embed ID', key: buildKey1(embedId) },
  { name: 'Embed ID shift +2', key: buildKey2(embedId) },
];

console.log('\n=== Testing key methods ===\n');

keyMethods.forEach(({ name, key }) => {
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i % key.length];
  }
  const str = result.toString('utf8');
  console.log(`${name}:`);
  console.log(`  Key: ${key.slice(0, 16).toString('hex')}...`);
  console.log(`  Result: ${str.substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);
  
  if (str.includes('http') || str.includes('.m3u8')) {
    console.log('  *** POTENTIAL MATCH ***');
  }
  console.log('');
});

// The key might be derived from the decoded embed ID
const decodedEmbedId = urlSafeBase64Decode(embedId);
console.log(`Decoded embed ID: ${decodedEmbedId.toString('hex')}`);
console.log(`Length: ${decodedEmbedId.length}`);

// Try using decoded embed ID as key
const key4 = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  key4[i] = decodedEmbedId[i % decodedEmbedId.length];
}

let result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ key4[i % key4.length];
}
console.log(`\nDecoded embed ID as key: ${result.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

// The key might involve MD5
const md5Path = crypto.createHash('md5').update(cleanedPath).digest();
result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ md5Path[i % md5Path.length];
}
console.log(`MD5(cleanedPath) as key: ${result.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

// Try combining embed ID and path
const combined = embedId + cleanedPath;
const md5Combined = crypto.createHash('md5').update(combined).digest();
result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ md5Combined[i % md5Combined.length];
}
console.log(`MD5(embedId+path) as key: ${result.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

// The key might be the XOR of two things
// We know the first 8 bytes of the key are: b7 77 7a 5c 80 b8 39 b5
const knownKey = Buffer.from([0xb7, 0x77, 0x7a, 0x5c, 0x80, 0xb8, 0x39, 0xb5]);

console.log('\n=== Analyzing known key bytes ===\n');

// XOR known key with different sources
const sources = [
  { name: 'cleanedPath', data: Buffer.from(cleanedPath) },
  { name: 'embedId', data: Buffer.from(embedId) },
  { name: 'decodedEmbedId', data: decodedEmbedId },
  { name: 'md5(embedId)', data: crypto.createHash('md5').update(embedId).digest() },
  { name: 'md5(cleanedPath)', data: crypto.createHash('md5').update(cleanedPath).digest() },
];

sources.forEach(({ name, data }) => {
  const xored = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    xored[i] = knownKey[i] ^ data[i % data.length];
  }
  console.log(`Known key XOR ${name}: ${xored.toString('hex')} ('${xored.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}')`);
});

// The key might be: source XOR constant
// Let's try to find the constant
console.log('\n=== Finding constant ===\n');

// If key = embedId XOR constant, then constant = key XOR embedId
const embedBytes = Buffer.from(embedId);
const constant = Buffer.alloc(8);
for (let i = 0; i < 8; i++) {
  constant[i] = knownKey[i] ^ embedBytes[i];
}
console.log(`Constant (key XOR embedId): ${constant.toString('hex')}`);

// Try extending with this constant
const fullKey = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  fullKey[i] = embedBytes[i % embedBytes.length] ^ constant[i % constant.length];
}

result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ fullKey[i % fullKey.length];
}
console.log(`Extended key result: ${result.toString('utf8').substring(0, 60).replace(/[^\x20-\x7e]/g, '.')}`);

// The constant might be derived from something else
// Let's try MD5 of various things
const md5Sources = [
  'rapidshare',
  'rapidairmax',
  'stream',
  'video',
  'player',
  'jwplayer',
  '2457433dff868594ecbf3b15e9f22a46efd70a', // app.js path
];

console.log('\n=== Trying MD5 constants ===\n');

md5Sources.forEach(src => {
  const md5 = crypto.createHash('md5').update(src).digest();
  
  // Check if first 8 bytes match our constant
  let matches = true;
  for (let i = 0; i < 8; i++) {
    if (md5[i] !== constant[i]) {
      matches = false;
      break;
    }
  }
  
  if (matches) {
    console.log(`MD5(${src}) matches constant!`);
  }
  
  // Try using this MD5 as the constant
  const key = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    key[i] = embedBytes[i % embedBytes.length] ^ md5[i % md5.length];
  }
  
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i % key.length];
  }
  
  const str = result.toString('utf8');
  if (str.includes('http') || str.includes('.m3u8')) {
    console.log(`MD5(${src}) produces valid URL!`);
    console.log(str);
  }
});

console.log('\n=== Done ===');
