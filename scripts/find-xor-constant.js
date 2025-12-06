/**
 * Find the XOR constant used in RapidShare encryption
 * 
 * We know:
 * - key[i] = header[i % 19] XOR something[i]
 * - For positions 0-18: something = URL (the plaintext)
 * - For positions 19+: something = ???
 * 
 * The "something" for positions 19-28 is: e8e7becd01c840e85cf2
 * 
 * Let's find what this relates to!
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const header = decoded.subarray(0, 19);

// Known key
const knownKeyHex = 'b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70';
const knownKey = Buffer.from(knownKeyHex, 'hex');

// The "something" values
const something = Buffer.from('e8e7becd01c840e85cf2', 'hex');

console.log('=== Analyzing the "something" constant ===\n');
console.log('something[19:29]:', something.toString('hex'));

// What is "something"?
// For positions 0-18: something[i] = URL[i]
// For positions 19-28: something[i] = e8e7becd01c840e85cf2[i-19]

// Let's see if "something" is derived from header
console.log('\n=== Checking relationships ===\n');

// something XOR header[0:10]
const somethingXorHeader = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  somethingXorHeader[i] = something[i] ^ header[i];
}
console.log('something XOR header[0:10]:', somethingXorHeader.toString('hex'));
console.log('As string:', somethingXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// something XOR header[10:19] (with wrap)
const somethingXorHeader2 = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  somethingXorHeader2[i] = something[i] ^ header[(i + 10) % 19];
}
console.log('something XOR header[10:19]:', somethingXorHeader2.toString('hex'));

// Check if something is related to the URL at different positions
const fullUrl = 'https://rapidshare.cc/stream/';
console.log('\nFull URL:', fullUrl);
console.log('URL length:', fullUrl.length);

// something XOR URL[19:29]
const urlPart = 'cc/stream/';
const somethingXorUrl = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  somethingXorUrl[i] = something[i] ^ urlPart.charCodeAt(i);
}
console.log('something XOR "cc/stream/":', somethingXorUrl.toString('hex'));
console.log('As string:', somethingXorUrl.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check: is something = header XOR constant?
// If so, constant = something XOR header
console.log('\n=== Looking for a fixed constant ===\n');

// For positions 0-18: key[i] = header[i] XOR URL[i]
// For positions 19-28: key[i] = header[i % 19] XOR something[i]
//                             = header[i % 19] XOR (header[i % 19] XOR constant[i])
//                             = constant[i]

// Wait! If key[i] = constant for positions 19+, then:
// plaintext[i] = ciphertext[i] XOR constant[i]

// Let's check: is key[19:29] a constant pattern?
const key19to29 = knownKey.subarray(19, 29);
console.log('key[19:29]:', key19to29.toString('hex'));

// Check if it's related to the URL
const urlBytes = Buffer.from(urlPart);
const keyXorUrl = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  keyXorUrl[i] = key19to29[i] ^ urlBytes[i];
}
console.log('key[19:29] XOR "cc/stream/":', keyXorUrl.toString('hex'));
console.log('This should be ciphertext[19:29]:', decoded.subarray(19, 29).toString('hex'));
console.log('Match:', keyXorUrl.toString('hex') === decoded.subarray(19, 29).toString('hex'));

// So: key[i] = ciphertext[i] XOR URL[i] for all i!
// This means: plaintext[i] = ciphertext[i] XOR key[i]
//                          = ciphertext[i] XOR ciphertext[i] XOR URL[i]
//                          = URL[i]

// But that's circular... The key must be derived BEFORE encryption.

// NEW INSIGHT: The key might be derived from the PLAINTEXT, not ciphertext!
// key[i] = plaintext[i] XOR constant
// ciphertext[i] = plaintext[i] XOR key[i] = plaintext[i] XOR plaintext[i] XOR constant = constant

// So ciphertext = constant repeated!
// Let's check if ciphertext has a repeating pattern

console.log('\n=== Checking for repeating pattern in ciphertext ===\n');

// Check if ciphertext repeats every 19 bytes
let repeats19 = true;
for (let i = 19; i < decoded.length; i++) {
  if (decoded[i] !== decoded[i % 19]) {
    repeats19 = false;
    console.log(`No repeat at ${i}: cipher[${i}]=0x${decoded[i].toString(16)} vs cipher[${i%19}]=0x${decoded[i%19].toString(16)}`);
  }
}
if (repeats19) {
  console.log('Ciphertext repeats every 19 bytes!');
}

// The ciphertext does NOT repeat. So the encryption is more complex.

// Let me try a different approach: maybe there's a secondary key
console.log('\n=== Looking for secondary key ===\n');

// For positions 0-18: ciphertext = header
// For positions 19+: ciphertext = ???

// The difference between ciphertext[i] and header[i % 19]:
const diff = Buffer.alloc(decoded.length - 19);
for (let i = 19; i < decoded.length; i++) {
  diff[i - 19] = decoded[i] ^ header[i % 19];
}
console.log('ciphertext[19:] XOR header[i%19]:', diff.toString('hex'));
console.log('As string:', diff.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This should be: plaintext[19:] XOR key[19:] XOR header[i%19]
// If key[i] = header[i%19] XOR URL[i], then:
// diff = plaintext XOR header XOR URL XOR header = plaintext XOR URL

// For positions 19-28, plaintext = "cc/stream/", URL = "cc/stream/"
// So diff[0:10] should be 0!
console.log('\nExpected diff[0:10] = 0 if key = header XOR URL');
console.log('Actual diff[0:10]:', diff.subarray(0, 10).toString('hex'));

// It's NOT zero! So key ≠ header XOR URL for positions 19+

// Let me compute what the key SHOULD be for positions 19+
console.log('\n=== Computing required key ===\n');

// plaintext[i] = ciphertext[i] XOR key[i]
// For positions 19-28: "cc/stream/"[i-19] = ciphertext[i] XOR key[i]
// So: key[i] = ciphertext[i] XOR "cc/stream/"[i-19]

const requiredKey = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  requiredKey[i] = decoded[19 + i] ^ urlPart.charCodeAt(i);
}
console.log('Required key[19:29]:', requiredKey.toString('hex'));
console.log('Known key[19:29]:   ', key19to29.toString('hex'));
console.log('Match:', requiredKey.toString('hex') === key19to29.toString('hex'));

// Now let's find the pattern: how is requiredKey derived from header?
console.log('\n=== Finding key derivation pattern ===\n');

// requiredKey[i] = f(header, i)
// Let's try: requiredKey[i] = header[i] XOR header[i+offset] XOR ...

// requiredKey XOR header[0:10]
const reqXorH0 = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  reqXorH0[i] = requiredKey[i] ^ header[i];
}
console.log('requiredKey XOR header[0:10]:', reqXorH0.toString('hex'));

// requiredKey XOR header[9:19]
const reqXorH9 = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  reqXorH9[i] = requiredKey[i] ^ header[9 + i];
}
console.log('requiredKey XOR header[9:19]:', reqXorH9.toString('hex'));

// Let's check if the key is: header[i] XOR header[i+9] (or some offset)
console.log('\n=== Testing header[i] XOR header[i+offset] ===\n');

for (let offset = 1; offset < 19; offset++) {
  const testKey = Buffer.alloc(10);
  for (let i = 0; i < 10; i++) {
    testKey[i] = header[i] ^ header[(i + offset) % 19];
  }
  if (testKey.toString('hex') === requiredKey.toString('hex')) {
    console.log(`MATCH! key = header[i] XOR header[i+${offset}]`);
  }
}

// Try: header[i] XOR header[19-i-1] (reverse)
const testKeyRev = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  testKeyRev[i] = header[i] ^ header[18 - i];
}
console.log('header[i] XOR header[18-i]:', testKeyRev.toString('hex'));
console.log('Match:', testKeyRev.toString('hex') === requiredKey.toString('hex'));

// Try: header[i] XOR constant byte
console.log('\n=== Testing header XOR constant byte ===\n');

for (let c = 0; c < 256; c++) {
  const testKey = Buffer.alloc(10);
  for (let i = 0; i < 10; i++) {
    testKey[i] = header[i] ^ c;
  }
  if (testKey.toString('hex') === requiredKey.toString('hex')) {
    console.log(`MATCH! key = header XOR 0x${c.toString(16)}`);
  }
}

// The key derivation is more complex. Let me look at individual bytes.
console.log('\n=== Byte-by-byte analysis ===\n');

for (let i = 0; i < 10; i++) {
  const req = requiredKey[i];
  const h = header[i];
  const xor = req ^ h;
  console.log(`[${i}] required=0x${req.toString(16).padStart(2,'0')} header=0x${h.toString(16).padStart(2,'0')} XOR=0x${xor.toString(16).padStart(2,'0')}='${String.fromCharCode(xor)}'`);
}

// The XOR values are: e8 e7 be cd 01 c8 40 e8 5c f2
// These don't look like ASCII or a simple pattern

// Let me check if they relate to the embed ID
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);

console.log('\n=== Checking embed ID relationship ===\n');
console.log('Embed ID:', decodedEmbedId.toString('hex'));

// XOR values XOR embedId[0:10]
const xorVals = Buffer.from('e8e7becd01c840e85cf2', 'hex');
const xorXorEmbed = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  xorXorEmbed[i] = xorVals[i] ^ decodedEmbedId[i];
}
console.log('XOR values XOR embedId:', xorXorEmbed.toString('hex'));
console.log('As string:', xorXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

console.log('\n=== Done ===');
