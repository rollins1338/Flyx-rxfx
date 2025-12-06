/**
 * Find the URL pattern
 * 
 * The URL structure is: https://[domain]/[path]/h[hash]/list,[filename].m3u8
 * 
 * We need to figure out how to derive the domain and path from the available data.
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
const embedDomain = 'rapidairmax.site';

const ciphertext = urlSafeBase64Decode(pageData);
const header = ciphertext.subarray(0, 19);
const hashHex = Buffer.from(appJsHash, 'hex');
const decodedEmbedId = urlSafeBase64Decode(embedId);

console.log('=== Finding URL Pattern ===\n');

// The embed page is from rapidairmax.site
// The HLS URL is from rrr.core36link.site
// Is there a relationship?

console.log('Embed domain:', embedDomain);
console.log('HLS domain:', 'rrr.core36link.site');

// The HLS URL structure:
// https://rrr.core36link.site/p267/c5/h[hash]/list,[filename].m3u8
// 
// Breaking it down:
// - Protocol: https://
// - Domain: rrr.core36link.site
// - Path: /p267/c5/
// - Hash prefix: h
// - Hash: 6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d
// - Separator: /list,
// - Filename: Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ
// - Extension: .m3u8

const urlParts = {
  protocol: 'https://',
  domain: 'rrr.core36link.site',
  path: '/p267/c5/',
  hashPrefix: 'h',
  hash: '6a90f70b8d237f94866b6cfc2e6349bddedc7dc1328a9167a7393f7521fd6fa6e358899eb0ee7bdfc502a43593daeb433f43341b2c9c0ee41c8cc89353a146e35d',
  separator: '/list,',
  filename: 'Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ',
  extension: '.m3u8'
};

console.log('\nURL parts:');
Object.entries(urlParts).forEach(([key, value]) => {
  console.log(`  ${key}: ${value} (${value.length} chars)`);
});

// The first 56 bytes of the URL are:
// https://rrr.core36link.site/p267/c5/h6a90f70b8d237f94866
// = protocol (8) + domain (19) + path (9) + hashPrefix (1) + hash[0:19] (19) = 56

const urlFirst56 = knownUrl.substring(0, 56);
console.log('\nFirst 56 chars:', urlFirst56);
console.log('Breakdown:');
console.log('  [0:8]   protocol:', urlFirst56.substring(0, 8));
console.log('  [8:27]  domain:', urlFirst56.substring(8, 27));
console.log('  [27:36] path:', urlFirst56.substring(27, 36));
console.log('  [36:37] hashPrefix:', urlFirst56.substring(36, 37));
console.log('  [37:56] hash start:', urlFirst56.substring(37, 56));

// The key insight: if we can figure out the domain and path, we can decrypt!
// The domain might be encoded in the header or derived from the embed domain.

console.log('\n=== Checking if domain is in header ===\n');

// header XOR "https://rrr.core36l" = key[0:19]
// If we XOR header with different URL prefixes, we get different keys
// The correct key should decrypt the ciphertext to the URL

// Let's try some common domain patterns
const domainPatterns = [
  'https://rrr.core36link.site/',
  'https://rapidshare.cc/stream/',
  'https://rapidairmax.site/',
  'https://core36link.site/',
];

console.log('Testing domain patterns:');
domainPatterns.forEach(pattern => {
  const prefix = pattern.substring(0, 19);
  const testKey = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    testKey[i] = header[i] ^ prefix.charCodeAt(i);
  }
  
  // Decrypt first 19 bytes with this key
  const decrypted = Buffer.alloc(19);
  for (let i = 0; i < 19; i++) {
    decrypted[i] = ciphertext[i] ^ testKey[i];
  }
  
  console.log(`  ${prefix} => ${decrypted.toString('utf8')}`);
});

// The correct decryption should give us the URL prefix
// Let's check which one matches

console.log('\n=== Checking header structure ===\n');

// The header might encode information about the URL
// Let's see if there's a pattern

console.log('Header bytes:');
for (let i = 0; i < 19; i++) {
  const h = header[i];
  const u = urlFirst56.charCodeAt(i);
  const k = h ^ u;
  console.log(`  [${i}] header=0x${h.toString(16).padStart(2,'0')} URL='${urlFirst56[i]}'=0x${u.toString(16).padStart(2,'0')} key=0x${k.toString(16).padStart(2,'0')}`);
}

// The key is: b7777a5c80b839b5a4f0251abcaee184d89d0b
// This doesn't look like a simple pattern

// Let me check if the key is related to the app.js hash
console.log('\n=== Key vs Hash relationship ===\n');

const key0to19 = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  key0to19[i] = header[i] ^ urlFirst56.charCodeAt(i);
}

console.log('Key[0:19]:', key0to19.toString('hex'));
console.log('Hash:     ', hashHex.toString('hex'));

// key XOR hash
const keyXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  keyXorHash[i] = key0to19[i] ^ hashHex[i];
}
console.log('Key XOR hash:', keyXorHash.toString('hex'));
console.log('As string:', keyXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if key XOR hash = URL
const urlBytes = Buffer.from(urlFirst56.substring(0, 19));
console.log('URL[0:19]:', urlBytes.toString('hex'));
console.log('Match:', keyXorHash.toString('hex') === urlBytes.toString('hex'));

// So key XOR hash ≠ URL
// But we know key = header XOR URL
// So: (header XOR URL) XOR hash = keyXorHash
// And: keyXorHash XOR URL = header XOR hash

const headerXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  headerXorHash[i] = header[i] ^ hashHex[i];
}
console.log('\nheader XOR hash:', headerXorHash.toString('hex'));
console.log('As string:', headerXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// This is: .TM.....:=l!63...|m
// Not the URL

// The decryption algorithm must be more complex
// Let me check if there's a two-stage decryption

console.log('\n=== Testing two-stage decryption ===\n');

// Stage 1: ciphertext XOR hash = intermediate
const intermediate = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  intermediate[i] = ciphertext[i] ^ hashHex[i % 19];
}
console.log('Stage 1 (cipher XOR hash):', intermediate.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Stage 2: intermediate XOR ??? = URL
// What should ??? be?

// intermediate XOR URL = ???
const stage2Key = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  stage2Key[i] = intermediate[i] ^ urlFirst56.charCodeAt(i);
}
console.log('Stage 2 key (intermediate XOR URL):', stage2Key.toString('hex'));
console.log('As string:', stage2Key.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if stage2Key has a pattern
console.log('\nStage 2 key segments:');
console.log('  [0:19]: ', stage2Key.subarray(0, 19).toString('hex'));
console.log('  [19:38]:', stage2Key.subarray(19, 38).toString('hex'));
console.log('  [38:56]:', stage2Key.subarray(38, 56).toString('hex'));

// Check if stage2Key[0:19] = header
console.log('\nStage 2 key[0:19] = header?', stage2Key.subarray(0, 19).toString('hex') === header.toString('hex'));

// If stage2Key[0:19] = header, then:
// intermediate XOR header = URL (for positions 0-18)
// (cipher XOR hash) XOR header = URL
// cipher XOR hash XOR header = URL

// Let's verify
const tripleXor = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  tripleXor[i] = ciphertext[i] ^ hashHex[i] ^ header[i];
}
console.log('\ncipher XOR hash XOR header:', tripleXor.toString('utf8'));
console.log('Expected URL[0:19]:', urlFirst56.substring(0, 19));
console.log('Match:', tripleXor.toString('utf8') === urlFirst56.substring(0, 19));

if (tripleXor.toString('utf8') === urlFirst56.substring(0, 19)) {
  console.log('\n🎉🎉🎉 DECRYPTION ALGORITHM FOUND! 🎉🎉🎉');
  console.log('For positions 0-18: URL[i] = ciphertext[i] XOR hash[i] XOR header[i]');
  console.log('Since ciphertext[0:19] = header:');
  console.log('URL[i] = header[i] XOR hash[i] XOR header[i] = hash[i]');
  console.log('');
  console.log('Wait, that would mean URL[0:19] = hash, but hash is only 19 bytes...');
}

console.log('\n=== Done ===');
