/**
 * Analyze the offset between key and hash
 * 
 * We found: offset = key XOR hash = 932039617f3ebc21484f1e0f555ccbc2374a01
 * 
 * This offset must come from somewhere!
 */

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const knownUrl = 'https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
const appJsHash = '2457433dff868594ecbf3b15e9f22a46efd70a';
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';

const ciphertext = urlSafeBase64Decode(pageData);
const header = ciphertext.subarray(0, 19);
const hashHex = Buffer.from(appJsHash, 'hex');
const decodedEmbedId = urlSafeBase64Decode(embedId);
const urlFirst56 = knownUrl.substring(0, 56);

// Derive actual key
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

const offset = Buffer.from('932039617f3ebc21484f1e0f555ccbc2374a01', 'hex');

console.log('=== Analyzing Offset ===\n');
console.log('Offset:', offset.toString('hex'));
console.log('Offset length:', offset.length);

// Check if offset is related to embed ID
console.log('\n=== Offset vs Embed ID ===\n');
console.log('Embed ID:', decodedEmbedId.toString('hex'));

const offsetXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  offsetXorEmbed[i] = offset[i] ^ decodedEmbedId[i];
}
console.log('Offset XOR embedId:', offsetXorEmbed.toString('hex'));
console.log('As string:', offsetXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if offset is related to header
console.log('\n=== Offset vs Header ===\n');
console.log('Header:', header.toString('hex'));

const offsetXorHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  offsetXorHeader[i] = offset[i] ^ header[i];
}
console.log('Offset XOR header:', offsetXorHeader.toString('hex'));
console.log('As string:', offsetXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if offset is related to URL
console.log('\n=== Offset vs URL ===\n');
const url0to19 = urlFirst56.substring(0, 19);
console.log('URL[0:19]:', url0to19);

const offsetXorUrl = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  offsetXorUrl[i] = offset[i] ^ url0to19.charCodeAt(i);
}
console.log('Offset XOR URL:', offsetXorUrl.toString('hex'));
console.log('As string:', offsetXorUrl.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if offset = embedId XOR something
console.log('\n=== Checking: offset = embedId XOR ??? ===\n');

// offset XOR embedId = ???
// We already computed this above
// Let's see if it matches any known value

// Check if offset XOR embedId = URL
const offsetXorEmbedAsUrl = offsetXorEmbed.toString('utf8');
console.log('Offset XOR embedId as string:', offsetXorEmbedAsUrl);
console.log('URL[0:19]:', url0to19);

// Check if offset XOR embedId = header
console.log('Offset XOR embedId hex:', offsetXorEmbed.toString('hex'));
console.log('Header hex:', header.toString('hex'));
console.log('Match:', offsetXorEmbed.toString('hex') === header.toString('hex'));

// Check if offset XOR embedId = hash
console.log('Hash hex:', hashHex.toString('hex'));
console.log('Match hash:', offsetXorEmbed.toString('hex') === hashHex.toString('hex'));

// Let me try: offset = header XOR embedId XOR hash
console.log('\n=== Testing: offset = header XOR embedId XOR hash ===\n');

const testOffset = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  testOffset[i] = header[i] ^ decodedEmbedId[i] ^ hashHex[i];
}
console.log('header XOR embedId XOR hash:', testOffset.toString('hex'));
console.log('Actual offset:              ', offset.toString('hex'));
console.log('Match:', testOffset.toString('hex') === offset.toString('hex'));

// Try: offset = URL XOR embedId
console.log('\n=== Testing: offset = URL XOR embedId ===\n');

const urlXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  urlXorEmbed[i] = url0to19.charCodeAt(i) ^ decodedEmbedId[i];
}
console.log('URL XOR embedId:', urlXorEmbed.toString('hex'));
console.log('Actual offset:  ', offset.toString('hex'));
console.log('Match:', urlXorEmbed.toString('hex') === offset.toString('hex'));

// Try: offset = header XOR URL
console.log('\n=== Testing: offset = header XOR URL ===\n');

const headerXorUrl = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXorUrl[i] = header[i] ^ url0to19.charCodeAt(i);
}
console.log('header XOR URL:', headerXorUrl.toString('hex'));
console.log('Actual offset: ', offset.toString('hex'));
console.log('Match:', headerXorUrl.toString('hex') === offset.toString('hex'));

// Wait! header XOR URL = key[0:19]!
// And offset = key XOR hash
// So: offset = (header XOR URL) XOR hash = header XOR URL XOR hash

// Let me verify
console.log('\n=== Verifying: offset = key = header XOR URL ===\n');
console.log('key[0:19]:', actualKey.subarray(0, 19).toString('hex'));
console.log('header XOR URL:', headerXorUrl.toString('hex'));
console.log('Match:', actualKey.subarray(0, 19).toString('hex') === headerXorUrl.toString('hex'));

// So key = header XOR URL, which we already knew!
// And offset = key XOR hash = header XOR URL XOR hash

// The question is: how do we get the key without knowing URL?
// We need to find another relationship.

// Let me check if there's a relationship between embedId and URL
console.log('\n=== Checking embedId vs URL relationship ===\n');

// The embed ID might encode part of the URL
console.log('Embed ID raw:', embedId);
console.log('Embed ID decoded:', decodedEmbedId.toString('hex'));

// The URL hash is: h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d
// Is there any relationship?

const urlHashPart = 'h6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d';
console.log('URL hash part:', urlHashPart);
console.log('URL hash length:', urlHashPart.length);

// Check if embedId is part of URL hash
if (urlHashPart.includes(embedId)) {
  console.log('Embed ID found in URL hash!');
}

// Check if decoded embedId is part of URL hash (as hex)
const embedIdHex = decodedEmbedId.toString('hex');
if (urlHashPart.includes(embedIdHex)) {
  console.log('Decoded embed ID (hex) found in URL hash!');
}

// The key insight might be that the URL is deterministic based on embedId
// Let me check if there's a pattern

console.log('\n=== Summary ===\n');
console.log('We have confirmed:');
console.log('1. key[i] = header[i] XOR URL[i] for i < 19');
console.log('2. key[i] = header[i % 19] XOR diff[i-19] for i >= 19');
console.log('3. offset = key XOR hash');
console.log('');
console.log('To decrypt without knowing URL, we need to find:');
console.log('- A relationship between embedId and URL');
console.log('- Or a way to derive the key from hash + embedId + header');

console.log('\n=== Done ===');
