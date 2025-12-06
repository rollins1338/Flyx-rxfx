/**
 * Deep deobfuscation of rapidshare app.js
 * 
 * Goal: Extract the exact decryption algorithm without browser automation
 * 
 * Key observations:
 * 1. The code uses a state machine with W3.w3P() and W3.Q66() for control flow
 * 2. N4F/N0M access a string table built by M2OpVfE
 * 3. The decryption uses XOR with a 32-byte key
 * 4. The key is derived from location.pathname
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Deep Deobfuscation ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// Step 1: Build the string table
// The string table is built by XORing with "C|B%"
console.log('=== Step 1: Building string table ===\n');

// Find the encoded string that gets XOR decoded
// It's in the M2OpVfE function
const m2opvfeStart = code.indexOf('M2OpVfE');
const m2opvfeEnd = code.indexOf('return N', m2opvfeStart);
const m2opvfeCode = code.substring(m2opvfeStart, m2opvfeEnd + 100);

// The XOR key is "C|B%" (URL encoded as C%7CB%)
const xorKey = 'C|B%';

// Find the b variable which holds the base string
// b=u6JBF.V4a()(t([17,64,75,32,15,76])())
// t() transforms the array [17,64,75,32,15,76] into something

// The array [17,64,75,32,15,76] when +36 gives [53,100,111,68,51,112]
// Which is ASCII for: 5, d, o, D, 3, p -> "5doD3p"
// This might be a function name or variable

// Let's find what t() does
const tFuncMatch = code.match(/var t=function\(a\)\{[^}]+\}/);
if (tFuncMatch) {
  console.log('t() function:');
  console.log(tFuncMatch[0]);
}

// The string table is built by iterating and XORing
// Q+=t(s(r)^w(c)) where s and w are bound to different strings

// Let's try to extract the string table directly
// Find all k[] assignments
const kPattern = /k\[(\d+)\]\s*=\s*["']([^"']+)["']/g;
const stringTable = {};
let match;
while ((match = kPattern.exec(code)) !== null) {
  stringTable[parseInt(match[1])] = match[2];
}

console.log(`Found ${Object.keys(stringTable).length} string table entries`);

// Look for interesting entries
const interestingIndices = [90, 148, 380, 419, 212, 266, 297, 344, 367, 249];
console.log('\nInteresting string table entries:');
interestingIndices.forEach(idx => {
  if (stringTable[idx]) {
    console.log(`  k[${idx}] = "${stringTable[idx]}"`);
  }
});

// Step 2: Understand the key derivation
console.log('\n=== Step 2: Key derivation ===\n');

// From i3():
// r[9]=J(u7dV1j(W3.N0M(212))) - initializes key array
// r[7]=f() - gets the pathname (cleaned)
// r[3]=r[1]?r[1][1]:W3.N0M(419)===r[4]?r[7]:R - conditional
// r[9][r[6]]=r[7][j3](r[6]%r[7][W3.N4F(380)]) - builds key

// j3 is likely charCodeAt (index 90 in string table)
// W3.N4F(380) is likely "length"

// f() returns: t4TD2P[u7dV1j(E3)][u7dV1j(B3)][A3](/[^\u0041-\x44\u0045-\u0047\110-\x50\121-\126\x57-\u005a\x30-\x34\x35-\x39]/g,W3.N4F(419))[S3](-30)
// This is: location.pathname.replace(/[^A-Z0-9]/gi, '').slice(-30)

// Let's decode the regex
const regexStr = '[^\\u0041-\\x44\\u0045-\\u0047\\110-\\x50\\121-\\126\\x57-\\u005a\\x30-\\x34\\x35-\\x39]';
console.log('Regex pattern:', regexStr);
// \u0041-\x44 = A-D
// \u0045-\u0047 = E-G
// \110-\x50 = H-P
// \121-\126 = Q-V
// \x57-\u005a = W-Z
// \x30-\x34 = 0-4
// \x35-\x39 = 5-9
// So it matches anything NOT in A-Z or 0-9

// Step 3: Simulate the key generation
console.log('\n=== Step 3: Simulating key generation ===\n');

const embedPath = '/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ';

// Clean the path (remove non-alphanumeric, uppercase)
const cleanPath = embedPath.replace(/[^A-Z0-9]/gi, '').toUpperCase();
console.log(`Clean path: ${cleanPath}`);

// Slice to last 30 chars
const slicedPath = cleanPath.slice(-30);
console.log(`Sliced path: ${slicedPath}`);

// Build the 32-byte key
const keyLen = 32;
const key = Buffer.alloc(keyLen);
for (let i = 0; i < keyLen; i++) {
  key[i] = slicedPath.charCodeAt(i % slicedPath.length);
}
console.log(`Key (hex): ${key.toString('hex')}`);
console.log(`Key (ascii): ${key.toString('ascii')}`);

// Step 4: Try decryption
console.log('\n=== Step 4: Trying decryption ===\n');

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

function xorDecrypt(data, key) {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

const decoded = urlSafeBase64Decode(pageData);
console.log(`Decoded PAGE_DATA: ${decoded.length} bytes`);
console.log(`Hex: ${decoded.toString('hex')}`);

let result = xorDecrypt(decoded, key);
console.log(`\nDecrypted with key:`);
console.log(`Hex: ${result.toString('hex')}`);
console.log(`ASCII: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// The decryption might also involve some transformations
// From the code: c[5]=D(c[5]), c[5]=b(c[5]), c[5]=w(c[5]), etc.
// These are transformation functions applied before/after XOR

// Let's try different transformations
console.log('\n=== Trying transformations ===\n');

// z(a) = 255 & (a << 3 | a >>> 8-3) - rotate left by 3
function rotateLeft3(byte) {
  return ((byte << 3) | (byte >>> 5)) & 0xFF;
}

// Try rotating each byte before XOR
const rotatedDecoded = Buffer.from(decoded.map(b => rotateLeft3(b)));
result = xorDecrypt(rotatedDecoded, key);
console.log(`Rotated then XOR: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try XOR then rotate
result = xorDecrypt(decoded, key);
const rotatedResult = Buffer.from(result.map(b => rotateLeft3(b)));
console.log(`XOR then rotated: ${rotatedResult.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// The code also has: r[9][r[6]]=r[9][r[6]+2]
// This suggests some byte rearrangement

// Try skipping first 2 bytes of key
const key2 = Buffer.alloc(keyLen);
for (let i = 0; i < keyLen; i++) {
  key2[i] = slicedPath.charCodeAt((i + 2) % slicedPath.length);
}
result = xorDecrypt(decoded, key2);
console.log(`\nKey offset +2: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// The actual decryption might use the embed ID directly, not the path
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const key3 = Buffer.alloc(keyLen);
for (let i = 0; i < keyLen; i++) {
  key3[i] = embedId.charCodeAt(i % embedId.length);
}
result = xorDecrypt(decoded, key3);
console.log(`\nEmbed ID key: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try lowercase
const key4 = Buffer.alloc(keyLen);
const lowerPath = embedPath.replace(/[^A-Z0-9]/gi, '').toLowerCase();
for (let i = 0; i < keyLen; i++) {
  key4[i] = lowerPath.charCodeAt(i % lowerPath.length);
}
result = xorDecrypt(decoded, key4);
console.log(`\nLowercase path key: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// The PAGE_DATA might have a different structure
// Let's analyze the bytes more carefully
console.log('\n=== Byte analysis ===\n');

// First few bytes might be a header
console.log('First 20 bytes:', decoded.slice(0, 20).toString('hex'));
console.log('Last 20 bytes:', decoded.slice(-20).toString('hex'));

// Check if there's a pattern
const byteFreq = new Array(256).fill(0);
for (const b of decoded) byteFreq[b]++;
const topBytes = byteFreq.map((f, i) => ({ byte: i, freq: f }))
  .filter(x => x.freq > 0)
  .sort((a, b) => b.freq - a.freq)
  .slice(0, 10);
console.log('\nMost common bytes:');
topBytes.forEach(({ byte, freq }) => {
  console.log(`  0x${byte.toString(16).padStart(2, '0')}: ${freq} times`);
});

console.log('\n=== Done ===');
