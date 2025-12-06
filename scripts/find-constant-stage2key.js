/**
 * Find the constant part of stage2Key
 * 
 * We found that stage2Key[0:8] is constant for all URL prefixes!
 * This is because URL[0:8] = "https://" is always the same.
 * 
 * stage2Key[i] = header[i] XOR URL[i] XOR hash[i]
 * For i < 8: URL[i] = "https://"[i], which is constant
 * So stage2Key[0:8] = header[0:8] XOR "https://" XOR hash[0:8]
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

console.log('=== Finding Constant Stage2Key ===\n');

// Compute stage2Key[0:8] using "https://"
const httpsPrefix = 'https://';
const stage2Key0to8 = Buffer.alloc(8);
for (let i = 0; i < 8; i++) {
  stage2Key0to8[i] = header[i] ^ httpsPrefix.charCodeAt(i) ^ hashHex[i];
}
console.log('stage2Key[0:8] (computed):', stage2Key0to8.toString('hex'));

// This is constant! We can use it to verify our decryption.

// Now, the question is: what about stage2Key[8:19]?
// This depends on the domain, which varies.

// But wait - maybe the domain is predictable!
// Let's check if there's a pattern.

console.log('\n=== Analyzing domain patterns ===\n');

// Known domains:
// - rapidshare.cc
// - rapidairmax.site
// - rrr.core36link.site

// The HLS URL domain might be derived from the embed domain
// or it might be stored in the app.js hash

// Let's check if the app.js hash encodes the domain
console.log('App.js hash:', appJsHash);
console.log('Hash as hex:', hashHex.toString('hex'));

// The hash is 19 bytes, same as header
// Maybe hash XOR header = domain info?

const hashXorHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  hashXorHeader[i] = hashHex[i] ^ header[i];
}
console.log('hash XOR header:', hashXorHeader.toString('hex'));
console.log('As string:', hashXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This gives: .TM.....:=l!63...|m
// Not obviously the domain

// Let me try a different approach: brute-force the domain
console.log('\n=== Brute-forcing domain ===\n');

// We know:
// 1. stage2Key[0:8] = 932039617f3ebc21 (constant for "https://")
// 2. URL = header XOR hash XOR stage2Key

// For positions 8-18:
// URL[i] = header[i] XOR hash[i] XOR stage2Key[i]

// If we assume stage2Key[8:19] is constant (or predictable), we can compute URL[8:19]

// Let's try assuming stage2Key is all zeros after position 8
const testStage2Key = Buffer.alloc(19);
stage2Key0to8.copy(testStage2Key, 0);
// Leave positions 8-18 as zeros

const testUrl = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  testUrl[i] = header[i] ^ hashHex[i] ^ testStage2Key[i];
}
console.log('URL with stage2Key[8:19]=0:', testUrl.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// That's not right. Let me try the actual stage2Key
const actualStage2Key = Buffer.from('932039617f3ebc21484f1e0f555ccbc2374a01', 'hex');
const actualUrl = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  actualUrl[i] = header[i] ^ hashHex[i] ^ actualStage2Key[i];
}
console.log('URL with actual stage2Key:', actualUrl.toString('utf8'));

// Now let's see if we can derive stage2Key[8:19] from something known
console.log('\n=== Deriving stage2Key[8:19] ===\n');

// stage2Key[i] = header[i] XOR URL[i] XOR hash[i]
// For i in 8-18: URL[i] = domain part

// The domain is "rrr.core36l" (positions 8-18)
// Let's compute stage2Key[8:19] for this domain

const domain = 'rrr.core36l';
const stage2Key8to19 = Buffer.alloc(11);
for (let i = 0; i < 11; i++) {
  stage2Key8to19[i] = header[8 + i] ^ domain.charCodeAt(i) ^ hashHex[8 + i];
}
console.log('stage2Key[8:19] for "rrr.core36l":', stage2Key8to19.toString('hex'));
console.log('Actual stage2Key[8:19]:', actualStage2Key.subarray(8, 19).toString('hex'));
console.log('Match:', stage2Key8to19.toString('hex') === actualStage2Key.subarray(8, 19).toString('hex'));

// So stage2Key depends on the domain. We need to know the domain to decrypt.

// But maybe the domain is encoded somewhere!
// Let's check if stage2Key[8:19] is related to the embed ID

const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);

console.log('\n=== Checking embed ID relationship ===\n');
console.log('Embed ID:', decodedEmbedId.toString('hex'));
console.log('stage2Key[8:19]:', stage2Key8to19.toString('hex'));

// stage2Key[8:19] XOR embedId[8:19]
const s2kXorEmbed = Buffer.alloc(11);
for (let i = 0; i < 11; i++) {
  s2kXorEmbed[i] = stage2Key8to19[i] ^ decodedEmbedId[8 + i];
}
console.log('stage2Key[8:19] XOR embedId[8:19]:', s2kXorEmbed.toString('hex'));
console.log('As string:', s2kXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Let me try a completely different approach:
// What if the decryption doesn't need stage2Key at all?
// What if we can decrypt directly using header, hash, and some constant?

console.log('\n=== Testing direct decryption ===\n');

// The decryption might be:
// URL[i] = cipher[i] XOR hash[i % 19] XOR constant[i]

// For positions 0-18: cipher = header
// URL[i] = header[i] XOR hash[i] XOR constant[i]

// If constant = stage2Key, then this works.
// But stage2Key depends on URL...

// Unless constant is derived from something else!

// Let me check if constant = embedId
const decryptWithEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  decryptWithEmbed[i] = header[i] ^ hashHex[i] ^ decodedEmbedId[i];
}
console.log('header XOR hash XOR embedId:', decryptWithEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Not the URL. Let me try other combinations.

// constant = header?
const decryptWithHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  decryptWithHeader[i] = header[i] ^ hashHex[i] ^ header[i];
}
console.log('header XOR hash XOR header:', decryptWithHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This gives hash, not URL.

// constant = 0?
const decryptWithZero = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  decryptWithZero[i] = header[i] ^ hashHex[i];
}
console.log('header XOR hash:', decryptWithZero.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This gives: .TM.....:=l!63...|m

// The key insight: we need stage2Key, and stage2Key depends on the URL.
// This is a chicken-and-egg problem.

// HOWEVER: the URL structure is predictable!
// URL = "https://" + domain + path + hash + filename + ".m3u8"

// If we can figure out the domain, we can decrypt!

console.log('\n=== Possible solution ===\n');
console.log('The decryption requires knowing the HLS domain.');
console.log('The domain might be:');
console.log('1. Hardcoded in the app.js');
console.log('2. Derived from the embed domain');
console.log('3. Stored in a separate API response');
console.log('');
console.log('For FNAF2 on rapidairmax.site, the HLS domain is rrr.core36link.site');
console.log('This mapping might be constant or configurable.');

console.log('\n=== Done ===');
