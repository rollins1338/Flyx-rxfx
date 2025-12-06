/**
 * Final crack attempt
 * 
 * We know:
 * 1. Output starts with "https://rapidshare.cc/stream/"
 * 2. The key is NOT a simple XOR with embedId
 * 3. The key derivation involves multiple steps
 * 
 * From the code analysis:
 * - i3() builds a 32-byte key
 * - It uses location.pathname (cleaned)
 * - It might also use a regex match result
 * - There's a shift operation: key[i] = key[i+2]
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Final Crack Attempt ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const embedPath = '/e/' + embedId;

// We know the first 29 bytes of output
const knownOutput = 'https://rapidshare.cc/stream/';
const knownOutputBytes = Buffer.from(knownOutput);

// Derive the key for known output
const knownKey = Buffer.alloc(knownOutputBytes.length);
for (let i = 0; i < knownOutputBytes.length; i++) {
  knownKey[i] = decoded[i] ^ knownOutputBytes[i];
}

console.log('Known key (29 bytes):');
console.log(`  Hex: ${knownKey.toString('hex')}`);
console.log(`  ASCII: ${knownKey.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}`);

// The key might be built from:
// 1. Cleaned pathname charCodes
// 2. Some transformation applied

const cleanedPath = embedPath.replace(/[^A-Z0-9]/gi, '').toUpperCase();
console.log(`\nCleaned path: ${cleanedPath}`);

// Compare known key with cleaned path charCodes
console.log('\nComparing known key with cleaned path:');
for (let i = 0; i < knownKey.length; i++) {
  const pathChar = cleanedPath[i % cleanedPath.length];
  const pathCode = pathChar.charCodeAt(0);
  const keyByte = knownKey[i];
  const diff = keyByte ^ pathCode;
  console.log(`  ${i}: key=0x${keyByte.toString(16).padStart(2, '0')} path='${pathChar}'(0x${pathCode.toString(16)}) diff=0x${diff.toString(16).padStart(2, '0')}`);
}

// The diff values might reveal a pattern
const diffs = [];
for (let i = 0; i < knownKey.length; i++) {
  const pathCode = cleanedPath.charCodeAt(i % cleanedPath.length);
  diffs.push(knownKey[i] ^ pathCode);
}

console.log(`\nDiff pattern: ${Buffer.from(diffs).toString('hex')}`);

// Check if diff has a repeating pattern
console.log('\nChecking diff for patterns:');
for (let period = 1; period <= 16; period++) {
  let repeats = true;
  for (let i = period; i < diffs.length; i++) {
    if (diffs[i] !== diffs[i % period]) {
      repeats = false;
      break;
    }
  }
  if (repeats) {
    console.log(`  Period ${period}: ${Buffer.from(diffs.slice(0, period)).toString('hex')}`);
  }
}

// The key might involve the decoded embed ID
const decodedEmbedId = urlSafeBase64Decode(embedId);
console.log(`\nDecoded embed ID: ${decodedEmbedId.toString('hex')}`);

// Compare known key with decoded embed ID
console.log('\nComparing known key with decoded embed ID:');
const diffs2 = [];
for (let i = 0; i < knownKey.length; i++) {
  const idByte = decodedEmbedId[i % decodedEmbedId.length];
  diffs2.push(knownKey[i] ^ idByte);
}
console.log(`Diff pattern: ${Buffer.from(diffs2).toString('hex')}`);

// Check for pattern
for (let period = 1; period <= 19; period++) {
  let repeats = true;
  for (let i = period; i < diffs2.length; i++) {
    if (diffs2[i] !== diffs2[i % period]) {
      repeats = false;
      break;
    }
  }
  if (repeats) {
    console.log(`  Period ${period}: ${Buffer.from(diffs2.slice(0, period)).toString('hex')}`);
  }
}

// The key might be: decodedEmbedId XOR constant
// Let's try to find the constant by assuming it's MD5 of something

console.log('\n=== Trying MD5-based constants ===\n');

const md5Sources = [
  'rapidshare',
  'rapidshare.cc',
  'stream',
  '/stream/',
  embedId,
  cleanedPath,
  embedPath,
  'video',
  'player',
  'jwplayer',
  '2457433dff868594ecbf3b15e9f22a46efd70a',
  '19a76d77646',
];

md5Sources.forEach(src => {
  const md5 = crypto.createHash('md5').update(src).digest();
  
  // Try: key = decodedEmbedId XOR md5
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = decodedEmbedId[i % decodedEmbedId.length] ^ md5[i % md5.length];
  }
  
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i];
  }
  
  const str = result.toString('utf8');
  if (str.startsWith('https://')) {
    console.log(`MD5(${src}) works!`);
    console.log(`  Result: ${str}`);
  }
});

// Try: key = cleanedPath XOR md5
md5Sources.forEach(src => {
  const md5 = crypto.createHash('md5').update(src).digest();
  
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = cleanedPath.charCodeAt(i % cleanedPath.length) ^ md5[i % md5.length];
  }
  
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i];
  }
  
  const str = result.toString('utf8');
  if (str.startsWith('https://')) {
    console.log(`cleanedPath XOR MD5(${src}) works!`);
    console.log(`  Result: ${str}`);
  }
});

// Try: key = embedId XOR md5
md5Sources.forEach(src => {
  const md5 = crypto.createHash('md5').update(src).digest();
  
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = embedId.charCodeAt(i % embedId.length) ^ md5[i % md5.length];
  }
  
  const result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ key[i];
  }
  
  const str = result.toString('utf8');
  if (str.startsWith('https://')) {
    console.log(`embedId XOR MD5(${src}) works!`);
    console.log(`  Result: ${str}`);
  }
});

// The key might be derived from the diff pattern we found
// Let's try extending it
console.log('\n=== Extending diff pattern ===\n');

// Use the diff pattern to build full key
const diffPattern = Buffer.from(diffs);
const fullKey = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  const pathCode = cleanedPath.charCodeAt(i % cleanedPath.length);
  fullKey[i] = pathCode ^ diffPattern[i % diffPattern.length];
}

let result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ fullKey[i];
}

console.log(`Extended diff pattern result: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '?')}`);

// The diff pattern might need to be extended differently
// Let's try using the first 8 bytes as a repeating pattern
const diff8 = Buffer.from(diffs.slice(0, 8));
const fullKey2 = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  const pathCode = cleanedPath.charCodeAt(i % cleanedPath.length);
  fullKey2[i] = pathCode ^ diff8[i % diff8.length];
}

result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ fullKey2[i];
}

console.log(`8-byte diff pattern result: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '?')}`);

console.log('\n=== Done ===');
