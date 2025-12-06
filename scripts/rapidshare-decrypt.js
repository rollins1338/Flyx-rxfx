/**
 * RapidShare PAGE_DATA Decryption
 * 
 * Usage:
 *   node rapidshare-decrypt.js <PAGE_DATA> <URL_PREFIX>
 * 
 * Example:
 *   node rapidshare-decrypt.js "3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4" "https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866"
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

function decryptPageData(pageData, urlPrefix) {
  const ciphertext = urlSafeBase64Decode(pageData);
  const header = ciphertext.subarray(0, 19);
  
  if (urlPrefix.length < 19) {
    throw new Error('URL prefix must be at least 19 characters');
  }
  
  const key = Buffer.alloc(ciphertext.length);
  const plaintext = Buffer.alloc(ciphertext.length);
  
  // Step 1: Compute key[0:19] = header XOR URL[0:19]
  for (let i = 0; i < 19; i++) {
    key[i] = header[i] ^ urlPrefix.charCodeAt(i);
  }
  
  // Step 2: Decrypt positions 0-18
  for (let i = 0; i < 19; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  // Step 3: For positions 19+, compute key iteratively
  for (let i = 19; i < ciphertext.length; i++) {
    if (i < urlPrefix.length) {
      // We know the URL character, compute the key
      const C = ciphertext[i - 19] ^ ciphertext[i];
      const U = urlPrefix.charCodeAt(i - 19) ^ urlPrefix.charCodeAt(i);
      const something = C ^ U;
      key[i] = key[i - 19] ^ something;
      plaintext[i] = ciphertext[i] ^ key[i];
    } else {
      // We don't know the URL character
      // Mark as unknown
      plaintext[i] = '?'.charCodeAt(0);
    }
  }
  
  return {
    decrypted: plaintext.toString('utf8'),
    knownLength: Math.min(urlPrefix.length, ciphertext.length),
    totalLength: ciphertext.length
  };
}

// Main
if (process.argv.length >= 4) {
  const pageData = process.argv[2];
  const urlPrefix = process.argv[3];
  
  console.log('=== RapidShare PAGE_DATA Decryption ===\n');
  console.log('PAGE_DATA:', pageData);
  console.log('URL Prefix:', urlPrefix);
  console.log('');
  
  try {
    const result = decryptPageData(pageData, urlPrefix);
    console.log('Decrypted:', result.decrypted);
    console.log('Known length:', result.knownLength, '/', result.totalLength);
  } catch (e) {
    console.error('Error:', e.message);
  }
} else {
  // Demo with known data
  const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
  const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
  
  console.log('=== RapidShare PAGE_DATA Decryption Demo ===\n');
  
  // Test with full URL prefix (56 chars)
  const urlPrefix56 = knownUrl.substring(0, 56);
  console.log('Testing with full URL prefix (56 chars):');
  console.log('URL Prefix:', urlPrefix56);
  
  const result = decryptPageData(pageData, urlPrefix56);
  console.log('Decrypted:', result.decrypted);
  console.log('Expected:', knownUrl.substring(0, 56));
  console.log('Match:', result.decrypted === knownUrl.substring(0, 56));
  
  console.log('\n---\n');
  
  // Test with partial URL prefix (37 chars - domain + path)
  const urlPrefix37 = 'https://rrr.core36link.site/p267/c5/h';
  console.log('Testing with partial URL prefix (37 chars):');
  console.log('URL Prefix:', urlPrefix37);
  
  const result2 = decryptPageData(pageData, urlPrefix37);
  console.log('Decrypted:', result2.decrypted);
  console.log('Known length:', result2.knownLength, '/', result2.totalLength);
}
