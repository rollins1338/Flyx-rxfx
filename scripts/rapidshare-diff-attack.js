/**
 * Differential Attack on RapidShare Cipher
 * 
 * We have two ciphertexts with the same header (first 19 bytes).
 * Let's use the difference to derive the plaintext.
 * 
 * For i < 19:
 * cipher1[i] = cipher2[i] = HEADER[i]
 * key1[i] = HEADER[i] XOR plain1[i]
 * key2[i] = HEADER[i] XOR plain2[i]
 * 
 * For i >= 19:
 * cipher1[i] = key1[i] XOR plain1[i]
 * cipher2[i] = key2[i] XOR plain2[i]
 * 
 * XORing:
 * cipher1[i] XOR cipher2[i] = (key1[i] XOR plain1[i]) XOR (key2[i] XOR plain2[i])
 *                           = key1[i] XOR key2[i] XOR plain1[i] XOR plain2[i]
 * 
 * Let D_c = cipher1 XOR cipher2 (ciphertext difference)
 * Let D_k = key1 XOR key2 (key difference)
 * Let D_p = plain1 XOR plain2 (plaintext difference)
 * 
 * Then: D_c[i] = D_k[i] XOR D_p[i]
 * 
 * For i < 19:
 * D_k[i] = (HEADER[i] XOR plain1[i]) XOR (HEADER[i] XOR plain2[i])
 *        = plain1[i] XOR plain2[i]
 *        = D_p[i]
 * 
 * So: D_c[i] = D_p[i] XOR D_p[i] = 0 for i < 19 ✓ (confirmed by constant header)
 * 
 * For i >= 19:
 * key1[i] = key1[i-19] XOR (cipher1[i] XOR cipher1[i-19]) XOR (plain1[i] XOR plain1[i-19])
 * key2[i] = key2[i-19] XOR (cipher2[i] XOR cipher2[i-19]) XOR (plain2[i] XOR plain2[i-19])
 * 
 * D_k[i] = key1[i] XOR key2[i]
 *        = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i] XOR D_p[i-19]
 * 
 * And: D_c[i] = D_k[i] XOR D_p[i]
 * 
 * Substituting:
 * D_c[i] = (D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i] XOR D_p[i-19]) XOR D_p[i]
 * D_c[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i-19]
 * 0 = D_k[i-19] XOR D_c[i-19] XOR D_p[i-19]
 * D_p[i-19] = D_k[i-19] XOR D_c[i-19]
 * 
 * But D_k[i-19] = D_p[i-19] for i-19 < 19, i.e., i < 38
 * So: D_p[i-19] = D_p[i-19] XOR D_c[i-19]
 * This means D_c[i-19] = 0 for i < 38, i.e., D_c[j] = 0 for j < 19 ✓
 * 
 * For i >= 38:
 * D_p[i-19] = D_k[i-19] XOR D_c[i-19]
 * 
 * We need to find D_k[i-19] for i-19 >= 19, i.e., i >= 38
 * 
 * Let's compute this recursively!
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// FNAF2 (known plaintext)
const FNAF2_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const FNAF2_URL = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866';

// Cyberpunk (unknown plaintext, known prefix)
const CYBERPUNK_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';
const CYBERPUNK_PREFIX = 'https://rapidshare.cc/stream/';

const cipher1 = urlSafeBase64Decode(FNAF2_PAGE_DATA);
const cipher2 = urlSafeBase64Decode(CYBERPUNK_PAGE_DATA);
const plain1 = Buffer.from(FNAF2_URL, 'utf8');

console.log('=== Differential Attack ===\n');
console.log('Cipher1 (FNAF2):', cipher1.toString('hex'));
console.log('Cipher2 (Cyberpunk):', cipher2.toString('hex'));
console.log('Plain1 (FNAF2):', FNAF2_URL);
console.log('Plain2 prefix:', CYBERPUNK_PREFIX);

// Compute ciphertext difference
const D_c = Buffer.alloc(cipher1.length);
for (let i = 0; i < cipher1.length; i++) {
  D_c[i] = cipher1[i] ^ cipher2[i];
}
console.log('\nCiphertext difference D_c:', D_c.toString('hex'));

// Verify D_c[0:19] = 0
console.log('D_c[0:19] all zeros?', D_c.slice(0, 19).every(b => b === 0));

// Compute key1 (FNAF2 key)
const key1 = Buffer.alloc(cipher1.length);
for (let i = 0; i < cipher1.length; i++) {
  key1[i] = cipher1[i] ^ plain1[i];
}

// Compute key difference D_k
// For i < 19: D_k[i] = D_p[i] = plain1[i] XOR plain2[i]
// We know plain2[0:29] = CYBERPUNK_PREFIX

const D_p = Buffer.alloc(cipher1.length);
const D_k = Buffer.alloc(cipher1.length);

// For positions where we know both plaintexts
for (let i = 0; i < Math.min(plain1.length, CYBERPUNK_PREFIX.length); i++) {
  D_p[i] = plain1[i] ^ CYBERPUNK_PREFIX.charCodeAt(i);
}

console.log('\nPlaintext difference D_p[0:29]:', D_p.slice(0, 29).toString('hex'));

// For i < 19: D_k[i] = D_p[i]
for (let i = 0; i < 19; i++) {
  D_k[i] = D_p[i];
}

// For i >= 19: D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i] XOR D_p[i-19]
// But we don't know D_p[i] for i >= 29...

// Let's use what we know to compute D_k for positions 19-28
for (let i = 19; i < CYBERPUNK_PREFIX.length; i++) {
  D_k[i] = D_k[i - 19] ^ D_c[i] ^ D_c[i - 19] ^ D_p[i] ^ D_p[i - 19];
}

console.log('Key difference D_k[0:29]:', D_k.slice(0, 29).toString('hex'));

// Now, for positions 29+, we can use the relationship:
// D_c[i] = D_k[i] XOR D_p[i]
// D_p[i] = D_c[i] XOR D_k[i]
// 
// And: D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i] XOR D_p[i-19]
// 
// Substituting D_p[i] = D_c[i] XOR D_k[i]:
// D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR (D_c[i] XOR D_k[i]) XOR D_p[i-19]
// D_k[i] = D_k[i-19] XOR D_c[i-19] XOR D_k[i] XOR D_p[i-19]
// 0 = D_k[i-19] XOR D_c[i-19] XOR D_p[i-19]
// D_p[i-19] = D_k[i-19] XOR D_c[i-19]
// 
// This gives us D_p[i-19] in terms of known quantities!
// For i = 29: D_p[10] = D_k[10] XOR D_c[10]
// But we already know D_p[10] from the prefix...

// Let me verify this relationship
console.log('\n=== Verifying D_p[i-19] = D_k[i-19] XOR D_c[i-19] ===');
for (let i = 19; i < CYBERPUNK_PREFIX.length; i++) {
  const computed = D_k[i - 19] ^ D_c[i - 19];
  const actual = D_p[i - 19];
  console.log(`i=${i}: D_p[${i-19}] computed=${computed.toString(16).padStart(2,'0')} actual=${actual.toString(16).padStart(2,'0')} match=${computed === actual}`);
}

// Great! The relationship holds. Now let's use it to find D_p for positions 29+
console.log('\n=== Computing D_p for positions 29+ ===');

// For i >= 48 (so i-19 >= 29), we can compute D_p[i-19] = D_k[i-19] XOR D_c[i-19]
// But we need D_k[i-19] which requires D_p[i-19]... circular!

// Wait, let me re-derive. For position j >= 29:
// We want D_p[j] = plain1[j] XOR plain2[j]
// 
// From the recurrence at position j+19:
// D_p[j] = D_k[j] XOR D_c[j]
// 
// And D_k[j] = D_k[j-19] XOR D_c[j] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]
// 
// Substituting:
// D_p[j] = (D_k[j-19] XOR D_c[j] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]) XOR D_c[j]
// D_p[j] = D_k[j-19] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]
// 0 = D_k[j-19] XOR D_c[j-19] XOR D_p[j-19]
// 
// This doesn't give us D_p[j], it gives us a constraint on D_p[j-19]!

// Let me try a different approach: compute everything iteratively

console.log('\n=== Iterative computation ===');

// We know D_p[0:29] and D_k[0:29]
// For j = 29, 30, ..., we need to find D_p[j]

// From D_c[j] = D_k[j] XOR D_p[j], we get D_p[j] = D_c[j] XOR D_k[j]
// And D_k[j] = D_k[j-19] XOR D_c[j] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]

// Substituting:
// D_p[j] = D_c[j] XOR (D_k[j-19] XOR D_c[j] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19])
// D_p[j] = D_k[j-19] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]
// 2*D_p[j] = D_k[j-19] XOR D_c[j-19] XOR D_p[j-19]
// 0 = D_k[j-19] XOR D_c[j-19] XOR D_p[j-19]  (since 2*x = 0 in XOR)

// This is a CONSTRAINT, not a solution!
// It means: D_p[j-19] = D_k[j-19] XOR D_c[j-19]

// For j = 29: D_p[10] = D_k[10] XOR D_c[10]
// We know D_p[10] and D_k[10], let's verify D_c[10] = 0
console.log('D_c[10] =', D_c[10], '(should be 0 since i < 19)');

// For j = 48: D_p[29] = D_k[29] XOR D_c[29]
// We know D_k[29] (computed above), and D_c[29] from ciphertext
const D_p_29 = D_k[29] ^ D_c[29];
console.log('D_p[29] =', D_p_29.toString(16).padStart(2, '0'));

// plain2[29] = plain1[29] XOR D_p[29]
const plain2_29 = plain1[29] ^ D_p_29;
console.log('plain2[29] =', plain2_29, '=', String.fromCharCode(plain2_29));

// Continue for more positions
for (let j = 29; j < cipher1.length - 19; j++) {
  // D_p[j] = D_k[j] XOR D_c[j]
  // But we need D_k[j] first
  
  // D_k[j] = D_k[j-19] XOR D_c[j] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]
  // This requires D_p[j] which we're trying to find!
  
  // Let's use the constraint: D_p[j] = D_k[j] XOR D_c[j]
  // And: D_k[j] = D_k[j-19] XOR D_c[j] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]
  // 
  // Substituting D_k[j]:
  // D_p[j] = (D_k[j-19] XOR D_c[j] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]) XOR D_c[j]
  // D_p[j] = D_k[j-19] XOR D_c[j-19] XOR D_p[j] XOR D_p[j-19]
  // 0 = D_k[j-19] XOR D_c[j-19] XOR D_p[j-19]
  // 
  // This gives us: D_p[j-19] = D_k[j-19] XOR D_c[j-19]
  // Which we can use to VERIFY our D_p values, not compute new ones!
}

// The issue is that the equation is degenerate - D_p[j] cancels out!
// This means ANY D_p[j] is valid as long as the recurrence is maintained.

// BUT WAIT - we have an additional constraint: plain2 must be a valid URL!
// Let's use that to constrain D_p

console.log('\n=== Using URL structure constraint ===');

// plain2 = "https://rapidshare.cc/stream/" + hash
// The hash is likely hex characters (0-9, a-f)

// For position 29 (first char of hash):
// plain2[29] must be in [0-9a-f]
// plain2[29] = plain1[29] XOR D_p[29]
// D_p[29] = D_k[29] XOR D_c[29]

// We computed D_k[29] above. Let's verify:
console.log('D_k[29] =', D_k[29].toString(16).padStart(2, '0'));
console.log('D_c[29] =', D_c[29].toString(16).padStart(2, '0'));
console.log('D_p[29] = D_k[29] XOR D_c[29] =', (D_k[29] ^ D_c[29]).toString(16).padStart(2, '0'));
console.log('plain1[29] =', plain1[29], '=', String.fromCharCode(plain1[29]));
console.log('plain2[29] = plain1[29] XOR D_p[29] =', plain1[29] ^ (D_k[29] ^ D_c[29]), '=', String.fromCharCode(plain1[29] ^ (D_k[29] ^ D_c[29])));

// Let's compute the full plain2!
const plain2 = Buffer.alloc(cipher2.length);

// Copy known prefix
for (let i = 0; i < CYBERPUNK_PREFIX.length; i++) {
  plain2[i] = CYBERPUNK_PREFIX.charCodeAt(i);
  D_p[i] = plain1[i] ^ plain2[i];
}

// Compute D_k for all positions
for (let i = 0; i < 19; i++) {
  D_k[i] = D_p[i];
}

for (let i = 19; i < cipher1.length; i++) {
  if (i < CYBERPUNK_PREFIX.length) {
    // We know D_p[i], compute D_k[i]
    D_k[i] = D_k[i - 19] ^ D_c[i] ^ D_c[i - 19] ^ D_p[i] ^ D_p[i - 19];
  } else {
    // We need to find D_p[i]
    // Use: D_p[i-19] = D_k[i-19] XOR D_c[i-19] (from the constraint at position i)
    // But this gives us D_p[i-19], not D_p[i]!
    
    // Actually, let's just compute D_k[i] assuming D_p[i] = 0 and see what happens
    // D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR 0 XOR D_p[i-19]
    D_k[i] = D_k[i - 19] ^ D_c[i] ^ D_c[i - 19] ^ D_p[i - 19];
    
    // Then D_p[i] = D_c[i] XOR D_k[i]
    D_p[i] = D_c[i] ^ D_k[i];
    
    // And plain2[i] = plain1[i] XOR D_p[i]
    plain2[i] = plain1[i] ^ D_p[i];
  }
}

console.log('\n=== RESULT ===');
console.log('Decrypted plain2:', plain2.toString('utf8'));
