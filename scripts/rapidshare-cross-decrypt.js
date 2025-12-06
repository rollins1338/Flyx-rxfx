/**
 * Cross-reference decryption using multiple samples
 * 
 * Key insight: The HEADER (first 19 bytes of ciphertext) is CONSTANT.
 * This means the key derivation must produce the same header regardless of the URL.
 * 
 * Let's analyze what this means for the key structure.
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// Two samples
const FNAF2 = {
  pageData: '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4',
  url: 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866'
};

const CYBERPUNK = {
  pageData: '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4',
  urlPrefix: 'https://rapidshare.cc/stream/'
};

const fnaf2Cipher = urlSafeBase64Decode(FNAF2.pageData);
const cyberpunkCipher = urlSafeBase64Decode(CYBERPUNK.pageData);

console.log('=== Cross-Reference Analysis ===\n');

// The key for position i is derived from:
// key[i] = HEADER[i] XOR URL[i]  (for i < 19)
// key[i] = key[i-19] XOR (cipher[i] XOR cipher[i-19]) XOR (URL[i] XOR URL[i-19])  (for i >= 19)

// For FNAF2, we know the full URL, so we can compute the full key
const fnaf2Plain = Buffer.from(FNAF2.url, 'utf8');
const fnaf2Key = Buffer.alloc(fnaf2Cipher.length);

for (let i = 0; i < 19; i++) {
  fnaf2Key[i] = HEADER[i] ^ fnaf2Plain[i];
}

for (let i = 19; i < fnaf2Cipher.length; i++) {
  const cipherDiff = fnaf2Cipher[i] ^ fnaf2Cipher[i - 19];
  const plainDiff = fnaf2Plain[i] ^ fnaf2Plain[i - 19];
  fnaf2Key[i] = fnaf2Key[i - 19] ^ cipherDiff ^ plainDiff;
}

console.log('FNAF2 Key:', fnaf2Key.toString('hex'));

// For Cyberpunk, we know the URL prefix
const cyberpunkPlain = Buffer.from(CYBERPUNK.urlPrefix, 'utf8');
const cyberpunkKey = Buffer.alloc(cyberpunkCipher.length);

for (let i = 0; i < 19; i++) {
  cyberpunkKey[i] = HEADER[i] ^ cyberpunkPlain[i];
}

for (let i = 19; i < CYBERPUNK.urlPrefix.length; i++) {
  const cipherDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
  const plainDiff = cyberpunkPlain[i] ^ cyberpunkPlain[i - 19];
  cyberpunkKey[i] = cyberpunkKey[i - 19] ^ cipherDiff ^ plainDiff;
}

console.log('Cyberpunk Key (partial):', cyberpunkKey.slice(0, CYBERPUNK.urlPrefix.length).toString('hex'));

// Now here's the key insight:
// For position i >= 19, we have:
// cipher[i] = key[i] XOR plain[i]
// key[i] = key[i-19] XOR cipherDiff XOR plainDiff
//
// Substituting:
// cipher[i] = (key[i-19] XOR cipherDiff XOR plainDiff) XOR plain[i]
// cipher[i] = key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19] XOR plain[i]
// cipher[i] = key[i-19] XOR cipher[i-19] XOR plain[i-19]
//
// Rearranging:
// plain[i-19] = key[i-19] XOR cipher[i-19] XOR cipher[i] ... wait that's not right

// Let me try a different approach: direct XOR
// cipher[i] XOR key[i] = plain[i]
// We know key[i] = key[i-19] XOR cipherDiff XOR plainDiff
// So: cipher[i] XOR key[i-19] XOR cipherDiff XOR plainDiff = plain[i]
// cipher[i] XOR key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19] = plain[i]
// key[i-19] XOR cipher[i-19] XOR plain[i-19] = 0
// key[i-19] = cipher[i-19] XOR plain[i-19]
// Which is just the definition of XOR encryption!

// So the key is simply: key[i] = cipher[i] XOR plain[i]
// And the recurrence relation is just a way to compute it iteratively

// This means: if we know plain[i-19], we can compute plain[i] directly!
// plain[i] = cipher[i] XOR key[i]
// key[i] = key[i-19] XOR cipherDiff XOR plainDiff
// key[i] = (cipher[i-19] XOR plain[i-19]) XOR (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])
// key[i] = plain[i-19] XOR cipher[i] XOR plain[i] XOR plain[i-19]
// key[i] = cipher[i] XOR plain[i]  ✓ (this is consistent)

// The issue is that the equation is self-referential: plain[i] appears on both sides
// Let's solve for plain[i]:
// cipher[i] XOR key[i] = plain[i]
// cipher[i] XOR (key[i-19] XOR cipherDiff XOR plainDiff) = plain[i]
// cipher[i] XOR key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19] = plain[i]
// key[i-19] XOR cipher[i-19] XOR plain[i-19] = 0
// This is always true! So any plain[i] works as long as the recurrence is maintained.

// WAIT - this means the encryption is NOT uniquely decodable without knowing the full key!
// But we DO have the full key from FNAF2...

// Let me check if the keys are related between videos
console.log('\n=== Key Comparison ===');
console.log('FNAF2 key[0:19]:', fnaf2Key.slice(0, 19).toString('hex'));
console.log('Cyberpunk key[0:19]:', cyberpunkKey.slice(0, 19).toString('hex'));

// The keys are different because the URLs are different
// But the HEADER is the same...

// AH! The HEADER is the CIPHERTEXT, not the key!
// cipher[0:19] = HEADER (constant)
// key[0:19] = HEADER XOR URL[0:19]
// So key[0:19] varies with the URL

// This means we can't directly transfer the key between videos.
// BUT we can use the structure!

// For position i, we have:
// FNAF2: fnaf2Cipher[i] = fnaf2Key[i] XOR fnaf2Plain[i]
// Cyberpunk: cyberpunkCipher[i] = cyberpunkKey[i] XOR cyberpunkPlain[i]

// XORing these:
// fnaf2Cipher[i] XOR cyberpunkCipher[i] = (fnaf2Key[i] XOR fnaf2Plain[i]) XOR (cyberpunkKey[i] XOR cyberpunkPlain[i])
// fnaf2Cipher[i] XOR cyberpunkCipher[i] = fnaf2Key[i] XOR cyberpunkKey[i] XOR fnaf2Plain[i] XOR cyberpunkPlain[i]

// For i < 19:
// fnaf2Key[i] = HEADER[i] XOR fnaf2Plain[i]
// cyberpunkKey[i] = HEADER[i] XOR cyberpunkPlain[i]
// fnaf2Key[i] XOR cyberpunkKey[i] = fnaf2Plain[i] XOR cyberpunkPlain[i]

// So:
// fnaf2Cipher[i] XOR cyberpunkCipher[i] = (fnaf2Plain[i] XOR cyberpunkPlain[i]) XOR fnaf2Plain[i] XOR cyberpunkPlain[i]
// fnaf2Cipher[i] XOR cyberpunkCipher[i] = 0

// This confirms that cipher[0:19] is constant (the HEADER)!

console.log('\n=== Using FNAF2 key structure to decrypt Cyberpunk ===');

// The key insight: the key derivation formula is the same for both videos
// key[i] = key[i-19] XOR cipherDiff XOR plainDiff

// For FNAF2, we have the full key. Let's see if there's a pattern.

// Actually, let me try a different approach:
// What if the "key" is actually derived from something constant, like the app.js hash?

// Let's check the app.js hashes
console.log('\nFNAF2 app.js hash: 2457433dff868594ecbf3b15e9f22a46efd70a');
console.log('Cyberpunk app.js hash: 2457433dff948487f3bb6d58f9db2a11');

// They're different! But both start with "2457433dff"
// Let's see if this relates to the key

const fnaf2AppHash = Buffer.from('2457433dff868594ecbf3b15e9f22a46efd70a', 'hex');
const cyberpunkAppHash = Buffer.from('2457433dff948487f3bb6d58f9db2a11', 'hex');

console.log('\nFNAF2 app hash (hex):', fnaf2AppHash.toString('hex'));
console.log('Cyberpunk app hash (hex):', cyberpunkAppHash.toString('hex'));

// XOR the app hashes with the keys
console.log('\nFNAF2 key XOR app hash:');
for (let i = 0; i < Math.min(fnaf2Key.length, fnaf2AppHash.length); i++) {
  const xor = fnaf2Key[i] ^ fnaf2AppHash[i];
  process.stdout.write(xor.toString(16).padStart(2, '0') + ' ');
}
console.log();

// Hmm, let me try something else.
// What if the remaining bytes of the URL can be derived from the ciphertext difference?

console.log('\n=== Deriving Cyberpunk URL from ciphertext difference ===');

// For positions 29+ (after the known prefix), we need to find plain[i]
// We know:
// - cipher[i] for both videos
// - plain[i] for FNAF2
// - key derivation formula

// The ciphertext difference tells us something:
// cipherDiff = fnaf2Cipher[i] XOR cyberpunkCipher[i]
// = (fnaf2Key[i] XOR fnaf2Plain[i]) XOR (cyberpunkKey[i] XOR cyberpunkPlain[i])
// = fnaf2Key[i] XOR cyberpunkKey[i] XOR fnaf2Plain[i] XOR cyberpunkPlain[i]

// If we knew the key difference, we could solve for plaintext difference
// keyDiff = fnaf2Key[i] XOR cyberpunkKey[i]
// cipherDiff = keyDiff XOR fnaf2Plain[i] XOR cyberpunkPlain[i]
// cyberpunkPlain[i] = fnaf2Plain[i] XOR cipherDiff XOR keyDiff

// For i < 19:
// keyDiff = (HEADER[i] XOR fnaf2Plain[i]) XOR (HEADER[i] XOR cyberpunkPlain[i])
// keyDiff = fnaf2Plain[i] XOR cyberpunkPlain[i]

// So for i < 19:
// cipherDiff = (fnaf2Plain[i] XOR cyberpunkPlain[i]) XOR fnaf2Plain[i] XOR cyberpunkPlain[i] = 0 ✓

// For i >= 19, the key difference follows a recurrence:
// keyDiff[i] = keyDiff[i-19] XOR (fnaf2CipherDiff XOR cyberpunkCipherDiff) XOR (fnaf2PlainDiff XOR cyberpunkPlainDiff)

// This is getting complex. Let me just try to directly compute.

// Actually, I realize the issue: the encryption is a stream cipher where the key
// depends on the plaintext. This makes it non-trivial to decrypt without knowing
// the plaintext structure.

// BUT - we know the URL structure! Let's use that.
// rapidshare.cc URLs are: https://rapidshare.cc/stream/{hash}
// The hash is likely hex characters

// Let me try to find the hash by checking which characters produce valid decryption

console.log('\n=== Final attempt: Character-by-character decryption ===');

const cyberpunkDecrypt = Buffer.alloc(cyberpunkCipher.length);
const cyberpunkKeyFull = Buffer.alloc(cyberpunkCipher.length);

// Copy known prefix
for (let i = 0; i < CYBERPUNK.urlPrefix.length; i++) {
  cyberpunkDecrypt[i] = CYBERPUNK.urlPrefix.charCodeAt(i);
  if (i < 19) {
    cyberpunkKeyFull[i] = HEADER[i] ^ cyberpunkDecrypt[i];
  } else {
    const cipherDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
    const plainDiff = cyberpunkDecrypt[i] ^ cyberpunkDecrypt[i - 19];
    cyberpunkKeyFull[i] = cyberpunkKeyFull[i - 19] ^ cipherDiff ^ plainDiff;
  }
}

// For remaining positions, we need to guess
// The constraint is: cipher[i] XOR key[i] must be a valid URL character

const validChars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_./,=';

for (let i = CYBERPUNK.urlPrefix.length; i < cyberpunkCipher.length; i++) {
  // Try each valid character
  let found = false;
  
  for (const char of validChars) {
    const testPlain = char.charCodeAt(0);
    
    // Compute what key[i] would be
    const cipherDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
    const plainDiff = testPlain ^ cyberpunkDecrypt[i - 19];
    const testKey = cyberpunkKeyFull[i - 19] ^ cipherDiff ^ plainDiff;
    
    // Check if this key decrypts to our test character
    const decrypted = cyberpunkCipher[i] ^ testKey;
    
    if (decrypted === testPlain) {
      cyberpunkDecrypt[i] = testPlain;
      cyberpunkKeyFull[i] = testKey;
      found = true;
      break;
    }
  }
  
  if (!found) {
    // No valid character found - this shouldn't happen
    console.log(`Position ${i}: No valid character found`);
    // Use raw decryption
    const cipherDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
    cyberpunkKeyFull[i] = cyberpunkKeyFull[i - 19] ^ cipherDiff;
    cyberpunkDecrypt[i] = cyberpunkCipher[i] ^ cyberpunkKeyFull[i];
  }
}

console.log('\nDecrypted Cyberpunk URL:', cyberpunkDecrypt.toString('utf8'));
