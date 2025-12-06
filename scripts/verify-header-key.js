/**
 * BREAKTHROUGH: The key is derived from the header!
 * 
 * Key XOR header = "https://rapidshare."
 * This means: key = header XOR "https://rapidshare."
 * 
 * But wait - the header is 19 bytes and the key is 29 bytes
 * So the key derivation must extend beyond the header
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Verifying Header-Based Key ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);

// The header is the first 19 bytes
const header = decoded.slice(0, 19);
console.log('Header (19 bytes):', header.toString('hex'));

// The known key (29 bytes)
const knownKeyHex = 'b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70';
const knownKey = Buffer.from(knownKeyHex, 'hex');

// XOR key with header
const xorResult = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  xorResult[i] = knownKey[i] ^ header[i];
}

console.log('Key XOR header:', xorResult.toString('hex'));
console.log('As string:', xorResult.toString('utf8'));

// This is "https://rapidshare." - the start of the URL!
// So the key for the first 19 bytes is: header XOR "https://rapidshare."

// But the key is 29 bytes, so we need to figure out the rest
// The URL continues with "cc/stream/"

const urlStart = 'https://rapidshare.cc/stream/';
console.log('\nExpected URL start:', urlStart);
console.log('URL start length:', urlStart.length);

// The key should be: header (repeated) XOR URL
// Let's verify by decrypting with this approach

// Method: key[i] = header[i % 19] XOR urlStart[i]
// Then: plaintext[i] = ciphertext[i] XOR key[i]
//                    = ciphertext[i] XOR header[i % 19] XOR urlStart[i]

// Wait, that's circular. Let me think again...

// The ciphertext is: decoded (56 bytes)
// The plaintext is: URL (56 bytes)
// The key is: some function of header and position

// We know: key[i] = decoded[i] XOR plaintext[i]
// And: key[0:19] XOR header = "https://rapidshare."

// So: key[i] = header[i] XOR "https://rapidshare."[i] for i < 19

// Let's verify this
console.log('\n=== Verifying key derivation ===\n');

// Build key from header XOR URL start
const urlStartBytes = Buffer.from(urlStart);
const derivedKey = Buffer.alloc(urlStart.length);
for (let i = 0; i < urlStart.length; i++) {
  derivedKey[i] = header[i % header.length] ^ urlStartBytes[i];
}

console.log('Derived key:', derivedKey.toString('hex'));
console.log('Known key:  ', knownKey.toString('hex'));

// Check if they match
let match = true;
for (let i = 0; i < derivedKey.length; i++) {
  if (derivedKey[i] !== knownKey[i]) {
    match = false;
    console.log(`Mismatch at position ${i}: derived=0x${derivedKey[i].toString(16)} known=0x${knownKey[i].toString(16)}`);
  }
}

if (match) {
  console.log('\n*** KEY DERIVATION CONFIRMED! ***');
  console.log('Key = header XOR URL');
}

// Now let's try to decrypt the full message
console.log('\n=== Full decryption attempt ===\n');

// The key is: header[i % 19] XOR plaintext[i]
// So: plaintext[i] = ciphertext[i] XOR header[i % 19] XOR plaintext[i]
// That's still circular...

// Wait, I think I misunderstood. Let me reconsider.

// The encryption is: ciphertext = plaintext XOR key
// We found: key[0:19] = header XOR "https://rapidshare."[0:19]

// But the header IS part of the ciphertext (first 19 bytes)
// So: header = plaintext[0:19] XOR key[0:19]
// And: key[0:19] = header XOR "https://rapidshare."[0:19]

// Substituting:
// header = plaintext[0:19] XOR (header XOR "https://rapidshare."[0:19])
// header = plaintext[0:19] XOR header XOR "https://rapidshare."[0:19]
// 0 = plaintext[0:19] XOR "https://rapidshare."[0:19]
// plaintext[0:19] = "https://rapidshare."[0:19]

// This confirms the plaintext starts with "https://rapidshare."!

// So the structure is:
// - First 19 bytes of ciphertext (header) = first 19 bytes of plaintext XOR key[0:19]
// - key[0:19] = header XOR "https://rapidshare."

// This means: key = header XOR plaintext (for first 19 bytes)
// And the key repeats or extends somehow

// Let's try: key = header repeated to 56 bytes
const extendedHeader = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  extendedHeader[i] = header[i % header.length];
}

// Decrypt: plaintext = ciphertext XOR extendedHeader
const plaintext = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  plaintext[i] = decoded[i] ^ extendedHeader[i];
}

console.log('Decrypted with repeated header:');
console.log(plaintext.toString('utf8'));

// Hmm, that gives garbage. The key must be different.

// Let me try another approach: the key might be the header XOR with a constant
// key = header XOR constant (repeated)

// We know key[0:19] = header XOR "https://rapidshare."
// So constant[0:19] = "https://rapidshare."

// For positions 19-28, we need to find the constant
// constant[19:29] = key[19:29] XOR header[0:10]

const constant19to29 = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  constant19to29[i] = knownKey[19 + i] ^ header[i];
}

console.log('\nConstant for positions 19-28:', constant19to29.toString('hex'));
console.log('As string:', constant19to29.toString('utf8'));

// This should be "cc/stream/" if the URL continues!
// Let's check
const expectedContinuation = 'cc/stream/';
console.log('Expected:', Buffer.from(expectedContinuation).toString('hex'));

// They should match!
const continuationMatch = constant19to29.toString('utf8') === expectedContinuation;
console.log('Continuation matches:', continuationMatch);

if (continuationMatch) {
  console.log('\n*** FULL KEY DERIVATION CONFIRMED! ***');
  console.log('Key = header (repeated) XOR URL');
  
  // Now we can decrypt any PAGE_DATA if we know the URL pattern
  // The URL is: https://rapidshare.cc/stream/[hash].m3u8
  
  // The hash is 22 characters (56 - 29 - 5 = 22)
  // We need to find the hash
  
  // For positions 29-55, the key is:
  // key[29:56] = header[(29-19):] XOR hash + ".m3u8"
  
  // Let's extract the hash
  const hashAndSuffix = Buffer.alloc(27);
  for (let i = 0; i < 27; i++) {
    hashAndSuffix[i] = decoded[29 + i] ^ header[(29 + i) % header.length];
  }
  
  console.log('\nHash + suffix:', hashAndSuffix.toString('utf8'));
}

console.log('\n=== Done ===');
