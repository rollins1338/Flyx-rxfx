/**
 * Final Decryption Algorithm v3
 * 
 * The key derivation is:
 * - key[0:19] = header XOR URL[0:19]
 * - key[19:38] = key[0:19] XOR something[0:19]
 * - key[38:56] = key[19:38] XOR something2[0:18]
 * 
 * Where:
 * - something = (cipher[0:19] XOR cipher[19:38]) XOR (URL[0:19] XOR URL[19:38])
 * - something2 = (cipher[19:38] XOR cipher[38:56]) XOR (URL[19:38] XOR URL[38:56])
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

console.log('=== Final Decryption v3 ===\n');

// Derive actual key
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

// Compute the "something" values for each segment
const something1 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  something1[i] = actualKey[i] ^ actualKey[19 + i];
}

const something2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  something2[i] = actualKey[19 + i] ^ actualKey[38 + i];
}

console.log('something1 (key[0:19] XOR key[19:38]):', something1.toString('hex'));
console.log('something2 (key[19:37] XOR key[38:56]):', something2.toString('hex'));

// Check if something1 and something2 are related
console.log('\n=== Checking something1 vs something2 ===\n');

// something1[0:18] XOR something2
const s1XorS2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  s1XorS2[i] = something1[i] ^ something2[i];
}
console.log('something1[0:18] XOR something2:', s1XorS2.toString('hex'));

// This should equal (URL[0:18] XOR URL[19:37]) XOR (URL[19:37] XOR URL[38:56])
// = URL[0:18] XOR URL[38:56]
const urlXor = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  urlXor[i] = urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(38 + i);
}
console.log('URL[0:18] XOR URL[38:56]:', urlXor.toString('hex'));
console.log('Match:', s1XorS2.toString('hex') === urlXor.toString('hex'));

// So: something2 = something1[0:18] XOR (URL[0:18] XOR URL[38:56])
// This still depends on URL!

// Let me check if there's a pattern in the "something" values
console.log('\n=== Analyzing something pattern ===\n');

// something1 = C1 XOR U1 where C1 = cipher[0:19] XOR cipher[19:38], U1 = URL[0:19] XOR URL[19:38]
// something2 = C2 XOR U2 where C2 = cipher[19:37] XOR cipher[38:56], U2 = URL[19:37] XOR URL[38:56]

const C1 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  C1[i] = ciphertext[i] ^ ciphertext[19 + i];
}

const C2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  C2[i] = ciphertext[19 + i] ^ ciphertext[38 + i];
}

console.log('C1 = cipher[0:19] XOR cipher[19:38]:', C1.toString('hex'));
console.log('C2 = cipher[19:37] XOR cipher[38:56]:', C2.toString('hex'));

// U1 = URL[0:19] XOR URL[19:38]
// U2 = URL[19:37] XOR URL[38:56]

const U1 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  U1[i] = urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(19 + i);
}

const U2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  U2[i] = urlFirst56.charCodeAt(19 + i) ^ urlFirst56.charCodeAt(38 + i);
}

console.log('U1 = URL[0:19] XOR URL[19:38]:', U1.toString('hex'));
console.log('U2 = URL[19:37] XOR URL[38:56]:', U2.toString('hex'));

// Verify: something1 = C1 XOR U1
const verifyS1 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  verifyS1[i] = C1[i] ^ U1[i];
}
console.log('\nVerify something1 = C1 XOR U1:', verifyS1.toString('hex'));
console.log('Actual something1:', something1.toString('hex'));
console.log('Match:', verifyS1.toString('hex') === something1.toString('hex'));

// Verify: something2 = C2 XOR U2
const verifyS2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  verifyS2[i] = C2[i] ^ U2[i];
}
console.log('\nVerify something2 = C2 XOR U2:', verifyS2.toString('hex'));
console.log('Actual something2:', something2.toString('hex'));
console.log('Match:', verifyS2.toString('hex') === something2.toString('hex'));

// The pattern is clear:
// something[n] = C[n] XOR U[n]
// where C[n] = cipher[n*19:(n+1)*19] XOR cipher[(n+1)*19:(n+2)*19]
// and U[n] = URL[n*19:(n+1)*19] XOR URL[(n+1)*19:(n+2)*19]

// To decrypt without knowing URL, we need to find U[n] from something else.

// Let me check if U1 and U2 are related to each other or to known values
console.log('\n=== Checking U relationships ===\n');

// U1 XOR U2[0:18]
const U1XorU2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  U1XorU2[i] = U1[i] ^ U2[i];
}
console.log('U1[0:18] XOR U2:', U1XorU2.toString('hex'));

// This should equal URL[0:18] XOR URL[38:56]
console.log('URL[0:18] XOR URL[38:56]:', urlXor.toString('hex'));
console.log('Match:', U1XorU2.toString('hex') === urlXor.toString('hex'));

// So U2 = U1[0:18] XOR (URL[0:18] XOR URL[38:56])
// This still depends on URL!

// The key insight: we need to find U1 (and U2) without knowing URL.
// U1 = URL[0:19] XOR URL[19:38]
// 
// If we know URL[0:19] (the prefix), we can compute U1 if we know URL[19:38].
// But URL[19:38] is part of what we're trying to decrypt!

// HOWEVER: we can use the ciphertext to help!
// cipher[19:38] = URL[19:38] XOR key[19:38]
// And: key[19:38] = key[0:19] XOR something1
// So: cipher[19:38] = URL[19:38] XOR key[0:19] XOR something1
// Therefore: URL[19:38] = cipher[19:38] XOR key[0:19] XOR something1

// But something1 = C1 XOR U1 = C1 XOR (URL[0:19] XOR URL[19:38])
// This is circular!

// Let me try a different approach: assume we know the URL structure
console.log('\n=== Assuming known URL structure ===\n');

// The URL is: https://[domain]/[path]/h[hash]...
// If we know the domain and path, we can predict URL[0:38]

// For this example:
// URL[0:19] = "https://rrr.core36l"
// URL[19:38] = "ink.site/p267/c5/h6"

// If we know both, we can compute U1 and decrypt!

function decryptWithKnownPrefix(ciphertext, urlPrefix38) {
  const header = ciphertext.subarray(0, 19);
  
  // Compute U1 = urlPrefix38[0:19] XOR urlPrefix38[19:38]
  const U1 = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    U1[i] = urlPrefix38.charCodeAt(i) ^ urlPrefix38.charCodeAt(19 + i);
  }
  
  // Compute C1 = cipher[0:19] XOR cipher[19:38]
  const C1 = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    C1[i] = ciphertext[i] ^ ciphertext[19 + i];
  }
  
  // Compute something1 = C1 XOR U1
  const something1 = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    something1[i] = C1[i] ^ U1[i];
  }
  
  // Compute key[0:19] = header XOR urlPrefix38[0:19]
  const key = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < 19; i++) {
    key[i] = header[i] ^ urlPrefix38.charCodeAt(i);
  }
  
  // Compute key[19:38] = key[0:19] XOR something1
  for (let i = 19; i < 38; i++) {
    key[i] = key[i - 19] ^ something1[i - 19];
  }
  
  // For positions 38+, we need something2
  // But we don't know URL[38:56] yet!
  // Let's decrypt positions 0-37 first and see if we can figure out the rest
  
  // Actually, we can compute something2 iteratively!
  // Once we decrypt URL[19:38], we can compute U2 and then something2
  
  // Decrypt positions 0-37
  const plaintext = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < 38; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  // Now we know URL[0:38], so we can compute U2
  // U2 = URL[19:37] XOR URL[38:56]
  // But we still don't know URL[38:56]!
  
  // Let me try: assume key[38:56] = key[19:37] XOR something2
  // And something2 = C2 XOR U2
  // C2 = cipher[19:37] XOR cipher[38:56] (known)
  // U2 = URL[19:37] XOR URL[38:56] (partially known)
  
  // We know URL[19:37] from the decryption above
  // So: U2 = plaintext[19:37] XOR URL[38:56]
  // And: something2 = C2 XOR U2 = C2 XOR plaintext[19:37] XOR URL[38:56]
  // And: key[38:56] = key[19:37] XOR something2
  //                 = key[19:37] XOR C2 XOR plaintext[19:37] XOR URL[38:56]
  // And: URL[38:56] = cipher[38:56] XOR key[38:56]
  //                 = cipher[38:56] XOR key[19:37] XOR C2 XOR plaintext[19:37] XOR URL[38:56]
  
  // This is still circular! URL[38:56] appears on both sides.
  
  // Let me simplify:
  // URL[38:56] = cipher[38:56] XOR key[38:56]
  // key[38:56] = key[19:37] XOR C2 XOR U2
  // U2 = plaintext[19:37] XOR URL[38:56]
  
  // Substituting:
  // URL[38:56] = cipher[38:56] XOR key[19:37] XOR C2 XOR plaintext[19:37] XOR URL[38:56]
  // 0 = cipher[38:56] XOR key[19:37] XOR C2 XOR plaintext[19:37]
  // cipher[38:56] = key[19:37] XOR C2 XOR plaintext[19:37]
  
  // Let's verify this!
  const C2 = Buffer.alloc(18);
  for (let i = 0; i < 18; i++) {
    C2[i] = ciphertext[19 + i] ^ ciphertext[38 + i];
  }
  
  const expected = Buffer.alloc(18);
  for (let i = 0; i < 18; i++) {
    expected[i] = key[19 + i] ^ C2[i] ^ plaintext[19 + i];
  }
  
  console.log('cipher[38:56]:', ciphertext.subarray(38, 56).toString('hex'));
  console.log('key[19:37] XOR C2 XOR plaintext[19:37]:', expected.toString('hex'));
  console.log('Match:', ciphertext.subarray(38, 56).toString('hex') === expected.toString('hex'));
  
  // If they match, then we can compute key[38:56] without knowing URL[38:56]!
  // key[38:56] = key[19:37] XOR C2 XOR plaintext[19:37]
  //            = key[19:37] XOR C2 XOR (cipher[19:37] XOR key[19:37])
  //            = C2 XOR cipher[19:37]
  
  // Let's verify
  const key38to56 = Buffer.alloc(18);
  for (let i = 0; i < 18; i++) {
    key38to56[i] = C2[i] ^ ciphertext[19 + i];
  }
  
  console.log('\nkey[38:56] = C2 XOR cipher[19:37]:', key38to56.toString('hex'));
  console.log('Actual key[38:56]:', actualKey.subarray(38, 56).toString('hex'));
  console.log('Match:', key38to56.toString('hex') === actualKey.subarray(38, 56).toString('hex'));
  
  // Copy to key array
  for (let i = 0; i < 18; i++) {
    key[38 + i] = key38to56[i];
  }
  
  // Decrypt positions 38-55
  for (let i = 38; i < 56; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  return plaintext.toString('utf8');
}

const urlPrefix38 = 'https://rrr.core36link.site/p267/c5/h6';
const decrypted = decryptWithKnownPrefix(ciphertext, urlPrefix38);
console.log('\n=== Final Decryption ===\n');
console.log('Decrypted:', decrypted);
console.log('Expected:', urlFirst56);
console.log('Match:', decrypted === urlFirst56);

console.log('\n=== Done ===');
