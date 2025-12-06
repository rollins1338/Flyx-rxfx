/**
 * Derive key from XOR difference between two samples
 * 
 * We have:
 * - Sample 1: encrypted with key K
 * - Sample 2: encrypted with key K
 * - XOR(Sample1, Sample2) = XOR(Plaintext1, Plaintext2)
 * 
 * If we know the plaintext difference, we can verify our URL assumptions
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Deriving Key from XOR Difference ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const sample1 = urlSafeBase64Decode('3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4');
const sample2 = urlSafeBase64Decode('3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4');

// XOR the samples
const xorSamples = Buffer.alloc(sample1.length);
for (let i = 0; i < sample1.length; i++) {
  xorSamples[i] = sample1[i] ^ sample2[i];
}

console.log('XOR of samples:');
console.log(`  Hex: ${xorSamples.toString('hex')}`);

// The XOR of ciphertexts equals XOR of plaintexts (for XOR cipher)
// So xorSamples = XOR(plaintext1, plaintext2)

// If both URLs are:
// https://rapidshare.cc/stream/[hash].m3u8
// https://rapidairmax.site/stream/[hash].m3u8

// The difference starts at position 8 (after "https://")
// "rapidshare.cc" vs "rapidairmax.site"

// Let's construct the expected plaintext XOR
const url1 = 'https://rapidshare.cc/stream/';
const url2 = 'https://rapidairmax.site/stream/';

// But wait - these have different lengths!
// rapidshare.cc = 13 chars
// rapidairmax.site = 16 chars

// So the URLs can't both be 56 chars with the same structure
// Unless the hash lengths are different

// Let's figure out the actual URL structure
console.log('\n=== URL structure analysis ===\n');

// Total length: 56 bytes
// "https://" = 8
// domain = ?
// "/stream/" = 8
// hash = ?
// ".m3u8" = 5

// For sample 1 (rapidshare.cc, 13 chars):
// 8 + 13 + 8 + hash + 5 = 56
// hash = 56 - 34 = 22 chars

// For sample 2 (rapidairmax.site, 16 chars):
// 8 + 16 + 8 + hash + 5 = 56
// hash = 56 - 37 = 19 chars

// But both samples have the same embed ID, so the hash should be the same!
// This means the URL structure might be different

// Maybe the URL doesn't include the domain?
// Or maybe it's a different format entirely

// Let's look at the XOR pattern more carefully
console.log('XOR pattern analysis:');
console.log('Position 0-18 (header): all zeros');
console.log('Position 19-49 (encrypted): varies');
console.log('Position 50-55 (trailer): all zeros');

// The non-zero XOR values are:
const nonZero = [];
for (let i = 0; i < xorSamples.length; i++) {
  if (xorSamples[i] !== 0) {
    nonZero.push({ pos: i, val: xorSamples[i] });
  }
}

console.log('\nNon-zero XOR positions:');
nonZero.forEach(({ pos, val }) => {
  console.log(`  ${pos}: 0x${val.toString(16).padStart(2, '0')} = ${val}`);
});

// The XOR values are small, suggesting the plaintexts are similar
// Let's see if the XOR matches the domain difference

// If the URL is "https://[domain]/stream/[hash].m3u8"
// And the domain starts at position 8
// Then the XOR should match at position 8 + 19 (header) = 27

// But our first non-zero is at position 19, which is right after the header
// This suggests the URL starts at position 0 of the encrypted part

// Let's try: the encrypted part IS the URL
// And the header is separate metadata

console.log('\n=== Trying URL at position 0 of encrypted part ===\n');

// Encrypted part starts at position 19
// If URL starts with "https://", then:
// encrypted[0] XOR key[0] = 'h' (0x68)
// encrypted[1] XOR key[1] = 't' (0x74)
// etc.

const encPart1 = sample1.slice(19);
const encPart2 = sample2.slice(19);

// If both URLs start with "https://", then:
// encPart1[0] XOR key[0] = 0x68
// encPart2[0] XOR key[0] = 0x68
// So encPart1[0] = encPart2[0] (they should be equal)

console.log('First byte of encrypted parts:');
console.log(`  Sample 1: 0x${encPart1[0].toString(16)}`);
console.log(`  Sample 2: 0x${encPart2[0].toString(16)}`);
console.log(`  XOR: 0x${(encPart1[0] ^ encPart2[0]).toString(16)}`);

// They're different! So the URLs don't start the same way
// Or the key is different for each sample

// If the key is derived from the domain, then:
// key1 = f(rapidshare.cc)
// key2 = f(rapidairmax.site)

// And the plaintext might be the same for both!
// plaintext = "https://[some-cdn]/stream/[hash].m3u8"

// Let's assume the plaintext is the same and derive the key difference
console.log('\n=== Assuming same plaintext ===\n');

// If plaintext is the same:
// sample1 = plaintext XOR key1
// sample2 = plaintext XOR key2
// sample1 XOR sample2 = key1 XOR key2

// So xorSamples = key1 XOR key2

// If key = MD5(domain) repeated:
const md5Domain1 = crypto.createHash('md5').update('rapidshare.cc').digest();
const md5Domain2 = crypto.createHash('md5').update('rapidairmax.site').digest();

const keyXor = Buffer.alloc(16);
for (let i = 0; i < 16; i++) {
  keyXor[i] = md5Domain1[i] ^ md5Domain2[i];
}

console.log('MD5(domain1) XOR MD5(domain2):');
console.log(`  ${keyXor.toString('hex')}`);

// Compare with our actual XOR (encrypted part only)
const encXor = xorSamples.slice(19, 19 + 16);
console.log('\nActual encrypted XOR (first 16 bytes):');
console.log(`  ${encXor.toString('hex')}`);

// Check if they match when repeated
let matches = true;
for (let i = 0; i < encXor.length; i++) {
  if (encXor[i] !== keyXor[i % keyXor.length]) {
    matches = false;
    break;
  }
}
console.log(`\nMD5 key XOR matches: ${matches}`);

// Try other key derivations
console.log('\n=== Trying other key derivations ===\n');

const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';

const keyDerivations = [
  { name: 'MD5(embedId+domain)', 
    key1: crypto.createHash('md5').update(embedId + 'rapidshare.cc').digest(),
    key2: crypto.createHash('md5').update(embedId + 'rapidairmax.site').digest()
  },
  { name: 'MD5(domain+embedId)', 
    key1: crypto.createHash('md5').update('rapidshare.cc' + embedId).digest(),
    key2: crypto.createHash('md5').update('rapidairmax.site' + embedId).digest()
  },
  { name: 'SHA1(domain)', 
    key1: crypto.createHash('sha1').update('rapidshare.cc').digest().slice(0, 16),
    key2: crypto.createHash('sha1').update('rapidairmax.site').digest().slice(0, 16)
  },
];

keyDerivations.forEach(({ name, key1, key2 }) => {
  const xor = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    xor[i] = key1[i] ^ key2[i];
  }
  
  // Check if this matches our encrypted XOR
  let matches = true;
  for (let i = 0; i < Math.min(encXor.length, 16); i++) {
    if (encXor[i] !== xor[i % xor.length]) {
      matches = false;
      break;
    }
  }
  
  console.log(`${name}: ${matches ? 'MATCHES!' : 'no match'}`);
  if (matches) {
    console.log(`  Key XOR: ${xor.toString('hex')}`);
  }
});

console.log('\n=== Done ===');
