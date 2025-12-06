/**
 * Final Analysis - Finding the decryption algorithm
 * 
 * We found:
 * something = (cipher[0:19] XOR cipher[19:38]) XOR (URL[0:19] XOR URL[19:38])
 * 
 * Let's define:
 * C = cipher[0:19] XOR cipher[19:38] (known from ciphertext)
 * U = URL[0:19] XOR URL[19:38] (unknown)
 * 
 * Then: something = C XOR U
 * And: key[i] = key[i-19] XOR something[i] for i >= 19
 * 
 * For decryption:
 * URL[i] = cipher[i] XOR key[i]
 * 
 * For i < 19: key[i] = header[i] XOR URL[i]
 * For i >= 19: key[i] = key[i-19] XOR C[i-19] XOR U[i-19]
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

console.log('=== Final Analysis ===\n');

// Compute C = cipher[0:19] XOR cipher[19:38]
const C = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  C[i] = ciphertext[i] ^ ciphertext[19 + i];
}
console.log('C = cipher[0:19] XOR cipher[19:38]:', C.toString('hex'));

// Compute U = URL[0:19] XOR URL[19:38]
const U = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  U[i] = urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(19 + i);
}
console.log('U = URL[0:19] XOR URL[19:38]:', U.toString('hex'));

// Compute something = C XOR U
const something = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  something[i] = C[i] ^ U[i];
}
console.log('something = C XOR U:', something.toString('hex'));

// Verify this matches our earlier calculation
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}
const actualSomething = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  actualSomething[i] = actualKey[i] ^ actualKey[19 + i];
}
console.log('Actual something:', actualSomething.toString('hex'));
console.log('Match:', something.toString('hex') === actualSomething.toString('hex'));

// Now, the key insight:
// We need to find U without knowing URL[19:38]
// 
// But wait - we know URL[0:19] = "https://rrr.core36l" (if we know the domain)
// And we can compute C from the ciphertext
// 
// The question is: can we find U from something else?

console.log('\n=== Analyzing U ===\n');

// U = URL[0:19] XOR URL[19:38]
// URL[0:19] = "https://rrr.core36l"
// URL[19:38] = "ink.site/p267/c5/h6"

console.log('URL[0:19]:', urlFirst56.substring(0, 19));
console.log('URL[19:38]:', urlFirst56.substring(19, 38));
console.log('U as string:', U.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// U is the XOR of two URL segments
// This depends on the specific URL, so it's not constant

// However, if we know the URL structure, we might be able to predict U
// For example, if URL[19:38] always starts with "ink.site/p267/c5/h"
// Then U would be predictable

// Let me check if U is related to hash or embedId
console.log('\n=== Checking U relationships ===\n');

// U XOR hash
const UXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  UXorHash[i] = U[i] ^ hashHex[i];
}
console.log('U XOR hash:', UXorHash.toString('hex'));
console.log('As string:', UXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// U XOR C
const UXorC = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  UXorC[i] = U[i] ^ C[i];
}
console.log('U XOR C:', UXorC.toString('hex'));
console.log('This should equal something:', actualSomething.toString('hex'));
console.log('Match:', UXorC.toString('hex') === actualSomething.toString('hex'));

// So: something = U XOR C
// And: U = something XOR C

// If we knew something, we could compute U!
// And if we knew U, we could decrypt!

// The question is: where does "something" come from?

console.log('\n=== The Decryption Algorithm ===\n');

// Given:
// - ciphertext (from PAGE_DATA)
// - hash (from app.js URL)
// - URL prefix (e.g., "https://rrr.core36l")
// 
// We need to find "something" to decrypt positions 19+

// Let me check if "something" is stored in the ciphertext or derived from hash

// something XOR hash
const somethingXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  somethingXorHash[i] = actualSomething[i] ^ hashHex[i];
}
console.log('something XOR hash:', somethingXorHash.toString('hex'));
console.log('As string:', somethingXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// something XOR header
const somethingXorHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  somethingXorHeader[i] = actualSomething[i] ^ header[i];
}
console.log('something XOR header:', somethingXorHeader.toString('hex'));
console.log('As string:', somethingXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// something XOR C
console.log('something XOR C:', U.toString('hex'));
console.log('This is U!');

// So the relationship is:
// something = C XOR U
// U = something XOR C
// 
// And: key[i] = key[i-19] XOR something[i-19] for i >= 19
// 
// To decrypt:
// 1. Compute C = cipher[0:19] XOR cipher[19:38]
// 2. Find "something" (this is the unknown!)
// 3. Compute U = something XOR C
// 4. Compute key[0:19] = header XOR URL[0:19]
// 5. Compute key[19:38] = key[0:19] XOR something
// 6. Decrypt: URL[i] = cipher[i] XOR key[i]

console.log('\n=== Testing decryption with known something ===\n');

// If we know "something", we can decrypt!
// Let's verify by decrypting with the actual something

function decrypt(ciphertext, urlPrefix, something) {
  const header = ciphertext.subarray(0, 19);
  const key = Buffer.alloc(ciphertext.length);
  
  // key[0:19] = header XOR urlPrefix
  for (let i = 0; i < 19; i++) {
    key[i] = header[i] ^ urlPrefix.charCodeAt(i);
  }
  
  // key[i] = key[i-19] XOR something[i-19] for i >= 19
  for (let i = 19; i < ciphertext.length; i++) {
    key[i] = key[i - 19] ^ something[(i - 19) % 19];
  }
  
  // Decrypt
  const plaintext = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  return plaintext.toString('utf8');
}

const urlPrefix = 'https://rrr.core36l';
const decrypted = decrypt(ciphertext, urlPrefix, actualSomething);
console.log('Decrypted:', decrypted);
console.log('Expected:', urlFirst56);
console.log('Match:', decrypted === urlFirst56);

if (decrypted === urlFirst56) {
  console.log('\n🎉🎉🎉 DECRYPTION WORKS! 🎉🎉🎉');
  console.log('');
  console.log('The algorithm is:');
  console.log('1. key[0:19] = header XOR URL_prefix');
  console.log('2. key[i] = key[i-19] XOR something[(i-19) % 19] for i >= 19');
  console.log('3. URL = ciphertext XOR key');
  console.log('');
  console.log('The unknown is "something", which is:');
  console.log('something = key[0:19] XOR key[19:38]');
  console.log('          = (cipher[0:19] XOR cipher[19:38]) XOR (URL[0:19] XOR URL[19:38])');
  console.log('');
  console.log('To find "something" without knowing URL, we need to:');
  console.log('1. Find it in the JavaScript code');
  console.log('2. Or derive it from hash/embedId');
  console.log('3. Or brute-force it (19 bytes = 152 bits, too large)');
}

console.log('\n=== Done ===');
