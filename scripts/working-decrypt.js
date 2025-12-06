/**
 * Working Decryption Algorithm
 * 
 * Based on our analysis:
 * - key[0:19] = header XOR URL[0:19]
 * - key[i] = key[i-19] XOR something[i-19] for i >= 19
 * - something = key[i-19] XOR key[i]
 * 
 * The key insight: we can compute the key iteratively if we know the URL prefix!
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
const urlFirst56 = knownUrl.substring(0, 56);

console.log('=== Working Decryption ===\n');

// Derive actual key for verification
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

// The decryption algorithm:
// 1. We need to know URL[0:19] to compute key[0:19]
// 2. We need to know "something" to compute key[19:56]
// 3. "something" depends on URL, which we're trying to find!

// The breakthrough: "something" can be computed from ciphertext and URL prefix!
// something[i] = C[i] XOR U[i]
// where C = cipher[0:19] XOR cipher[19:38]
// and U = URL[0:19] XOR URL[19:38]

// If we know URL[0:38], we can compute everything!

function decrypt(ciphertext, urlPrefix) {
  // urlPrefix should be at least 38 characters
  if (urlPrefix.length < 38) {
    throw new Error('URL prefix must be at least 38 characters');
  }
  
  const header = ciphertext.subarray(0, 19);
  const key = Buffer.alloc(ciphertext.length);
  
  // Step 1: Compute key[0:19] = header XOR URL[0:19]
  for (let i = 0; i < 19; i++) {
    key[i] = header[i] ^ urlPrefix.charCodeAt(i);
  }
  
  // Step 2: Compute C = cipher[0:19] XOR cipher[19:38]
  const C = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    C[i] = ciphertext[i] ^ ciphertext[19 + i];
  }
  
  // Step 3: Compute U = URL[0:19] XOR URL[19:38]
  const U = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    U[i] = urlPrefix.charCodeAt(i) ^ urlPrefix.charCodeAt(19 + i);
  }
  
  // Step 4: Compute something = C XOR U
  const something = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    something[i] = C[i] ^ U[i];
  }
  
  // Step 5: Compute key[19:38] = key[0:19] XOR something
  for (let i = 19; i < 38; i++) {
    key[i] = key[i - 19] ^ something[i - 19];
  }
  
  // Step 6: For positions 38+, we need to continue the pattern
  // key[i] = key[i-19] XOR something2[i-38]
  // where something2 = key[19:37] XOR key[38:56]
  
  // But we don't know key[38:56] yet!
  // However, we can compute it iteratively:
  // 
  // Decrypt URL[38:56] using the pattern:
  // URL[i] = cipher[i] XOR key[i]
  // key[i] = key[i-19] XOR (key[i-38] XOR key[i-19])
  //        = key[i-38]
  // 
  // Wait, that would mean key repeats with period 38!
  // Let me verify...
  
  // Actually, the pattern is:
  // key[i] = key[i-19] XOR something[i-19]
  // For i in 38-56: key[i] = key[i-19] XOR something[(i-19) % 19]
  //                       = key[i-19] XOR something[i-38]
  
  // Let's compute key[38:56]
  for (let i = 38; i < ciphertext.length; i++) {
    key[i] = key[i - 19] ^ something[(i - 19) % 19];
  }
  
  // Decrypt
  const plaintext = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  return {
    plaintext: plaintext.toString('utf8'),
    key: key
  };
}

// Test with known URL prefix (38 characters)
const urlPrefix38 = 'https://rrr.core36link.site/p267/c5/h6';
console.log('URL prefix (38 chars):', urlPrefix38);

const result = decrypt(ciphertext, urlPrefix38);
console.log('\nDecrypted:', result.plaintext);
console.log('Expected:', urlFirst56);
console.log('Match:', result.plaintext === urlFirst56);

// Compare keys
console.log('\n=== Key comparison ===\n');
console.log('Computed key:', result.key.toString('hex'));
console.log('Actual key:  ', actualKey.toString('hex'));
console.log('Match:', result.key.toString('hex') === actualKey.toString('hex'));

// The issue is that "something" changes for each 19-byte segment!
// Let me recalculate...

console.log('\n=== Recalculating with correct pattern ===\n');

// The correct pattern is:
// something1 = key[0:19] XOR key[19:38]
// something2 = key[19:38] XOR key[38:56]
// 
// And: something1 = C1 XOR U1
//      something2 = C2 XOR U2
// 
// Where:
// C1 = cipher[0:19] XOR cipher[19:38]
// C2 = cipher[19:38] XOR cipher[38:56]
// U1 = URL[0:19] XOR URL[19:38]
// U2 = URL[19:38] XOR URL[38:56]

// The problem: we don't know URL[38:56] to compute U2!

// But wait - we can decrypt URL[38:56] using key[38:56]
// And key[38:56] = key[19:38] XOR something2
// And something2 = C2 XOR U2
// And U2 = URL[19:38] XOR URL[38:56]

// This is circular! URL[38:56] depends on itself.

// HOWEVER: we can solve this!
// URL[38:56] = cipher[38:56] XOR key[38:56]
//            = cipher[38:56] XOR key[19:38] XOR something2
//            = cipher[38:56] XOR key[19:38] XOR C2 XOR U2
//            = cipher[38:56] XOR key[19:38] XOR C2 XOR URL[19:38] XOR URL[38:56]

// Rearranging:
// URL[38:56] XOR URL[38:56] = cipher[38:56] XOR key[19:38] XOR C2 XOR URL[19:38]
// 0 = cipher[38:56] XOR key[19:38] XOR C2 XOR URL[19:38]

// This means: cipher[38:56] = key[19:38] XOR C2 XOR URL[19:38]

// Let's verify this!
const C2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  C2[i] = ciphertext[19 + i] ^ ciphertext[38 + i];
}

const url19to37 = urlFirst56.substring(19, 37);
const key19to37 = actualKey.subarray(19, 37);

const expected = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  expected[i] = key19to37[i] ^ C2[i] ^ url19to37.charCodeAt(i);
}

console.log('cipher[38:56]:', ciphertext.subarray(38, 56).toString('hex'));
console.log('key[19:37] XOR C2 XOR URL[19:37]:', expected.toString('hex'));
console.log('Match:', ciphertext.subarray(38, 56).toString('hex') === expected.toString('hex'));

// If this is true, then we can compute key[38:56] without knowing URL[38:56]!
// key[38:56] = cipher[38:56] XOR URL[38:56]
// But we showed: cipher[38:56] = key[19:37] XOR C2 XOR URL[19:37]
// So: key[38:56] = (key[19:37] XOR C2 XOR URL[19:37]) XOR URL[38:56]

// Hmm, this still has URL[38:56] in it...

// Let me try a different approach: use the relationship directly
// cipher[38:56] = key[19:37] XOR C2 XOR URL[19:37]
// This means: URL[38:56] = cipher[38:56] XOR key[38:56]
//                        = (key[19:37] XOR C2 XOR URL[19:37]) XOR key[38:56]

// And: key[38:56] = key[19:37] XOR something2
//                 = key[19:37] XOR C2 XOR U2
//                 = key[19:37] XOR C2 XOR URL[19:37] XOR URL[38:56]

// Substituting:
// URL[38:56] = (key[19:37] XOR C2 XOR URL[19:37]) XOR (key[19:37] XOR C2 XOR URL[19:37] XOR URL[38:56])
//            = URL[38:56]

// This is always true! So we can't determine URL[38:56] from this equation alone.

// The key insight: we need MORE information to decrypt positions 38+!
// Either:
// 1. Know more of the URL prefix
// 2. Find "something2" from another source
// 3. Brute-force the remaining characters

console.log('\n=== Conclusion ===\n');
console.log('To decrypt the full URL, we need to know at least 38 characters of the URL prefix.');
console.log('With 38 characters, we can decrypt positions 0-37.');
console.log('For positions 38+, we need additional information or brute-forcing.');
console.log('');
console.log('For the FNAF2 example:');
console.log('URL prefix: https://rrr.core36link.site/p267/c5/h6');
console.log('This gives us the first 38 characters of the decrypted URL.');
console.log('The remaining 18 characters (positions 38-55) contain part of the hash.');

console.log('\n=== Done ===');
