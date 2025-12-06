/**
 * RapidShare Full Decryption Tool
 * 
 * This tool decrypts PAGE_DATA by trying known domain mappings.
 * 
 * Usage:
 *   node rapidshare-full-decrypt.js <PAGE_DATA> <APP_JS_HASH>
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// Constant header (same for all videos)
const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

// Known domain mappings (domain part at positions 8-18 of URL)
const DOMAIN_MAPPINGS = [
  { domain: 'rapidshare.', fullDomain: 'rapidshare.cc', path: '/stream/' },
  { domain: 'rrr.core36l', fullDomain: 'rrr.core36link.site', path: '/p267/c5/' },
  { domain: 'core36link.', fullDomain: 'core36link.site', path: '/' },
  { domain: 'rapidairmax', fullDomain: 'rapidairmax.site', path: '/' },
];

function computeStage2Key(hash, domain) {
  const hashHex = Buffer.from(hash, 'hex');
  const stage2Key = Buffer.alloc(19);
  
  // stage2Key[i] = header[i] XOR URL[i] XOR hash[i]
  // For positions 0-7: URL[i] = "https://"[i]
  // For positions 8-18: URL[i] = domain[i-8]
  
  const urlPrefix = 'https://' + domain;
  
  for (let i = 0; i < Math.min(19, hashHex.length); i++) {
    stage2Key[i] = HEADER[i] ^ urlPrefix.charCodeAt(i) ^ hashHex[i];
  }
  
  return stage2Key;
}

function decrypt(pageData, hash, domain, path) {
  const ciphertext = urlSafeBase64Decode(pageData);
  const hashHex = Buffer.from(hash, 'hex');
  
  if (hashHex.length < 19) {
    // Pad hash with zeros if needed
    const paddedHash = Buffer.alloc(19);
    hashHex.copy(paddedHash);
    // Use padded hash
  }
  
  // Build URL prefix
  const urlPrefix = 'https://' + domain + path + 'h';
  
  // Compute stage2Key
  const stage2Key = computeStage2Key(hash, domain.substring(0, 11));
  
  // Compute key
  const key = Buffer.alloc(ciphertext.length);
  
  // key[0:19] = header XOR URL[0:19]
  for (let i = 0; i < 19 && i < urlPrefix.length; i++) {
    key[i] = HEADER[i] ^ urlPrefix.charCodeAt(i);
  }
  
  // key[i] = key[i-19] XOR something[i-19] for i >= 19
  // where something = stage2Key (approximately)
  for (let i = 19; i < ciphertext.length; i++) {
    // Compute C = cipher[i-19] XOR cipher[i]
    const C = ciphertext[i - 19] ^ ciphertext[i];
    
    // For positions where we know the URL:
    if (i < urlPrefix.length) {
      const U = urlPrefix.charCodeAt(i - 19) ^ urlPrefix.charCodeAt(i);
      const something = C ^ U;
      key[i] = key[i - 19] ^ something;
    } else {
      // For unknown positions, use the pattern
      key[i] = key[i - 19] ^ stage2Key[(i - 19) % 19];
    }
  }
  
  // Decrypt
  const plaintext = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    plaintext[i] = ciphertext[i] ^ key[i];
  }
  
  return plaintext.toString('utf8');
}

function tryDecrypt(pageData, hash) {
  const results = [];
  
  for (const mapping of DOMAIN_MAPPINGS) {
    try {
      const decrypted = decrypt(pageData, hash, mapping.fullDomain, mapping.path);
      
      // Check if decryption looks valid (starts with https://)
      if (decrypted.startsWith('https://')) {
        // Check if the domain matches
        const expectedStart = 'https://' + mapping.fullDomain;
        if (decrypted.startsWith(expectedStart)) {
          results.push({
            domain: mapping.fullDomain,
            path: mapping.path,
            decrypted: decrypted,
            valid: true
          });
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  return results;
}

// Main
if (process.argv.length >= 4) {
  const pageData = process.argv[2];
  const hash = process.argv[3];
  
  console.log('=== RapidShare Full Decryption ===\n');
  console.log('PAGE_DATA:', pageData);
  console.log('Hash:', hash);
  console.log('');
  
  const results = tryDecrypt(pageData, hash);
  
  if (results.length > 0) {
    console.log('Found valid decryption(s):');
    results.forEach((r, i) => {
      console.log(`\n[${i + 1}] Domain: ${r.domain}`);
      console.log(`    Path: ${r.path}`);
      console.log(`    Decrypted: ${r.decrypted}`);
    });
  } else {
    console.log('No valid decryption found with known domains.');
    console.log('The domain might be new or different.');
  }
} else {
  // Demo with known data
  console.log('=== RapidShare Full Decryption Demo ===\n');
  
  // Sample 1: rapidshare.cc
  const pd1 = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';
  const hash1 = '2457433dff948487f3bb6d58f9db2a11';
  
  console.log('Sample 1 (rapidshare.cc):');
  console.log('PAGE_DATA:', pd1);
  console.log('Hash:', hash1);
  
  const results1 = tryDecrypt(pd1, hash1);
  if (results1.length > 0) {
    console.log('Decrypted:', results1[0].decrypted);
  } else {
    console.log('No valid decryption found');
  }
  
  console.log('\n---\n');
  
  // Sample 2: rapidairmax.site (FNAF2)
  const pd2 = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
  const hash2 = '2457433dff868594ecbf3b15e9f22a46efd70a';
  const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
  
  console.log('Sample 2 (rapidairmax.site - FNAF2):');
  console.log('PAGE_DATA:', pd2);
  console.log('Hash:', hash2);
  
  const results2 = tryDecrypt(pd2, hash2);
  if (results2.length > 0) {
    console.log('Decrypted:', results2[0].decrypted);
    console.log('Expected:', knownUrl.substring(0, 56));
    console.log('Match:', results2[0].decrypted === knownUrl.substring(0, 56));
  } else {
    console.log('No valid decryption found');
  }
}
