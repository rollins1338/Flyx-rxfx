/**
 * Analyze the Stage 2 key pattern
 * 
 * Stage 2 key segments:
 *   [0:19]:  932039617f3ebc21484f1e0f555ccbc2374a01
 *   [19:38]: 19beb7810ad7c2e2249078bbff7a7edd763e0e
 *   [38:56]: 68277b1db2772f0e657a11b3803c964662ef
 * 
 * This is: (cipher XOR hash) XOR URL
 *        = key XOR hash (since cipher = URL XOR key)
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

// Derive actual key
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

// Stage 2 key = key XOR hash (repeated)
const stage2Key = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  stage2Key[i] = actualKey[i] ^ hashHex[i % 19];
}

console.log('=== Analyzing Stage 2 Key ===\n');
console.log('Stage 2 key:', stage2Key.toString('hex'));

// Split into 19-byte segments
const seg0 = stage2Key.subarray(0, 19);
const seg1 = stage2Key.subarray(19, 38);
const seg2 = stage2Key.subarray(38, 56);

console.log('\nSegments:');
console.log('  [0:19]: ', seg0.toString('hex'));
console.log('  [19:38]:', seg1.toString('hex'));
console.log('  [38:56]:', seg2.toString('hex'));

// Check relationships between segments
console.log('\n=== Segment relationships ===\n');

// seg0 XOR seg1
const seg01 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  seg01[i] = seg0[i] ^ seg1[i];
}
console.log('seg0 XOR seg1:', seg01.toString('hex'));
console.log('As string:', seg01.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// seg1 XOR seg2 (partial)
const seg12 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  seg12[i] = seg1[i] ^ seg2[i];
}
console.log('seg1 XOR seg2:', seg12.toString('hex'));

// Check if seg0 XOR seg1 = URL[0:19] XOR URL[19:38]
const url0to19 = urlFirst56.substring(0, 19);
const url19to38 = urlFirst56.substring(19, 38);
const urlXor = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlXor[i] = url0to19.charCodeAt(i) ^ url19to38.charCodeAt(i);
}
console.log('\nURL[0:19] XOR URL[19:38]:', urlXor.toString('hex'));
console.log('Match seg0 XOR seg1:', urlXor.toString('hex') === seg01.toString('hex'));

// The stage2Key is: key XOR hash
// key[i] = header[i % 19] XOR URL[i] (approximately)
// So stage2Key[i] = header[i % 19] XOR URL[i] XOR hash[i % 19]

// For positions 0-18:
// stage2Key[i] = header[i] XOR URL[i] XOR hash[i]
// Since ciphertext[0:19] = header:
// stage2Key[i] = ciphertext[i] XOR URL[i] XOR hash[i]
//              = (URL[i] XOR key[i]) XOR URL[i] XOR hash[i]
//              = key[i] XOR hash[i]

// This is consistent with our definition.

// The question is: can we derive stage2Key without knowing URL?
// stage2Key = key XOR hash
// And key = header XOR URL (for positions 0-18)
// So stage2Key = header XOR URL XOR hash

// If we knew stage2Key, we could compute:
// URL = header XOR hash XOR stage2Key

console.log('\n=== Testing: URL = header XOR hash XOR stage2Key ===\n');

const testUrl = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  testUrl[i] = header[i] ^ hashHex[i] ^ seg0[i];
}
console.log('header XOR hash XOR stage2Key[0:19]:', testUrl.toString('utf8'));
console.log('Expected URL[0:19]:', url0to19);
console.log('Match:', testUrl.toString('utf8') === url0to19);

// So if we can find stage2Key, we can decrypt!
// But stage2Key = key XOR hash, and key depends on URL...

// Let me check if stage2Key has a predictable pattern
console.log('\n=== Checking stage2Key pattern ===\n');

// stage2Key[0:19] = key[0:19] XOR hash
//                 = (header XOR URL[0:19]) XOR hash
//                 = header XOR URL[0:19] XOR hash

// For the URL "https://rrr.core36l":
// stage2Key[0:19] = header XOR "https://rrr.core36l" XOR hash

// Let's compute this for different URL prefixes
const prefixes = [
  'https://rrr.core36l',
  'https://rapidshare.',
  'https://rapidairmax',
  'https://core36link.',
];

console.log('Stage 2 key for different prefixes:');
prefixes.forEach(prefix => {
  const s2k = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    s2k[i] = header[i] ^ prefix.charCodeAt(i) ^ hashHex[i];
  }
  console.log(`  ${prefix}: ${s2k.toString('hex')}`);
});

console.log('\nActual stage2Key[0:19]:', seg0.toString('hex'));

// The actual stage2Key matches "https://rrr.core36l"!
// So if we know the URL prefix, we can verify our decryption.

// But how do we know the URL prefix?
// It might be derived from the embed domain or stored somewhere.

console.log('\n=== Checking if stage2Key is stored in ciphertext ===\n');

// The ciphertext is 56 bytes
// First 19 bytes = header
// Remaining 37 bytes = ???

// Let's check if ciphertext[19:] contains stage2Key information
const cipher19plus = ciphertext.subarray(19);
console.log('ciphertext[19:]:', cipher19plus.toString('hex'));
console.log('stage2Key[19:]:', stage2Key.subarray(19).toString('hex'));

// XOR them
const cipherXorS2k = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  cipherXorS2k[i] = cipher19plus[i] ^ stage2Key[19 + i];
}
console.log('cipher[19:] XOR stage2Key[19:]:', cipherXorS2k.toString('hex'));
console.log('As string:', cipherXorS2k.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This should be URL[19:56] XOR hash[i%19] (since cipher = URL XOR key and stage2Key = key XOR hash)
// cipher XOR stage2Key = (URL XOR key) XOR (key XOR hash) = URL XOR hash

const urlXorHash = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  urlXorHash[i] = urlFirst56.charCodeAt(19 + i) ^ hashHex[(19 + i) % 19];
}
console.log('URL[19:] XOR hash:', urlXorHash.toString('hex'));
console.log('Match:', cipherXorS2k.toString('hex') === urlXorHash.toString('hex'));

// So cipher[19:] XOR stage2Key[19:] = URL[19:] XOR hash
// This means: URL[19:] = cipher[19:] XOR stage2Key[19:] XOR hash

// If we knew stage2Key[19:], we could decrypt URL[19:]!

console.log('\n=== Summary ===\n');
console.log('Decryption algorithm:');
console.log('1. stage2Key = key XOR hash');
console.log('2. URL[i] = header[i] XOR hash[i] XOR stage2Key[i] (for i < 19)');
console.log('3. URL[i] = cipher[i] XOR stage2Key[i] XOR hash[i % 19] (for i >= 19)');
console.log('');
console.log('The challenge: finding stage2Key without knowing URL');
console.log('');
console.log('Possible approaches:');
console.log('- stage2Key might be constant for all videos');
console.log('- stage2Key might be derived from embed ID');
console.log('- stage2Key might be stored in the app.js');

console.log('\n=== Done ===');
