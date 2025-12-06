/**
 * Known Plaintext Attack on RapidShare Encryption
 * 
 * We have:
 * - PAGE_DATA (ciphertext): 3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4
 * - Known plaintext (HLS URL): https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8
 * 
 * With known plaintext and ciphertext, we can derive the key!
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

function urlSafeBase64Encode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

const ciphertext = urlSafeBase64Decode(pageData);
const plaintext = Buffer.from(knownUrl);

console.log('=== Known Plaintext Attack ===\n');
console.log('PAGE_DATA:', pageData);
console.log('Ciphertext length:', ciphertext.length, 'bytes');
console.log('Ciphertext hex:', ciphertext.toString('hex'));
console.log('\nKnown URL:', knownUrl);
console.log('Plaintext length:', plaintext.length, 'bytes');

// Check if lengths match
if (ciphertext.length !== plaintext.length) {
  console.log('\n⚠️  LENGTH MISMATCH!');
  console.log('Ciphertext:', ciphertext.length, 'bytes');
  console.log('Plaintext:', plaintext.length, 'bytes');
  console.log('Difference:', Math.abs(ciphertext.length - plaintext.length), 'bytes');
  
  // The URL is much longer than the ciphertext!
  // This means the PAGE_DATA is NOT the encrypted URL directly
  // It might be an encrypted hash/ID that points to the URL
}

// Let's still derive what we can
const minLen = Math.min(ciphertext.length, plaintext.length);

console.log('\n=== Deriving Key (first', minLen, 'bytes) ===\n');

const key = Buffer.alloc(minLen);
for (let i = 0; i < minLen; i++) {
  key[i] = ciphertext[i] ^ plaintext[i];
}

console.log('Derived key:', key.toString('hex'));
console.log('Key as string:', key.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if key has a repeating pattern
console.log('\n=== Checking for key patterns ===\n');

// Check for 19-byte repeat (header length)
const header = ciphertext.subarray(0, 19);
console.log('Header (first 19 bytes):', header.toString('hex'));

// Check if key repeats every 19 bytes
let repeats = true;
for (let i = 19; i < minLen; i++) {
  if (key[i] !== key[i % 19]) {
    repeats = false;
    break;
  }
}
console.log('Key repeats every 19 bytes:', repeats);

// Check key[0:19] vs key[19:38]
if (minLen >= 38) {
  const key0to19 = key.subarray(0, 19);
  const key19to38 = key.subarray(19, 38);
  console.log('key[0:19]: ', key0to19.toString('hex'));
  console.log('key[19:38]:', key19to38.toString('hex'));
  console.log('Match:', key0to19.toString('hex') === key19to38.toString('hex'));
}

// The PAGE_DATA might encode something else entirely
// Let's check what the ciphertext XOR "https://" gives us
console.log('\n=== Partial key from "https://" ===\n');

const httpsPrefix = 'https://';
const partialKey = Buffer.alloc(8);
for (let i = 0; i < 8; i++) {
  partialKey[i] = ciphertext[i] ^ httpsPrefix.charCodeAt(i);
}
console.log('Key from "https://":', partialKey.toString('hex'));
console.log('As string:', partialKey.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Try decrypting with this partial key repeated
console.log('\n=== Trying partial key decryption ===\n');

// If the key is the first 19 bytes repeated
const testKey = key.subarray(0, 19);
const decrypted = Buffer.alloc(ciphertext.length);
for (let i = 0; i < ciphertext.length; i++) {
  decrypted[i] = ciphertext[i] ^ testKey[i % testKey.length];
}
console.log('Decrypted with key[0:19]:', decrypted.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Wait - the URL is 219 bytes but ciphertext is only 56 bytes
// The PAGE_DATA must encode something shorter, like a stream ID

console.log('\n=== Analyzing URL structure ===\n');
console.log('URL:', knownUrl);

// Extract parts of the URL
const urlParts = knownUrl.split('/');
console.log('URL parts:', urlParts);

// The hash in the URL
const hashPart = urlParts[5]; // h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d
console.log('\nHash part:', hashPart);
console.log('Hash length:', hashPart.length);

// The filename
const filename = urlParts[6]; // list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8
console.log('Filename:', filename);

// Maybe PAGE_DATA decrypts to just the hash or a shorter URL
// Let's check if 56 bytes could be a base URL

// 56 bytes could be: "https://rrr.core36link.site/p267/c5/" (36 chars) + 20 more
const shortUrl = 'https://rrr.core36link.site/p267/c5/';
console.log('\nShort URL:', shortUrl);
console.log('Short URL length:', shortUrl.length);

// Try decrypting assuming plaintext is the short URL
if (shortUrl.length <= ciphertext.length) {
  const shortKey = Buffer.alloc(shortUrl.length);
  for (let i = 0; i < shortUrl.length; i++) {
    shortKey[i] = ciphertext[i] ^ shortUrl.charCodeAt(i);
  }
  console.log('Key from short URL:', shortKey.toString('hex'));
  console.log('As string:', shortKey.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));
}

// Actually, let me check what rapidshare.cc URLs look like
// The previous analysis mentioned "https://rapidshare.cc/stream/"
console.log('\n=== Checking rapidshare.cc format ===\n');

const rapidshareUrl = 'https://rapidshare.cc/stream/';
console.log('RapidShare URL prefix:', rapidshareUrl);
console.log('Length:', rapidshareUrl.length);

// 56 bytes - 29 bytes prefix = 27 bytes for hash + extension
// "XXXXXXXXXXXXXXXXXXXX.m3u8" = 25 chars
// So the full URL would be ~54-56 chars

// Let's assume the URL is: https://rapidshare.cc/stream/[22-char-hash].m3u8
// That's 29 + 22 + 5 = 56 bytes! Perfect match!

const testUrl = rapidshareUrl + 'X'.repeat(22) + '.m3u8';
console.log('Test URL format:', testUrl);
console.log('Test URL length:', testUrl.length);

// Derive key assuming this format
const rapidKey = Buffer.alloc(rapidshareUrl.length);
for (let i = 0; i < rapidshareUrl.length; i++) {
  rapidKey[i] = ciphertext[i] ^ rapidshareUrl.charCodeAt(i);
}
console.log('\nKey from rapidshare prefix:', rapidKey.toString('hex'));

// Check if this key has a pattern
console.log('\n=== Analyzing rapidshare key ===\n');

// The key should be: header XOR URL for positions 0-18
// Let's verify
for (let i = 0; i < 19; i++) {
  const expectedKey = header[i] ^ rapidshareUrl.charCodeAt(i);
  console.log(`[${i}] header=0x${header[i].toString(16).padStart(2,'0')} XOR '${rapidshareUrl[i]}'=0x${rapidshareUrl.charCodeAt(i).toString(16).padStart(2,'0')} = 0x${expectedKey.toString(16).padStart(2,'0')} | derived=0x${rapidKey[i].toString(16).padStart(2,'0')}`);
}

// Now the question is: what's the relationship between the FNAF2 URL and the PAGE_DATA?
// They might be from different sources/servers!

console.log('\n=== IMPORTANT INSIGHT ===\n');
console.log('The FNAF2 URL you provided is from core36link.site, not rapidshare.cc');
console.log('This suggests different servers return different URL formats.');
console.log('The PAGE_DATA we have might be for rapidshare.cc specifically.');
console.log('\nWe need the PAGE_DATA that corresponds to the core36link URL!');

console.log('\n=== Done ===');
