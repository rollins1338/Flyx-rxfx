/**
 * Verify the key relationship
 * 
 * We found: diff[0:19] XOR header = key[19:38]
 * 
 * This means: key[19+i] = diff[i] XOR header[i] for i in 0..18
 * And: key[i] = header[i] XOR URL[i] for i in 0..18
 * 
 * So the full key derivation might be:
 * key[i] = header[i] XOR URL[i] for i < 19
 * key[i] = diff[i-19] XOR header[i-19] for i >= 19
 * 
 * But we still need to find where diff comes from!
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

// Derive the full key
const key = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  key[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

const diff = Buffer.from('e2eafa9006d351ec1ead149ac949c77a7242639373360cbe73bc005f477d92b60f2fe16693', 'hex');

console.log('=== Verifying Key Relationship ===\n');

// Verify: key[19+i] = diff[i] XOR header[i] for i in 0..18
console.log('Checking: key[19+i] = diff[i] XOR header[i]');
let match1 = true;
for (let i = 0; i < 19; i++) {
  const expected = diff[i] ^ header[i];
  const actual = key[19 + i];
  if (expected !== actual) {
    match1 = false;
    console.log(`  Mismatch at i=${i}: expected=0x${expected.toString(16)} actual=0x${actual.toString(16)}`);
  }
}
console.log('Match for positions 19-37:', match1);

// Verify: key[38+i] = diff[19+i] XOR header[i] for i in 0..17
console.log('\nChecking: key[38+i] = diff[19+i] XOR header[i]');
let match2 = true;
for (let i = 0; i < 18; i++) {
  const expected = diff[19 + i] ^ header[i];
  const actual = key[38 + i];
  if (expected !== actual) {
    match2 = false;
    console.log(`  Mismatch at i=${i}: expected=0x${expected.toString(16)} actual=0x${actual.toString(16)}`);
  }
}
console.log('Match for positions 38-55:', match2);

// So the pattern is: key[i] = diff[(i-19) % 37] XOR header[(i-19) % 19] for i >= 19
// But diff is 37 bytes, not 19...

// Wait, let me reconsider. The diff is computed as:
// diff[i] = key[19+i] XOR header[i % 19]

// So diff is NOT a constant - it depends on the key!
// But the key depends on the URL...

// UNLESS the encryption uses a different approach:
// Maybe the ciphertext[19:] encodes the diff directly?

console.log('\n=== Checking if ciphertext[19:] encodes diff ===\n');

// ciphertext[19:] XOR something = diff?
// We know: ciphertext[i] = URL[i] XOR key[i]
// And: key[i] = diff[i-19] XOR header[(i-19) % 19] for i >= 19

// So: ciphertext[i] = URL[i] XOR diff[i-19] XOR header[(i-19) % 19]
// Therefore: diff[i-19] = ciphertext[i] XOR URL[i] XOR header[(i-19) % 19]

// This still requires URL...

// Let me try a different approach: what if the encryption is simpler?
// What if: ciphertext = header || (URL[19:] XOR header[i%19] XOR constant)

console.log('\n=== Testing simpler encryption ===\n');

// If ciphertext[i] = URL[i] XOR header[i % 19] for all i
// Then: URL[i] = ciphertext[i] XOR header[i % 19]

const simpleDecrypt = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  simpleDecrypt[i] = ciphertext[i] ^ header[i % 19];
}
console.log('Simple decrypt (cipher XOR header[i%19]):');
console.log(simpleDecrypt.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// For positions 0-18, this gives: header XOR header = 0
// So the first 19 bytes would be null, not the URL

// The actual URL starts with "https://rrr.core36l"
// Let's see what we get for positions 0-18:
console.log('\nPositions 0-18:', simpleDecrypt.subarray(0, 19).toString('hex'));
console.log('Expected (URL[0:19]):', Buffer.from(urlFirst56.substring(0, 19)).toString('hex'));

// They don't match because ciphertext[0:19] = header, not URL XOR header

// So the encryption is:
// ciphertext[0:19] = header (NOT URL XOR key)
// ciphertext[19:] = URL[19:] XOR key[19:]

// This means the first 19 bytes of the URL are NOT encrypted in the ciphertext!
// They must be derived from the header somehow.

console.log('\n=== BREAKTHROUGH: URL[0:19] is derived from header ===\n');

// We know: key[0:19] = header XOR URL[0:19]
// And: ciphertext[0:19] = header
// So: ciphertext[0:19] = URL[0:19] XOR key[0:19] would give:
//     header = URL[0:19] XOR (header XOR URL[0:19]) = header ✓

// This is consistent! The encryption is:
// ciphertext[i] = URL[i] XOR key[i] for all i
// where key[i] = header[i % 19] XOR URL[i % 19] (maybe?)

// Let's test: key[i] = header[i % 19] XOR URL[i % 19]
console.log('Testing: key[i] = header[i % 19] XOR URL[i % 19]');

const testKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  testKey[i] = header[i % 19] ^ urlFirst56.charCodeAt(i % 19);
}

const testDecrypt = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  testDecrypt[i] = ciphertext[i] ^ testKey[i];
}
console.log('Decrypted:', testDecrypt.toString('utf8'));

if (testDecrypt.toString('utf8') === urlFirst56) {
  console.log('\n🎉🎉🎉 SUCCESS! 🎉🎉🎉');
  console.log('The key is: key[i] = header[i % 19] XOR URL[i % 19]');
} else {
  console.log('\nNot a match. Let me try another approach...');
  
  // The key might use a different modulo
  // Or the URL prefix might be constant
  
  // What if the URL always starts with "https://rrr.core36l" (19 chars)?
  // Then key[0:19] = header XOR "https://rrr.core36l"
  // And we can decrypt!
  
  console.log('\n=== Testing with known URL prefix ===\n');
  
  const urlPrefix = 'https://rrr.core36l';
  const key2 = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    key2[i] = header[i] ^ urlPrefix.charCodeAt(i);
  }
  
  console.log('Key from URL prefix:', key2.toString('hex'));
  
  // Decrypt with this key repeated
  const decrypt2 = Buffer.alloc(56);
  for (let i = 0; i < 56; i++) {
    decrypt2[i] = ciphertext[i] ^ key2[i % 19];
  }
  console.log('Decrypted:', decrypt2.toString('utf8'));
  
  // Check first 19 chars
  console.log('First 19 chars:', decrypt2.subarray(0, 19).toString('utf8'));
  console.log('Expected:', urlPrefix);
}

// Let me also check what the actual key looks like
console.log('\n=== Actual key analysis ===\n');
console.log('key[0:19]: ', key.subarray(0, 19).toString('hex'));
console.log('key[19:38]:', key.subarray(19, 38).toString('hex'));
console.log('key[38:56]:', key.subarray(38, 56).toString('hex'));

// Check if key[19:38] = key[0:19] XOR something
const keyDiff = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  keyDiff[i] = key[i] ^ key[19 + i];
}
console.log('\nkey[0:19] XOR key[19:38]:', keyDiff.toString('hex'));
console.log('As string:', keyDiff.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This should be URL[0:19] XOR URL[19:38]
const urlDiff = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlDiff[i] = urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(19 + i);
}
console.log('URL[0:19] XOR URL[19:38]:', urlDiff.toString('hex'));
console.log('Match:', keyDiff.toString('hex') === urlDiff.toString('hex'));

console.log('\n=== Done ===');
