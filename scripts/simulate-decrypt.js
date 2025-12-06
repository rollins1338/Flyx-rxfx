/**
 * Try to simulate the decryption by creating a minimal environment
 * and extracting the decryption function from app.js
 */

const fs = require('fs');
const vm = require('vm');

// The PAGE_DATA we want to decrypt
const PAGE_DATA = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';

console.log('=== Simulating Decryption ===\n');
console.log('PAGE_DATA:', PAGE_DATA);
console.log('Length:', PAGE_DATA.length);

// Try common decryption patterns

// Pattern 1: Simple base64 with character substitution
function tryBase64Variants() {
  console.log('\n=== Base64 Variants ===');
  
  const variants = [
    PAGE_DATA,
    PAGE_DATA.replace(/-/g, '+').replace(/_/g, '/'),
    PAGE_DATA.replace(/_/g, '+').replace(/-/g, '/'),
  ];
  
  for (const v of variants) {
    try {
      // Add padding if needed
      let padded = v;
      while (padded.length % 4 !== 0) padded += '=';
      
      const decoded = Buffer.from(padded, 'base64');
      console.log('\nVariant:', v.substring(0, 30) + '...');
      console.log('Decoded hex:', decoded.toString('hex'));
      console.log('Decoded utf8:', decoded.toString('utf8').substring(0, 100));
    } catch (e) {
      console.log('Failed:', e.message);
    }
  }
}

// Pattern 2: RC4 decryption (common in video players)
function rc4(key, data) {
  const s = [];
  for (let i = 0; i < 256; i++) s[i] = i;
  
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    [s[i], s[j]] = [s[j], s[i]];
  }
  
  let i = 0;
  j = 0;
  const result = [];
  
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) % 256;
    j = (j + s[i]) % 256;
    [s[i], s[j]] = [s[j], s[i]];
    result.push(data.charCodeAt(k) ^ s[(s[i] + s[j]) % 256]);
  }
  
  return Buffer.from(result);
}

function tryRC4() {
  console.log('\n=== RC4 Decryption ===');
  
  // Common keys to try
  const keys = [
    'rapidshare',
    'rapidairmax',
    'secret',
    'password',
    '1234567890123456',
    'abcdefghijklmnop',
  ];
  
  // Decode PAGE_DATA from base64 first
  const data = Buffer.from(PAGE_DATA.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('binary');
  
  for (const key of keys) {
    const decrypted = rc4(key, data);
    const str = decrypted.toString('utf8');
    
    // Check if result looks valid
    if (str.includes('http') || str.includes('{') || str.includes('file')) {
      console.log(`\nKey "${key}" might work:`);
      console.log(str.substring(0, 200));
    }
  }
}

// Pattern 3: XOR with repeating key
function tryXOR() {
  console.log('\n=== XOR Decryption ===');
  
  const data = Buffer.from(PAGE_DATA.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  
  // Try common XOR keys
  const keys = [
    'rapidshare.cc',
    'rapidairmax.site',
    'jwplayer',
    'video',
  ];
  
  for (const key of keys) {
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ key.charCodeAt(i % key.length);
    }
    
    const str = result.toString('utf8');
    if (str.includes('http') || str.includes('{') || str.includes('file') || str.includes('m3u8')) {
      console.log(`\nKey "${key}" might work:`);
      console.log(str.substring(0, 200));
    }
  }
}

// Pattern 4: AES decryption
function tryAES() {
  console.log('\n=== AES Decryption (requires crypto) ===');
  
  try {
    const crypto = require('crypto');
    
    const data = Buffer.from(PAGE_DATA.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    
    // Common keys/IVs
    const keys = [
      '0123456789abcdef', // 16 bytes
      'rapidshare123456',
      'abcdefghijklmnop',
    ];
    
    for (const key of keys) {
      try {
        // Try AES-128-CBC with zero IV
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(false);
        
        let decrypted = decipher.update(data);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const str = decrypted.toString('utf8');
        if (str.includes('http') || str.includes('{')) {
          console.log(`\nKey "${key}" might work:`);
          console.log(str.substring(0, 200));
        }
      } catch (e) {
        // Ignore decryption errors
      }
    }
  } catch (e) {
    console.log('Crypto not available');
  }
}

tryBase64Variants();
tryRC4();
tryXOR();
tryAES();

console.log('\n\n=== Summary ===');
console.log('The PAGE_DATA appears to be encrypted with a custom algorithm.');
console.log('The decryption key is likely derived from the obfuscated app.js code.');
console.log('Without reverse engineering the full obfuscation, we cannot decrypt it.');
