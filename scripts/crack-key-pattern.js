/**
 * Crack the key pattern for RapidShare decryption
 * 
 * Known facts:
 * 1. First 19 bytes of ciphertext = header
 * 2. key[0:19] = header XOR "https://rapidshare."
 * 3. key[19:29] decrypts to "cc/stream/"
 * 4. The ciphertext is NOT simply header repeated
 * 
 * The key insight: the key derivation for positions 19+ must use
 * something OTHER than just header[i % 19] XOR URL[i]
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const header = decoded.subarray(0, 19);

console.log('=== Analyzing Key Pattern ===\n');
console.log('PAGE_DATA length:', decoded.length, 'bytes');
console.log('Header (19 bytes):', header.toString('hex'));
console.log('Full ciphertext:', decoded.toString('hex'));

// Known key from previous analysis
const knownKeyHex = 'b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70';
const knownKey = Buffer.from(knownKeyHex, 'hex');

// Known URL structure
const urlStart = 'https://rapidshare.cc/stream/';
const urlEnd = '.m3u8';

console.log('\n=== Key Analysis ===\n');

// For positions 0-18: key[i] = header[i] XOR URL[i]
console.log('Verifying key[0:19]:');
for (let i = 0; i < 19; i++) {
  const expectedKey = header[i] ^ urlStart.charCodeAt(i);
  const actualKey = knownKey[i];
  const match = expectedKey === actualKey ? '✓' : '✗';
  console.log(`  [${i}] header[${i}]=0x${header[i].toString(16).padStart(2,'0')} XOR '${urlStart[i]}'=0x${urlStart.charCodeAt(i).toString(16).padStart(2,'0')} = 0x${expectedKey.toString(16).padStart(2,'0')} | known=0x${actualKey.toString(16).padStart(2,'0')} ${match}`);
}

// For positions 19-28: analyze the pattern
console.log('\n=== Analyzing positions 19-28 ===\n');

const urlPart2 = 'cc/stream/';
for (let i = 19; i < 29; i++) {
  const cipherByte = decoded[i];
  const keyByte = knownKey[i];
  const plainByte = cipherByte ^ keyByte;
  const expectedPlain = urlPart2.charCodeAt(i - 19);
  const headerMod = header[i % 19];
  
  console.log(`[${i}] cipher=0x${cipherByte.toString(16).padStart(2,'0')} key=0x${keyByte.toString(16).padStart(2,'0')} => plain=0x${plainByte.toString(16).padStart(2,'0')}='${String.fromCharCode(plainByte)}' | expected='${urlPart2[i-19]}' | header[${i%19}]=0x${headerMod.toString(16).padStart(2,'0')}`);
  
  // What's the relationship between key[i] and header?
  // key[i] = header[i % 19] XOR something
  const something = keyByte ^ headerMod;
  console.log(`       key[${i}] XOR header[${i%19}] = 0x${something.toString(16).padStart(2,'0')} = '${String.fromCharCode(something)}'`);
}

// The "something" for each position
console.log('\n=== Finding the "something" pattern ===\n');

const somethings = [];
for (let i = 19; i < 29; i++) {
  const something = knownKey[i] ^ header[i % 19];
  somethings.push(something);
}
console.log('something[19:29]:', Buffer.from(somethings).toString('hex'));
console.log('As string:', Buffer.from(somethings).toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Is "something" = URL[i]?
const urlBytes = [];
for (let i = 19; i < 29; i++) {
  urlBytes.push(urlPart2.charCodeAt(i - 19));
}
console.log('URL[19:29]:', Buffer.from(urlBytes).toString('hex'));

// Is "something" = ciphertext[i]?
const cipherBytes = [];
for (let i = 19; i < 29; i++) {
  cipherBytes.push(decoded[i]);
}
console.log('cipher[19:29]:', Buffer.from(cipherBytes).toString('hex'));

// Check: something = cipher XOR URL?
const cipherXorUrl = [];
for (let i = 0; i < 10; i++) {
  cipherXorUrl.push(cipherBytes[i] ^ urlBytes[i]);
}
console.log('cipher XOR URL:', Buffer.from(cipherXorUrl).toString('hex'));

// Check: something = header[0:10] XOR URL?
const headerXorUrl = [];
for (let i = 0; i < 10; i++) {
  headerXorUrl.push(header[i] ^ urlBytes[i]);
}
console.log('header[0:10] XOR URL:', Buffer.from(headerXorUrl).toString('hex'));

// The key derivation formula
console.log('\n=== Deriving the formula ===\n');

// We have:
// key[i] = header[i % 19] XOR something[i]
// plaintext[i] = ciphertext[i] XOR key[i]
//              = ciphertext[i] XOR header[i % 19] XOR something[i]

// For positions 0-18:
// plaintext[i] = header[i] XOR header[i] XOR something[i] = something[i]
// And plaintext[0:19] = "https://rapidshare."
// So something[0:19] = "https://rapidshare."

// For positions 19-28:
// plaintext[i] = ciphertext[i] XOR header[i % 19] XOR something[i]
// And plaintext[19:29] = "cc/stream/"
// So: "cc/stream/"[i-19] = ciphertext[i] XOR header[i % 19] XOR something[i]
// Therefore: something[i] = ciphertext[i] XOR header[i % 19] XOR "cc/stream/"[i-19]

const derivedSomething = [];
for (let i = 19; i < 29; i++) {
  const s = decoded[i] ^ header[i % 19] ^ urlPart2.charCodeAt(i - 19);
  derivedSomething.push(s);
}
console.log('Derived something[19:29]:', Buffer.from(derivedSomething).toString('hex'));
console.log('Matches computed:', Buffer.from(derivedSomething).toString('hex') === Buffer.from(somethings).toString('hex'));

// Now let's see if "something" has a pattern
// For positions 0-18: something = URL
// For positions 19-28: something = ???

// Let's check if something[19:28] relates to the embed ID
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);
console.log('\nEmbed ID decoded:', decodedEmbedId.toString('hex'));
console.log('Embed ID length:', decodedEmbedId.length);

// Check if something relates to embed ID
console.log('\n=== Checking embed ID relationship ===\n');

// something[19:29] XOR embedId[0:10]?
const somethingXorEmbed = [];
for (let i = 0; i < 10; i++) {
  somethingXorEmbed.push(somethings[i] ^ decodedEmbedId[i]);
}
console.log('something XOR embedId:', Buffer.from(somethingXorEmbed).toString('hex'));
console.log('As string:', Buffer.from(somethingXorEmbed).toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Maybe the key is simply: key = embedId XOR URL (repeated)
console.log('\n=== Testing: key = embedId XOR URL ===\n');

const fullUrl = 'https://rapidshare.cc/stream/';
const testKey = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  testKey[i] = decodedEmbedId[i % decodedEmbedId.length] ^ fullUrl.charCodeAt(i % fullUrl.length);
}

const testPlain = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  testPlain[i] = decoded[i] ^ testKey[i];
}

console.log('Test decryption:', testPlain.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Try: key = header XOR embedId (both repeated)
console.log('\n=== Testing: key = header XOR embedId ===\n');

const testKey2 = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  testKey2[i] = header[i % 19] ^ decodedEmbedId[i % decodedEmbedId.length];
}

const testPlain2 = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  testPlain2[i] = decoded[i] ^ testKey2[i];
}

console.log('Test decryption:', testPlain2.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// The key insight: maybe the "something" IS the URL itself!
// key[i] = header[i % 19] XOR URL[i]
// But we need to know the full URL to decrypt...

// Wait! For positions 0-18, ciphertext = header
// So: header[i] = URL[i] XOR key[i] = URL[i] XOR header[i] XOR URL[i] = header[i]
// This is always true, so it doesn't constrain anything.

// The real question: what is the relationship between header and the URL?
// header might BE derived from the URL!

console.log('\n=== Checking if header is derived from URL ===\n');

// If header = f(URL), then we can reverse it
// Let's check: header XOR "https://rapidshare." = key[0:19]
// And key[0:19] should have some pattern

const key0to19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key0to19[i] = header[i] ^ urlStart.charCodeAt(i);
}
console.log('key[0:19]:', key0to19.toString('hex'));
console.log('As string:', key0to19.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if key[0:19] = embedId[0:19]
console.log('embedId[0:19]:', decodedEmbedId.subarray(0, 19).toString('hex'));
console.log('Match:', key0to19.toString('hex') === decodedEmbedId.subarray(0, 19).toString('hex'));

// AHA! Let's check if key = embedId!
console.log('\n=== BREAKTHROUGH: Is key = embedId? ===\n');

// Compare known key with embed ID
console.log('Known key:', knownKey.toString('hex'));
console.log('Embed ID: ', decodedEmbedId.toString('hex'));

// They're both 19 bytes!
if (knownKey.length >= 19 && decodedEmbedId.length === 19) {
  const keyFirst19 = knownKey.subarray(0, 19);
  console.log('key[0:19] === embedId:', keyFirst19.toString('hex') === decodedEmbedId.toString('hex'));
}

// If key = embedId repeated, then:
// plaintext = ciphertext XOR embedId (repeated)
console.log('\n=== Final test: decrypt with embedId as key ===\n');

const finalPlain = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  finalPlain[i] = decoded[i] ^ decodedEmbedId[i % decodedEmbedId.length];
}

console.log('Decrypted:', finalPlain.toString('utf8'));

if (finalPlain.toString('utf8').startsWith('https://')) {
  console.log('\n🎉 SUCCESS! The key is the decoded embed ID!');
}

console.log('\n=== Done ===');
