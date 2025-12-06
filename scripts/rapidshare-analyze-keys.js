/**
 * Analyze the key pattern between different PAGE_DATA samples
 * 
 * If the URL is static per video, then the key must be derived from something
 * that differs between videos (like the embed ID or app.js hash).
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// Sample 1: FNAF2 on rapidairmax.site
const FNAF2 = {
  pageData: '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4',
  url: 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8',
  appJsHash: '2457433dff868594ecbf3b15e9f22a46efd70a',
  domain: 'rapidairmax.site'
};

// Sample 2: Cyberpunk on rapidshare.cc
const CYBERPUNK = {
  pageData: '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4',
  url: null, // Unknown - we need to figure this out
  appJsHash: '2457433dff948487f3bb6d58f9db2a11',
  domain: 'rapidshare.cc'
};

console.log('=== Analyzing Key Patterns ===\n');

// Decode both ciphertexts
const fnaf2Cipher = urlSafeBase64Decode(FNAF2.pageData);
const cyberpunkCipher = urlSafeBase64Decode(CYBERPUNK.pageData);

console.log('FNAF2 cipher (hex):', fnaf2Cipher.toString('hex'));
console.log('Cyberpunk cipher (hex):', cyberpunkCipher.toString('hex'));

// Compare the ciphertexts
console.log('\n=== Ciphertext Comparison ===\n');
console.log('Position | FNAF2 | Cyberpunk | Same?');
console.log('-'.repeat(45));

let sameCount = 0;
for (let i = 0; i < Math.max(fnaf2Cipher.length, cyberpunkCipher.length); i++) {
  const f = fnaf2Cipher[i];
  const c = cyberpunkCipher[i];
  const same = f === c;
  if (same) sameCount++;
  
  if (i < 25 || !same) { // Show first 25 and any differences
    console.log(`${i.toString().padStart(8)} | ${f?.toString(16).padStart(2, '0') || '--'} | ${c?.toString(16).padStart(2, '0') || '--'} | ${same ? '✓' : '✗'}`);
  }
}

console.log(`\nSame bytes: ${sameCount}/${Math.max(fnaf2Cipher.length, cyberpunkCipher.length)}`);

// The first 19 bytes are the HEADER - should be same
console.log('\n=== First 19 bytes (HEADER) ===');
console.log('FNAF2:', fnaf2Cipher.slice(0, 19).toString('hex'));
console.log('Cyberpunk:', cyberpunkCipher.slice(0, 19).toString('hex'));
console.log('Same:', fnaf2Cipher.slice(0, 19).toString('hex') === cyberpunkCipher.slice(0, 19).toString('hex'));

// Derive key from FNAF2
const fnaf2Plain = Buffer.from(FNAF2.url.substring(0, fnaf2Cipher.length), 'utf8');
const fnaf2Key = Buffer.alloc(fnaf2Cipher.length);
for (let i = 0; i < fnaf2Cipher.length; i++) {
  fnaf2Key[i] = fnaf2Cipher[i] ^ fnaf2Plain[i];
}

console.log('\n=== FNAF2 Key Analysis ===');
console.log('Key (hex):', fnaf2Key.toString('hex'));

// The key for positions 0-18 should be: HEADER XOR URL[0:19]
// Let's verify
const expectedKey0_18 = Buffer.alloc(19);
const header = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');
for (let i = 0; i < 19; i++) {
  expectedKey0_18[i] = header[i] ^ fnaf2Plain[i];
}
console.log('\nExpected key[0:19] (header XOR url):', expectedKey0_18.toString('hex'));
console.log('Actual key[0:19]:', fnaf2Key.slice(0, 19).toString('hex'));
console.log('Match:', expectedKey0_18.toString('hex') === fnaf2Key.slice(0, 19).toString('hex'));

// Now let's see what the key looks like for positions 19+
console.log('\n=== Key Pattern for positions 19+ ===');
for (let i = 19; i < fnaf2Key.length; i++) {
  // Check if key[i] relates to key[i-19]
  const keyDiff = fnaf2Key[i] ^ fnaf2Key[i - 19];
  const cipherDiff = fnaf2Cipher[i] ^ fnaf2Cipher[i - 19];
  const plainDiff = fnaf2Plain[i] ^ fnaf2Plain[i - 19];
  
  console.log(`i=${i}: key[i]=${fnaf2Key[i].toString(16).padStart(2,'0')} key[i-19]=${fnaf2Key[i-19].toString(16).padStart(2,'0')} keyDiff=${keyDiff.toString(16).padStart(2,'0')} cipherDiff=${cipherDiff.toString(16).padStart(2,'0')} plainDiff=${plainDiff.toString(16).padStart(2,'0')}`);
}

// KEY INSIGHT: key[i] = key[i-19] XOR cipherDiff XOR plainDiff
// But we don't know plainDiff for new videos!
// UNLESS... the plainDiff is predictable from the URL structure

console.log('\n=== URL Structure Analysis ===');
console.log('FNAF2 URL:', FNAF2.url.substring(0, 56));
console.log('');
console.log('Position 0-7: "https://" (protocol)');
console.log('Position 8-26: "rrr.core36link.site" (domain)');
console.log('Position 27-35: "/p267/c5/" (path)');
console.log('Position 36: "h" (hash prefix)');
console.log('Position 37-55: "6a90f70b8d237f94866" (first 19 chars of video hash)');

// For rapidshare.cc, the URL structure is different
console.log('\n=== Expected rapidshare.cc URL structure ===');
console.log('Position 0-7: "https://" (protocol) - SAME');
console.log('Position 8-20: "rapidshare.cc" (domain) - DIFFERENT');
console.log('Position 21-28: "/stream/" (path) - DIFFERENT');
console.log('Position 29+: video hash - DIFFERENT');

// The key difference is at position 8+ where the domain differs
// Let's see if we can figure out the rapidshare.cc URL

console.log('\n=== Attempting to decrypt rapidshare.cc ===');

// We know positions 0-7 are "https://"
// We know the domain is likely "rapidshare.cc"
// Let's try: https://rapidshare.cc/stream/

const rsUrlGuess = 'https://rapidshare.cc/stream/';
const rsGuessPlain = Buffer.from(rsUrlGuess, 'utf8');

// Derive key for rapidshare.cc using the same header
const rsKey = Buffer.alloc(cyberpunkCipher.length);
for (let i = 0; i < 19; i++) {
  rsKey[i] = header[i] ^ rsGuessPlain[i];
}

// Decrypt first 19 bytes
const rsDecrypt = Buffer.alloc(cyberpunkCipher.length);
for (let i = 0; i < 19; i++) {
  rsDecrypt[i] = cyberpunkCipher[i] ^ rsKey[i];
}

console.log('Decrypted first 19 bytes:', rsDecrypt.slice(0, 19).toString('utf8'));

// For positions 19+, we need to compute iteratively
for (let i = 19; i < cyberpunkCipher.length && i < rsGuessPlain.length; i++) {
  const cipherDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
  const plainDiff = rsGuessPlain[i] ^ rsGuessPlain[i - 19];
  rsKey[i] = rsKey[i - 19] ^ cipherDiff ^ plainDiff;
  rsDecrypt[i] = cyberpunkCipher[i] ^ rsKey[i];
}

console.log('Decrypted with guess "' + rsUrlGuess + '":');
console.log(rsDecrypt.slice(0, rsGuessPlain.length).toString('utf8'));

// The remaining bytes after the known prefix
console.log('\n=== Remaining bytes (video hash) ===');
// We can't decrypt these without knowing more of the URL
// BUT if the structure is consistent, we can try to extend

// Let's assume the video hash follows the same pattern
// Try to decrypt byte by byte assuming hex characters (0-9, a-f)
console.log('\nTrying to brute-force remaining bytes...');

const hexChars = '0123456789abcdef';
let fullDecrypt = rsDecrypt.slice(0, rsGuessPlain.length).toString('utf8');

for (let i = rsGuessPlain.length; i < cyberpunkCipher.length; i++) {
  // For each position, try all hex characters
  let found = false;
  for (const char of hexChars) {
    // Compute what the key would be if this char is correct
    const testPlain = Buffer.from(fullDecrypt + char, 'utf8');
    const plainDiff = testPlain[i] ^ testPlain[i - 19];
    const cipherDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
    const testKey = rsKey[i - 19] ^ cipherDiff ^ plainDiff;
    const decrypted = cyberpunkCipher[i] ^ testKey;
    
    if (decrypted === char.charCodeAt(0)) {
      fullDecrypt += char;
      rsKey[i] = testKey;
      found = true;
      break;
    }
  }
  
  if (!found) {
    // Try other common URL characters
    for (const char of '/-_.') {
      const testPlain = Buffer.from(fullDecrypt + char, 'utf8');
      const plainDiff = testPlain[i] ^ testPlain[i - 19];
      const cipherDiff = cyberpunkCipher[i] ^ cyberpunkCipher[i - 19];
      const testKey = rsKey[i - 19] ^ cipherDiff ^ plainDiff;
      const decrypted = cyberpunkCipher[i] ^ testKey;
      
      if (decrypted === char.charCodeAt(0)) {
        fullDecrypt += char;
        rsKey[i] = testKey;
        found = true;
        break;
      }
    }
  }
  
  if (!found) {
    console.log(`Position ${i}: Could not find valid character`);
    // Just decrypt with current key and see what we get
    const decrypted = cyberpunkCipher[i] ^ rsKey[i - 19];
    fullDecrypt += String.fromCharCode(decrypted);
  }
}

console.log('\nFull decrypted URL attempt:', fullDecrypt);
