/**
 * Crack rapidshare PAGE_DATA - Version 2
 * 
 * Key insight: First 19 bytes are identical between samples
 * This suggests: [19-byte header][37-byte encrypted data]
 * 
 * The encrypted part differs, so the key might be derived from:
 * - The embed ID (different per video)
 * - A timestamp
 * - Something in the URL
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Cracking rapidshare PAGE_DATA v2 ===\n');

// URL-safe base64 decode
function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// MD5 hash
function md5(str) {
  return crypto.createHash('md5').update(str).digest();
}

function md5Hex(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// XOR decrypt
function xorDecrypt(data, key) {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

// Sample data
const pageData = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';
const decoded = urlSafeBase64Decode(pageData);

console.log('Decoded PAGE_DATA:');
console.log(`  Length: ${decoded.length} bytes`);
console.log(`  Hex: ${decoded.toString('hex')}`);
console.log('');

// Split into header and data
const header = decoded.slice(0, 19);
const encData = decoded.slice(19);

console.log('Header (19 bytes):');
console.log(`  Hex: ${header.toString('hex')}`);
console.log('');

console.log('Encrypted data (37 bytes):');
console.log(`  Hex: ${encData.toString('hex')}`);
console.log('');

// The header might contain:
// - A version byte
// - A timestamp
// - An IV
// - A key identifier

// Let's analyze the header structure
console.log('=== Header Analysis ===\n');

// First byte might be version
console.log(`First byte (version?): 0x${header[0].toString(16)} = ${header[0]}`);

// Bytes 1-4 might be timestamp (big-endian uint32)
const ts1 = header.readUInt32BE(1);
const ts2 = header.readUInt32LE(1);
console.log(`Bytes 1-4 as BE uint32: ${ts1} (${new Date(ts1 * 1000).toISOString()})`);
console.log(`Bytes 1-4 as LE uint32: ${ts2} (${new Date(ts2 * 1000).toISOString()})`);

// Try different interpretations
console.log('\n=== Trying different key derivations ===\n');

// The key might be derived from the header
const keyFromHeader = md5(header);
let result = xorDecrypt(encData, keyFromHeader);
console.log(`md5(header) XOR: ${result.toString('hex')}`);
console.log(`  As string: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try using header bytes directly as key
result = xorDecrypt(encData, header);
console.log(`\nheader XOR: ${result.toString('hex')}`);
console.log(`  As string: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try using first 16 bytes of header as key
result = xorDecrypt(encData, header.slice(0, 16));
console.log(`\nheader[0:16] XOR: ${result.toString('hex')}`);
console.log(`  As string: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// The obfuscated code uses a 32-byte key with %32
// Let's try to find what that key might be

// Look at the string table in the obfuscated code
console.log('\n=== Analyzing string table ===\n');

const code = fs.readFileSync('rapidshare-app.js', 'utf8');

// Find the V2AsvL function and its encoded string
const v2asvlMatch = code.match(/V2AsvL\s*=\s*function[^{]*\{([^}]+)\}/);
if (v2asvlMatch) {
  console.log('V2AsvL function found');
}

// The string table is built using XOR with "C|B%"
// Let's decode it
const xorKey = 'C|B%';

// Find the encoded string in the code
// It's passed to M2OpVfE which decodes it
const encodedMatch = code.match(/M2OpVfE[^"]*"([^"]+)"/);
if (encodedMatch) {
  console.log(`Encoded string: ${encodedMatch[1]}`);
  
  // Decode it
  const encoded = decodeURIComponent(encodedMatch[1]);
  console.log(`URL decoded: ${encoded}`);
  
  // XOR with key
  let decoded = '';
  for (let i = 0; i < encoded.length; i++) {
    decoded += String.fromCharCode(encoded.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
  }
  console.log(`XOR decoded: ${decoded}`);
}

// Look for the actual decryption function
console.log('\n=== Finding decryption function ===\n');

// The pattern c[5]^=c[1][c[9]%32] suggests:
// c[1] is the 32-byte key
// c[9] is the index
// c[5] is the current byte being decrypted
// c[8] collects the result

// Find where c[1] is set
const c1SetMatch = code.match(/c\[1\]\s*=\s*([^;,]+)/g);
if (c1SetMatch) {
  console.log('c[1] assignments:');
  c1SetMatch.slice(0, 5).forEach(m => console.log(`  ${m}`));
}

// Look for the function that initializes the decryption
const initMatch = code.match(/function\s+T\s*\([^)]*\)\s*\{[^}]{0,500}/);
if (initMatch) {
  console.log('\nFunction T (decryption init):');
  console.log(initMatch[0].substring(0, 300));
}

// Try to find where the key comes from
// It might be from location.host or a constant
console.log('\n=== Looking for key source ===\n');

// Find location.host usage
const hostMatch = code.match(/location\.host[^;]*/g);
if (hostMatch) {
  console.log('location.host usage:');
  hostMatch.forEach(m => console.log(`  ${m}`));
}

// Find MD5 usage (function ce in the code)
const md5Usage = code.match(/ce\s*\([^)]+\)/g);
if (md5Usage) {
  console.log('\nMD5 (ce) usage:');
  md5Usage.slice(0, 5).forEach(m => console.log(`  ${m}`));
}

// Try brute force with common patterns
console.log('\n=== Brute force attempts ===\n');

// The key might be a constant string from the code
const possibleKeys = [
  'rapidshare',
  'rapidairmax',
  'jwplayer',
  'player',
  'video',
  'stream',
  'embed',
  'secret',
  'key',
  '2457433dff948487f3bb6d58f9db2a11', // from app.js path
  '19a76d77646', // version from app.js
];

for (const keyStr of possibleKeys) {
  // Try direct XOR
  let key = Buffer.from(keyStr);
  let result = xorDecrypt(encData, key);
  let str = result.toString('utf8');
  if (str.includes('http') || str.includes('.m3u8') || /^[\x20-\x7e]+$/.test(str)) {
    console.log(`Direct XOR with "${keyStr}": ${str.substring(0, 50)}`);
  }
  
  // Try MD5 of key
  key = md5(keyStr);
  result = xorDecrypt(encData, key);
  str = result.toString('utf8');
  if (str.includes('http') || str.includes('.m3u8') || /^[\x20-\x7e]+$/.test(str)) {
    console.log(`MD5 XOR with "${keyStr}": ${str.substring(0, 50)}`);
  }
}

// Try XOR with the full decoded data using different key lengths
console.log('\n=== Key length analysis ===\n');

for (let keyLen = 1; keyLen <= 32; keyLen++) {
  // Extract potential key from repeating pattern
  const key = decoded.slice(0, keyLen);
  const result = xorDecrypt(decoded.slice(keyLen), key);
  const str = result.toString('utf8');
  
  // Check if result looks valid
  let printable = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] >= 32 && result[i] <= 126) printable++;
  }
  
  if (printable / result.length > 0.8) {
    console.log(`Key length ${keyLen}: ${(printable / result.length * 100).toFixed(1)}% printable`);
    console.log(`  Result: ${str.substring(0, 60)}`);
  }
}

// The data might be structured differently
// Let's try to find the actual m3u8 URL format
console.log('\n=== Expected output format ===\n');

// The output should be something like:
// https://domain.com/path/to/video.m3u8
// or a JSON object with the URL

// Let's try to find patterns that would produce valid URLs
// A valid URL starts with "http" which is 0x68 0x74 0x74 0x70

const httpBytes = Buffer.from('http');
console.log('Looking for XOR key that produces "http" at start...');

// For each position in encData, find what key byte would produce 'h'
for (let pos = 0; pos < Math.min(encData.length, 10); pos++) {
  const keyByte = encData[pos] ^ httpBytes[0]; // XOR with 'h'
  console.log(`Position ${pos}: key byte 0x${keyByte.toString(16)} would produce 'h'`);
  
  // Check if this key byte pattern continues
  let matches = 0;
  for (let i = 0; i < 4 && pos + i < encData.length; i++) {
    if ((encData[pos + i] ^ keyByte) === httpBytes[i]) matches++;
  }
  if (matches >= 3) {
    console.log(`  -> ${matches}/4 matches for "http"!`);
  }
}

console.log('\n=== Done ===');
