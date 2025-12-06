/**
 * Pattern Analysis - Find relationship between cipher bytes
 * 
 * Since the cipher is self-referential, let's look for patterns
 * that could help us decrypt without knowing the plaintext.
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// FNAF2 data
const FNAF2_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const FNAF2_URL = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866';

// Cyberpunk data
const CYBERPUNK_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';

const fnaf2Cipher = urlSafeBase64Decode(FNAF2_PAGE_DATA);
const fnaf2Plain = Buffer.from(FNAF2_URL, 'utf8');
const cyberpunkCipher = urlSafeBase64Decode(CYBERPUNK_PAGE_DATA);

console.log('=== Pattern Analysis ===\n');

// For FNAF2, we know the plaintext. Let's see if there's a pattern
// in cipher[i] that relates to plain[i] without using the key.

console.log('FNAF2 cipher vs plaintext:');
console.log('i  | cipher | plain | c^p  | c^p^c[i-19] | p^p[i-19]');
console.log('-'.repeat(60));

for (let i = 0; i < fnaf2Cipher.length; i++) {
  const c = fnaf2Cipher[i];
  const p = fnaf2Plain[i];
  const xor = c ^ p;
  const cDiff = i >= 19 ? c ^ fnaf2Cipher[i - 19] : 0;
  const pDiff = i >= 19 ? p ^ fnaf2Plain[i - 19] : 0;
  const combined = i >= 19 ? xor ^ fnaf2Cipher[i - 19] : 0;
  
  console.log(`${i.toString().padStart(2)} | ${c.toString(16).padStart(2,'0')}     | ${String.fromCharCode(p).padStart(5)} | ${xor.toString(16).padStart(2,'0')}   | ${combined.toString(16).padStart(2,'0')}          | ${pDiff.toString(16).padStart(2,'0')}`);
}

// Let's check if cipher[i] XOR cipher[i-19] relates to plain[i] XOR plain[i-19]
console.log('\n=== Checking cipher diff vs plain diff ===');
console.log('i  | cDiff | pDiff | cDiff^pDiff');
console.log('-'.repeat(40));

for (let i = 19; i < fnaf2Cipher.length; i++) {
  const cDiff = fnaf2Cipher[i] ^ fnaf2Cipher[i - 19];
  const pDiff = fnaf2Plain[i] ^ fnaf2Plain[i - 19];
  const combined = cDiff ^ pDiff;
  
  console.log(`${i.toString().padStart(2)} | ${cDiff.toString(16).padStart(2,'0')}    | ${pDiff.toString(16).padStart(2,'0')}    | ${combined.toString(16).padStart(2,'0')}`);
}

// The combined value (cDiff XOR pDiff) is the key difference!
// key[i] XOR key[i-19] = cDiff XOR pDiff

// Now let's see if we can find a pattern in the key differences
console.log('\n=== Key difference pattern ===');

const keyDiffs = [];
for (let i = 19; i < fnaf2Cipher.length; i++) {
  const cDiff = fnaf2Cipher[i] ^ fnaf2Cipher[i - 19];
  const pDiff = fnaf2Plain[i] ^ fnaf2Plain[i - 19];
  keyDiffs.push(cDiff ^ pDiff);
}

console.log('Key diffs:', keyDiffs.map(d => d.toString(16).padStart(2, '0')).join(' '));

// Check if key diffs have a pattern
console.log('\nChecking for repeating pattern in key diffs...');
for (let period = 1; period <= 19; period++) {
  let matches = 0;
  for (let i = period; i < keyDiffs.length; i++) {
    if (keyDiffs[i] === keyDiffs[i - period]) matches++;
  }
  if (matches > keyDiffs.length / 2) {
    console.log(`Period ${period}: ${matches}/${keyDiffs.length - period} matches`);
  }
}

// Let's try a different approach: use the HEADER to derive the key
console.log('\n=== Using HEADER to derive key ===');

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// For i < 19: key[i] = HEADER[i] XOR plain[i]
// For i >= 19: key[i] = key[i-19] XOR keyDiff[i-19]

// If we know the key for positions 0-18, we can compute the rest!
// key[0:19] = HEADER XOR plain[0:19]

// For Cyberpunk, we know plain[0:29] = "https://rapidshare.cc/stream/"
const CYBERPUNK_PREFIX = 'https://rapidshare.cc/stream/';

const cyberpunkKey = Buffer.alloc(cyberpunkCipher.length);

// Compute key[0:19]
for (let i = 0; i < 19; i++) {
  cyberpunkKey[i] = HEADER[i] ^ CYBERPUNK_PREFIX.charCodeAt(i);
}

console.log('Cyberpunk key[0:19]:', cyberpunkKey.slice(0, 19).toString('hex'));

// For positions 19-28, we know the plaintext
for (let i = 19; i < CYBERPUNK_PREFIX.length; i++) {
  // key[i] = cipher[i] XOR plain[i]
  cyberpunkKey[i] = cyberpunkCipher[i] ^ CYBERPUNK_PREFIX.charCodeAt(i);
}

console.log('Cyberpunk key[0:29]:', cyberpunkKey.slice(0, 29).toString('hex'));

// Now for positions 29+, we need to find the key
// We know: key[i] = key[i-19] XOR keyDiff[i-19]
// And: keyDiff[i-19] = cipher[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19]

// But we don't know plain[i]!

// HOWEVER - we can use the Cyberpunk ciphertext to constrain the key!
// cipher[i] = key[i] XOR plain[i]
// key[i] = key[i-19] XOR (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])

// Let's try to find plain[i] by checking which values produce a consistent key

console.log('\n=== Finding consistent plaintext ===');

const cyberpunkPlain = Buffer.alloc(cyberpunkCipher.length);

// Copy known prefix
for (let i = 0; i < CYBERPUNK_PREFIX.length; i++) {
  cyberpunkPlain[i] = CYBERPUNK_PREFIX.charCodeAt(i);
}

// For positions 29+, try to find consistent plaintext
for (let i = CYBERPUNK_PREFIX.length; i < cyberpunkCipher.length; i++) {
  // We need: cipher[i] = key[i] XOR plain[i]
  // And: key[i] = key[i-19] XOR (cipher[i] XOR cipher[i-19]) XOR (plain[i] XOR plain[i-19])
  
  // Substituting:
  // cipher[i] = (key[i-19] XOR cDiff XOR pDiff) XOR plain[i]
  // cipher[i] = key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i] XOR plain[i-19] XOR plain[i]
  // cipher[i] = key[i-19] XOR cipher[i] XOR cipher[i-19] XOR plain[i-19]
  // 0 = key[i-19] XOR cipher[i-19] XOR plain[i-19]
  // plain[i-19] = key[i-19] XOR cipher[i-19]
  
  // This gives us plain[i-19], not plain[i]!
  // But we already know plain[i-19] for i-19 < 29...
  
  // For i = 29: plain[10] = key[10] XOR cipher[10]
  // We know key[10] and cipher[10], so we can verify plain[10]
  
  if (i === 29) {
    const computed_plain_10 = cyberpunkKey[10] ^ cyberpunkCipher[10];
    console.log(`Computed plain[10] = ${computed_plain_10} = '${String.fromCharCode(computed_plain_10)}'`);
    console.log(`Actual plain[10] = ${cyberpunkPlain[10]} = '${String.fromCharCode(cyberpunkPlain[10])}'`);
    console.log(`Match: ${computed_plain_10 === cyberpunkPlain[10]}`);
  }
  
  // For i >= 48: plain[i-19] = key[i-19] XOR cipher[i-19]
  // We can compute key[i-19] from the recurrence!
  
  // Actually, let's just compute the key for all positions using the recurrence
  // and then decrypt.
  
  const cDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
  const pDiff_prev = cyberpunkPlain[i - 19] ^ (i >= 38 ? cyberpunkPlain[i - 38] : 0);
  
  // We need plain[i] to compute key[i]
  // Let's try: plain[i] = cipher[i] XOR key[i-19] XOR cDiff XOR pDiff
  // But pDiff = plain[i] XOR plain[i-19], so this is circular!
  
  // The only way out is to use additional constraints.
  // Let's assume the hash is hex (0-9, a-f) and try each character.
  
  const hexChars = '0123456789abcdef';
  let found = false;
  
  for (const char of hexChars) {
    const testPlain = char.charCodeAt(0);
    const testPDiff = testPlain ^ cyberpunkPlain[i - 19];
    const testKey = cyberpunkKey[i - 19] ^ cDiff ^ testPDiff;
    const testDecrypt = cyberpunkCipher[i] ^ testKey;
    
    if (testDecrypt === testPlain) {
      cyberpunkPlain[i] = testPlain;
      cyberpunkKey[i] = testKey;
      found = true;
      break;
    }
  }
  
  if (!found) {
    // Try other URL characters
    for (const char of '/-_.') {
      const testPlain = char.charCodeAt(0);
      const testPDiff = testPlain ^ cyberpunkPlain[i - 19];
      const testKey = cyberpunkKey[i - 19] ^ cDiff ^ testPDiff;
      const testDecrypt = cyberpunkCipher[i] ^ testKey;
      
      if (testDecrypt === testPlain) {
        cyberpunkPlain[i] = testPlain;
        cyberpunkKey[i] = testKey;
        found = true;
        break;
      }
    }
  }
  
  if (!found) {
    // Fallback: use '0'
    cyberpunkPlain[i] = '0'.charCodeAt(0);
    const testPDiff = cyberpunkPlain[i] ^ cyberpunkPlain[i - 19];
    cyberpunkKey[i] = cyberpunkKey[i - 19] ^ cDiff ^ testPDiff;
  }
}

console.log('\n=== RESULT ===');
console.log('Decrypted Cyberpunk URL:', cyberpunkPlain.toString('utf8'));

// The issue is that the self-check (testDecrypt === testPlain) is always true
// because of how the cipher works!

// Let me verify this:
console.log('\n=== Verifying self-check ===');
for (const char of '0123456789abcdef') {
  const testPlain = char.charCodeAt(0);
  const testPDiff = testPlain ^ cyberpunkPlain[28]; // plain[i-19] for i=47
  const testKey = cyberpunkKey[28] ^ (cyberpunkCipher[47] ^ cyberpunkCipher[28]) ^ testPDiff;
  const testDecrypt = cyberpunkCipher[47] ^ testKey;
  console.log(`char='${char}': testDecrypt=${testDecrypt} testPlain=${testPlain} match=${testDecrypt === testPlain}`);
}

// If all characters pass the self-check, then the cipher is truly degenerate
// and we cannot decrypt without additional information.
