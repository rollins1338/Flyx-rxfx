/**
 * Differential Attack v2 - Fixed computation
 * 
 * The key insight: D_p[j] = D_k[j] XOR D_c[j]
 * And D_k follows a recurrence that we can compute!
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

console.log('=== Differential Attack v2 ===\n');

// Compute ciphertext difference
const D_c = Buffer.alloc(cipher1.length);
for (let i = 0; i < cipher1.length; i++) {
  D_c[i] = cipher1[i] ^ cipher2[i];
}

// Initialize D_p and D_k with known values
const D_p = Buffer.alloc(cipher1.length);
const D_k = Buffer.alloc(cipher1.length);

// For positions 0 to prefix length - 1, we know both plaintexts
for (let i = 0; i < CYBERPUNK_PREFIX.length; i++) {
  D_p[i] = plain1[i] ^ CYBERPUNK_PREFIX.charCodeAt(i);
}

// For i < 19: D_k[i] = D_p[i]
for (let i = 0; i < 19; i++) {
  D_k[i] = D_p[i];
}

// For 19 <= i < prefix length: compute D_k using the recurrence
for (let i = 19; i < CYBERPUNK_PREFIX.length; i++) {
  D_k[i] = D_k[i - 19] ^ D_c[i] ^ D_c[i - 19] ^ D_p[i] ^ D_p[i - 19];
}

console.log('D_k[0:29]:', D_k.slice(0, 29).toString('hex'));
console.log('D_p[0:29]:', D_p.slice(0, 29).toString('hex'));
console.log('D_c[0:29]:', D_c.slice(0, 29).toString('hex'));

// Now for positions >= prefix length, we need to compute D_k and D_p together
// The recurrence is:
// D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i] XOR D_p[i-19]
// D_p[i] = D_k[i] XOR D_c[i]
//
// Substituting the second into the first:
// D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR (D_k[i] XOR D_c[i]) XOR D_p[i-19]
// D_k[i] = D_k[i-19] XOR D_c[i-19] XOR D_k[i] XOR D_p[i-19]
// 0 = D_k[i-19] XOR D_c[i-19] XOR D_p[i-19]
//
// This is a CONSTRAINT: D_p[i-19] = D_k[i-19] XOR D_c[i-19]
// It doesn't give us D_k[i] or D_p[i] directly!

// BUT - we can use this constraint to verify and propagate!
// For i = prefix_length (29):
// D_p[10] = D_k[10] XOR D_c[10]
// We know D_k[10] = D_p[10] (since 10 < 19)
// So: D_p[10] = D_p[10] XOR D_c[10]
// This means D_c[10] = 0, which is true!

// For i = 48:
// D_p[29] = D_k[29] XOR D_c[29]
// We computed D_k[29] above.

console.log('\n=== Computing D_p for positions 29+ ===');

for (let i = CYBERPUNK_PREFIX.length; i < cipher1.length; i++) {
  // Use the constraint from position i+19 (if it exists)
  // D_p[i] = D_k[i] XOR D_c[i]
  
  // But we need D_k[i] first!
  // D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i] XOR D_p[i-19]
  
  // Since D_p[i] = D_k[i] XOR D_c[i], we have:
  // D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR (D_k[i] XOR D_c[i]) XOR D_p[i-19]
  // D_k[i] XOR D_k[i] = D_k[i-19] XOR D_c[i-19] XOR D_p[i-19]
  // 0 = D_k[i-19] XOR D_c[i-19] XOR D_p[i-19]
  
  // This means D_p[i-19] is determined by D_k[i-19] and D_c[i-19]!
  // D_p[i-19] = D_k[i-19] XOR D_c[i-19]
  
  // So for position i, we can compute D_p[i-19] from the constraint.
  // But we want D_p[i], not D_p[i-19]!
  
  // Let's think differently. We have:
  // - D_k[i-19] (known from previous computation)
  // - D_c[i-19] (known from ciphertext)
  // - D_p[i-19] (known from previous computation)
  // - D_c[i] (known from ciphertext)
  
  // We want D_k[i] and D_p[i].
  // From D_p[i] = D_k[i] XOR D_c[i], we get D_k[i] = D_p[i] XOR D_c[i]
  // 
  // Substituting into the recurrence:
  // D_p[i] XOR D_c[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i] XOR D_p[i-19]
  // D_c[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i-19]
  // 0 = D_k[i-19] XOR D_c[i-19] XOR D_p[i-19]
  
  // This is always true (it's the constraint)! So D_p[i] can be ANYTHING!
  
  // The encryption is degenerate - multiple plaintexts produce valid ciphertexts.
  // We need additional constraints (like URL structure) to find the correct one.
}

// Since the math shows D_p[i] is unconstrained, let's try a different approach:
// Use the FNAF2 key directly to decrypt Cyberpunk!

console.log('\n=== Direct key transfer approach ===');

// Compute FNAF2 key
const key1 = Buffer.alloc(cipher1.length);
for (let i = 0; i < cipher1.length; i++) {
  key1[i] = cipher1[i] ^ plain1[i];
}

console.log('FNAF2 key:', key1.toString('hex'));

// Try to decrypt Cyberpunk with FNAF2 key
const plain2_attempt = Buffer.alloc(cipher2.length);
for (let i = 0; i < cipher2.length; i++) {
  plain2_attempt[i] = cipher2[i] ^ key1[i];
}

console.log('Cyberpunk decrypted with FNAF2 key:', plain2_attempt.toString('utf8'));

// That won't work because the keys are different.
// Let's compute the key difference and use it.

// key2[i] = key1[i] XOR D_k[i]
// plain2[i] = cipher2[i] XOR key2[i]
//           = cipher2[i] XOR key1[i] XOR D_k[i]
//           = (cipher2[i] XOR key1[i]) XOR D_k[i]

// We know D_k for positions 0-28. Let's use that.
const plain2 = Buffer.alloc(cipher2.length);

for (let i = 0; i < cipher2.length; i++) {
  if (i < CYBERPUNK_PREFIX.length) {
    // We know the plaintext
    plain2[i] = CYBERPUNK_PREFIX.charCodeAt(i);
  } else {
    // Use the key relationship
    // key2[i] = key1[i] XOR D_k[i]
    // But we need D_k[i] for i >= 29
    
    // From the recurrence:
    // D_k[i] = D_k[i-19] XOR D_c[i] XOR D_c[i-19] XOR D_p[i] XOR D_p[i-19]
    
    // We don't know D_p[i], but we can compute D_k[i] if we assume D_p[i] = 0
    // (i.e., plain2[i] = plain1[i])
    
    // Actually, let's use the constraint: D_p[i-19] = D_k[i-19] XOR D_c[i-19]
    // This gives us D_p for positions 10-36 (from i = 29 to 55)
    
    const j = i - 19; // Position whose D_p we can compute
    if (j >= 0 && j < i) {
      // D_p[j] = D_k[j] XOR D_c[j]
      // But we need D_k[j]...
    }
    
    // Let's just try assuming D_p[i] = 0 and see what we get
    if (i >= 19) {
      D_k[i] = D_k[i - 19] ^ D_c[i] ^ D_c[i - 19] ^ 0 ^ D_p[i - 19];
      D_p[i] = D_k[i] ^ D_c[i];
    }
    
    plain2[i] = plain1[i] ^ D_p[i];
  }
}

console.log('\nDecrypted Cyberpunk (with D_p[i]=0 assumption):', plain2.toString('utf8'));

// The issue is that D_p[i] = 0 means plain2[i] = plain1[i], which is wrong.
// Let's try to find D_p[i] by using the URL structure constraint.

console.log('\n=== Using URL structure to constrain D_p ===');

// For rapidshare.cc, the URL is: https://rapidshare.cc/stream/{hash}
// The hash is likely alphanumeric or hex.

// Let's try all possible values for each position and see which ones
// produce valid URL characters.

const validUrlChars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_.~:/?#[]@!$&\'()*+,;=';

const plain2_constrained = Buffer.from(CYBERPUNK_PREFIX, 'utf8');

// Reset D_k and D_p
for (let i = 0; i < 19; i++) {
  D_k[i] = D_p[i];
}
for (let i = 19; i < CYBERPUNK_PREFIX.length; i++) {
  D_k[i] = D_k[i - 19] ^ D_c[i] ^ D_c[i - 19] ^ D_p[i] ^ D_p[i - 19];
}

console.log('Starting constrained search from position', CYBERPUNK_PREFIX.length);

for (let i = CYBERPUNK_PREFIX.length; i < cipher2.length; i++) {
  // Try each valid URL character
  let found = false;
  
  for (const char of validUrlChars) {
    const testPlain2 = char.charCodeAt(0);
    const testDp = plain1[i] ^ testPlain2;
    
    // Compute D_k[i] with this D_p[i]
    const testDk = D_k[i - 19] ^ D_c[i] ^ D_c[i - 19] ^ testDp ^ D_p[i - 19];
    
    // Check if D_p[i] = D_k[i] XOR D_c[i]
    const expectedDp = testDk ^ D_c[i];
    
    if (testDp === expectedDp) {
      // This character is consistent!
      D_p[i] = testDp;
      D_k[i] = testDk;
      plain2_constrained[i] = testPlain2;
      found = true;
      console.log(`Position ${i}: '${char}' is consistent`);
      break;
    }
  }
  
  if (!found) {
    console.log(`Position ${i}: No consistent character found!`);
    // Use the first valid character as fallback
    const fallback = plain1[i] ^ (D_k[i - 19] ^ D_c[i - 19] ^ D_p[i - 19]);
    plain2_constrained[i] = fallback;
    D_p[i] = plain1[i] ^ fallback;
    D_k[i] = D_k[i - 19] ^ D_c[i] ^ D_c[i - 19] ^ D_p[i] ^ D_p[i - 19];
  }
}

console.log('\n=== FINAL RESULT ===');
console.log('Decrypted Cyberpunk URL:', plain2_constrained.toString('utf8'));
