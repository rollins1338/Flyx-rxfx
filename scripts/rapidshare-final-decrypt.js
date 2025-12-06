/**
 * RapidShare FINAL Decryption - Using Known Plaintext Attack
 * 
 * The URL stays the same on reloads! So we can use the known FNAF2 URL
 * to derive the FULL key and decrypt ANY PAGE_DATA.
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// FNAF2 Known Data
const FNAF2_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const FNAF2_URL = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

// Derive the FULL key from known plaintext
const fnaf2Cipher = urlSafeBase64Decode(FNAF2_PAGE_DATA);
const fnaf2Plain = Buffer.from(FNAF2_URL.substring(0, fnaf2Cipher.length), 'utf8');

console.log('=== Deriving Full Key from FNAF2 ===\n');
console.log('Ciphertext length:', fnaf2Cipher.length);
console.log('Plaintext length:', fnaf2Plain.length);

// XOR to get the key: key = cipher XOR plaintext
const FULL_KEY = Buffer.alloc(fnaf2Cipher.length);
for (let i = 0; i < fnaf2Cipher.length; i++) {
  FULL_KEY[i] = fnaf2Cipher[i] ^ fnaf2Plain[i];
}

console.log('\nFULL KEY (hex):', FULL_KEY.toString('hex'));
console.log('FULL KEY length:', FULL_KEY.length, 'bytes');

// Verify by decrypting FNAF2
const verifyDecrypt = Buffer.alloc(fnaf2Cipher.length);
for (let i = 0; i < fnaf2Cipher.length; i++) {
  verifyDecrypt[i] = fnaf2Cipher[i] ^ FULL_KEY[i];
}
console.log('\nVerification - Decrypted FNAF2:', verifyDecrypt.toString('utf8'));
console.log('Expected:', FNAF2_URL.substring(0, fnaf2Cipher.length));
console.log('Match:', verifyDecrypt.toString('utf8') === FNAF2_URL.substring(0, fnaf2Cipher.length));

// Now test with rapidshare.cc sample
console.log('\n\n=== Testing with rapidshare.cc sample ===\n');

const RS_PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';
const rsCipher = urlSafeBase64Decode(RS_PAGE_DATA);

console.log('rapidshare.cc PAGE_DATA:', RS_PAGE_DATA);
console.log('Ciphertext length:', rsCipher.length);

// Decrypt using the derived key
const rsDecrypt = Buffer.alloc(rsCipher.length);
for (let i = 0; i < rsCipher.length; i++) {
  rsDecrypt[i] = rsCipher[i] ^ FULL_KEY[i];
}

console.log('\nDecrypted URL:', rsDecrypt.toString('utf8'));

// Check if it looks like a valid URL
const decryptedStr = rsDecrypt.toString('utf8');
if (decryptedStr.startsWith('https://')) {
  console.log('\n✅ SUCCESS! Valid URL decrypted!');
} else {
  console.log('\n❌ Decryption produced invalid URL');
  console.log('First bytes (hex):', rsDecrypt.slice(0, 20).toString('hex'));
}

// Export the key for use in other scripts
console.log('\n\n=== EXPORT ===\n');
console.log('// Use this key to decrypt any PAGE_DATA:');
console.log(`const RAPIDSHARE_KEY = Buffer.from('${FULL_KEY.toString('hex')}', 'hex');`);

// Create decrypt function
console.log('\n// Decrypt function:');
console.log(`
function decryptPageData(pageData) {
  const RAPIDSHARE_KEY = Buffer.from('${FULL_KEY.toString('hex')}', 'hex');
  
  // URL-safe base64 decode
  let base64 = pageData.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const cipher = Buffer.from(base64, 'base64');
  
  // XOR decrypt
  const plain = Buffer.alloc(cipher.length);
  for (let i = 0; i < cipher.length; i++) {
    plain[i] = cipher[i] ^ RAPIDSHARE_KEY[i % RAPIDSHARE_KEY.length];
  }
  
  return plain.toString('utf8');
}
`);

module.exports = {
  FULL_KEY,
  decrypt: function(pageData) {
    let base64 = pageData.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const cipher = Buffer.from(base64, 'base64');
    
    const plain = Buffer.alloc(cipher.length);
    for (let i = 0; i < cipher.length; i++) {
      plain[i] = cipher[i] ^ FULL_KEY[i % FULL_KEY.length];
    }
    
    return plain.toString('utf8');
  }
};
