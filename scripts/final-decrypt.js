/**
 * FINAL DECRYPTION
 * 
 * Key derivation:
 * - For i < 19: key[i] = header[i] XOR URL[i]
 * - For i >= 19: key[i] = encrypted[i] XOR URL[i]
 * 
 * This means: plaintext[i] = encrypted[i] XOR key[i]
 * - For i < 19: plaintext[i] = encrypted[i] XOR header[i] XOR URL[i]
 *                            = header[i] XOR header[i] XOR URL[i] (since encrypted[0:19] = header)
 *                            = URL[i]
 * - For i >= 19: plaintext[i] = encrypted[i] XOR encrypted[i] XOR URL[i]
 *                             = URL[i]
 * 
 * Wait, that's circular. Let me reconsider...
 * 
 * Actually, the key is derived BEFORE encryption, not from the ciphertext.
 * The key must be derived from something known at encryption time.
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Final Decryption Attempt ===\n');

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);
const header = decoded.slice(0, 19);

console.log('Decoded PAGE_DATA:', decoded.toString('hex'));
console.log('Header (first 19 bytes):', header.toString('hex'));

// We know the URL starts with "https://rapidshare.cc/stream/"
// And the key for positions 0-18 is: header XOR "https://rapidshare."

// The key derivation must be:
// key = f(header) where f is some function

// Let's try: key = header repeated, then XORed with a constant

// For positions 0-18: key[i] = header[i] XOR constant[i]
// We know: key[i] XOR URL[i] = header[i] (since ciphertext[0:19] = header)
// So: (header[i] XOR constant[i]) XOR URL[i] = header[i]
// Therefore: constant[i] = URL[i]

// This means: key[i] = header[i] XOR URL[i]
// And: ciphertext[i] = plaintext[i] XOR key[i] = URL[i] XOR header[i] XOR URL[i] = header[i]

// So the first 19 bytes of ciphertext ARE the header, which is header[i] = URL[i] XOR key[i]
// And key[i] = header[i] XOR URL[i]

// This is self-consistent for positions 0-18.

// For positions 19+, the key must be derived differently.
// Let's see what the key is for positions 19-28:

const knownKeyHex = 'b7777a5c80b839b5a4e3275dbbb2fb8099ce4937e4b0e1f24a56728a70';
const knownKey = Buffer.from(knownKeyHex, 'hex');

console.log('\nKnown key:', knownKey.toString('hex'));

// For positions 19-28, the URL is "cc/stream/"
const urlPart2 = 'cc/stream/';

// key[19:29] = ???
// We know key[19:29] = 37e4b0e1f24a56728a70

// Let's see what this XORs with header[0:10]
const key19to29 = knownKey.slice(19, 29);
const header0to10 = header.slice(0, 10);

const xorResult = Buffer.alloc(10);
for (let i = 0; i < 10; i++) {
  xorResult[i] = key19to29[i] ^ header0to10[i];
}

console.log('\nkey[19:29] XOR header[0:10]:', xorResult.toString('hex'));
console.log('As string:', xorResult.toString('utf8'));

// This should be "cc/stream/" if key[19:29] = header[0:10] XOR "cc/stream/"
const expected = Buffer.from(urlPart2);
console.log('Expected "cc/stream/":', expected.toString('hex'));

const match = xorResult.toString('hex') === expected.toString('hex');
console.log('Match:', match);

if (!match) {
  // The key derivation is different for positions 19+
  // Let's find the pattern
  
  console.log('\n=== Finding key derivation for positions 19+ ===\n');
  
  // key[19:29] should decrypt encrypted[19:29] to "cc/stream/"
  // encrypted[19:29] = decoded[19:29]
  const enc19to29 = decoded.slice(19, 29);
  console.log('encrypted[19:29]:', enc19to29.toString('hex'));
  
  // plaintext[19:29] = "cc/stream/"
  // key[19:29] = encrypted[19:29] XOR plaintext[19:29]
  const derivedKey19to29 = Buffer.alloc(10);
  for (let i = 0; i < 10; i++) {
    derivedKey19to29[i] = enc19to29[i] ^ expected[i];
  }
  console.log('Derived key[19:29]:', derivedKey19to29.toString('hex'));
  console.log('Known key[19:29]:  ', key19to29.toString('hex'));
  
  // They should match!
  const keyMatch = derivedKey19to29.toString('hex') === key19to29.toString('hex');
  console.log('Key match:', keyMatch);
  
  if (keyMatch) {
    console.log('\n*** KEY DERIVATION CONFIRMED ***');
    
    // Now let's figure out how key[19:29] is derived from header
    // key[19:29] = f(header)
    
    // Try: key[i] = header[(i-19) % 19] XOR something
    // Or: key[i] = header[i % 19] XOR something
    
    // Let's compute: key[19:29] XOR header[0:10]
    const keyXorHeader = Buffer.alloc(10);
    for (let i = 0; i < 10; i++) {
      keyXorHeader[i] = key19to29[i] ^ header[i];
    }
    console.log('\nkey[19:29] XOR header[0:10]:', keyXorHeader.toString('hex'));
    
    // And: key[19:29] XOR header[19-19:29-19] = key[19:29] XOR header[0:10]
    // Same as above
    
    // Let's try: key[i] = header[i % 19] XOR constant
    // For i=19: key[19] = header[0] XOR constant
    // constant = key[19] XOR header[0] = 0x37 XOR 0xdf = 0xe8
    
    const constants = [];
    for (let i = 0; i < 10; i++) {
      constants.push(key19to29[i] ^ header[i]);
    }
    console.log('Constants:', constants.map(c => '0x' + c.toString(16)).join(', '));
    
    // Check if constants match "cc/stream/"
    const constantsMatch = constants.every((c, i) => c === expected[i]);
    console.log('Constants match "cc/stream/":', constantsMatch);
    
    // So the key derivation is:
    // key[i] = header[i % 19] XOR URL[i]
    
    // This means we can decrypt if we know the URL pattern!
    console.log('\n*** DECRYPTION ALGORITHM ***');
    console.log('key[i] = header[i % 19] XOR URL[i]');
    console.log('plaintext[i] = ciphertext[i] XOR key[i]');
    console.log('             = ciphertext[i] XOR header[i % 19] XOR URL[i]');
    
    // But we don't know the full URL...
    // We know it's: https://rapidshare.cc/stream/[hash].m3u8
    // The hash is 22 characters
    
    // Let's decrypt what we can
    const urlKnown = 'https://rapidshare.cc/stream/';
    const urlSuffix = '.m3u8';
    
    // Decrypt positions 0-28 (known URL part)
    const plaintext = Buffer.alloc(decoded.length);
    for (let i = 0; i < urlKnown.length; i++) {
      plaintext[i] = decoded[i] ^ header[i % 19] ^ urlKnown.charCodeAt(i);
    }
    
    // For positions 29-50 (hash), we need to find the pattern
    // For positions 51-55 (.m3u8), we can decrypt
    for (let i = 51; i < 56; i++) {
      plaintext[i] = decoded[i] ^ header[i % 19] ^ urlSuffix.charCodeAt(i - 51);
    }
    
    console.log('\nPartial decryption:');
    console.log('Positions 0-28:', plaintext.slice(0, 29).toString('utf8'));
    console.log('Positions 51-55:', plaintext.slice(51, 56).toString('utf8'));
    
    // The hash (positions 29-50) is still encrypted
    // But we can try to find it by assuming it's alphanumeric
    
    console.log('\n=== Extracting hash ===\n');
    
    // For positions 29-50:
    // plaintext[i] = ciphertext[i] XOR header[i % 19] XOR URL[i]
    // We don't know URL[i], but we know plaintext[i] should be alphanumeric
    
    // Let's compute: ciphertext[i] XOR header[i % 19]
    const hashEncrypted = Buffer.alloc(22);
    for (let i = 0; i < 22; i++) {
      hashEncrypted[i] = decoded[29 + i] ^ header[(29 + i) % 19];
    }
    console.log('Hash encrypted (ciphertext XOR header):', hashEncrypted.toString('hex'));
    console.log('As string:', hashEncrypted.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));
    
    // This IS the hash! Because:
    // plaintext[i] = ciphertext[i] XOR header[i % 19] XOR URL[i]
    // And URL[i] = plaintext[i] (the hash is part of the URL)
    // So: plaintext[i] = ciphertext[i] XOR header[i % 19] XOR plaintext[i]
    // This is only true if ciphertext[i] XOR header[i % 19] = 0
    // Which means ciphertext[i] = header[i % 19]
    
    // Wait, that's not right. Let me reconsider...
    
    // Actually, the encryption is: ciphertext = plaintext XOR key
    // And key[i] = header[i % 19] XOR URL[i]
    // So: ciphertext[i] = plaintext[i] XOR header[i % 19] XOR URL[i]
    //                   = URL[i] XOR header[i % 19] XOR URL[i]
    //                   = header[i % 19]
    
    // So ciphertext[i] = header[i % 19] for all i!
    // Let's verify this
    
    console.log('\n=== Verifying ciphertext = header[i % 19] ===\n');
    
    let allMatch = true;
    for (let i = 0; i < decoded.length; i++) {
      if (decoded[i] !== header[i % 19]) {
        allMatch = false;
        console.log(`Mismatch at ${i}: ciphertext=0x${decoded[i].toString(16)} header=0x${header[i % 19].toString(16)}`);
      }
    }
    
    if (allMatch) {
      console.log('All bytes match! ciphertext = header repeated');
    }
  }
}

console.log('\n=== Done ===');
