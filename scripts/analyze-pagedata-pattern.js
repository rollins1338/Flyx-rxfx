/**
 * Analyze PAGE_DATA pattern to find the full URL
 * 
 * Key finding: Headers are IDENTICAL between samples!
 * Header: df030e2cf382169ad6825734dfc193e1ebab67
 * 
 * This means the header is a CONSTANT, not video-specific!
 * 
 * The encryption is:
 * ciphertext[0:19] = header (constant)
 * ciphertext[19:56] = encrypted URL data
 * 
 * Since header is constant, we can derive the key if we know the URL prefix!
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// The constant header
const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

console.log('=== PAGE_DATA Pattern Analysis ===\n');
console.log('Constant header:', HEADER.toString('hex'));

// Sample 1: rapidshare.cc
const pd1 = urlSafeBase64Decode('3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4');
const hash1 = '2457433dff948487f3bb6d58f9db2a11';

// Sample 2: rapidairmax.site (FNAF2)
const pd2 = urlSafeBase64Decode('3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4');
const hash2 = '2457433dff868594ecbf3b15e9f22a46efd70a';
const knownUrl2 = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

console.log('\n=== Sample 1 (rapidshare.cc) ===\n');
console.log('PAGE_DATA:', pd1.toString('hex'));
console.log('App.js hash:', hash1);

// For rapidshare.cc, the URL format is: https://rapidshare.cc/stream/[hash].m3u8
// Let's try to decrypt with this assumption

const urlPrefix1 = 'https://rapidshare.cc/stream/';
console.log('Expected URL prefix:', urlPrefix1, `(${urlPrefix1.length} chars)`);

// Compute key[0:19] = header XOR URL[0:19]
const key1 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key1[i] = HEADER[i] ^ urlPrefix1.charCodeAt(i);
}
console.log('Key[0:19]:', key1.toString('hex'));

// Decrypt first 19 bytes
const decrypted1_0to19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  decrypted1_0to19[i] = pd1[i] ^ key1[i];
}
console.log('Decrypted[0:19]:', decrypted1_0to19.toString('utf8'));

// For positions 19+, we need to compute the key iteratively
// But we need to know more of the URL...

console.log('\n=== Sample 2 (rapidairmax.site - FNAF2) ===\n');
console.log('PAGE_DATA:', pd2.toString('hex'));
console.log('App.js hash:', hash2);
console.log('Known URL:', knownUrl2.substring(0, 56));

// Verify decryption with known URL
const urlPrefix2 = knownUrl2.substring(0, 56);
const key2 = Buffer.alloc(56);

// Compute full key
for (let i = 0; i < 56; i++) {
  key2[i] = pd2[i] ^ urlPrefix2.charCodeAt(i);
}
console.log('Full key:', key2.toString('hex'));

// The key for positions 0-18 should be header XOR URL[0:19]
const expectedKey0to19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  expectedKey0to19[i] = HEADER[i] ^ urlPrefix2.charCodeAt(i);
}
console.log('Expected key[0:19]:', expectedKey0to19.toString('hex'));
console.log('Actual key[0:19]:  ', key2.subarray(0, 19).toString('hex'));
console.log('Match:', expectedKey0to19.toString('hex') === key2.subarray(0, 19).toString('hex'));

// Now let's see if we can find a pattern in the encrypted data (positions 19-55)
console.log('\n=== Analyzing encrypted data (positions 19-55) ===\n');

const encrypted1 = pd1.subarray(19, 56);
const encrypted2 = pd2.subarray(19, 56);

console.log('Encrypted1:', encrypted1.toString('hex'));
console.log('Encrypted2:', encrypted2.toString('hex'));

// XOR the encrypted parts
const encryptedXor = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  encryptedXor[i] = encrypted1[i] ^ encrypted2[i];
}
console.log('Encrypted1 XOR Encrypted2:', encryptedXor.toString('hex'));

// This XOR should equal URL1[19:56] XOR URL2[19:56] XOR key1[19:56] XOR key2[19:56]
// If the keys are the same, it would just be URL1 XOR URL2

// Let's check if the encrypted data contains the URL hash
console.log('\n=== Checking if encrypted data contains URL info ===\n');

// The URL hash for FNAF2 starts with: 6a90f70b8d237f94866
// Let's see if this appears in the encrypted data

const urlHashStart = '6a90f70b8d237f94866';
console.log('URL hash start:', urlHashStart);

// Decrypt positions 37-55 (where the hash should be)
// URL[37:56] = "6a90f70b8d237f94866"
const url37to56 = knownUrl2.substring(37, 56);
console.log('URL[37:56]:', url37to56);

// The encrypted data at positions 37-55 (relative to full ciphertext)
// is at positions 18-36 in the encrypted part
const enc18to36 = encrypted2.subarray(18, 37);
console.log('Encrypted[37:56]:', enc18to36.toString('hex'));

// Key[37:56]
const key37to56 = key2.subarray(37, 56);
console.log('Key[37:56]:', key37to56.toString('hex'));

// Verify: encrypted XOR key = URL
const decrypted37to56 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  decrypted37to56[i] = enc18to36[i] ^ key37to56[i];
}
console.log('Decrypted[37:56]:', decrypted37to56.toString('utf8'));
console.log('Expected:', url37to56);
console.log('Match:', decrypted37to56.toString('utf8') === url37to56);

// Now let's see if we can derive the URL hash from the PAGE_DATA
console.log('\n=== Deriving URL from PAGE_DATA ===\n');

// We know:
// 1. Header is constant: df030e2cf382169ad6825734dfc193e1ebab67
// 2. URL format: https://[domain]/[path]/h[hash]/list,[filename].m3u8
// 3. For rapidairmax.site: domain = rrr.core36link.site, path = /p267/c5/

// The challenge: how do we know the domain and path?
// Hypothesis: they might be encoded in the app.js hash!

console.log('App.js hash (sample 2):', hash2);
console.log('Hash length:', hash2.length, 'chars =', hash2.length / 2, 'bytes');

// The hash is 19 bytes, same as header!
// Let's see if hash XOR header gives us something useful

const hashHex2 = Buffer.from(hash2, 'hex');
const hashXorHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  hashXorHeader[i] = hashHex2[i] ^ HEADER[i];
}
console.log('Hash XOR Header:', hashXorHeader.toString('hex'));
console.log('As string:', hashXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This gives: .TM.....:=l!63...|m
// Not the URL prefix directly

// Let's check if the key is related to the hash
console.log('\n=== Key vs Hash relationship ===\n');

// Key[0:19] for sample 2
const key2_0to19 = key2.subarray(0, 19);
console.log('Key[0:19]:', key2_0to19.toString('hex'));
console.log('Hash:', hashHex2.toString('hex'));

// Key XOR Hash
const keyXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  keyXorHash[i] = key2_0to19[i] ^ hashHex2[i];
}
console.log('Key XOR Hash:', keyXorHash.toString('hex'));
console.log('As string:', keyXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This should be: (header XOR URL) XOR hash = header XOR URL XOR hash
// Let's verify
const headerXorUrlXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXorUrlXorHash[i] = HEADER[i] ^ urlPrefix2.charCodeAt(i) ^ hashHex2[i];
}
console.log('Header XOR URL XOR Hash:', headerXorUrlXorHash.toString('hex'));
console.log('Match:', keyXorHash.toString('hex') === headerXorUrlXorHash.toString('hex'));

// So: Key XOR Hash = Header XOR URL XOR Hash
// Therefore: Key = Header XOR URL
// And: URL = Header XOR Key

// If we knew the key, we could get the URL!
// The key might be derivable from the hash...

console.log('\n=== Testing: Key = Hash XOR constant ===\n');

// If Key = Hash XOR constant, then:
// constant = Key XOR Hash = Header XOR URL XOR Hash

// For sample 2:
const constant2 = keyXorHash;
console.log('Constant (Key XOR Hash):', constant2.toString('hex'));

// If this constant is the same for all videos, we can decrypt!
// Let's check if it's related to the URL prefix

// constant = Header XOR URL XOR Hash
// URL = Header XOR Hash XOR constant

// If constant = 0, then URL = Header XOR Hash
// Let's check
const urlFromHeaderXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlFromHeaderXorHash[i] = HEADER[i] ^ hashHex2[i];
}
console.log('Header XOR Hash:', urlFromHeaderXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));
console.log('Expected URL[0:19]:', urlPrefix2.substring(0, 19));

// They don't match, so constant ≠ 0

// The constant might be the URL prefix itself!
// constant = Header XOR URL XOR Hash
// If constant = URL, then: URL = Header XOR URL XOR Hash
// This means: 0 = Header XOR Hash, which is false

// Let me try: constant = "https://rrr.core36l" (the URL prefix)
const urlPrefixBytes = Buffer.from(urlPrefix2.substring(0, 19));
console.log('\nURL prefix bytes:', urlPrefixBytes.toString('hex'));
console.log('Constant:', constant2.toString('hex'));
console.log('Match:', urlPrefixBytes.toString('hex') === constant2.toString('hex'));

// They don't match directly.

// The constant is: 932039617f3ebc21484f1e0f555ccbc2374a01
// This is the "stage2Key" we found earlier!

console.log('\n=== Conclusion ===\n');
console.log('The constant (Key XOR Hash) is:', constant2.toString('hex'));
console.log('This is the "stage2Key" from our earlier analysis.');
console.log('');
console.log('To decrypt, we need:');
console.log('1. The app.js hash (from the embed page)');
console.log('2. The stage2Key (which depends on the URL prefix)');
console.log('');
console.log('The stage2Key might be:');
console.log('- Hardcoded in the app.js');
console.log('- Derived from the embed domain');
console.log('- Or we need to brute-force the URL prefix');

console.log('\n=== Done ===');
