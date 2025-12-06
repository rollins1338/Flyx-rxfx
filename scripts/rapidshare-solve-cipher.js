/**
 * Solve the cipher by analyzing the mathematical structure
 * 
 * The encryption is:
 * cipher[i] = key[i] XOR plain[i]
 * 
 * Where:
 * key[i] = HEADER[i] XOR plain[i]  (for i < 19)
 * key[i] = key[i-19] XOR (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])  (for i >= 19)
 * 
 * Substituting key into cipher equation for i < 19:
 * cipher[i] = (HEADER[i] XOR plain[i]) XOR plain[i]
 * cipher[i] = HEADER[i]
 * 
 * This confirms that cipher[0:19] = HEADER (constant)!
 * 
 * For i >= 19:
 * cipher[i] = key[i] XOR plain[i]
 * cipher[i] = (key[i-19] XOR cipherDiff XOR plainDiff) XOR plain[i]
 * 
 * Let's expand this:
 * cipher[i] = key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19] XOR plain[i]
 * cipher[i] = key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i-19]
 * 0 = key[i-19] XOR cipher[i-19] XOR plain[i-19]
 * key[i-19] = cipher[i-19] XOR plain[i-19]
 * 
 * This is just the definition of XOR encryption! So the recurrence is consistent.
 * 
 * The key insight: cipher[i] for i >= 19 DOES depend on plain[i]!
 * Let's solve for plain[i]:
 * 
 * cipher[i] = key[i] XOR plain[i]
 * key[i] = key[i-19] XOR (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])
 * 
 * Substituting:
 * cipher[i] = (key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19]) XOR plain[i]
 * cipher[i] = key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i-19]
 * 0 = key[i-19] XOR cipher[i-19] XOR plain[i-19]
 * 
 * This is always true! So the equation doesn't constrain plain[i].
 * 
 * WAIT - this means the cipher[i] for i >= 19 is NOT determined by plain[i]!
 * Let me re-derive...
 * 
 * Actually, I think I've been making an error. Let me be more careful.
 * 
 * The ENCRYPTION process is:
 * 1. key[i] = HEADER[i] XOR plain[i]  (for i < 19)
 * 2. cipher[i] = key[i] XOR plain[i]  (for all i)
 * 3. For i >= 19: key[i] = key[i-19] XOR (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])
 * 
 * But step 3 uses cipher[i] which depends on key[i]... this is circular!
 * 
 * Let me think about this differently. The encryption must be:
 * 1. Compute key[0:19] = HEADER XOR plain[0:19]
 * 2. cipher[0:19] = key[0:19] XOR plain[0:19] = HEADER
 * 3. For i >= 19:
 *    - First compute key[i] using some formula that doesn't depend on cipher[i]
 *    - Then cipher[i] = key[i] XOR plain[i]
 * 
 * The formula for key[i] must be:
 * key[i] = f(key[0:i-1], plain[0:i-1], cipher[0:i-1])
 * 
 * Given that we observed:
 * key[i] = key[i-19] XOR (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])
 * 
 * And cipher[i] = key[i] XOR plain[i], we can substitute:
 * key[i] = key[i-19] XOR ((key[i] XOR plain[i]) XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])
 * key[i] = key[i-19] XOR key[i] XOR plain[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19]
 * 0 = key[i-19] XOR cipher[i-19] XOR plain[i-19]
 * 
 * This is always true (by definition of XOR encryption), so it doesn't help.
 * 
 * Let me try a DIFFERENT formula. What if the key is computed BEFORE the cipher?
 * key[i] = key[i-19] XOR (plain[i] XOR plain[i-19])
 * cipher[i] = key[i] XOR plain[i]
 * 
 * Then:
 * cipher[i] = (key[i-19] XOR plain[i] XOR plain[i-19]) XOR plain[i]
 * cipher[i] = key[i-19] XOR plain[i-19]
 * cipher[i] = cipher[i-19]  (since key[i-19] XOR plain[i-19] = cipher[i-19])
 * 
 * This would mean cipher[i] = cipher[i-19] for all i >= 19!
 * Let's check if this is true for FNAF2...
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const FNAF2_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const fnaf2Cipher = urlSafeBase64Decode(FNAF2_PAGE_DATA);

console.log('=== Checking if cipher[i] = cipher[i-19] ===\n');

for (let i = 19; i < fnaf2Cipher.length; i++) {
  const same = fnaf2Cipher[i] === fnaf2Cipher[i - 19];
  console.log(`i=${i}: cipher[i]=${fnaf2Cipher[i].toString(16).padStart(2,'0')} cipher[i-19]=${fnaf2Cipher[i-19].toString(16).padStart(2,'0')} same=${same}`);
}

// They're NOT the same! So the formula must include cipher[i-19] somehow.

console.log('\n=== Trying different key formula ===\n');

// What if: key[i] = key[i-19] XOR constant
// Then: cipher[i] = (key[i-19] XOR constant) XOR plain[i]
// And: cipher[i] XOR cipher[i-19] = (key[i-19] XOR constant XOR plain[i]) XOR (key[i-19] XOR plain[i-19])
//                                 = constant XOR plain[i] XOR plain[i-19]

// So: constant = (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])

const FNAF2_URL = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866';
const fnaf2Plain = Buffer.from(FNAF2_URL, 'utf8');

console.log('Checking if constant is the same for all i >= 19:');
const constants = [];
for (let i = 19; i < fnaf2Cipher.length; i++) {
  const cipherDiff = fnaf2Cipher[i] ^ fnaf2Cipher[i - 19];
  const plainDiff = fnaf2Plain[i] ^ fnaf2Plain[i - 19];
  const constant = cipherDiff ^ plainDiff;
  constants.push(constant);
  console.log(`i=${i}: cipherDiff=${cipherDiff.toString(16).padStart(2,'0')} plainDiff=${plainDiff.toString(16).padStart(2,'0')} constant=${constant.toString(16).padStart(2,'0')}`);
}

// Check if all constants are the same
const allSame = constants.every(c => c === constants[0]);
console.log('\nAll constants same?', allSame);

if (!allSame) {
  // The constant varies! This means the key formula is more complex.
  // Let's see if there's a pattern in the constants.
  
  console.log('\n=== Analyzing constant pattern ===');
  
  // Maybe the constant depends on position?
  // Or maybe it's derived from the key itself?
  
  // Let's compute the actual key and see
  const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');
  const fnaf2Key = Buffer.alloc(fnaf2Cipher.length);
  
  for (let i = 0; i < fnaf2Cipher.length; i++) {
    fnaf2Key[i] = fnaf2Cipher[i] ^ fnaf2Plain[i];
  }
  
  console.log('\nFNAF2 Key:', fnaf2Key.toString('hex'));
  console.log('HEADER:', HEADER.toString('hex'));
  
  // Check key[0:19] = HEADER XOR plain[0:19]
  const expectedKey0_19 = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    expectedKey0_19[i] = HEADER[i] ^ fnaf2Plain[i];
  }
  console.log('\nExpected key[0:19]:', expectedKey0_19.toString('hex'));
  console.log('Actual key[0:19]:', fnaf2Key.slice(0, 19).toString('hex'));
  console.log('Match:', expectedKey0_19.toString('hex') === fnaf2Key.slice(0, 19).toString('hex'));
  
  // Now check the key recurrence
  console.log('\n=== Key recurrence analysis ===');
  for (let i = 19; i < fnaf2Key.length; i++) {
    const keyDiff = fnaf2Key[i] ^ fnaf2Key[i - 19];
    const cipherDiff = fnaf2Cipher[i] ^ fnaf2Cipher[i - 19];
    const plainDiff = fnaf2Plain[i] ^ fnaf2Plain[i - 19];
    
    // Check if keyDiff = cipherDiff XOR plainDiff
    const expected = cipherDiff ^ plainDiff;
    console.log(`i=${i}: keyDiff=${keyDiff.toString(16).padStart(2,'0')} expected=${expected.toString(16).padStart(2,'0')} match=${keyDiff === expected}`);
  }
}

// Now let's try to use this to decrypt Cyberpunk
console.log('\n\n=== Decrypting Cyberpunk ===\n');

const CYBERPUNK_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';
const cyberpunkCipher = urlSafeBase64Decode(CYBERPUNK_PAGE_DATA);
const CYBERPUNK_PREFIX = 'https://rapidshare.cc/stream/';

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// Compute key[0:19]
const cyberpunkKey = Buffer.alloc(cyberpunkCipher.length);
const cyberpunkPlain = Buffer.alloc(cyberpunkCipher.length);

for (let i = 0; i < 19; i++) {
  cyberpunkKey[i] = HEADER[i] ^ CYBERPUNK_PREFIX.charCodeAt(i);
  cyberpunkPlain[i] = cyberpunkCipher[i] ^ cyberpunkKey[i];
}

console.log('Decrypted [0:19]:', cyberpunkPlain.slice(0, 19).toString('utf8'));

// For positions 19 to prefix length
for (let i = 19; i < CYBERPUNK_PREFIX.length; i++) {
  // We know the plaintext, so we can compute the key
  const cipherDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
  const plainDiff = CYBERPUNK_PREFIX.charCodeAt(i) ^ CYBERPUNK_PREFIX.charCodeAt(i - 19);
  cyberpunkKey[i] = cyberpunkKey[i - 19] ^ cipherDiff ^ plainDiff;
  cyberpunkPlain[i] = cyberpunkCipher[i] ^ cyberpunkKey[i];
}

console.log('Decrypted [0:' + CYBERPUNK_PREFIX.length + ']:', cyberpunkPlain.slice(0, CYBERPUNK_PREFIX.length).toString('utf8'));

// For remaining positions, we need to find plaintext that satisfies:
// plain[i] = cipher[i] XOR key[i]
// key[i] = key[i-19] XOR cipherDiff XOR plainDiff
// 
// Substituting:
// plain[i] = cipher[i] XOR (key[i-19] XOR cipherDiff XOR (plain[i] XOR plain[i-19]))
// plain[i] = cipher[i] XOR key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19]
// 0 = key[i-19] XOR cipher[i-19] XOR plain[i-19]
// 
// This is always true! So we can't solve for plain[i] uniquely.

// BUT WAIT - we have the FNAF2 key! And the key derivation is deterministic.
// If the key derivation uses the same formula, then:
// cyberpunkKey[i] = cyberpunkKey[i-19] XOR cyberpunkCipherDiff XOR cyberpunkPlainDiff

// The issue is that cyberpunkPlainDiff depends on cyberpunkPlain[i] which we don't know.

// HOWEVER - what if the key is derived from something OTHER than the plaintext?
// Like the app.js hash or embed ID?

// Let me check if the key has a pattern independent of plaintext
console.log('\n=== Checking key pattern ===');

// For FNAF2, compute key[i] - key[i-19]
console.log('FNAF2 key differences:');
for (let i = 19; i < fnaf2Key.length; i++) {
  const diff = fnaf2Key[i] ^ fnaf2Key[i - 19];
  console.log(`i=${i}: diff=${diff.toString(16).padStart(2,'0')}`);
}

// For Cyberpunk (partial)
console.log('\nCyberpunk key differences (partial):');
for (let i = 19; i < CYBERPUNK_PREFIX.length; i++) {
  const diff = cyberpunkKey[i] ^ cyberpunkKey[i - 19];
  console.log(`i=${i}: diff=${diff.toString(16).padStart(2,'0')}`);
}

// The key differences are different! This confirms the key depends on plaintext.

// FINAL INSIGHT: The encryption is a self-synchronizing stream cipher.
// Without knowing the plaintext, we cannot uniquely decrypt.
// The only way to decrypt is to:
// 1. Know the full plaintext (like we do for FNAF2)
// 2. Brute-force with constraints (like URL structure)
// 3. Intercept the decrypted URL from the browser

console.log('\n=== CONCLUSION ===');
console.log('The encryption is a self-synchronizing stream cipher.');
console.log('The key depends on the plaintext, making unique decryption impossible');
console.log('without additional constraints.');
console.log('');
console.log('To decrypt Cyberpunk, we need to either:');
console.log('1. Intercept the URL from the browser (JWPlayer hook)');
console.log('2. Find an API that returns the URL');
console.log('3. Brute-force with URL structure constraints');
