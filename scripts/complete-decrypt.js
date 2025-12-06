/**
 * Complete Decryption Algorithm
 * 
 * Key insight: cipher[38:56] = key[19:37] XOR C2 XOR URL[19:37]
 * 
 * This means:
 * key[38:56] = cipher[38:56] XOR URL[38:56]
 * 
 * And we can derive URL[38:56] from:
 * URL[38:56] = cipher[38:56] XOR key[38:56]
 * 
 * But we also know:
 * cipher[38:56] = key[19:37] XOR C2 XOR URL[19:37]
 * 
 * So:
 * URL[38:56] = (key[19:37] XOR C2 XOR URL[19:37]) XOR key[38:56]
 * 
 * And:
 * key[38:56] = key[19:37] XOR something2
 * something2 = C2 XOR U2 = C2 XOR (URL[19:37] XOR URL[38:56])
 * 
 * Substituting:
 * key[38:56] = key[19:37] XOR C2 XOR URL[19:37] XOR URL[38:56]
 * 
 * So:
 * URL[38:56] = (key[19:37] XOR C2 XOR URL[19:37]) XOR (key[19:37] XOR C2 XOR URL[19:37] XOR URL[38:56])
 *            = URL[38:56]
 * 
 * This is circular! But we can use a different approach:
 * 
 * From cipher[38:56] = key[19:37] XOR C2 XOR URL[19:37], we get:
 * key[38:56] XOR URL[38:56] = key[19:37] XOR C2 XOR URL[19:37]
 * 
 * Let X = URL[38:56] (unknown)
 * key[38:56] = key[19:37] XOR C2 XOR URL[19:37] XOR X
 * 
 * And: URL[38:56] = cipher[38:56] XOR key[38:56]
 *                 = (key[19:37] XOR C2 XOR URL[19:37]) XOR (key[19:37] XOR C2 XOR URL[19:37] XOR X)
 *                 = X
 * 
 * So X = X, which is always true. We need another equation!
 * 
 * NEW APPROACH: The "something" values might be derivable from the hash!
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
const appJsHash = '2457433dff868594ecbf3b15e9f22a46efd70a';

const ciphertext = urlSafeBase64Decode(pageData);
const header = ciphertext.subarray(0, 19);
const hashHex = Buffer.from(appJsHash, 'hex');
const urlFirst56 = knownUrl.substring(0, 56);

console.log('=== Complete Decryption ===\n');

// Derive actual key for verification
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

// Compute the "something" values
const something1 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  something1[i] = actualKey[i] ^ actualKey[19 + i];
}

const something2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  something2[i] = actualKey[19 + i] ^ actualKey[38 + i];
}

console.log('something1:', something1.toString('hex'));
console.log('something2:', something2.toString('hex'));

// Check if something1 and something2 are related to hash
console.log('\n=== Checking hash relationships ===\n');

// something1 XOR hash
const s1XorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  s1XorHash[i] = something1[i] ^ hashHex[i];
}
console.log('something1 XOR hash:', s1XorHash.toString('hex'));

// something2 XOR hash[0:18]
const s2XorHash = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  s2XorHash[i] = something2[i] ^ hashHex[i];
}
console.log('something2 XOR hash[0:18]:', s2XorHash.toString('hex'));

// Check if s1XorHash or s2XorHash equals URL parts
console.log('\nURL[0:19]:', Buffer.from(urlFirst56.substring(0, 19)).toString('hex'));
console.log('URL[19:38]:', Buffer.from(urlFirst56.substring(19, 38)).toString('hex'));
console.log('URL[38:56]:', Buffer.from(urlFirst56.substring(38, 56)).toString('hex'));

// The "something" values are:
// something1 = C1 XOR U1 = (cipher[0:19] XOR cipher[19:38]) XOR (URL[0:19] XOR URL[19:38])
// something2 = C2 XOR U2 = (cipher[19:37] XOR cipher[38:56]) XOR (URL[19:37] XOR URL[38:56])

// These depend on URL, so they can't be derived from hash alone.

// FINAL APPROACH: Use the known URL structure
// The URL is: https://[domain]/[path]/h[hash]/list,[filename].m3u8
// 
// For FNAF2:
// - Domain: rrr.core36link.site
// - Path: /p267/c5/
// - Hash prefix: h
// - Hash: 6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d
// 
// The first 56 bytes are: https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866
// 
// If we know the domain and path, we can decrypt!

console.log('\n=== Decryption with known domain/path ===\n');

function decryptWithDomainPath(ciphertext, domain, path) {
  // Build URL prefix
  const urlPrefix = 'https://' + domain + path + 'h';
  console.log('URL prefix:', urlPrefix, `(${urlPrefix.length} chars)`);
  
  if (urlPrefix.length > 56) {
    throw new Error('URL prefix too long');
  }
  
  const header = ciphertext.subarray(0, 19);
  const key = Buffer.alloc(ciphertext.length);
  const plaintext = Buffer.alloc(ciphertext.length);
  
  // Step 1: Compute key[0:19] = header XOR URL[0:19]
  for (let i = 0; i < 19 && i < urlPrefix.length; i++) {
    key[i] = header[i] ^ urlPrefix.charCodeAt(i);
  }
  
  // Step 2: Decrypt positions 0-18
  for (let i = 0; i < 19; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  // Step 3: For positions 19+, we need to compute the key iteratively
  // The key derivation is: key[i] = key[i-19] XOR something[i-19]
  // And: something = C XOR U
  // Where C = cipher[i-19] XOR cipher[i]
  // And U = URL[i-19] XOR URL[i]
  
  // We can compute this iteratively:
  // 1. Decrypt URL[19] using key[19] = key[0] XOR something[0]
  // 2. something[0] = (cipher[0] XOR cipher[19]) XOR (URL[0] XOR URL[19])
  // 3. We know URL[0] from the prefix, but not URL[19]!
  
  // HOWEVER: if we know enough of the URL prefix, we can bootstrap the decryption!
  
  // For positions where we know the URL prefix:
  for (let i = 19; i < urlPrefix.length; i++) {
    // Compute C[i-19] = cipher[i-19] XOR cipher[i]
    const C = ciphertext[i - 19] ^ ciphertext[i];
    // Compute U[i-19] = URL[i-19] XOR URL[i]
    const U = urlPrefix.charCodeAt(i - 19) ^ urlPrefix.charCodeAt(i);
    // Compute something[i-19] = C XOR U
    const s = C ^ U;
    // Compute key[i] = key[i-19] XOR something[i-19]
    key[i] = key[i - 19] ^ s;
    // Decrypt
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  // For positions beyond the URL prefix, we need to continue the pattern
  // But we don't know the URL characters!
  
  // Let's try: assume the pattern continues with the same "something"
  // This won't work because "something" depends on URL...
  
  // Actually, we can use the relationship:
  // cipher[i] = URL[i] XOR key[i]
  // key[i] = key[i-19] XOR C[i-19] XOR U[i-19]
  //        = key[i-19] XOR cipher[i-19] XOR cipher[i] XOR URL[i-19] XOR URL[i]
  
  // Substituting:
  // cipher[i] = URL[i] XOR key[i-19] XOR cipher[i-19] XOR cipher[i] XOR URL[i-19] XOR URL[i]
  // cipher[i] XOR cipher[i] = URL[i] XOR key[i-19] XOR cipher[i-19] XOR URL[i-19] XOR URL[i]
  // 0 = URL[i] XOR key[i-19] XOR cipher[i-19] XOR URL[i-19] XOR URL[i]
  // 0 = key[i-19] XOR cipher[i-19] XOR URL[i-19]
  // key[i-19] = cipher[i-19] XOR URL[i-19]
  
  // This is just the definition of key! So it's always true.
  
  // The issue is that we can't determine URL[i] for i >= urlPrefix.length
  // without additional information.
  
  return {
    plaintext: plaintext.toString('utf8'),
    decryptedLength: urlPrefix.length
  };
}

const domain = 'rrr.core36link.site';
const path = '/p267/c5/';
const result = decryptWithDomainPath(ciphertext, domain, path);

console.log('Decrypted:', result.plaintext);
console.log('Decrypted length:', result.decryptedLength);
console.log('Expected:', urlFirst56);

// The decryption only works up to the URL prefix length!
// For the remaining characters, we need to know more of the URL.

console.log('\n=== Summary ===\n');
console.log('The RapidShare PAGE_DATA encryption uses a complex XOR scheme.');
console.log('');
console.log('To decrypt:');
console.log('1. You need to know the HLS domain and path');
console.log('2. The decryption works iteratively, character by character');
console.log('3. Each character depends on the previous 19 characters');
console.log('');
console.log('For FNAF2:');
console.log('- Domain: rrr.core36link.site');
console.log('- Path: /p267/c5/');
console.log('- The first 37 characters can be decrypted with this info');
console.log('- The remaining characters (the hash) require additional info');
console.log('');
console.log('The hash in the URL might be:');
console.log('1. Derived from the embed ID');
console.log('2. Stored in a separate API response');
console.log('3. Computed from the video metadata');

console.log('\n=== Done ===');
