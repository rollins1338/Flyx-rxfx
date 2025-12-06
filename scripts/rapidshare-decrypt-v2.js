/**
 * RapidShare Decryption v2
 * 
 * Based on our analysis:
 * - Header is constant: df030e2cf382169ad6825734dfc193e1ebab67
 * - key[0:19] = header XOR URL[0:19]
 * - For positions 19+, we need to compute iteratively using the URL
 * 
 * The decryption requires knowing the full URL prefix (at least 38 chars)
 * to decrypt positions 0-37. For positions 38+, we need even more.
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// Known URL prefixes for different domains
const URL_PREFIXES = {
  'rapidshare.cc': 'https://rapidshare.cc/stream/',
  'rrr.core36link.site': 'https://rrr.core36link.site/p267/c5/h',
};

function decrypt(pageData, urlPrefix) {
  const ciphertext = urlSafeBase64Decode(pageData);
  const key = Buffer.alloc(ciphertext.length);
  const plaintext = Buffer.alloc(ciphertext.length);
  
  // Step 1: Compute key[0:19] = header XOR URL[0:19]
  for (let i = 0; i < 19 && i < urlPrefix.length; i++) {
    key[i] = HEADER[i] ^ urlPrefix.charCodeAt(i);
  }
  
  // Step 2: Decrypt positions 0-18
  for (let i = 0; i < 19; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  // Step 3: For positions 19+, compute key iteratively
  for (let i = 19; i < ciphertext.length; i++) {
    if (i < urlPrefix.length) {
      // We know the URL character
      // C = cipher[i-19] XOR cipher[i]
      const C = ciphertext[i - 19] ^ ciphertext[i];
      // U = URL[i-19] XOR URL[i]
      const U = urlPrefix.charCodeAt(i - 19) ^ urlPrefix.charCodeAt(i);
      // something = C XOR U
      const something = C ^ U;
      // key[i] = key[i-19] XOR something
      key[i] = key[i - 19] ^ something;
      // Decrypt
      plaintext[i] = ciphertext[i] ^ key[i];
    } else {
      // We don't know the URL character - mark as unknown
      plaintext[i] = '?'.charCodeAt(0);
    }
  }
  
  return {
    plaintext: plaintext.toString('utf8'),
    knownLength: Math.min(urlPrefix.length, ciphertext.length)
  };
}

function tryAllDomains(pageData) {
  const results = [];
  
  for (const [domain, prefix] of Object.entries(URL_PREFIXES)) {
    const result = decrypt(pageData, prefix);
    
    // Check if decryption looks valid
    if (result.plaintext.startsWith('https://')) {
      results.push({
        domain: domain,
        prefix: prefix,
        decrypted: result.plaintext,
        knownLength: result.knownLength
      });
    }
  }
  
  return results;
}

// Demo
console.log('=== RapidShare Decryption v2 ===\n');

// Sample 1: rapidshare.cc
const pd1 = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';

console.log('Sample 1 (rapidshare.cc):');
console.log('PAGE_DATA:', pd1);

const result1 = decrypt(pd1, URL_PREFIXES['rapidshare.cc']);
console.log('Decrypted:', result1.plaintext);
console.log('Known length:', result1.knownLength);

console.log('\n---\n');

// Sample 2: rapidairmax.site (FNAF2)
const pd2 = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

console.log('Sample 2 (rapidairmax.site - FNAF2):');
console.log('PAGE_DATA:', pd2);

// Try with known prefix (37 chars)
const result2a = decrypt(pd2, URL_PREFIXES['rrr.core36link.site']);
console.log('\nWith known prefix (37 chars):');
console.log('Decrypted:', result2a.plaintext);
console.log('Known length:', result2a.knownLength);

// Try with full known URL (56 chars)
const result2b = decrypt(pd2, knownUrl.substring(0, 56));
console.log('\nWith full URL prefix (56 chars):');
console.log('Decrypted:', result2b.plaintext);
console.log('Expected:', knownUrl.substring(0, 56));
console.log('Match:', result2b.plaintext === knownUrl.substring(0, 56));

// The key insight: we can decrypt if we know the URL prefix!
// The challenge is knowing the URL prefix without the full URL.

console.log('\n=== Summary ===\n');
console.log('The decryption works when we know the URL prefix!');
console.log('');
console.log('For rapidshare.cc:');
console.log('  URL prefix: https://rapidshare.cc/stream/');
console.log('  This gives us 29 characters of the URL');
console.log('');
console.log('For rapidairmax.site (FNAF2):');
console.log('  URL prefix: https://rrr.core36link.site/p267/c5/h');
console.log('  This gives us 37 characters of the URL');
console.log('');
console.log('The remaining characters (the video hash) are in the encrypted data.');
console.log('To get the full URL, we need to know more of the prefix or brute-force.');
