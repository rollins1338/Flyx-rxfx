/**
 * Crack using the app.js hash
 * 
 * Key insight: The hash hex is exactly 19 bytes - same as header!
 * 
 * Hash hex: 2457433dff868594ecbf3b15e9f22a46efd70a (19 bytes)
 * Header:   df030e2cf382169ad6825734dfc193e1ebab67 (19 bytes)
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
const appJsHash = '2457433dff868594ecbf3b15e9f22a46efd70a';

const ciphertext = urlSafeBase64Decode(pageData);
const header = ciphertext.subarray(0, 19);
const hashHex = Buffer.from(appJsHash, 'hex');
const urlFirst56 = knownUrl.substring(0, 56);

console.log('=== Cracking with Hash ===\n');
console.log('Header:', header.toString('hex'));
console.log('Hash:  ', hashHex.toString('hex'));

// Derive actual key
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

// Check: is actualKey[0:19] = header XOR hash XOR URL[0:19]?
console.log('\n=== Testing: key = header XOR hash XOR URL ===\n');

const testKey = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  testKey[i] = header[i] ^ hashHex[i] ^ urlFirst56.charCodeAt(i);
}
console.log('header XOR hash XOR URL[0:19]:', testKey.toString('hex'));
console.log('Actual key[0:19]:             ', actualKey.subarray(0, 19).toString('hex'));
console.log('Match:', testKey.toString('hex') === actualKey.subarray(0, 19).toString('hex'));

// Check: is actualKey[0:19] = hash XOR URL[0:19]?
const testKey2 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  testKey2[i] = hashHex[i] ^ urlFirst56.charCodeAt(i);
}
console.log('\nhash XOR URL[0:19]:', testKey2.toString('hex'));
console.log('Actual key[0:19]: ', actualKey.subarray(0, 19).toString('hex'));
console.log('Match:', testKey2.toString('hex') === actualKey.subarray(0, 19).toString('hex'));

// Check: header XOR hash = ?
const headerXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXorHash[i] = header[i] ^ hashHex[i];
}
console.log('\nheader XOR hash:', headerXorHash.toString('hex'));
console.log('As string:', headerXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check: actualKey[0:19] XOR hash = ?
const keyXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  keyXorHash[i] = actualKey[i] ^ hashHex[i];
}
console.log('\nkey[0:19] XOR hash:', keyXorHash.toString('hex'));
console.log('As string:', keyXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This should be: (header XOR URL) XOR hash = header XOR URL XOR hash
// Let's check if it equals URL XOR header XOR hash
const urlXorHeaderXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlXorHeaderXorHash[i] = urlFirst56.charCodeAt(i) ^ header[i] ^ hashHex[i];
}
console.log('URL XOR header XOR hash:', urlXorHeaderXorHash.toString('hex'));

// The key derivation might be:
// key[i] = hash[i % 19] XOR something
// where something = header XOR URL

console.log('\n=== Testing: key = hash XOR (header XOR URL) ===\n');

// For positions 0-18:
// key[i] = hash[i] XOR header[i] XOR URL[i]
// But we know key[i] = header[i] XOR URL[i]
// So: header[i] XOR URL[i] = hash[i] XOR header[i] XOR URL[i]
// This means: 0 = hash[i], which is false

// Let me try: plaintext = ciphertext XOR hash (repeated)
const decryptWithHash = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  decryptWithHash[i] = ciphertext[i] ^ hashHex[i % 19];
}
console.log('Decrypted with hash:', decryptWithHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if first 19 chars match URL
console.log('First 19 chars:', decryptWithHash.subarray(0, 19).toString('utf8'));
console.log('Expected:', urlFirst56.substring(0, 19));

// The decryption gives: .TM.....:=l!63...|m
// This is header XOR hash!
// So: ciphertext XOR hash = header XOR hash (for positions 0-18)
// Which means: ciphertext[0:19] = header (confirmed!)

// For positions 19+:
// ciphertext XOR hash = ???
console.log('\n=== Analyzing positions 19+ ===\n');

const cipher19plus = ciphertext.subarray(19);
const decrypted19plus = decryptWithHash.subarray(19);
console.log('ciphertext[19:] XOR hash:', decrypted19plus.toString('hex'));
console.log('As string:', decrypted19plus.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Expected URL[19:56]
console.log('Expected URL[19:56]:', urlFirst56.substring(19));

// The difference
const diff = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  diff[i] = decrypted19plus[i] ^ urlFirst56.charCodeAt(19 + i);
}
console.log('Difference:', diff.toString('hex'));
console.log('As string:', diff.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This difference is what we need to XOR with (ciphertext XOR hash) to get URL
// diff = (ciphertext XOR hash) XOR URL
//      = ciphertext XOR hash XOR URL
//      = key XOR hash (since ciphertext = URL XOR key)

// So diff = key XOR hash for positions 19+
// And we know key[i] = actualKey[i]
// Let's verify
const keyXorHashFull = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  keyXorHashFull[i] = actualKey[19 + i] ^ hashHex[(19 + i) % 19];
}
console.log('\nkey[19:] XOR hash:', keyXorHashFull.toString('hex'));
console.log('Match diff:', keyXorHashFull.toString('hex') === diff.toString('hex'));

// So the decryption is:
// plaintext[i] = ciphertext[i] XOR hash[i % 19] XOR diff[i - 19] (for i >= 19)
// plaintext[i] = ciphertext[i] XOR hash[i % 19] (for i < 19, but this gives header XOR hash, not URL)

// Wait, for positions 0-18:
// ciphertext[i] = header[i]
// plaintext[i] = URL[i]
// So: URL[i] = header[i] XOR key[i]
// And: key[i] = header[i] XOR URL[i]

// If we use hash as key:
// header[i] XOR hash[i] = URL[i]?
// Let's check
const headerXorHashAsUrl = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXorHashAsUrl[i] = header[i] ^ hashHex[i];
}
console.log('\n=== Testing: URL = header XOR hash ===\n');
console.log('header XOR hash:', headerXorHashAsUrl.toString('utf8'));
console.log('Expected URL[0:19]:', urlFirst56.substring(0, 19));
console.log('Match:', headerXorHashAsUrl.toString('utf8') === urlFirst56.substring(0, 19));

// They don't match! So hash is NOT the direct key.

// Let me check if there's a constant offset
console.log('\n=== Finding the offset ===\n');

// URL[i] = header[i] XOR key[i]
// key[i] = header[i] XOR URL[i]
// If key[i] = hash[i] XOR offset[i], then:
// offset[i] = key[i] XOR hash[i]

const offset = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  offset[i] = actualKey[i] ^ hashHex[i];
}
console.log('Offset (key XOR hash):', offset.toString('hex'));
console.log('As string:', offset.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if offset = URL[0:19]
console.log('URL[0:19] hex:', Buffer.from(urlFirst56.substring(0, 19)).toString('hex'));
console.log('Match:', offset.toString('hex') === Buffer.from(urlFirst56.substring(0, 19)).toString('hex'));

// So: key = hash XOR URL!
// This means: plaintext = ciphertext XOR hash XOR URL
// But we need URL to decrypt... circular!

// UNLESS the URL has a predictable prefix!
console.log('\n=== Testing with known URL prefix ===\n');

// The URL always starts with "https://" (8 chars)
// And the domain might be predictable

// For FNAF2, the URL is: https://rrr.core36link.site/...
// Let's assume we know the first 19 chars: "https://rrr.core36l"

const knownPrefix = 'https://rrr.core36l';
console.log('Known prefix:', knownPrefix);

// key = hash XOR URL
// So: key[0:19] = hash XOR "https://rrr.core36l"
const derivedKey = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  derivedKey[i] = hashHex[i] ^ knownPrefix.charCodeAt(i);
}
console.log('Derived key:', derivedKey.toString('hex'));
console.log('Actual key: ', actualKey.subarray(0, 19).toString('hex'));
console.log('Match:', derivedKey.toString('hex') === actualKey.subarray(0, 19).toString('hex'));

if (derivedKey.toString('hex') === actualKey.subarray(0, 19).toString('hex')) {
  console.log('\n🎉🎉🎉 KEY DERIVATION FOUND! 🎉🎉🎉');
  console.log('key = hash XOR URL');
  console.log('plaintext = ciphertext XOR key = ciphertext XOR hash XOR URL');
  console.log('');
  console.log('For positions 0-18: ciphertext = header, so:');
  console.log('plaintext = header XOR hash XOR URL');
  console.log('');
  console.log('If we know the URL prefix, we can derive the key!');
}

console.log('\n=== Done ===');
