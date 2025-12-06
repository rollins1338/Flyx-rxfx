/**
 * Analyze the "something" values
 * 
 * something[i] = key[i] XOR header[i % 19] XOR URL[i % 19]
 * 
 * For i < 19: something[i] = 0 (verified)
 * For i >= 19: something[i] = ??? (need to find pattern)
 * 
 * something[19:38]: 8a9e8ee075e97ec36cdf66b4aa26b51f41740f
 * something[38:56]: fb07427ccd49932f2d350fbcd5605d8455a5
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

// Compute something
const something = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  something[i] = actualKey[i] ^ header[i % 19] ^ urlFirst56.charCodeAt(i % 19);
}

console.log('=== Analyzing "something" ===\n');

const s19to38 = something.subarray(19, 38);
const s38to56 = something.subarray(38, 56);

console.log('something[19:38]:', s19to38.toString('hex'));
console.log('something[38:56]:', s38to56.toString('hex'));

// Check relationships with known values
console.log('\n=== Checking relationships ===\n');

// something XOR hash
const sXorHash = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  sXorHash[i] = s19to38[i] ^ hashHex[i];
}
console.log('something[19:38] XOR hash:', sXorHash.toString('hex'));
console.log('As string:', sXorHash.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// something XOR embedId
const sXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  sXorEmbed[i] = s19to38[i] ^ decodedEmbedId[i];
}
console.log('something[19:38] XOR embedId:', sXorEmbed.toString('hex'));
console.log('As string:', sXorEmbed.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// something XOR header
const sXorHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  sXorHeader[i] = s19to38[i] ^ header[i];
}
console.log('something[19:38] XOR header:', sXorHeader.toString('hex'));
console.log('As string:', sXorHeader.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// something XOR ciphertext[19:38]
const sXorCipher = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  sXorCipher[i] = s19to38[i] ^ ciphertext[19 + i];
}
console.log('something[19:38] XOR cipher[19:38]:', sXorCipher.toString('hex'));
console.log('As string:', sXorCipher.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Check if something is related to URL[19:38]
const url19to38 = Buffer.from(urlFirst56.substring(19, 38));
const sXorUrl = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  sXorUrl[i] = s19to38[i] ^ url19to38[i];
}
console.log('something[19:38] XOR URL[19:38]:', sXorUrl.toString('hex'));
console.log('As string:', sXorUrl.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Let me check if something = key[0:19] XOR key[19:38]
const keyXor = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  keyXor[i] = actualKey[i] ^ actualKey[19 + i];
}
console.log('\nkey[0:19] XOR key[19:38]:', keyXor.toString('hex'));
console.log('something[19:38]:', s19to38.toString('hex'));
console.log('Match:', keyXor.toString('hex') === s19to38.toString('hex'));

// Yes! something[19:38] = key[0:19] XOR key[19:38]!

// So: something[i] = key[i - 19] XOR key[i] for i >= 19
// This means: key[i] = key[i - 19] XOR something[i] for i >= 19

// But we still need to find something[i] without knowing key[i]...

// Let me check if something is related to ciphertext
console.log('\n=== Checking: something = f(ciphertext) ===\n');

// something[19:38] = key[0:19] XOR key[19:38]
//                  = (cipher[0:19] XOR URL[0:19]) XOR (cipher[19:38] XOR URL[19:38])
//                  = cipher[0:19] XOR URL[0:19] XOR cipher[19:38] XOR URL[19:38]
//                  = header XOR URL[0:19] XOR cipher[19:38] XOR URL[19:38]

// Let's verify
const computed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  computed[i] = header[i] ^ urlFirst56.charCodeAt(i) ^ ciphertext[19 + i] ^ urlFirst56.charCodeAt(19 + i);
}
console.log('header XOR URL[0:19] XOR cipher[19:38] XOR URL[19:38]:', computed.toString('hex'));
console.log('something[19:38]:', s19to38.toString('hex'));
console.log('Match:', computed.toString('hex') === s19to38.toString('hex'));

// So: something[i] = header[i-19] XOR URL[i-19] XOR cipher[i] XOR URL[i] for i >= 19
// This simplifies to: something[i] = key[i-19] XOR key[i]
// Which we already knew.

// The key insight: we can compute something if we know URL!
// But we need something to compute URL... circular!

// UNLESS: something is constant or predictable!

// Let me check if something[19:38] = something[38:56] (with appropriate indexing)
console.log('\n=== Checking if something repeats ===\n');

// something[38:56] has 18 bytes
// Compare with something[19:37]
const s19to37 = s19to38.subarray(0, 18);
console.log('something[19:37]:', s19to37.toString('hex'));
console.log('something[38:56]:', s38to56.toString('hex'));

// XOR them
const sXorS = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  sXorS[i] = s19to37[i] ^ s38to56[i];
}
console.log('something[19:37] XOR something[38:56]:', sXorS.toString('hex'));

// This should equal key[19:37] XOR key[38:56]
const keyXor2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  keyXor2[i] = actualKey[19 + i] ^ actualKey[38 + i];
}
console.log('key[19:37] XOR key[38:56]:', keyXor2.toString('hex'));
console.log('Match:', sXorS.toString('hex') === keyXor2.toString('hex'));

// And this should equal URL[19:37] XOR URL[38:56]
const urlXor2 = Buffer.alloc(18);
for (let i = 0; i < 18; i++) {
  urlXor2[i] = urlFirst56.charCodeAt(19 + i) ^ urlFirst56.charCodeAt(38 + i);
}
console.log('URL[19:37] XOR URL[38:56]:', urlXor2.toString('hex'));

// The pattern is: something[i] XOR something[i+19] = URL[i] XOR URL[i+19]
// This is because something[i] = key[i-19] XOR key[i]
// And key[i] = cipher[i] XOR URL[i]

console.log('\n=== Summary ===\n');
console.log('The "something" values are:');
console.log('something[i] = key[i-19] XOR key[i] for i >= 19');
console.log('');
console.log('This means:');
console.log('key[i] = key[i-19] XOR something[i] for i >= 19');
console.log('');
console.log('To decrypt, we need to find something[i] without knowing key[i].');
console.log('');
console.log('Possible approaches:');
console.log('1. something might be derived from hash/embedId');
console.log('2. something might be stored in the ciphertext');
console.log('3. something might be constant');

// Let me check if something is derived from hash XOR embedId
console.log('\n=== Checking: something = hash XOR embedId ===\n');

const hashXorEmbed = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  hashXorEmbed[i] = hashHex[i] ^ decodedEmbedId[i];
}
console.log('hash XOR embedId:', hashXorEmbed.toString('hex'));
console.log('something[19:38]:', s19to38.toString('hex'));
console.log('Match:', hashXorEmbed.toString('hex') === s19to38.toString('hex'));

// Let me try: something = hash XOR header
const hashXorHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  hashXorHeader[i] = hashHex[i] ^ header[i];
}
console.log('hash XOR header:', hashXorHeader.toString('hex'));
console.log('Match:', hashXorHeader.toString('hex') === s19to38.toString('hex'));

// Let me try: something = embedId XOR header
const embedXorHeader = Buffer.alloc(19);
for (let i = 0; i < 19; i++) {
  embedXorHeader[i] = decodedEmbedId[i] ^ header[i];
}
console.log('embedId XOR header:', embedXorHeader.toString('hex'));
console.log('Match:', embedXorHeader.toString('hex') === s19to38.toString('hex'));

console.log('\n=== Done ===');
