/**
 * Compare stage2Keys between samples
 * 
 * If the stage2Key is constant across all videos, we can decrypt!
 * 
 * stage2Key = Key XOR Hash = Header XOR URL XOR Hash
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const HEADER = Buffer.from('df030e2cf382169ad6825734dfc193e1ebab67', 'hex');

console.log('=== Comparing Stage2Keys ===\n');

// Sample 1: rapidshare.cc
const pd1 = urlSafeBase64Decode('3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4');
const hash1 = '2457433dff948487f3bb6d58f9db2a11';
const hashHex1 = Buffer.from(hash1, 'hex');

// For rapidshare.cc, URL format is: https://rapidshare.cc/stream/[hash].m3u8
// URL[0:19] = "https://rapidshare."
const url1_0to19 = 'https://rapidshare.';

// Compute key[0:19] = header XOR URL[0:19]
const key1_0to19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key1_0to19[i] = HEADER[i] ^ url1_0to19.charCodeAt(i);
}

// Compute stage2Key = key XOR hash
// But hash1 is only 16 bytes, not 19!
console.log('Sample 1 (rapidshare.cc):');
console.log('  Hash length:', hashHex1.length, 'bytes');
console.log('  Key[0:19]:', key1_0to19.toString('hex'));

// We can only compute stage2Key for the first 16 bytes
const stage2Key1 = Buffer.alloc(16);
for (let i = 0; i < 16; i++) {
  stage2Key1[i] = key1_0to19[i] ^ hashHex1[i];
}
console.log('  Stage2Key[0:16]:', stage2Key1.toString('hex'));

// Sample 2: rapidairmax.site (FNAF2)
const pd2 = urlSafeBase64Decode('3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4');
const hash2 = '2457433dff868594ecbf3b15e9f22a46efd70a';
const hashHex2 = Buffer.from(hash2, 'hex');

// URL[0:19] = "https://rrr.core36l"
const url2_0to19 = 'https://rrr.core36l';

// Compute key[0:19] = header XOR URL[0:19]
const key2_0to19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key2_0to19[i] = HEADER[i] ^ url2_0to19.charCodeAt(i);
}

// Compute stage2Key = key XOR hash
const stage2Key2 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  stage2Key2[i] = key2_0to19[i] ^ hashHex2[i];
}

console.log('\nSample 2 (rapidairmax.site):');
console.log('  Hash length:', hashHex2.length, 'bytes');
console.log('  Key[0:19]:', key2_0to19.toString('hex'));
console.log('  Stage2Key[0:19]:', stage2Key2.toString('hex'));

// Compare the first 16 bytes of stage2Keys
console.log('\n=== Comparison ===\n');
console.log('Stage2Key1[0:16]:', stage2Key1.toString('hex'));
console.log('Stage2Key2[0:16]:', stage2Key2.subarray(0, 16).toString('hex'));
console.log('Match:', stage2Key1.toString('hex') === stage2Key2.subarray(0, 16).toString('hex'));

// If they match, the stage2Key is constant!
// If not, it depends on the URL prefix

// Let's check what the stage2Key represents
console.log('\n=== Analyzing Stage2Key ===\n');

// stage2Key = key XOR hash = (header XOR URL) XOR hash = header XOR URL XOR hash
// If stage2Key is constant, then: header XOR URL XOR hash = constant
// Therefore: URL = header XOR hash XOR constant

// For sample 2:
// URL = header XOR hash XOR stage2Key
const urlFromFormula = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlFromFormula[i] = HEADER[i] ^ hashHex2[i] ^ stage2Key2[i];
}
console.log('URL from formula (header XOR hash XOR stage2Key):', urlFromFormula.toString('utf8'));
console.log('Expected URL[0:19]:', url2_0to19);
console.log('Match:', urlFromFormula.toString('utf8') === url2_0to19);

// This should always match by definition!

// The question is: can we find stage2Key without knowing URL?
// Let's check if stage2Key is related to something known

console.log('\n=== Stage2Key relationships ===\n');

// stage2Key as string
console.log('Stage2Key2 as string:', stage2Key2.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// stage2Key XOR "https://" (first 8 bytes)
const httpsPrefix = 'https://';
const stage2KeyXorHttps = Buffer.alloc(8);
for (let i = 0; i < 8; i++) {
  stage2KeyXorHttps[i] = stage2Key2[i] ^ httpsPrefix.charCodeAt(i);
}
console.log('Stage2Key XOR "https://":', stage2KeyXorHttps.toString('hex'));
console.log('As string:', stage2KeyXorHttps.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This should give us: header[0:8] XOR hash[0:8]
const headerXorHash = Buffer.alloc(8);
for (let i = 0; i < 8; i++) {
  headerXorHash[i] = HEADER[i] ^ hashHex2[i];
}
console.log('Header XOR Hash [0:8]:', headerXorHash.toString('hex'));
console.log('Match:', stage2KeyXorHttps.toString('hex') === headerXorHash.toString('hex'));

// So: stage2Key[0:8] XOR "https://" = header[0:8] XOR hash[0:8]
// This means: stage2Key[0:8] = header[0:8] XOR hash[0:8] XOR "https://"

// The first 8 bytes of stage2Key are determined by the constant "https://" prefix!
// This is always the same for all URLs.

console.log('\n=== Key Insight ===\n');
console.log('The first 8 bytes of stage2Key are CONSTANT because:');
console.log('stage2Key[0:8] = header XOR URL[0:8] XOR hash[0:8]');
console.log('             = header XOR "https://" XOR hash[0:8]');
console.log('');
console.log('Since header and "https://" are constant, stage2Key[0:8] only depends on hash[0:8].');
console.log('');
console.log('For positions 8-18, stage2Key depends on the domain, which varies.');

// Let's compute the constant part
const constantPart = Buffer.alloc(8);
for (let i = 0; i < 8; i++) {
  constantPart[i] = HEADER[i] ^ httpsPrefix.charCodeAt(i);
}
console.log('\nConstant part (header XOR "https://"):', constantPart.toString('hex'));

// stage2Key[0:8] = constantPart XOR hash[0:8]
const stage2Key_0to8 = Buffer.alloc(8);
for (let i = 0; i < 8; i++) {
  stage2Key_0to8[i] = constantPart[i] ^ hashHex2[i];
}
console.log('Computed stage2Key[0:8]:', stage2Key_0to8.toString('hex'));
console.log('Actual stage2Key[0:8]:  ', stage2Key2.subarray(0, 8).toString('hex'));
console.log('Match:', stage2Key_0to8.toString('hex') === stage2Key2.subarray(0, 8).toString('hex'));

// Now we can decrypt the first 8 bytes of any URL!
// URL[0:8] = header XOR hash XOR stage2Key = header XOR hash XOR (header XOR "https://" XOR hash)
//          = "https://"

console.log('\n=== Decryption Formula ===\n');
console.log('For positions 0-7 (the "https://" part):');
console.log('  URL[i] = header[i] XOR hash[i] XOR stage2Key[i]');
console.log('         = header[i] XOR hash[i] XOR (header[i] XOR "https://"[i] XOR hash[i])');
console.log('         = "https://"[i]');
console.log('');
console.log('This is always "https://" regardless of the hash!');
console.log('');
console.log('For positions 8-18 (the domain part):');
console.log('  We need to know the domain to compute stage2Key[8:19]');
console.log('  OR we need to find stage2Key[8:19] from another source');

console.log('\n=== Done ===');
