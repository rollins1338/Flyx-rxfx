/**
 * Solve the key derivation
 * 
 * We have confirmed:
 * 1. key[0:19] = header XOR "https://rapidshare."
 * 2. key[19:29] = encrypted[19:29] XOR "cc/stream/"
 * 
 * The key for positions 19+ is derived from the encrypted data itself!
 * This is a self-referential encryption scheme.
 * 
 * Let's figure out the pattern.
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Solving Key Derivation ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const header = decoded.slice(0, 19);

// Known URL parts
const urlPart1 = 'https://rapidshare.'; // positions 0-18
const urlPart2 = 'cc/stream/';          // positions 19-28
const urlSuffix = '.m3u8';              // positions 51-55

console.log('Header:', header.toString('hex'));
console.log('Encrypted:', decoded.toString('hex'));

// Derive key for positions 0-18
const key0to18 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key0to18[i] = header[i] ^ urlPart1.charCodeAt(i);
}
console.log('\nkey[0:19]:', key0to18.toString('hex'));

// Derive key for positions 19-28
const enc19to28 = decoded.slice(19, 29);
const key19to28 = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  key19to28[i] = enc19to28[i] ^ urlPart2.charCodeAt(i);
}
console.log('key[19:29]:', key19to28.toString('hex'));

// Now let's find the pattern
// For positions 0-18: key[i] = header[i] XOR URL[i]
// For positions 19-28: key[i] = encrypted[i] XOR URL[i]

// The key source changes from header to encrypted at position 19
// This is exactly where the header ends!

// So the pattern might be:
// key[i] = source[i] XOR URL[i]
// where source[i] = header[i] for i < 19
//       source[i] = encrypted[i] for i >= 19

// But that's circular for i >= 19:
// encrypted[i] = plaintext[i] XOR key[i]
//              = URL[i] XOR (encrypted[i] XOR URL[i])
//              = encrypted[i]
// This is always true, so it doesn't help.

// Let me think differently...
// The key might be derived from the header only, but in a complex way.

// For positions 0-18: key[i] = header[i] XOR URL[i]
// For positions 19-28: key[i] = f(header, i) XOR URL[i]

// Let's find f(header, i) for positions 19-28
const keySource19to28 = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  keySource19to28[i] = key19to28[i] ^ urlPart2.charCodeAt(i);
}
console.log('\nKey source for [19:29]:', keySource19to28.toString('hex'));
console.log('This should equal encrypted[19:29]:', enc19to28.toString('hex'));

// They're the same! So key[i] = encrypted[i] XOR URL[i] for i >= 19

// But how do we know encrypted[i] without knowing the key?
// The answer: the key is derived BEFORE encryption, from the plaintext!

// So the encryption process is:
// 1. Generate key from plaintext: key[i] = plaintext[i] XOR something
// 2. Encrypt: ciphertext[i] = plaintext[i] XOR key[i]

// For positions 0-18:
// key[i] = header[i] XOR URL[i]
// But header = ciphertext[0:19], so:
// key[i] = ciphertext[i] XOR URL[i]
// And: ciphertext[i] = URL[i] XOR key[i] = URL[i] XOR ciphertext[i] XOR URL[i] = ciphertext[i]
// This is circular and always true.

// The key must be derived from something else!

// Let me look at the header more carefully
console.log('\n=== Header analysis ===\n');

// The header is 19 bytes: df030e2cf382169ad6825734dfc193e1ebab67
// This might be:
// - A hash of something
// - An IV
// - Encoded data

// Let's check if it's a hash
const md5Tests = [
  'rapidshare',
  'rapidshare.cc',
  'stream',
  '/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ',
  '2MvvbnGoWS2JcOLzFLpK7RXpCQ',
];

md5Tests.forEach(input => {
  const md5 = crypto.createHash('md5').update(input).digest();
  if (md5.slice(0, 19).toString('hex') === header.toString('hex')) {
    console.log(`Header matches MD5(${input})[0:19]!`);
  }
});

// The header might be derived from the embed ID
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);

console.log('Decoded embed ID:', decodedEmbedId.toString('hex'));
console.log('Header:          ', header.toString('hex'));

// Check if header is related to decoded embed ID
if (decodedEmbedId.length === header.length) {
  const xor = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    xor[i] = header[i] ^ decodedEmbedId[i];
  }
  console.log('Header XOR decodedEmbedId:', xor.toString('hex'));
}

// The key derivation might use the embed ID
// Let's try: key = decodedEmbedId XOR URL

console.log('\n=== Trying decodedEmbedId-based key ===\n');

const fullUrl = 'https://rapidshare.cc/stream/';
const key = Buffer.alloc(fullUrl.length);
for (let i = 0; i < fullUrl.length; i++) {
  key[i] = decodedEmbedId[i % decodedEmbedId.length] ^ fullUrl.charCodeAt(i);
}

console.log('Key (decodedEmbedId XOR URL):', key.toString('hex'));

// Decrypt with this key
const plaintext = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  plaintext[i] = decoded[i] ^ key[i % key.length];
}

console.log('Decrypted:', plaintext.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if it starts with https://
if (plaintext.toString('utf8').startsWith('https://')) {
  console.log('\n*** SUCCESS! ***');
}

// Let's try another approach: the key might be header XOR decodedEmbedId
console.log('\n=== Trying header XOR decodedEmbedId ===\n');

const key2 = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  key2[i] = header[i % header.length] ^ decodedEmbedId[i % decodedEmbedId.length];
}

const plaintext2 = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  plaintext2[i] = decoded[i] ^ key2[i];
}

console.log('Decrypted:', plaintext2.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

if (plaintext2.toString('utf8').startsWith('https://')) {
  console.log('\n*** SUCCESS! ***');
}

console.log('\n=== Done ===');
