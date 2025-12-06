/**
 * Complete key derivation
 * 
 * We know:
 * 1. Output starts with "https://rapidshare.cc/stream/"
 * 2. The key for first 30 bytes is: b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70
 * 
 * The URL probably continues with something like:
 * https://rapidshare.cc/stream/[hash]/[filename].m3u8
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Complete Key Derivation ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);

// Known key from "https://rapidshare.cc/stream/"
const knownKeyHex = 'b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70';
const knownKey = Buffer.from(knownKeyHex, 'hex');

console.log(`Decoded PAGE_DATA length: ${decoded.length} bytes`);
console.log(`Known key length: ${knownKey.length} bytes`);
console.log(`Remaining bytes to decrypt: ${decoded.length - knownKey.length}`);

// Decrypt what we can
const partialResult = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  if (i < knownKey.length) {
    partialResult[i] = decoded[i] ^ knownKey[i];
  } else {
    partialResult[i] = decoded[i]; // Unknown key bytes
  }
}

console.log(`\nPartial decryption: ${partialResult.toString('utf8').replace(/[^\x20-\x7e]/g, '?')}`);

// The remaining 26 bytes need to be decrypted
// The URL after /stream/ is likely a hash or ID

// Let's analyze the key pattern
console.log('\n=== Key pattern analysis ===\n');

console.log('Known key bytes:');
for (let i = 0; i < knownKey.length; i++) {
  const byte = knownKey[i];
  const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
  const embedByte = embedId.charCodeAt(i % embedId.length);
  const xored = byte ^ embedByte;
  console.log(`  ${i.toString().padStart(2)}: 0x${byte.toString(16).padStart(2, '0')} ^ '${embedId[i % embedId.length]}' = 0x${xored.toString(16).padStart(2, '0')} ('${String.fromCharCode(xored).replace(/[^\x20-\x7e]/g, '.')}')`);
}

// The key might be: embedId XOR constant
// Let's find the constant
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const constant = Buffer.alloc(knownKey.length);
for (let i = 0; i < knownKey.length; i++) {
  constant[i] = knownKey[i] ^ embedId.charCodeAt(i % embedId.length);
}

console.log(`\nDerived constant: ${constant.toString('hex')}`);
console.log(`Constant ASCII: ${constant.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}`);

// Check if constant repeats
console.log('\nChecking for repeating pattern in constant:');
for (let period = 1; period <= 16; period++) {
  let repeats = true;
  for (let i = period; i < constant.length; i++) {
    if (constant[i] !== constant[i % period]) {
      repeats = false;
      break;
    }
  }
  if (repeats) {
    console.log(`  Period ${period}: ${constant.slice(0, period).toString('hex')}`);
  }
}

// The key might be derived differently
// Let's try: key = MD5(embedId) XOR something

const md5EmbedId = crypto.createHash('md5').update(embedId).digest();
console.log(`\nMD5(embedId): ${md5EmbedId.toString('hex')}`);

// XOR known key with MD5
const xorWithMd5 = Buffer.alloc(knownKey.length);
for (let i = 0; i < knownKey.length; i++) {
  xorWithMd5[i] = knownKey[i] ^ md5EmbedId[i % md5EmbedId.length];
}
console.log(`Key XOR MD5(embedId): ${xorWithMd5.toString('hex')}`);

// The key might be built from multiple sources
// Let's try to extend the key using the pattern we found

console.log('\n=== Trying to extend key ===\n');

// If the key is embedId XOR constant, we can extend it
const fullKey = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  fullKey[i] = embedId.charCodeAt(i % embedId.length) ^ constant[i % constant.length];
}

const fullResult = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  fullResult[i] = decoded[i] ^ fullKey[i];
}

console.log(`Extended key: ${fullKey.toString('hex')}`);
console.log(`Full decryption: ${fullResult.toString('utf8').replace(/[^\x20-\x7e]/g, '?')}`);

// The URL might end with .m3u8
// Let's try to find where .m3u8 might be
console.log('\n=== Looking for .m3u8 position ===\n');

const m3u8Bytes = Buffer.from('.m3u8');
for (let pos = decoded.length - 10; pos < decoded.length - 4; pos++) {
  const keyBytes = Buffer.alloc(5);
  for (let i = 0; i < 5; i++) {
    keyBytes[i] = decoded[pos + i] ^ m3u8Bytes[i];
  }
  console.log(`Position ${pos}: key would be ${keyBytes.toString('hex')} ('${keyBytes.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}')`);
}

// Try assuming the URL is exactly 56 characters
// https://rapidshare.cc/stream/XXXXXXXXXXXXXXXX.m3u8
// That's 30 + 16 + 5 = 51 characters, close to 56

const urlTemplate = 'https://rapidshare.cc/stream/';
const suffix = '.m3u8';
const hashLen = decoded.length - urlTemplate.length - suffix.length;

console.log(`\nURL structure: ${urlTemplate}[${hashLen} chars]${suffix}`);

// The hash might be the embed ID or derived from it
const possibleHashes = [
  embedId,
  embedId.slice(0, hashLen),
  crypto.createHash('md5').update(embedId).digest('hex').slice(0, hashLen),
  crypto.createHash('sha1').update(embedId).digest('hex').slice(0, hashLen),
];

possibleHashes.forEach(hash => {
  if (hash.length !== hashLen) return;
  
  const fullUrl = urlTemplate + hash + suffix;
  if (fullUrl.length !== decoded.length) return;
  
  const urlBytes = Buffer.from(fullUrl);
  const key = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    key[i] = decoded[i] ^ urlBytes[i];
  }
  
  console.log(`\nTrying hash: ${hash}`);
  console.log(`Full URL: ${fullUrl}`);
  console.log(`Key: ${key.toString('hex')}`);
  
  // Check if key looks valid (mostly printable or follows a pattern)
  let printable = 0;
  for (let i = 0; i < key.length; i++) {
    if (key[i] >= 32 && key[i] <= 126) printable++;
  }
  console.log(`Key printable: ${printable}/${key.length}`);
});

console.log('\n=== Done ===');
