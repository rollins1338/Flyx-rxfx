/**
 * Analyze the "diff" constant
 * 
 * We found that:
 * - For positions 0-18: key[i] = header[i] XOR URL[i]
 * - For positions 19+: key[i] = header[i%19] XOR diff[i-19]
 * 
 * The diff is: e2eafa9006d351ec1ead149ac949c77a7242639373360cbe73bc005f477d92b60f2fe16693
 * 
 * This diff must come from somewhere!
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const diff = Buffer.from('e2eafa9006d351ec1ead149ac949c77a7242639373360cbe73bc005f477d92b60f2fe16693', 'hex');

console.log('=== Analyzing Diff Constant ===\n');
console.log('Diff:', diff.toString('hex'));
console.log('Diff length:', diff.length, 'bytes');
console.log('As string:', diff.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if diff is base64 encoded
console.log('\n=== Checking encodings ===\n');

// Try to decode as base64
try {
  const decoded = Buffer.from(diff.toString('utf8'), 'base64');
  console.log('As base64 decoded:', decoded.toString('hex'));
} catch (e) {
  console.log('Not valid base64');
}

// Check if diff is related to the URL parts
const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

console.log('\n=== Diff vs URL parts ===\n');

// diff XOR URL[19:56]
const url19to56 = knownUrl.substring(19, 56);
const diffXorUrl = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  diffXorUrl[i] = diff[i] ^ url19to56.charCodeAt(i);
}
console.log('diff XOR URL[19:56]:', diffXorUrl.toString('hex'));
console.log('As string:', diffXorUrl.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This should be: (key XOR header) XOR URL = key XOR header XOR URL
// And we know key = ciphertext XOR URL
// So: (ciphertext XOR URL XOR header) XOR URL = ciphertext XOR header

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const ciphertext = urlSafeBase64Decode(pageData);
const header = ciphertext.subarray(0, 19);

const cipherXorHeader = Buffer.alloc(37);
for (let i = 19; i < 56; i++) {
  cipherXorHeader[i - 19] = ciphertext[i] ^ header[i % 19];
}
console.log('ciphertext[19:56] XOR header:', cipherXorHeader.toString('hex'));
console.log('Match diffXorUrl:', diffXorUrl.toString('hex') === cipherXorHeader.toString('hex'));

// So diff XOR URL = ciphertext XOR header
// Therefore: diff = (ciphertext XOR header) XOR URL

// But we need URL to compute diff... unless diff is stored somewhere!

// Let me check if diff is in the PAGE_DATA itself
console.log('\n=== Checking if diff is in PAGE_DATA ===\n');

// The ciphertext is 56 bytes
// First 19 bytes = header
// Remaining 37 bytes = ???

const remaining = ciphertext.subarray(19);
console.log('ciphertext[19:56]:', remaining.toString('hex'));
console.log('diff:             ', diff.toString('hex'));

// remaining XOR diff
const remainingXorDiff = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  remainingXorDiff[i] = remaining[i] ^ diff[i];
}
console.log('remaining XOR diff:', remainingXorDiff.toString('hex'));
console.log('As string:', remainingXorDiff.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if this is URL[19:56]
console.log('URL[19:56]:', Buffer.from(url19to56).toString('hex'));
console.log('Match:', remainingXorDiff.toString('hex') === Buffer.from(url19to56).toString('hex'));

// Hmm, remaining XOR diff should give us something meaningful

// Let me think about this differently:
// ciphertext[i] = URL[i] XOR key[i]
// For i >= 19: key[i] = header[i%19] XOR diff[i-19]
// So: ciphertext[i] = URL[i] XOR header[i%19] XOR diff[i-19]
// Therefore: diff[i-19] = ciphertext[i] XOR URL[i] XOR header[i%19]

// We computed diff from the known URL, so it's correct.
// The question is: where does diff come from in the original encryption?

// HYPOTHESIS: diff might be derived from the URL itself!
// For example: diff[i] = URL[i+19] XOR URL[i] (some kind of self-XOR)

console.log('\n=== Testing: diff = URL[i+19] XOR URL[i] ===\n');

const urlSelfXor = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  urlSelfXor[i] = knownUrl.charCodeAt(i + 19) ^ knownUrl.charCodeAt(i);
}
console.log('URL[i+19] XOR URL[i]:', urlSelfXor.toString('hex'));
console.log('diff:                ', diff.toString('hex'));
console.log('Match:', urlSelfXor.toString('hex') === diff.toString('hex'));

// Try: diff = URL[i+19] XOR constant
for (let c = 0; c < 256; c++) {
  let match = true;
  for (let i = 0; i < 37; i++) {
    if (diff[i] !== (url19to56.charCodeAt(i) ^ c)) {
      match = false;
      break;
    }
  }
  if (match) {
    console.log(`diff = URL[19:56] XOR 0x${c.toString(16)}`);
  }
}

// The diff might be a hash of something
const crypto = require('crypto');

console.log('\n=== Checking if diff is a hash ===\n');

const hashInputs = [
  knownUrl,
  knownUrl.substring(0, 56),
  knownUrl.substring(19),
  '2MvvbnGoWS2JcOLzFLpK7RXpCQ',
  pageData,
];

for (const input of hashInputs) {
  const sha256 = crypto.createHash('sha256').update(input).digest();
  if (diff.subarray(0, 32).toString('hex') === sha256.subarray(0, 32).toString('hex')) {
    console.log(`diff starts with SHA256(${input.substring(0, 30)}...)`);
  }
  
  const md5 = crypto.createHash('md5').update(input).digest();
  if (diff.subarray(0, 16).toString('hex') === md5.toString('hex')) {
    console.log(`diff starts with MD5(${input.substring(0, 30)}...)`);
  }
}

// Let me look at the structure of diff more carefully
console.log('\n=== Diff structure analysis ===\n');

// Split into 19-byte chunks
const diffChunk1 = diff.subarray(0, 19);
const diffChunk2 = diff.subarray(19, 37);

console.log('diff[0:19]: ', diffChunk1.toString('hex'));
console.log('diff[19:37]:', diffChunk2.toString('hex'));

// XOR the chunks
const chunkXor = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  chunkXor[i] = diffChunk1[i] ^ diffChunk2[i];
}
console.log('chunk1 XOR chunk2:', chunkXor.toString('hex'));

// Check if diff chunks relate to header
console.log('\ndiff[0:19] XOR header:', Buffer.alloc(19).map((_, i) => diffChunk1[i] ^ header[i]).toString('hex'));

// IMPORTANT INSIGHT:
// The encryption might use a PRNG seeded with something known
// Or the diff might be transmitted separately

console.log('\n=== Key insight ===\n');
console.log('The diff constant is: e2eafa9006d351ec1ead149ac949c77a7242639373360cbe73bc005f477d92b60f2fe16693');
console.log('This is 37 bytes = 56 - 19 (total length - header length)');
console.log('');
console.log('The encryption algorithm appears to be:');
console.log('1. First 19 bytes: ciphertext[i] = URL[i] XOR header[i] XOR URL[i] = header[i]');
console.log('   (So first 19 bytes of ciphertext = header)');
console.log('2. Remaining bytes: ciphertext[i] = URL[i] XOR header[i%19] XOR diff[i-19]');
console.log('');
console.log('The diff must be derived from something we can compute!');

// Let me check if diff = ciphertext[19:] XOR header[i%19] XOR URL[19:]
// We already know this is true by construction.

// The question is: can we compute diff without knowing URL?
// diff = key[19:] XOR header[i%19]
// And key = ciphertext XOR URL
// So diff = ciphertext[19:] XOR URL[19:] XOR header[i%19]

// If we could find a relationship between diff and something known...

// Let me check the embed ID more carefully
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const decodedEmbedId = urlSafeBase64Decode(embedId);

console.log('\n=== Embed ID analysis ===\n');
console.log('Embed ID raw:', embedId);
console.log('Embed ID decoded:', decodedEmbedId.toString('hex'));
console.log('Embed ID length:', decodedEmbedId.length);

// diff XOR embedId (repeated)
const diffXorEmbed = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  diffXorEmbed[i] = diff[i] ^ decodedEmbedId[i % 19];
}
console.log('diff XOR embedId[i%19]:', diffXorEmbed.toString('hex'));
console.log('As string:', diffXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// header XOR embedId
const headerXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXorEmbed[i] = header[i] ^ decodedEmbedId[i];
}
console.log('header XOR embedId:', headerXorEmbed.toString('hex'));
console.log('As string:', headerXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

console.log('\n=== Done ===');
