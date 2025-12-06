/**
 * Test if the app.js hash is the decryption key
 * 
 * We have:
 * - PAGE_DATA: 3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4
 * - Known URL: https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8
 * - App.js hash: 2457433dff868594ecbf3b15e9f22a46efd70a
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
const urlFirst56 = knownUrl.substring(0, 56);

console.log('=== Testing App.js Hash as Key ===\n');
console.log('App.js hash:', appJsHash);
console.log('Hash length:', appJsHash.length);

// Derive the actual key from known plaintext
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}
console.log('\nActual key:', actualKey.toString('hex'));

// Try app.js hash as hex key
console.log('\n=== Testing hash as hex key ===\n');

const hashAsHex = Buffer.from(appJsHash, 'hex');
console.log('Hash as hex:', hashAsHex.toString('hex'));
console.log('Hash hex length:', hashAsHex.length);

// Compare with actual key
console.log('\nComparing with actual key:');
console.log('Actual key[0:20]:', actualKey.subarray(0, 20).toString('hex'));
console.log('Hash hex[0:20]:  ', hashAsHex.subarray(0, 20).toString('hex'));

// Try decrypting with hash as key
const decryptedWithHash = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  decryptedWithHash[i] = ciphertext[i] ^ hashAsHex[i % hashAsHex.length];
}
console.log('\nDecrypted with hash:', decryptedWithHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Try hash as ASCII key
console.log('\n=== Testing hash as ASCII key ===\n');

const hashAsAscii = Buffer.from(appJsHash);
console.log('Hash as ASCII:', hashAsAscii.toString('hex'));
console.log('Hash ASCII length:', hashAsAscii.length);

const decryptedWithAscii = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  decryptedWithAscii[i] = ciphertext[i] ^ hashAsAscii[i % hashAsAscii.length];
}
console.log('Decrypted with ASCII hash:', decryptedWithAscii.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if actual key XOR hash gives something meaningful
console.log('\n=== Actual key XOR hash ===\n');

const keyXorHash = Buffer.alloc(20);
for (let i = 0; i < 20; i++) {
  keyXorHash[i] = actualKey[i] ^ hashAsHex[i];
}
console.log('Key XOR hash hex:', keyXorHash.toString('hex'));
console.log('As string:', keyXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if it's the URL
console.log('URL[0:20]:', Buffer.from(urlFirst56.substring(0, 20)).toString('hex'));

// Maybe the key is derived from hash + something
console.log('\n=== Testing hash + header combinations ===\n');

const header = ciphertext.subarray(0, 19);

// hash XOR header
const hashXorHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  hashXorHeader[i] = hashAsHex[i] ^ header[i];
}
console.log('Hash XOR header:', hashXorHeader.toString('hex'));
console.log('As string:', hashXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Decrypt with hash XOR header as key
const decryptedWithHashHeader = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  decryptedWithHashHeader[i] = ciphertext[i] ^ hashXorHeader[i % 19];
}
console.log('Decrypted with hash XOR header:', decryptedWithHashHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Try: key = hash, then XOR with header
console.log('\n=== Testing: decrypt = cipher XOR hash XOR header ===\n');

const decryptedTriple = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  decryptedTriple[i] = ciphertext[i] ^ hashAsHex[i % 20] ^ header[i % 19];
}
console.log('Decrypted (cipher XOR hash XOR header):', decryptedTriple.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// The actual key might be: header XOR URL
// And we need to find how URL relates to hash

console.log('\n=== Checking URL vs hash relationship ===\n');

// The URL contains a hash: h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d
// The app.js hash is: 2457433dff868594ecbf3b15e9f22a46efd70a

// Are they related?
const urlHash = 'h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d';
console.log('URL hash:', urlHash);
console.log('URL hash length:', urlHash.length);
console.log('App.js hash:', appJsHash);
console.log('App.js hash length:', appJsHash.length);

// XOR first 40 chars
const urlHashFirst40 = urlHash.substring(0, 40);
const xorHashes = Buffer.alloc(40);
for (let i = 0; i < 40; i++) {
  xorHashes[i] = urlHashFirst40.charCodeAt(i) ^ appJsHash.charCodeAt(i);
}
console.log('\nURL hash XOR app.js hash:', xorHashes.toString('hex'));
console.log('As string:', xorHashes.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

console.log('\n=== Done ===');
