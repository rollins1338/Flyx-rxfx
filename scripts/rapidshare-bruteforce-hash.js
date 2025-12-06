/**
 * Brute-force the video hash for rapidshare.cc
 * 
 * We know:
 * - First 19 bytes of ciphertext are the HEADER (constant)
 * - URL prefix is "https://rapidshare.cc/stream/"
 * - The video hash follows and is likely hex characters
 * 
 * The key derivation is:
 * - key[i] = key[i-19] XOR (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])
 * 
 * Since we know cipher and we're guessing plain, we can verify by checking
 * if the decrypted character matches our guess.
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// rapidshare.cc sample
const PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';
const cipher = urlSafeBase64Decode(PAGE_DATA);

// Known URL prefix
const URL_PREFIX = 'https://rapidshare.cc/stream/';

console.log('=== Brute-forcing rapidshare.cc video hash ===\n');
console.log('PAGE_DATA:', PAGE_DATA);
console.log('Cipher length:', cipher.length);
console.log('URL prefix:', URL_PREFIX);
console.log('Prefix length:', URL_PREFIX.length);

// Initialize key and plaintext
const key = Buffer.alloc(cipher.length);
const plain = Buffer.alloc(cipher.length);

// Step 1: Compute key[0:19] = HEADER XOR URL[0:19]
for (let i = 0; i < 19; i++) {
  key[i] = HEADER[i] ^ URL_PREFIX.charCodeAt(i);
  plain[i] = cipher[i] ^ key[i];
}

console.log('\nFirst 19 chars decrypted:', plain.slice(0, 19).toString('utf8'));

// Step 2: For positions 19 to URL_PREFIX.length-1, use known plaintext
for (let i = 19; i < URL_PREFIX.length; i++) {
  const cipherDiff = cipher[i] ^ cipher[i - 19];
  const plainDiff = URL_PREFIX.charCodeAt(i) ^ URL_PREFIX.charCodeAt(i - 19);
  key[i] = key[i - 19] ^ cipherDiff ^ plainDiff;
  plain[i] = cipher[i] ^ key[i];
}

console.log('First', URL_PREFIX.length, 'chars decrypted:', plain.slice(0, URL_PREFIX.length).toString('utf8'));

// Step 3: Brute-force the remaining characters
// The video hash is likely hex (0-9, a-f) or alphanumeric

const CHARSET = '0123456789abcdef'; // Try hex first
const EXTENDED_CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_./,';

console.log('\n=== Brute-forcing remaining', cipher.length - URL_PREFIX.length, 'bytes ===\n');

let decryptedUrl = URL_PREFIX;

for (let i = URL_PREFIX.length; i < cipher.length; i++) {
  let found = false;
  
  // Try each character in charset
  for (const char of EXTENDED_CHARSET) {
    // If this char is correct, then:
    // plain[i] = char
    // key[i] = cipher[i] XOR char
    // And key[i] should equal: key[i-19] XOR cipherDiff XOR plainDiff
    
    const testPlainChar = char.charCodeAt(0);
    const testKey = cipher[i] ^ testPlainChar;
    
    // Compute expected key based on the recurrence relation
    const cipherDiff = cipher[i] ^ cipher[i - 19];
    const plainDiff = testPlainChar ^ decryptedUrl.charCodeAt(i - 19);
    const expectedKey = key[i - 19] ^ cipherDiff ^ plainDiff;
    
    if (testKey === expectedKey) {
      // This character is consistent!
      key[i] = testKey;
      plain[i] = testPlainChar;
      decryptedUrl += char;
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log(`Position ${i}: No valid character found!`);
    // Show what we have so far
    console.log('Decrypted so far:', decryptedUrl);
    
    // Try to show what the raw decryption would give
    const cipherDiff = cipher[i] ^ cipher[i - 19];
    // We need to guess plainDiff... let's try 0 (same char as 19 positions ago)
    const rawKey = key[i - 19] ^ cipherDiff;
    const rawChar = cipher[i] ^ rawKey;
    console.log(`Raw decryption (assuming plainDiff=0): ${String.fromCharCode(rawChar)} (${rawChar})`);
    
    // Add the raw char and continue
    key[i] = rawKey;
    plain[i] = rawChar;
    decryptedUrl += String.fromCharCode(rawChar);
  }
}

console.log('\n=== RESULT ===\n');
console.log('Decrypted URL:', decryptedUrl);
console.log('');

// Verify the decryption
console.log('=== Verification ===');
const verifyPlain = Buffer.from(decryptedUrl, 'utf8');
const verifyKey = Buffer.alloc(cipher.length);
const verifyDecrypt = Buffer.alloc(cipher.length);

for (let i = 0; i < 19; i++) {
  verifyKey[i] = HEADER[i] ^ verifyPlain[i];
}

for (let i = 19; i < cipher.length; i++) {
  const cipherDiff = cipher[i] ^ cipher[i - 19];
  const plainDiff = verifyPlain[i] ^ verifyPlain[i - 19];
  verifyKey[i] = verifyKey[i - 19] ^ cipherDiff ^ plainDiff;
}

for (let i = 0; i < cipher.length; i++) {
  verifyDecrypt[i] = cipher[i] ^ verifyKey[i];
}

console.log('Re-decrypted:', verifyDecrypt.toString('utf8'));
console.log('Match:', verifyDecrypt.toString('utf8') === decryptedUrl);

// Also try with FNAF2 to verify algorithm
console.log('\n=== Verify with FNAF2 ===');
const FNAF2_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const FNAF2_URL = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866';

const fnaf2Cipher = urlSafeBase64Decode(FNAF2_PAGE_DATA);
const fnaf2Key = Buffer.alloc(fnaf2Cipher.length);
const fnaf2Plain = Buffer.from(FNAF2_URL, 'utf8');

for (let i = 0; i < 19; i++) {
  fnaf2Key[i] = HEADER[i] ^ fnaf2Plain[i];
}

for (let i = 19; i < fnaf2Cipher.length && i < fnaf2Plain.length; i++) {
  const cipherDiff = fnaf2Cipher[i] ^ fnaf2Cipher[i - 19];
  const plainDiff = fnaf2Plain[i] ^ fnaf2Plain[i - 19];
  fnaf2Key[i] = fnaf2Key[i - 19] ^ cipherDiff ^ plainDiff;
}

const fnaf2Decrypt = Buffer.alloc(fnaf2Cipher.length);
for (let i = 0; i < fnaf2Cipher.length; i++) {
  fnaf2Decrypt[i] = fnaf2Cipher[i] ^ fnaf2Key[i];
}

console.log('FNAF2 decrypted:', fnaf2Decrypt.toString('utf8'));
console.log('Expected:', FNAF2_URL);
console.log('Match:', fnaf2Decrypt.toString('utf8') === FNAF2_URL);
