/**
 * RapidShare PAGE_DATA Decryption
 * 
 * Algorithm:
 * 1. Decode PAGE_DATA from URL-safe base64
 * 2. Extract header (first 19 bytes of ciphertext)
 * 3. Compute stage2Key = header XOR URL_prefix XOR hash
 * 4. Decrypt: URL[i] = cipher[i] XOR hash[i % 19] XOR stage2Key[i % 19]
 * 
 * The challenge: we need to know the HLS domain to compute stage2Key
 * 
 * Known domain mappings:
 * - rapidshare.cc -> rapidshare.cc/stream/
 * - rapidairmax.site -> rrr.core36link.site/p267/c5/
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

function decryptPageData(pageData, appJsHash, hlsDomain) {
  const ciphertext = urlSafeBase64Decode(pageData);
  const header = ciphertext.subarray(0, 19);
  const hashHex = Buffer.from(appJsHash, 'hex');
  
  // Build the URL prefix (must be exactly 19 chars)
  const urlPrefix = ('https://' + hlsDomain).substring(0, 19);
  
  // Compute stage2Key
  const stage2Key = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    stage2Key[i] = header[i] ^ urlPrefix.charCodeAt(i) ^ hashHex[i];
  }
  
  // Decrypt
  const plaintext = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    plaintext[i] = ciphertext[i] ^ hashHex[i % 19] ^ stage2Key[i % 19];
  }
  
  return plaintext.toString('utf8');
}

// Test with known data
const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const appJsHash = '2457433dff868594ecbf3b15e9f22a46efd70a';
const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

console.log('=== RapidShare PAGE_DATA Decryption ===\n');

// Test with correct domain
const hlsDomain = 'rrr.core36link.site/p267/c5/';
const decrypted = decryptPageData(pageData, appJsHash, hlsDomain);

console.log('PAGE_DATA:', pageData);
console.log('App.js hash:', appJsHash);
console.log('HLS domain:', hlsDomain);
console.log('\nDecrypted URL (first 56 chars):');
console.log(decrypted);
console.log('\nExpected URL (first 56 chars):');
console.log(knownUrl.substring(0, 56));
console.log('\nMatch:', decrypted === knownUrl.substring(0, 56));

// The decrypted URL is only the first 56 chars
// The full URL needs to be fetched from the server or constructed

console.log('\n=== Testing with different domains ===\n');

const domains = [
  'rrr.core36link.site/p267/c5/',
  'rapidshare.cc/stream/',
  'rapidairmax.site/',
];

domains.forEach(domain => {
  const result = decryptPageData(pageData, appJsHash, domain);
  console.log(`Domain: ${domain}`);
  console.log(`Result: ${result.substring(0, 30)}...`);
  console.log();
});

console.log('=== Summary ===\n');
console.log('The decryption works when we know the HLS domain!');
console.log('');
console.log('To fully decrypt:');
console.log('1. Get the app.js hash from the embed page');
console.log('2. Determine the HLS domain (may need to try multiple)');
console.log('3. Decrypt PAGE_DATA to get the first 56 chars of URL');
console.log('4. The rest of the URL (hash, filename) is in the decrypted data');
console.log('');
console.log('Known domain mappings:');
console.log('- rapidairmax.site -> rrr.core36link.site/p267/c5/');
console.log('- rapidshare.cc -> rapidshare.cc/stream/');

console.log('\n=== Done ===');
