/**
 * Analyze domain mapping and hash generation
 * 
 * We have two samples:
 * 
 * 1. rapidshare.cc (Cyberpunk Edgerunners)
 *    - App.js hash: 2457433dff948487f3bb6d58f9db2a11 (32 chars = 16 bytes hex)
 *    - PAGE_DATA: 3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4
 *    - Expected HLS domain: rapidshare.cc/stream/
 * 
 * 2. rapidairmax.site (FNAF2)
 *    - App.js hash: 2457433dff868594ecbf3b15e9f22a46efd70a (38 chars = 19 bytes hex)
 *    - PAGE_DATA: 3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4
 *    - Known HLS URL: https://rrr.core36link.site/p267/c5/h...
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

console.log('=== Domain Mapping Analysis ===\n');

// Sample 1: rapidshare.cc
const sample1 = {
  embedDomain: 'rapidshare.cc',
  appJsHash: '2457433dff948487f3bb6d58f9db2a11',
  pageData: '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4',
  expectedHlsDomain: 'rapidshare.cc',
  expectedPath: '/stream/'
};

// Sample 2: rapidairmax.site (FNAF2)
const sample2 = {
  embedDomain: 'rapidairmax.site',
  appJsHash: '2457433dff868594ecbf3b15e9f22a46efd70a',
  pageData: '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4',
  knownHlsUrl: 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8',
  expectedHlsDomain: 'rrr.core36link.site',
  expectedPath: '/p267/c5/'
};

console.log('Sample 1 (rapidshare.cc):');
console.log('  App.js hash:', sample1.appJsHash, `(${sample1.appJsHash.length} chars)`);
console.log('  Hash as hex:', Buffer.from(sample1.appJsHash, 'hex').toString('hex'));
console.log('  Hash length:', sample1.appJsHash.length / 2, 'bytes');

console.log('\nSample 2 (rapidairmax.site):');
console.log('  App.js hash:', sample2.appJsHash, `(${sample2.appJsHash.length} chars)`);
console.log('  Hash as hex:', Buffer.from(sample2.appJsHash, 'hex').toString('hex'));
console.log('  Hash length:', sample2.appJsHash.length / 2, 'bytes');

// Compare the hashes
console.log('\n=== Hash Comparison ===\n');

const hash1 = sample1.appJsHash;
const hash2 = sample2.appJsHash;

// Find common prefix
let commonPrefix = '';
for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
  if (hash1[i] === hash2[i]) {
    commonPrefix += hash1[i];
  } else {
    break;
  }
}
console.log('Common prefix:', commonPrefix, `(${commonPrefix.length} chars)`);
console.log('Hash1 suffix:', hash1.substring(commonPrefix.length));
console.log('Hash2 suffix:', hash2.substring(commonPrefix.length));

// The common prefix is "2457433dff" (10 chars = 5 bytes)
// This might be a version number or constant

// Decode PAGE_DATA
console.log('\n=== PAGE_DATA Comparison ===\n');

const pd1 = urlSafeBase64Decode(sample1.pageData);
const pd2 = urlSafeBase64Decode(sample2.pageData);

console.log('PAGE_DATA 1:', pd1.toString('hex'));
console.log('PAGE_DATA 2:', pd2.toString('hex'));
console.log('Length 1:', pd1.length, 'bytes');
console.log('Length 2:', pd2.length, 'bytes');

// Compare headers (first 19 bytes)
const header1 = pd1.subarray(0, 19);
const header2 = pd2.subarray(0, 19);

console.log('\nHeader 1:', header1.toString('hex'));
console.log('Header 2:', header2.toString('hex'));

// Find common bytes in headers
let commonHeaderBytes = 0;
for (let i = 0; i < 19; i++) {
  if (header1[i] === header2[i]) {
    commonHeaderBytes++;
  }
}
console.log('Common header bytes:', commonHeaderBytes, '/ 19');

// XOR the headers
const headerXor = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXor[i] = header1[i] ^ header2[i];
}
console.log('Header1 XOR Header2:', headerXor.toString('hex'));

// The headers are almost identical! Only a few bytes differ.
// This suggests the header encodes something about the video, not the domain.

// Let's check if the hash is related to the header
console.log('\n=== Hash vs Header Relationship ===\n');

const hashHex1 = Buffer.from(hash1, 'hex');
const hashHex2 = Buffer.from(hash2, 'hex');

console.log('Hash1 hex:', hashHex1.toString('hex'), `(${hashHex1.length} bytes)`);
console.log('Hash2 hex:', hashHex2.toString('hex'), `(${hashHex2.length} bytes)`);

// Hash2 is 19 bytes, same as header!
// Let's check if hash2 XOR header2 gives something meaningful

if (hashHex2.length === 19) {
  const hash2XorHeader2 = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    hash2XorHeader2[i] = hashHex2[i] ^ header2[i];
  }
  console.log('\nHash2 XOR Header2:', hash2XorHeader2.toString('hex'));
  console.log('As string:', hash2XorHeader2.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));
}

// Let's check if the hash encodes the HLS domain
console.log('\n=== Checking if hash encodes HLS domain ===\n');

// For sample 2, the HLS domain is "rrr.core36link.site"
// Let's see if this is encoded in the hash

const hlsDomain2 = 'rrr.core36link.site';
console.log('HLS domain:', hlsDomain2, `(${hlsDomain2.length} chars)`);

// Check if hash XOR something = domain
// hash2 XOR header2 = ???
// If this equals "https://rrr.core36l" (19 chars), we found the relationship!

const urlPrefix = 'https://rrr.core36l';
console.log('URL prefix:', urlPrefix, `(${urlPrefix.length} chars)`);

// Check: hash2 XOR header2 = URL prefix?
if (hashHex2.length === 19) {
  const hash2XorHeader2 = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    hash2XorHeader2[i] = hashHex2[i] ^ header2[i];
  }
  console.log('Hash2 XOR Header2:', hash2XorHeader2.toString('utf8'));
  console.log('Expected URL prefix:', urlPrefix);
  console.log('Match:', hash2XorHeader2.toString('utf8') === urlPrefix);
}

// Let's try: header XOR URL = key
// And: key = hash XOR something

// We know from our analysis:
// key[0:19] = header XOR URL[0:19]
// So: URL[0:19] = header XOR key

// If key = hash, then:
// URL[0:19] = header XOR hash

const urlFromHeaderXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlFromHeaderXorHash[i] = header2[i] ^ hashHex2[i];
}
console.log('\nHeader2 XOR Hash2:', urlFromHeaderXorHash.toString('utf8'));

// This doesn't give us the URL directly.
// The key is NOT simply the hash.

// Let me check the known URL structure
console.log('\n=== Known URL Structure ===\n');

const knownUrl = sample2.knownHlsUrl;
console.log('Full URL:', knownUrl);
console.log('URL length:', knownUrl.length);

// Parse the URL
const urlParts = new URL(knownUrl);
console.log('\nParsed URL:');
console.log('  Protocol:', urlParts.protocol);
console.log('  Host:', urlParts.host);
console.log('  Pathname:', urlParts.pathname);

// The pathname is: /p267/c5/h[hash]/list,[filename].m3u8
const pathParts = urlParts.pathname.split('/');
console.log('  Path parts:', pathParts);

// Extract the hash from the URL
const urlHash = pathParts[3]; // h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d
console.log('\nURL hash:', urlHash);
console.log('URL hash length:', urlHash.length);

// The URL hash starts with 'h' followed by 130 hex characters (65 bytes)
const urlHashHex = urlHash.substring(1); // Remove 'h' prefix
console.log('URL hash (without h):', urlHashHex);
console.log('URL hash hex length:', urlHashHex.length);

// Is the URL hash related to the app.js hash?
console.log('\n=== URL Hash vs App.js Hash ===\n');

console.log('App.js hash:', sample2.appJsHash);
console.log('URL hash:', urlHashHex.substring(0, 38)); // First 38 chars

// Check if they share any common parts
const appHash = sample2.appJsHash;
const urlHashStart = urlHashHex.substring(0, appHash.length);
console.log('URL hash start:', urlHashStart);
console.log('Match:', appHash === urlHashStart);

// They don't match directly. The URL hash is different from the app.js hash.

// Let me check if the URL hash is derived from the embed ID
console.log('\n=== Checking Embed ID ===\n');

// The embed ID for FNAF2 is: 2MvvbnGoWS2JcOLzFLpK7RXpCQ
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);

console.log('Embed ID:', embedId);
console.log('Decoded embed ID:', decodedEmbedId.toString('hex'));
console.log('Decoded length:', decodedEmbedId.length, 'bytes');

// Check if embed ID is in the URL hash
if (urlHashHex.includes(decodedEmbedId.toString('hex'))) {
  console.log('Embed ID found in URL hash!');
} else {
  console.log('Embed ID NOT found in URL hash');
}

// The URL hash might be a signature or encrypted data
// Let's check if it's related to the PAGE_DATA

console.log('\n=== Summary ===\n');
console.log('Findings:');
console.log('1. App.js hash length varies: 16 bytes (rapidshare.cc) vs 19 bytes (rapidairmax.site)');
console.log('2. The 19-byte hash matches the header length - this is significant!');
console.log('3. Headers are similar between samples, suggesting they encode video-specific data');
console.log('4. The URL hash (130 chars) is different from the app.js hash');
console.log('5. The embed ID is not directly visible in the URL hash');
console.log('');
console.log('The HLS domain mapping might be:');
console.log('- Hardcoded in the app.js based on the embed domain');
console.log('- Or derived from the app.js hash');

console.log('\n=== Done ===');
