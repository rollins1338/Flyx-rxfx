/**
 * Extract diff from ciphertext
 * 
 * We know:
 * - ciphertext[0:19] = header
 * - ciphertext[19:56] = URL[19:56] XOR key[19:56]
 * - key[i] = diff[i-19] XOR header[(i-19) % 19] for i >= 19
 * 
 * So: ciphertext[i] = URL[i] XOR diff[i-19] XOR header[(i-19) % 19] for i >= 19
 * 
 * If we XOR ciphertext[19:] with header[i%19], we get:
 * ciphertext[i] XOR header[(i-19) % 19] = URL[i] XOR diff[i-19]
 * 
 * This is still URL-dependent...
 * 
 * BUT! What if diff is actually ciphertext[19:] XOR header[i%19]?
 * Then: URL[i] = ciphertext[i] XOR header[(i-19)%19] XOR diff[i-19]
 *             = ciphertext[i] XOR header[(i-19)%19] XOR (ciphertext[i] XOR header[(i-19)%19])
 *             = 0
 * That's wrong...
 * 
 * Let me think about this more carefully.
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

console.log('=== Analyzing Encryption Structure ===\n');

// The ciphertext structure:
// [0:19]  = header (19 bytes)
// [19:56] = encrypted URL part (37 bytes)

console.log('Ciphertext structure:');
console.log('  [0:19]  header:', header.toString('hex'));
console.log('  [19:56] data:  ', ciphertext.subarray(19).toString('hex'));

// Let's see what ciphertext[19:] XOR header[i%19] gives us
const dataXorHeader = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  dataXorHeader[i] = ciphertext[19 + i] ^ header[i % 19];
}
console.log('\nciphertext[19:] XOR header[i%19]:', dataXorHeader.toString('hex'));
console.log('As string:', dataXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// And URL[19:56]
console.log('\nURL[19:56]:', Buffer.from(urlFirst56.substring(19)).toString('hex'));
console.log('As string:', urlFirst56.substring(19));

// The XOR of these two should give us something
const mystery = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  mystery[i] = dataXorHeader[i] ^ urlFirst56.charCodeAt(19 + i);
}
console.log('\n(cipher XOR header) XOR URL:', mystery.toString('hex'));
console.log('As string:', mystery.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This "mystery" is the diff!
// mystery = (ciphertext XOR header) XOR URL = key XOR header XOR URL XOR header = key XOR URL
// But key = ciphertext XOR URL, so mystery = ciphertext XOR URL XOR URL = ciphertext
// Wait, that's not right either...

// Let me recalculate:
// ciphertext[i] = URL[i] XOR key[i]
// dataXorHeader[i] = ciphertext[19+i] XOR header[i%19]
//                  = URL[19+i] XOR key[19+i] XOR header[i%19]
// mystery[i] = dataXorHeader[i] XOR URL[19+i]
//            = URL[19+i] XOR key[19+i] XOR header[i%19] XOR URL[19+i]
//            = key[19+i] XOR header[i%19]

// So mystery = key[19:] XOR header[i%19]
// And we know: key[19+i] = diff[i] XOR header[i%19]
// So: mystery[i] = diff[i] XOR header[i%19] XOR header[i%19] = diff[i]

// Therefore: mystery = diff!
console.log('\n=== Verification ===\n');
const diff = Buffer.from('e2eafa9006d351ec1ead149ac949c77a7242639373360cbe73bc005f477d92b60f2fe16693', 'hex');
console.log('Computed mystery:', mystery.toString('hex'));
console.log('Known diff:      ', diff.toString('hex'));
console.log('Match:', mystery.toString('hex') === diff.toString('hex'));

// Great! So diff = (ciphertext[19:] XOR header[i%19]) XOR URL[19:]
// But we still need URL to compute diff...

// WAIT! What if the URL has a predictable structure?
// The URL is: https://rrr.core36link.site/p267/c5/h[hash]
// The first 36 chars are: "https://rrr.core36link.site/p267/c5/"
// Then comes the hash

console.log('\n=== URL Structure Analysis ===\n');
console.log('Full URL:', knownUrl);
console.log('URL length:', knownUrl.length);

// The URL structure:
// https://rrr.core36link.site/p267/c5/h[128-char-hash]/list,[filename].m3u8
// 
// Positions 0-35: "https://rrr.core36link.site/p267/c5/"
// Position 36: "h"
// Positions 37-164: 128-char hash
// Position 165: "/"
// Positions 166-170: "list,"
// Positions 171-203: filename
// Positions 204-208: ".m3u8"

const urlParts = {
  prefix: knownUrl.substring(0, 36),  // "https://rrr.core36link.site/p267/c5/"
  h: knownUrl.substring(36, 37),       // "h"
  hash: knownUrl.substring(37, 165),   // 128-char hash
  slash: knownUrl.substring(165, 166), // "/"
  list: knownUrl.substring(166, 171),  // "list,"
  filename: knownUrl.substring(171, 203), // filename
  ext: knownUrl.substring(203),        // ".m3u8"
};

console.log('URL parts:');
console.log('  prefix:', urlParts.prefix, `(${urlParts.prefix.length} chars)`);
console.log('  h:', urlParts.h);
console.log('  hash:', urlParts.hash.substring(0, 20) + '...', `(${urlParts.hash.length} chars)`);
console.log('  slash:', urlParts.slash);
console.log('  list:', urlParts.list);
console.log('  filename:', urlParts.filename, `(${urlParts.filename.length} chars)`);
console.log('  ext:', urlParts.ext);

// The PAGE_DATA only encrypts the first 56 bytes of the URL
// That's: "https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866"
// Which is: prefix (36) + "h" (1) + first 19 chars of hash

console.log('\n=== First 56 bytes of URL ===\n');
console.log('URL[0:56]:', urlFirst56);
console.log('Breakdown:');
console.log('  [0:36]  prefix:', urlFirst56.substring(0, 36));
console.log('  [36:56] hash start:', urlFirst56.substring(36));

// So the PAGE_DATA encrypts:
// - The URL prefix (which might be constant or predictable)
// - The first 20 chars of the hash path

// If the prefix is always "https://rrr.core36link.site/p267/c5/h"
// Then we know URL[0:37] and can derive key[0:37]!

console.log('\n=== Testing with known prefix ===\n');

const knownPrefix = 'https://rrr.core36link.site/p267/c5/h';
console.log('Known prefix:', knownPrefix, `(${knownPrefix.length} chars)`);

// Derive key for positions 0-36
const keyFromPrefix = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  keyFromPrefix[i] = ciphertext[i] ^ knownPrefix.charCodeAt(i);
}
console.log('Key from prefix:', keyFromPrefix.toString('hex'));

// Now decrypt the rest using this key pattern
// For positions 37-55, we need to figure out the key

// If key[i] = header[i%19] XOR URL[i%19], then:
// key[37] = header[37%19] XOR URL[37%19] = header[18] XOR URL[18]
// But URL[18] = 'l' (from "https://rrr.core36l")

// Actually, let's check if the key repeats with period 19
console.log('\n=== Checking key periodicity ===\n');

// Derive full key from known URL
const fullKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  fullKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

// Check if key[i] = key[i % 19] for all i
let isPeriodic = true;
for (let i = 19; i < 56; i++) {
  if (fullKey[i] !== fullKey[i % 19]) {
    isPeriodic = false;
    console.log(`key[${i}] = 0x${fullKey[i].toString(16)} ≠ key[${i%19}] = 0x${fullKey[i%19].toString(16)}`);
  }
}
console.log('Key is periodic with period 19:', isPeriodic);

// The key is NOT periodic. So the encryption is more complex.

// Let me check if there's a relationship between key segments
console.log('\n=== Key segment relationships ===\n');

const keySeg0 = fullKey.subarray(0, 19);
const keySeg1 = fullKey.subarray(19, 38);
const keySeg2 = fullKey.subarray(38, 56);

console.log('keySeg0:', keySeg0.toString('hex'));
console.log('keySeg1:', keySeg1.toString('hex'));
console.log('keySeg2:', keySeg2.toString('hex'));

// keySeg0 XOR keySeg1
const seg01Xor = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  seg01Xor[i] = keySeg0[i] ^ keySeg1[i];
}
console.log('\nkeySeg0 XOR keySeg1:', seg01Xor.toString('hex'));

// This should equal URL[0:19] XOR URL[19:38]
const urlSeg01Xor = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlSeg01Xor[i] = urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(19 + i);
}
console.log('URL[0:19] XOR URL[19:38]:', urlSeg01Xor.toString('hex'));

// They should match if key[i] = f(URL[i])
console.log('Match:', seg01Xor.toString('hex') === urlSeg01Xor.toString('hex'));

// They don't match! So the key is NOT simply derived from the URL.

// The key must be derived from something else - maybe the embed ID or a server-side secret.

console.log('\n=== Conclusion ===\n');
console.log('The encryption uses a key that is NOT simply derived from the URL.');
console.log('The key must come from the server or be derived from the embed ID.');
console.log('');
console.log('To decrypt, we need to either:');
console.log('1. Find the key derivation algorithm in the JavaScript');
console.log('2. Find a way to get the key from the server');
console.log('3. Find a pattern in multiple samples');

console.log('\n=== Done ===');
