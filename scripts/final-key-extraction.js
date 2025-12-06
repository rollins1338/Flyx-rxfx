/**
 * Final key extraction attempt
 * 
 * Key findings:
 * - f() returns t4TD2P[u7dV1j(E3)][u7dV1j(B3)] with regex replacement
 * - M() returns r(t4TD2P[u7dV1j(E3)][u7dV1j(B3)])[I3](16) - likely toString(16)
 * - The key is derived from location.pathname
 * - J() splits a string and gets charCodes
 * 
 * The regex in f(): /[^\u0041-\x44\u0045-\u0047\110-\x50\121-\126\x57-\u005a\x30-\x34\x35-\x39]/g
 * This matches: A-D, E-G, H-P, Q-V, W-Z, 0-4, 5-9
 * So it keeps only: A-Z and 0-9 (alphanumeric uppercase)
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Final Key Extraction ===\n');

// The embed URL is: /e/2MvvbnGoWS2JcOLzFLpK7RXpCQ
const embedPath = '/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';

// The regex keeps only A-Z and 0-9
const cleanPath = embedPath.replace(/[^A-Z0-9]/gi, '').toUpperCase();
console.log(`Clean path (alphanumeric): ${cleanPath}`);

// f() returns this with [S3](-30) which is likely slice(-30)
const sliced = cleanPath.slice(-30);
console.log(`Sliced (-30): ${sliced}`);

// M() returns r(pathname)[I3](16) - likely parseInt(pathname, 16) or toString(16)
// But pathname is a string, so it might be getting the hash

// Let's try different interpretations
console.log('\n=== Trying different key derivations ===\n');

// URL-safe base64 decode
function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// XOR decrypt
function xorDecrypt(data, key) {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

// Check if result looks valid
function isValid(buffer) {
  const str = buffer.toString('utf8');
  if (str.includes('http://') || str.includes('https://')) return { valid: true, reason: 'URL' };
  if (str.includes('.m3u8')) return { valid: true, reason: 'm3u8' };
  if (str.includes('.mp4')) return { valid: true, reason: 'mp4' };
  if (str.startsWith('{') || str.startsWith('[')) return { valid: true, reason: 'JSON' };
  
  let printable = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] >= 32 && buffer[i] <= 126) printable++;
  }
  if (printable / buffer.length > 0.9) return { valid: true, reason: 'printable' };
  
  return { valid: false };
}

const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);

console.log(`PAGE_DATA decoded: ${decoded.length} bytes`);
console.log(`Hex: ${decoded.toString('hex')}`);

// The key is 32 bytes, derived from the embed ID
// J() function: splits string and gets charCodes
// So the key might be the charCodes of the embed ID

// Try 1: Direct charCodes of embed ID
const key1 = Buffer.from(embedId.split('').map(c => c.charCodeAt(0)));
console.log(`\nKey 1 (charCodes of embedId): ${key1.toString('hex')}`);
let result = xorDecrypt(decoded, key1);
console.log(`Result: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
console.log(`Valid: ${JSON.stringify(isValid(result))}`);

// Try 2: CharCodes of clean path
const key2 = Buffer.from(cleanPath.split('').map(c => c.charCodeAt(0)));
console.log(`\nKey 2 (charCodes of cleanPath): ${key2.toString('hex')}`);
result = xorDecrypt(decoded, key2);
console.log(`Result: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
console.log(`Valid: ${JSON.stringify(isValid(result))}`);

// Try 3: CharCodes of sliced path
const key3 = Buffer.from(sliced.split('').map(c => c.charCodeAt(0)));
console.log(`\nKey 3 (charCodes of sliced): ${key3.toString('hex')}`);
result = xorDecrypt(decoded, key3);
console.log(`Result: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
console.log(`Valid: ${JSON.stringify(isValid(result))}`);

// Try 4: MD5 of embed ID
const key4 = crypto.createHash('md5').update(embedId).digest();
console.log(`\nKey 4 (MD5 of embedId): ${key4.toString('hex')}`);
result = xorDecrypt(decoded, key4);
console.log(`Result: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
console.log(`Valid: ${JSON.stringify(isValid(result))}`);

// Try 5: The embed ID might be base64 encoded, decode it first
try {
  const decodedId = urlSafeBase64Decode(embedId);
  console.log(`\nDecoded embed ID: ${decodedId.toString('hex')}`);
  
  // Use decoded ID as key
  result = xorDecrypt(decoded, decodedId);
  console.log(`Key 5 (decoded embedId): ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
  console.log(`Valid: ${JSON.stringify(isValid(result))}`);
  
  // MD5 of decoded ID
  const key6 = crypto.createHash('md5').update(decodedId).digest();
  result = xorDecrypt(decoded, key6);
  console.log(`\nKey 6 (MD5 of decoded embedId): ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
  console.log(`Valid: ${JSON.stringify(isValid(result))}`);
} catch (e) {
  console.log(`Embed ID decode error: ${e.message}`);
}

// Try 7: The key might be built character by character with XOR
// From i3(): r[9][r[6]]=r[7][j3](r[6]%r[7][W3.N4F(380)])
// This XORs each position with a character from r[7] (which is f())

// The key building loop:
// r[9][r[6]]=r[3][j3](r[6]%r[3][W3.N0M(380)])
// This sets key[i] = someString.charCodeAt(i % someString.length)

// Let's try building the key from the embed ID
console.log('\n=== Building key from embed ID ===\n');

// The key is 32 bytes
const keyLen = 32;

// Build key by repeating embed ID charCodes
const key7 = Buffer.alloc(keyLen);
for (let i = 0; i < keyLen; i++) {
  key7[i] = embedId.charCodeAt(i % embedId.length);
}
console.log(`Key 7 (repeated embedId charCodes): ${key7.toString('hex')}`);
result = xorDecrypt(decoded, key7);
console.log(`Result: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
console.log(`Valid: ${JSON.stringify(isValid(result))}`);

// Try 8: The key might involve the clean path
const key8 = Buffer.alloc(keyLen);
for (let i = 0; i < keyLen; i++) {
  key8[i] = cleanPath.charCodeAt(i % cleanPath.length);
}
console.log(`\nKey 8 (repeated cleanPath charCodes): ${key8.toString('hex')}`);
result = xorDecrypt(decoded, key8);
console.log(`Result: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
console.log(`Valid: ${JSON.stringify(isValid(result))}`);

// Try 9: The key might be XORed with something else
// From i3(): r[9][r[6]]=r[9][r[6]+2]
// This suggests some shifting/rearranging

// Try 10: Look at the actual bytes and try to find patterns
console.log('\n=== Byte pattern analysis ===\n');

// The first 19 bytes are the same between samples
// This might be a header or IV
const header = decoded.slice(0, 19);
const encData = decoded.slice(19);

console.log(`Header (19 bytes): ${header.toString('hex')}`);
console.log(`Encrypted data (37 bytes): ${encData.toString('hex')}`);

// Try XORing encrypted data with embed ID
const key9 = Buffer.alloc(encData.length);
for (let i = 0; i < encData.length; i++) {
  key9[i] = embedId.charCodeAt(i % embedId.length);
}
result = xorDecrypt(encData, key9);
console.log(`\nEncrypted data XOR embedId: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);
console.log(`Valid: ${JSON.stringify(isValid(result))}`);

// The header might contain the key or key derivation info
// Let's try using header bytes as part of the key
const key10 = Buffer.concat([header, Buffer.alloc(32 - header.length, 0)]).slice(0, 32);
result = xorDecrypt(decoded, key10);
console.log(`\nFull data XOR header-padded: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try MD5 of header
const key11 = crypto.createHash('md5').update(header).digest();
result = xorDecrypt(encData, key11);
console.log(`\nEncrypted data XOR MD5(header): ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

console.log('\n=== Done ===');
