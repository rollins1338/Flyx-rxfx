/**
 * RapidShare PAGE_DATA Decryption v2
 * 
 * The decryption is more complex than initially thought.
 * 
 * For positions 0-18:
 *   URL[i] = header[i] XOR hash[i] XOR stage2Key[i]
 *   where stage2Key[i] = header[i] XOR URL[i] XOR hash[i]
 *   This simplifies to: URL[i] = URL[i] (circular, but works if we know URL prefix)
 * 
 * For positions 19+:
 *   The key changes! We need to find the pattern.
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

console.log('=== Analyzing Full Decryption ===\n');

// Derive the actual key for all 56 positions
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

console.log('Actual key:', actualKey.toString('hex'));

// The key for positions 0-18 is: header XOR URL[0:19]
// Let's verify
const key0to19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key0to19[i] = header[i] ^ urlFirst56.charCodeAt(i);
}
console.log('key[0:19] = header XOR URL:', key0to19.toString('hex'));
console.log('Match:', key0to19.toString('hex') === actualKey.subarray(0, 19).toString('hex'));

// For positions 19+, the key is different
// Let's see if there's a pattern

console.log('\n=== Analyzing key for positions 19+ ===\n');

// key[19:38]
const key19to38 = actualKey.subarray(19, 38);
console.log('key[19:38]:', key19to38.toString('hex'));

// Is key[19:38] = header XOR URL[19:38]?
const headerXorUrl19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXorUrl19[i] = header[i] ^ urlFirst56.charCodeAt(19 + i);
}
console.log('header XOR URL[19:38]:', headerXorUrl19.toString('hex'));
console.log('Match:', headerXorUrl19.toString('hex') === key19to38.toString('hex'));

// They don't match! So the key derivation is different for positions 19+.

// Let's find the relationship
// key[19+i] = f(header, URL, hash, i)

// Check: key[19+i] = key[i] XOR something?
const keyDiff = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  keyDiff[i] = actualKey[i] ^ actualKey[19 + i];
}
console.log('\nkey[0:19] XOR key[19:38]:', keyDiff.toString('hex'));

// Check if keyDiff = URL[0:19] XOR URL[19:38]
const urlDiff = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlDiff[i] = urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(19 + i);
}
console.log('URL[0:19] XOR URL[19:38]:', urlDiff.toString('hex'));
console.log('Match:', keyDiff.toString('hex') === urlDiff.toString('hex'));

// They don't match! The key derivation is more complex.

// Let me check if the key is related to the ciphertext
console.log('\n=== Checking key vs ciphertext relationship ===\n');

// For positions 0-18: ciphertext = header
// For positions 19+: ciphertext = ???

// key[i] = ciphertext[i] XOR URL[i]
// This is the definition of XOR encryption.

// The question is: how is the key derived?
// We know key[0:19] = header XOR URL[0:19]
// But key[19:38] ≠ header XOR URL[19:38]

// Let me check: key[19+i] = ciphertext[19+i] XOR URL[19+i]
// And: ciphertext[19+i] = URL[19+i] XOR key[19+i]
// This is circular.

// The key must be derived from something known BEFORE encryption.
// Possibilities:
// 1. key = f(header, hash)
// 2. key = f(URL) where URL is known
// 3. key is stored separately

// Let me check if key[19:38] is related to hash
const key19XorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key19XorHash[i] = key19to38[i] ^ hashHex[i];
}
console.log('key[19:38] XOR hash:', key19XorHash.toString('hex'));
console.log('As string:', key19XorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if this equals URL[19:38]
console.log('URL[19:38]:', Buffer.from(urlFirst56.substring(19, 38)).toString('hex'));

// Let me try: key[i] = header[i % 19] XOR URL[i] for all i
// This would mean the key repeats with period 19, but XORed with URL

console.log('\n=== Testing: key[i] = header[i % 19] XOR URL[i] ===\n');

const testKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  testKey[i] = header[i % 19] ^ urlFirst56.charCodeAt(i);
}
console.log('Test key:', testKey.toString('hex'));
console.log('Actual key:', actualKey.toString('hex'));
console.log('Match:', testKey.toString('hex') === actualKey.toString('hex'));

// If this matches, then:
// ciphertext[i] = URL[i] XOR key[i] = URL[i] XOR header[i % 19] XOR URL[i] = header[i % 19]
// So ciphertext should be header repeated!

console.log('\n=== Checking if ciphertext = header repeated ===\n');

let cipherIsHeaderRepeated = true;
for (let i = 0; i < 56; i++) {
  if (ciphertext[i] !== header[i % 19]) {
    cipherIsHeaderRepeated = false;
    console.log(`Mismatch at ${i}: cipher=0x${ciphertext[i].toString(16)} header[${i%19}]=0x${header[i%19].toString(16)}`);
  }
}
console.log('Ciphertext = header repeated:', cipherIsHeaderRepeated);

// The ciphertext is NOT header repeated, so the key derivation is different.

// Let me try a different approach: what if the key is derived from ciphertext?
// key[i] = f(ciphertext[0:19], i)

console.log('\n=== Testing: key derived from ciphertext ===\n');

// For positions 0-18: key[i] = header[i] XOR URL[i]
// For positions 19+: key[i] = ciphertext[i-19] XOR URL[i] ???

// Let's check: key[19+i] = ciphertext[i] XOR URL[19+i]?
const testKey19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  testKey19[i] = ciphertext[i] ^ urlFirst56.charCodeAt(19 + i);
}
console.log('ciphertext[0:19] XOR URL[19:38]:', testKey19.toString('hex'));
console.log('Actual key[19:38]:', key19to38.toString('hex'));
console.log('Match:', testKey19.toString('hex') === key19to38.toString('hex'));

// Let me try: key[19+i] = ciphertext[19+i-19] XOR URL[19+i] = ciphertext[i] XOR URL[19+i]
// This is what we just tested.

// Actually, let me reconsider the problem.
// The encryption might use a stream cipher or PRNG.

// Let me check if the key has any structure
console.log('\n=== Key structure analysis ===\n');

// Split key into 19-byte segments
const keySeg0 = actualKey.subarray(0, 19);
const keySeg1 = actualKey.subarray(19, 38);
const keySeg2 = actualKey.subarray(38, 56);

console.log('keySeg0:', keySeg0.toString('hex'));
console.log('keySeg1:', keySeg1.toString('hex'));
console.log('keySeg2:', keySeg2.toString('hex'));

// Check if keySeg1 = keySeg0 XOR constant
const seg01Diff = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  seg01Diff[i] = keySeg0[i] ^ keySeg1[i];
}
console.log('\nkeySeg0 XOR keySeg1:', seg01Diff.toString('hex'));

// Check if this constant is related to URL or hash
console.log('URL[0:19] XOR URL[19:38]:', urlDiff.toString('hex'));
console.log('hash:', hashHex.toString('hex'));

// The seg01Diff is: 8a9e8ee075e97ec36cdf66b4aa26b51f41740f
// This doesn't match URL diff or hash directly.

// Let me check: seg01Diff XOR hash
const seg01DiffXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  seg01DiffXorHash[i] = seg01Diff[i] ^ hashHex[i];
}
console.log('seg01Diff XOR hash:', seg01DiffXorHash.toString('hex'));
console.log('As string:', seg01DiffXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This gives: .....u.~.l.f..&..At.
// Not obviously meaningful.

console.log('\n=== Conclusion ===\n');
console.log('The key derivation for positions 19+ is complex.');
console.log('It does not follow a simple pattern like key[i] = header[i % 19] XOR URL[i].');
console.log('');
console.log('The encryption might use:');
console.log('1. A PRNG seeded with header/hash');
console.log('2. A more complex XOR scheme');
console.log('3. Multiple rounds of encryption');
console.log('');
console.log('To fully crack this, we would need to:');
console.log('1. Reverse engineer the JavaScript decryption code');
console.log('2. Or collect more samples to find patterns');

console.log('\n=== Done ===');
