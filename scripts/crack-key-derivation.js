/**
 * Crack the key derivation algorithm
 * 
 * We know:
 * 1. key[0:19] XOR header = "https://rapidshare." (first 19 chars of URL)
 * 2. The full URL is "https://rapidshare.cc/stream/[hash].m3u8"
 * 3. The key is 32 bytes (from %32 in code)
 * 
 * The key derivation must use the header in some way
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Cracking Key Derivation ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const header = decoded.slice(0, 19);

// Known key (29 bytes)
const knownKeyHex = 'b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70';
const knownKey = Buffer.from(knownKeyHex, 'hex');

// The URL starts with "https://rapidshare."
const urlStart = 'https://rapidshare.';

console.log('Header:', header.toString('hex'));
console.log('Known key:', knownKey.toString('hex'));

// For positions 0-18: key[i] = header[i] XOR urlStart[i]
// This is confirmed

// For positions 19-28: key[i] = ???
// Let's find the pattern

console.log('\n=== Analyzing key for positions 19-28 ===\n');

// The URL continues with "cc/stream/"
const urlContinuation = 'cc/stream/';
const urlContinuationBytes = Buffer.from(urlContinuation);

// key[19:29] should decrypt decoded[19:29] to "cc/stream/"
// So: key[19:29] = decoded[19:29] XOR "cc/stream/"

const encPart = decoded.slice(19, 29);
const expectedKey19to29 = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  expectedKey19to29[i] = encPart[i] ^ urlContinuationBytes[i];
}

console.log('Encrypted part [19:29]:', encPart.toString('hex'));
console.log('Expected key [19:29]:', expectedKey19to29.toString('hex'));
console.log('Known key [19:29]:   ', knownKey.slice(19, 29).toString('hex'));

// Check if they match
const match = expectedKey19to29.toString('hex') === knownKey.slice(19, 29).toString('hex');
console.log('Match:', match);

if (match) {
  console.log('\n*** URL CONFIRMED: https://rapidshare.cc/stream/... ***');
}

// Now let's figure out how the key is derived
// For positions 0-18: key[i] = header[i] XOR urlStart[i]
// For positions 19-28: key[i] = ??? XOR urlContinuation[i-19]

// Let's find what the key is XORed with for positions 19-28
const keySource19to29 = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  keySource19to29[i] = knownKey[19 + i] ^ urlContinuationBytes[i];
}

console.log('\nKey source for [19:29]:', keySource19to29.toString('hex'));
console.log('Header [0:10]:        ', header.slice(0, 10).toString('hex'));

// Check if key source matches header
const sourceMatchesHeader = keySource19to29.toString('hex') === header.slice(0, 10).toString('hex');
console.log('Source matches header[0:10]:', sourceMatchesHeader);

// If not, check other patterns
if (!sourceMatchesHeader) {
  // Maybe it's header shifted or transformed
  console.log('\nTrying other patterns...');
  
  // XOR with header
  const xorWithHeader = Buffer.alloc(10);
  for (let i = 0; i < 10; i++) {
    xorWithHeader[i] = keySource19to29[i] ^ header[i];
  }
  console.log('Key source XOR header[0:10]:', xorWithHeader.toString('hex'));
  console.log('As string:', xorWithHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));
  
  // Maybe it's header[19-i] (reversed)
  const headerReversed = Buffer.alloc(10);
  for (let i = 0; i < 10; i++) {
    headerReversed[i] = header[18 - i];
  }
  console.log('Header reversed [18:8]:', headerReversed.toString('hex'));
  
  // Maybe it's a hash of header
  const md5Header = crypto.createHash('md5').update(header).digest();
  console.log('MD5(header):', md5Header.toString('hex'));
  
  // Check if key source matches MD5
  const sourceMatchesMd5 = keySource19to29.slice(0, 10).toString('hex') === md5Header.slice(0, 10).toString('hex');
  console.log('Source matches MD5(header)[0:10]:', sourceMatchesMd5);
}

// Let's try to find the full key derivation
console.log('\n=== Full key derivation ===\n');

// The key might be: header XOR URL (with header repeated)
// But we saw that doesn't work for positions 19+

// Let's try: key[i] = header[i % 19] XOR URL[i] XOR something

// The "something" might be position-dependent
const something = Buffer.alloc(29);
for (let i = 0; i < 29; i++) {
  const urlByte = i < 19 ? urlStart.charCodeAt(i) : urlContinuation.charCodeAt(i - 19);
  something[i] = knownKey[i] ^ header[i % 19] ^ urlByte;
}

console.log('Key XOR header XOR URL:', something.toString('hex'));
console.log('As string:', something.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if "something" is all zeros (meaning key = header XOR URL)
const allZeros = something.every(b => b === 0);
console.log('All zeros:', allZeros);

// Check if "something" is a simple pattern
const uniqueBytes = new Set(something);
console.log('Unique bytes:', uniqueBytes.size);
console.log('Unique values:', [...uniqueBytes].map(b => '0x' + b.toString(16)).join(', '));

// The pattern might be related to position
console.log('\nPosition analysis:');
for (let i = 0; i < 29; i++) {
  const posXor = something[i] ^ i;
  const pos19Xor = something[i] ^ (i % 19);
  console.log(`  ${i}: something=0x${something[i].toString(16).padStart(2, '0')} XOR i=0x${posXor.toString(16).padStart(2, '0')} XOR (i%19)=0x${pos19Xor.toString(16).padStart(2, '0')}`);
}

console.log('\n=== Done ===');
