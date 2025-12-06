/**
 * Find the key source for RapidShare decryption
 * 
 * We have the full derived key:
 * b7777a5c80b839b5a4f0251abcaee184d89d0b3de9f4bcf5514776c82f43ae1688549b99e9044c70382
 * 04df1aa9a89c52aa669cebc008d38
 * 
 * The key must come from somewhere - let's find it!
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

console.log('=== Finding Key Source ===\n');
console.log('Full key:', key.toString('hex'));
console.log('Key length:', key.length);

// The key might be:
// 1. A hash of something
// 2. Derived from the embed page
// 3. A constant XORed with something

// Let's check if the key is related to the URL itself
console.log('\n=== Key vs URL relationship ===\n');

// Check if key[i] = f(URL[i])
// For example: key[i] = URL[i] XOR constant
for (let c = 0; c < 256; c++) {
  let match = true;
  for (let i = 0; i < 56; i++) {
    if (key[i] !== (urlFirst56.charCodeAt(i) ^ c)) {
      match = false;
      break;
    }
  }
  if (match) {
    console.log(`Key = URL XOR 0x${c.toString(16)}`);
  }
}

// Check if key is URL with some transformation
// key[i] = URL[i] + offset (mod 256)
for (let offset = 1; offset < 256; offset++) {
  let match = true;
  for (let i = 0; i < 56; i++) {
    if (key[i] !== ((urlFirst56.charCodeAt(i) + offset) & 0xff)) {
      match = false;
      break;
    }
  }
  if (match) {
    console.log(`Key = URL + ${offset} (mod 256)`);
  }
}

// The key might be derived from the ciphertext in a complex way
console.log('\n=== Analyzing key structure ===\n');

// Check if key has any repeating patterns
for (let period = 1; period <= 28; period++) {
  let repeats = true;
  for (let i = period; i < key.length; i++) {
    if (key[i] !== key[i % period]) {
      repeats = false;
      break;
    }
  }
  if (repeats) {
    console.log(`Key repeats with period ${period}`);
  }
}

// Check byte frequency in key
const freq = new Array(256).fill(0);
for (let i = 0; i < key.length; i++) {
  freq[key[i]]++;
}
console.log('\nKey byte frequency (non-zero):');
for (let i = 0; i < 256; i++) {
  if (freq[i] > 1) {
    console.log(`  0x${i.toString(16).padStart(2,'0')}: ${freq[i]} times`);
  }
}

// The key might be a hash
const crypto = require('crypto');

console.log('\n=== Checking if key is a hash ===\n');

// Try various inputs
const hashInputs = [
  pageData,
  knownUrl,
  urlFirst56,
  '2MvvbnGoWS2JcOLzFLpK7RXpCQ', // embed ID
  header.toString('hex'),
  ciphertext.toString('hex'),
];

for (const input of hashInputs) {
  const md5 = crypto.createHash('md5').update(input).digest();
  const sha1 = crypto.createHash('sha1').update(input).digest();
  const sha256 = crypto.createHash('sha256').update(input).digest();
  
  // Check if key starts with any hash
  if (key.subarray(0, 16).toString('hex') === md5.toString('hex')) {
    console.log(`Key starts with MD5(${input.substring(0, 30)}...)`);
  }
  if (key.subarray(0, 20).toString('hex') === sha1.toString('hex')) {
    console.log(`Key starts with SHA1(${input.substring(0, 30)}...)`);
  }
  if (key.subarray(0, 32).toString('hex') === sha256.subarray(0, 32).toString('hex')) {
    console.log(`Key starts with SHA256(${input.substring(0, 30)}...)`);
  }
}

// The key might be XOR of multiple things
console.log('\n=== Key as XOR combination ===\n');

// key = header XOR something
// something = key XOR header (repeated)
const keyXorHeader = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  keyXorHeader[i] = key[i] ^ header[i % 19];
}
console.log('key XOR header[i%19]:', keyXorHeader.toString('hex'));
console.log('As string:', keyXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This should be the URL!
console.log('URL first 56:', Buffer.from(urlFirst56).toString('hex'));
console.log('Match:', keyXorHeader.toString('hex') === Buffer.from(urlFirst56).toString('hex'));

// Wait! key XOR header = URL means key = header XOR URL
// But we derived key = ciphertext XOR URL
// So: header XOR URL = ciphertext XOR URL
// Therefore: header = ciphertext (for positions 0-18)

// Let's verify
console.log('\n=== Verifying header = ciphertext[0:19] ===\n');
console.log('header:         ', header.toString('hex'));
console.log('ciphertext[0:19]:', ciphertext.subarray(0, 19).toString('hex'));
console.log('Match:', header.toString('hex') === ciphertext.subarray(0, 19).toString('hex'));

// Yes! The first 19 bytes of ciphertext ARE the header.
// This means for positions 0-18:
// ciphertext[i] = header[i]
// key[i] = ciphertext[i] XOR URL[i] = header[i] XOR URL[i]

// For positions 19+:
// ciphertext[i] ≠ header[i % 19]
// So the encryption changes after position 18

// Let me look at what ciphertext[19:] XOR header[i%19] gives us
console.log('\n=== ciphertext[19:] XOR header[i%19] ===\n');

const cipherXorHeader = Buffer.alloc(37);
for (let i = 19; i < 56; i++) {
  cipherXorHeader[i - 19] = ciphertext[i] ^ header[i % 19];
}
console.log('Result:', cipherXorHeader.toString('hex'));
console.log('As string:', cipherXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// And URL[19:56]
console.log('URL[19:56]:', Buffer.from(urlFirst56.substring(19)).toString('hex'));

// The difference
const diff = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  diff[i] = cipherXorHeader[i] ^ urlFirst56.charCodeAt(19 + i);
}
console.log('Difference:', diff.toString('hex'));
console.log('As string:', diff.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This difference is: (ciphertext XOR header) XOR URL = key XOR header XOR URL XOR header = key XOR URL
// But key = ciphertext XOR URL, so this should be ciphertext XOR URL XOR URL = ciphertext
// Wait, that's not right...

// Let me recalculate:
// diff = (ciphertext[i] XOR header[i%19]) XOR URL[i]
//      = ciphertext[i] XOR header[i%19] XOR URL[i]
// 
// We know: ciphertext[i] = URL[i] XOR key[i]
// So: diff = URL[i] XOR key[i] XOR header[i%19] XOR URL[i]
//          = key[i] XOR header[i%19]

// So diff = key XOR header!
console.log('\n=== Verifying diff = key XOR header ===\n');

const keyXorHeaderPart = Buffer.alloc(37);
for (let i = 19; i < 56; i++) {
  keyXorHeaderPart[i - 19] = key[i] ^ header[i % 19];
}
console.log('key[19:56] XOR header:', keyXorHeaderPart.toString('hex'));
console.log('diff:                 ', diff.toString('hex'));
console.log('Match:', keyXorHeaderPart.toString('hex') === diff.toString('hex'));

// So we have: key[i] = header[i%19] XOR diff[i-19] for i >= 19
// And diff = (ciphertext XOR header) XOR URL

// But we need URL to compute diff... still circular!

// UNLESS... diff is a constant that we can find elsewhere!
console.log('\n=== Is diff a known constant? ===\n');

// Check if diff is related to embed ID
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);
console.log('Embed ID:', decodedEmbedId.toString('hex'));
console.log('diff[0:19]:', diff.subarray(0, 19).toString('hex'));

// diff XOR embedId
const diffXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  diffXorEmbed[i] = diff[i] ^ decodedEmbedId[i];
}
console.log('diff XOR embedId:', diffXorEmbed.toString('hex'));
console.log('As string:', diffXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

console.log('\n=== Done ===');
