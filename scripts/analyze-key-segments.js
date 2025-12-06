/**
 * Analyze key segments to find the pattern
 * 
 * We know:
 * - key[0:19] = header XOR URL[0:19] (verified)
 * - key[19:56] = ??? (need to find pattern)
 * 
 * The full derived key is:
 * b7777a5c80b839b5a4f0251abcaee184d89d0b3de9f4bcf5514776c82f43ae1688549b99e9044c70382
 * 04df1aa9a89c52aa669cebc008d38
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

const ciphertext = urlSafeBase64Decode(pageData);
const header = ciphertext.subarray(0, 19);
const urlFirst56 = knownUrl.substring(0, 56);

// Derive the full key
const key = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  key[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

console.log('=== Key Segment Analysis ===\n');

// Split key into 19-byte segments
const seg0 = key.subarray(0, 19);
const seg1 = key.subarray(19, 38);
const seg2 = key.subarray(38, 56);

console.log('Key segment 0 (0-18): ', seg0.toString('hex'));
console.log('Key segment 1 (19-37):', seg1.toString('hex'));
console.log('Key segment 2 (38-55):', seg2.toString('hex'));

// Check relationships between segments
console.log('\n=== Segment Relationships ===\n');

// seg0 XOR seg1
const seg0XorSeg1 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  seg0XorSeg1[i] = seg0[i] ^ seg1[i];
}
console.log('seg0 XOR seg1:', seg0XorSeg1.toString('hex'));
console.log('As string:', seg0XorSeg1.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// seg1 XOR seg2 (partial)
const seg1XorSeg2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  seg1XorSeg2[i] = seg1[i] ^ seg2[i];
}
console.log('seg1 XOR seg2:', seg1XorSeg2.toString('hex'));

// Check if seg0 XOR seg1 = URL[0:19] XOR URL[19:38]
const url0to19 = urlFirst56.substring(0, 19);
const url19to38 = urlFirst56.substring(19, 38);
const urlXor = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlXor[i] = url0to19.charCodeAt(i) ^ url19to38.charCodeAt(i);
}
console.log('\nURL[0:19] XOR URL[19:38]:', urlXor.toString('hex'));
console.log('Match seg0 XOR seg1:', urlXor.toString('hex') === seg0XorSeg1.toString('hex'));

// Check if key[i] = key[i-19] XOR something
console.log('\n=== Key[i] vs Key[i-19] ===\n');

for (let i = 19; i < 38; i++) {
  const diff = key[i] ^ key[i - 19];
  const urlDiff = urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(i - 19);
  console.log(`key[${i}] XOR key[${i-19}] = 0x${diff.toString(16).padStart(2,'0')} | URL[${i}] XOR URL[${i-19}] = 0x${urlDiff.toString(16).padStart(2,'0')} ('${urlFirst56[i]}' XOR '${urlFirst56[i-19]}')`);
}

// The key difference should equal the URL difference!
// key[i] XOR key[i-19] = URL[i] XOR URL[i-19]
// This means: key[i] = key[i-19] XOR URL[i] XOR URL[i-19]

console.log('\n=== Verifying: key[i] = key[i-19] XOR URL[i] XOR URL[i-19] ===\n');

let formulaWorks = true;
for (let i = 19; i < 56; i++) {
  const expected = key[i - 19] ^ urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(i - 19);
  if (key[i] !== expected) {
    formulaWorks = false;
    console.log(`Mismatch at ${i}: key=${key[i].toString(16)} expected=${expected.toString(16)}`);
  }
}
console.log('Formula works:', formulaWorks);

if (formulaWorks) {
  console.log('\n🎉 KEY DERIVATION FORMULA FOUND!');
  console.log('key[i] = key[i-19] XOR URL[i] XOR URL[i-19] for i >= 19');
  console.log('key[i] = header[i] XOR URL[i] for i < 19');
  console.log('\nBut this still requires knowing the URL...');
}

// Wait - let me think about this differently
// If key[i] = key[i-19] XOR URL[i] XOR URL[i-19]
// Then: ciphertext[i] = plaintext[i] XOR key[i]
//                     = URL[i] XOR key[i-19] XOR URL[i] XOR URL[i-19]
//                     = key[i-19] XOR URL[i-19]
//                     = header[i-19] XOR URL[i-19] XOR URL[i-19]  (for i in 19-37)
//                     = header[i-19]

// So ciphertext[19:38] should equal header[0:19]!
console.log('\n=== Checking ciphertext[19:38] vs header ===\n');

const cipher19to38 = ciphertext.subarray(19, 38);
console.log('ciphertext[19:38]:', cipher19to38.toString('hex'));
console.log('header[0:19]:     ', header.toString('hex'));
console.log('Match:', cipher19to38.toString('hex') === header.toString('hex'));

// They don't match! So the formula is wrong, or there's something else going on.

// Let me try a different approach: what if the key is derived from the ciphertext itself?
console.log('\n=== Alternative: Key derived from ciphertext ===\n');

// For positions 0-18: key[i] = header[i] XOR URL[i]
// For positions 19+: key[i] = ciphertext[i-19] XOR URL[i] ???

// Let's check: key[19] = ciphertext[0] XOR URL[19]?
for (let i = 19; i < 38; i++) {
  const testKey = ciphertext[i - 19] ^ urlFirst56.charCodeAt(i);
  console.log(`key[${i}]=0x${key[i].toString(16).padStart(2,'0')} vs cipher[${i-19}] XOR URL[${i}]=0x${testKey.toString(16).padStart(2,'0')} ${key[i] === testKey ? '✓' : '✗'}`);
}

// Let me try: key[i] = ciphertext[i] XOR something
console.log('\n=== Key[i] vs Ciphertext[i] ===\n');

for (let i = 0; i < 56; i++) {
  const diff = key[i] ^ ciphertext[i];
  console.log(`[${i}] key XOR cipher = 0x${diff.toString(16).padStart(2,'0')} = '${String.fromCharCode(diff)}' | URL[${i}]='${urlFirst56[i]}'`);
}

// key XOR cipher = plaintext = URL!
// So key[i] = ciphertext[i] XOR URL[i]
// This is just the definition of XOR encryption...

// The real question is: how do we derive the key WITHOUT knowing the URL?
// The key must be derived from something we know: header, embed ID, etc.

console.log('\n=== Looking for key source ===\n');

// The embed ID
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);

console.log('Embed ID:', decodedEmbedId.toString('hex'));
console.log('Key[0:19]:', seg0.toString('hex'));

// key XOR embedId
const keyXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  keyXorEmbed[i] = seg0[i] ^ decodedEmbedId[i];
}
console.log('key XOR embedId:', keyXorEmbed.toString('hex'));
console.log('As string:', keyXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// header XOR embedId
const headerXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXorEmbed[i] = header[i] ^ decodedEmbedId[i];
}
console.log('header XOR embedId:', headerXorEmbed.toString('hex'));
console.log('As string:', headerXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if header XOR embedId = URL[0:19]
console.log('\nURL[0:19]:', Buffer.from(url0to19).toString('hex'));
console.log('header XOR embedId = URL?:', headerXorEmbed.toString('hex') === Buffer.from(url0to19).toString('hex'));

// If header XOR embedId = URL, then:
// key = header XOR URL = header XOR (header XOR embedId) = embedId!

console.log('\n=== Testing: key = embedId ===\n');

const decryptedWithEmbed = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  decryptedWithEmbed[i] = ciphertext[i] ^ decodedEmbedId[i % 19];
}
console.log('Decrypted with embedId:', decryptedWithEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

console.log('\n=== Done ===');
