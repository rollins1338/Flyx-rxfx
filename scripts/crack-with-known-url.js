/**
 * Crack RapidShare encryption using known URL
 * 
 * We have:
 * - PAGE_DATA: 3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4
 * - Known URL: https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8
 * 
 * Key insight: The ciphertext is 56 bytes, URL is 208 bytes
 * So PAGE_DATA doesn't encrypt the full URL!
 * 
 * But we found that decrypting with key[0:19] gives "https://rrr.core36l"
 * This means the key derivation is: key[i] = header[i % 19] XOR something
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

console.log('=== Cracking with Known URL ===\n');
console.log('Ciphertext:', ciphertext.toString('hex'));
console.log('Header:', header.toString('hex'));
console.log('Ciphertext length:', ciphertext.length);
console.log('URL length:', knownUrl.length);

// The URL is 208 bytes but ciphertext is 56 bytes
// This means PAGE_DATA encrypts only the first 56 bytes of the URL!

const urlFirst56 = knownUrl.substring(0, 56);
console.log('\nFirst 56 chars of URL:', urlFirst56);

// Derive the full key
const key = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  key[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

console.log('\n=== Derived Key ===\n');
console.log('Full key:', key.toString('hex'));

// Analyze key pattern
console.log('\n=== Key Pattern Analysis ===\n');

// For positions 0-18: key[i] = header[i] XOR URL[i]
// Let's verify this
console.log('Verifying key[0:19] = header XOR URL:');
let match0to19 = true;
for (let i = 0; i < 19; i++) {
  const expected = header[i] ^ urlFirst56.charCodeAt(i);
  if (key[i] !== expected) {
    match0to19 = false;
    console.log(`  Mismatch at ${i}: key=${key[i].toString(16)} expected=${expected.toString(16)}`);
  }
}
console.log('key[0:19] = header XOR URL:', match0to19);

// For positions 19+: what's the pattern?
console.log('\n=== Analyzing key[19:56] ===\n');

// Check if key[i] = header[i % 19] XOR something
const somethings = [];
for (let i = 19; i < 56; i++) {
  const something = key[i] ^ header[i % 19];
  somethings.push(something);
}
console.log('something values (key XOR header[i%19]):');
console.log(Buffer.from(somethings).toString('hex'));
console.log('As string:', Buffer.from(somethings).toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if "something" = URL[i]
const urlPart19to56 = urlFirst56.substring(19);
console.log('\nURL[19:56]:', urlPart19to56);
console.log('URL[19:56] hex:', Buffer.from(urlPart19to56).toString('hex'));

// Compare
const urlBytes = Buffer.from(urlPart19to56);
let matchUrl = true;
for (let i = 0; i < somethings.length; i++) {
  if (somethings[i] !== urlBytes[i]) {
    matchUrl = false;
    console.log(`Mismatch at ${i+19}: something=0x${somethings[i].toString(16)} URL=0x${urlBytes[i].toString(16)}='${urlPart19to56[i]}'`);
  }
}
console.log('\nsomething = URL[19:56]:', matchUrl);

if (matchUrl) {
  console.log('\n🎉 KEY DERIVATION CONFIRMED!');
  console.log('key[i] = header[i % 19] XOR URL[i]');
  console.log('\nThis means: plaintext[i] = ciphertext[i] XOR header[i % 19] XOR URL[i]');
  console.log('But we need to know URL to decrypt... circular!');
}

// Wait - if key[i] = header[i % 19] XOR URL[i], then:
// ciphertext[i] = plaintext[i] XOR key[i]
//               = URL[i] XOR header[i % 19] XOR URL[i]
//               = header[i % 19]
// So ciphertext should be header repeated!

console.log('\n=== Checking if ciphertext = header repeated ===\n');

let cipherIsHeaderRepeated = true;
for (let i = 0; i < ciphertext.length; i++) {
  if (ciphertext[i] !== header[i % 19]) {
    cipherIsHeaderRepeated = false;
    console.log(`Mismatch at ${i}: cipher=0x${ciphertext[i].toString(16)} header[${i%19}]=0x${header[i%19].toString(16)}`);
  }
}
console.log('Ciphertext = header repeated:', cipherIsHeaderRepeated);

// The ciphertext is NOT header repeated, so the key derivation is different!
// Let me reconsider...

// Actually, the key we derived is: key[i] = ciphertext[i] XOR plaintext[i]
// And we found: key[i] = header[i % 19] XOR URL[i]
// So: ciphertext[i] XOR URL[i] = header[i % 19] XOR URL[i]
// Therefore: ciphertext[i] = header[i % 19]

// But we just showed ciphertext ≠ header repeated!
// This is a contradiction... unless our URL is wrong!

console.log('\n=== Verifying URL correctness ===\n');

// Let's decrypt with the pattern: plaintext[i] = ciphertext[i] XOR header[i % 19]
const decrypted = Buffer.alloc(ciphertext.length);
for (let i = 0; i < ciphertext.length; i++) {
  decrypted[i] = ciphertext[i] ^ header[i % 19];
}
console.log('Decrypted (cipher XOR header[i%19]):', decrypted.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Hmm, that doesn't give us the URL either.

// Let me try: plaintext[i] = ciphertext[i] XOR key[i % 19]
// where key[0:19] = header XOR "https://rrr.core36l"
const key0to19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key0to19[i] = header[i] ^ urlFirst56.charCodeAt(i);
}

const decrypted2 = Buffer.alloc(ciphertext.length);
for (let i = 0; i < ciphertext.length; i++) {
  decrypted2[i] = ciphertext[i] ^ key0to19[i % 19];
}
console.log('Decrypted (cipher XOR key[i%19]):', decrypted2.toString('utf8'));

// Check if this matches the URL
if (decrypted2.toString('utf8') === urlFirst56) {
  console.log('\n🎉🎉🎉 SUCCESS! 🎉🎉🎉');
  console.log('The decryption algorithm is:');
  console.log('1. key = header XOR URL[0:19]');
  console.log('2. plaintext[i] = ciphertext[i] XOR key[i % 19]');
}

// But wait - we need to know URL[0:19] to derive the key!
// Unless... the key is constant for all videos?

console.log('\n=== Testing if key is constant ===\n');
console.log('key[0:19]:', key0to19.toString('hex'));
console.log('As string:', key0to19.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// The key might be derived from something else, like the embed ID
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);
console.log('\nEmbed ID decoded:', decodedEmbedId.toString('hex'));
console.log('Key[0:19]:        ', key0to19.toString('hex'));
console.log('Match:', decodedEmbedId.toString('hex') === key0to19.toString('hex'));

// XOR them
const keyXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  keyXorEmbed[i] = key0to19[i] ^ decodedEmbedId[i];
}
console.log('key XOR embedId:', keyXorEmbed.toString('hex'));
console.log('As string:', keyXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

console.log('\n=== Done ===');
