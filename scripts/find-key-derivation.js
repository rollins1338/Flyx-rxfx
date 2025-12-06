/**
 * Find the key derivation algorithm
 * 
 * We have:
 * - ciphertext[0:19] = header
 * - ciphertext[19:56] = encrypted data
 * - key[0:19] = header XOR URL[0:19]
 * - key[19:56] = ??? (need to find)
 * 
 * Let's analyze the relationship between ciphertext[19:] and key[19:]
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

// Derive actual key
const actualKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  actualKey[i] = ciphertext[i] ^ urlFirst56.charCodeAt(i);
}

console.log('=== Finding Key Derivation ===\n');

// For positions 19+, let's see what ciphertext[i] XOR key[i] gives us
// We know: ciphertext[i] XOR key[i] = URL[i]

// Let's check: key[i] = ciphertext[i] XOR URL[i]
// This is the definition, so it's always true.

// The question is: how is key[i] derived from known values?

// Let's check if key[i] is related to ciphertext[i-19]
console.log('=== Checking: key[i] = f(ciphertext[i-19]) ===\n');

for (let i = 19; i < 38; i++) {
  const k = actualKey[i];
  const c = ciphertext[i - 19];
  const xor = k ^ c;
  console.log(`key[${i}]=0x${k.toString(16).padStart(2,'0')} cipher[${i-19}]=0x${c.toString(16).padStart(2,'0')} XOR=0x${xor.toString(16).padStart(2,'0')}='${String.fromCharCode(xor)}'`);
}

// The XOR values are: key[i] XOR ciphertext[i-19]
// Let's see if this equals URL[i] or something else

console.log('\n=== Checking: key[i] XOR cipher[i-19] = URL[i]? ===\n');

let match = true;
for (let i = 19; i < 38; i++) {
  const xor = actualKey[i] ^ ciphertext[i - 19];
  const url = urlFirst56.charCodeAt(i);
  if (xor !== url) {
    match = false;
    console.log(`Mismatch at ${i}: XOR=0x${xor.toString(16)} URL=0x${url.toString(16)}='${urlFirst56[i]}'`);
  }
}
console.log('key[i] XOR cipher[i-19] = URL[i]:', match);

// Let's check: key[i] XOR cipher[i-19] = URL[i-19]?
console.log('\n=== Checking: key[i] XOR cipher[i-19] = URL[i-19]? ===\n');

match = true;
for (let i = 19; i < 38; i++) {
  const xor = actualKey[i] ^ ciphertext[i - 19];
  const url = urlFirst56.charCodeAt(i - 19);
  if (xor !== url) {
    match = false;
  }
}
console.log('key[i] XOR cipher[i-19] = URL[i-19]:', match);

// Let's check: key[i] = cipher[i-19] XOR URL[i-19]?
console.log('\n=== Checking: key[i] = cipher[i-19] XOR URL[i-19]? ===\n');

match = true;
for (let i = 19; i < 38; i++) {
  const expected = ciphertext[i - 19] ^ urlFirst56.charCodeAt(i - 19);
  if (actualKey[i] !== expected) {
    match = false;
    console.log(`Mismatch at ${i}: key=0x${actualKey[i].toString(16)} expected=0x${expected.toString(16)}`);
  }
}
console.log('key[i] = cipher[i-19] XOR URL[i-19]:', match);

// Wait! cipher[i-19] = header[i-19] for i in 19-37
// And URL[i-19] = URL[0:19]
// So: key[i] = header[i-19] XOR URL[i-19] = key[i-19]!

// Let's verify: key[i] = key[i-19]?
console.log('\n=== Checking: key[i] = key[i-19]? ===\n');

match = true;
for (let i = 19; i < 38; i++) {
  if (actualKey[i] !== actualKey[i - 19]) {
    match = false;
    console.log(`Mismatch at ${i}: key[${i}]=0x${actualKey[i].toString(16)} key[${i-19}]=0x${actualKey[i-19].toString(16)}`);
  }
}
console.log('key[i] = key[i-19]:', match);

// The key does NOT repeat with period 19!
// So the derivation is more complex.

// Let me check: key[i] = header[i % 19] XOR URL[i % 19] XOR something?
console.log('\n=== Finding the "something" ===\n');

// key[i] = header[i % 19] XOR URL[i % 19] XOR something[i]
// something[i] = key[i] XOR header[i % 19] XOR URL[i % 19]

const something = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  something[i] = actualKey[i] ^ header[i % 19] ^ urlFirst56.charCodeAt(i % 19);
}

console.log('something:', something.toString('hex'));
console.log('As string:', something.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// For positions 0-18: something[i] = key[i] XOR header[i] XOR URL[i]
//                                  = (header[i] XOR URL[i]) XOR header[i] XOR URL[i]
//                                  = 0
// So something[0:19] should be all zeros!

console.log('\nsomething[0:19]:', something.subarray(0, 19).toString('hex'));
console.log('All zeros:', something.subarray(0, 19).every(b => b === 0));

// For positions 19+: something[i] = key[i] XOR header[i % 19] XOR URL[i % 19]
// This is the "extra" XOR that's applied for positions 19+

console.log('\nsomething[19:38]:', something.subarray(19, 38).toString('hex'));
console.log('something[38:56]:', something.subarray(38, 56).toString('hex'));

// Let's see if something[19:] is related to URL[19:] or ciphertext[19:]
console.log('\n=== Analyzing something[19:] ===\n');

// something[19:] XOR URL[19:]
const somethingXorUrl = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  somethingXorUrl[i] = something[19 + i] ^ urlFirst56.charCodeAt(19 + i);
}
console.log('something[19:] XOR URL[19:]:', somethingXorUrl.toString('hex'));
console.log('As string:', somethingXorUrl.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// something[19:] XOR ciphertext[19:]
const somethingXorCipher = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  somethingXorCipher[i] = something[19 + i] ^ ciphertext[19 + i];
}
console.log('something[19:] XOR cipher[19:]:', somethingXorCipher.toString('hex'));
console.log('As string:', somethingXorCipher.toString('utf8').replace(/[^\x20-\x7e]/g, '.'));

// Let me check if something[19:] = URL[19:] XOR URL[0:19] (repeated)
console.log('\n=== Checking: something[i] = URL[i] XOR URL[i % 19] ===\n');

const urlXorUrlMod = Buffer.alloc(37);
for (let i = 0; i < 37; i++) {
  urlXorUrlMod[i] = urlFirst56.charCodeAt(19 + i) ^ urlFirst56.charCodeAt((19 + i) % 19);
}
console.log('URL[19:] XOR URL[i % 19]:', urlXorUrlMod.toString('hex'));
console.log('something[19:]:', something.subarray(19, 56).toString('hex'));
console.log('Match:', urlXorUrlMod.toString('hex') === something.subarray(19, 56).toString('hex'));

// YES! something[i] = URL[i] XOR URL[i % 19] for i >= 19!

// So the full key derivation is:
// key[i] = header[i % 19] XOR URL[i % 19] XOR (URL[i] XOR URL[i % 19])
//        = header[i % 19] XOR URL[i]

// Wait, that simplifies to: key[i] = header[i % 19] XOR URL[i]
// But we showed earlier that this doesn't match!

// Let me re-verify
console.log('\n=== Re-verifying: key[i] = header[i % 19] XOR URL[i] ===\n');

const testKey = Buffer.alloc(56);
for (let i = 0; i < 56; i++) {
  testKey[i] = header[i % 19] ^ urlFirst56.charCodeAt(i);
}
console.log('Test key:', testKey.toString('hex'));
console.log('Actual key:', actualKey.toString('hex'));
console.log('Match:', testKey.toString('hex') === actualKey.toString('hex'));

// They don't match! So my derivation is wrong somewhere.

// Let me recalculate:
// something[i] = key[i] XOR header[i % 19] XOR URL[i % 19]
// For i >= 19: something[i] = URL[i] XOR URL[i % 19]
// So: key[i] XOR header[i % 19] XOR URL[i % 19] = URL[i] XOR URL[i % 19]
// Therefore: key[i] = header[i % 19] XOR URL[i % 19] XOR URL[i] XOR URL[i % 19]
//                   = header[i % 19] XOR URL[i]

// This should be correct! Let me check the calculation again.

console.log('\n=== Detailed verification ===\n');

for (let i = 19; i < 25; i++) {
  const h = header[i % 19];
  const u = urlFirst56.charCodeAt(i);
  const expected = h ^ u;
  const actual = actualKey[i];
  console.log(`[${i}] header[${i%19}]=0x${h.toString(16).padStart(2,'0')} URL[${i}]='${urlFirst56[i]}'=0x${u.toString(16).padStart(2,'0')} expected=0x${expected.toString(16).padStart(2,'0')} actual=0x${actual.toString(16).padStart(2,'0')} ${expected === actual ? '✓' : '✗'}`);
}

// The expected and actual don't match!
// So key[i] ≠ header[i % 19] XOR URL[i]

// But we showed something[i] = URL[i] XOR URL[i % 19]
// And something[i] = key[i] XOR header[i % 19] XOR URL[i % 19]
// So: key[i] XOR header[i % 19] XOR URL[i % 19] = URL[i] XOR URL[i % 19]
// key[i] = header[i % 19] XOR URL[i]

// There must be an error in my calculation. Let me check something[19:] again.

console.log('\n=== Rechecking something calculation ===\n');

for (let i = 19; i < 25; i++) {
  const k = actualKey[i];
  const h = header[i % 19];
  const uMod = urlFirst56.charCodeAt(i % 19);
  const s = k ^ h ^ uMod;
  const uXorUMod = urlFirst56.charCodeAt(i) ^ urlFirst56.charCodeAt(i % 19);
  console.log(`[${i}] key=0x${k.toString(16).padStart(2,'0')} header[${i%19}]=0x${h.toString(16).padStart(2,'0')} URL[${i%19}]='${urlFirst56[i%19]}'=0x${uMod.toString(16).padStart(2,'0')} something=0x${s.toString(16).padStart(2,'0')} URL[${i}]XOR URL[${i%19}]=0x${uXorUMod.toString(16).padStart(2,'0')} ${s === uXorUMod ? '✓' : '✗'}`);
}

console.log('\n=== Done ===');
