/**
 * Step 17: Analyze __PAGE_DATA decryption
 * 
 * The video source is encrypted in window.__PAGE_DATA
 * The app.js decrypts it to get the actual video URL
 */

const fs = require('fs');

console.log('=== Step 17: PAGE_DATA Analysis ===\n');

// Sample PAGE_DATA from the embed
const pageData = "3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4";

console.log('PAGE_DATA:', pageData);
console.log('Length:', pageData.length);

// Check if it's base64
console.log('\n=== Base64 Analysis ===');
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const urlSafeBase64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=';

const isBase64 = [...pageData].every(c => base64Chars.includes(c));
const isUrlSafeBase64 = [...pageData].every(c => urlSafeBase64Chars.includes(c));

console.log('Is standard base64:', isBase64);
console.log('Is URL-safe base64:', isUrlSafeBase64);

// Try to decode as URL-safe base64
if (isUrlSafeBase64) {
  try {
    // Convert URL-safe to standard base64
    const standardBase64 = pageData.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = standardBase64 + '='.repeat((4 - standardBase64.length % 4) % 4);
    const decoded = Buffer.from(padded, 'base64');
    console.log('\nDecoded as base64:');
    console.log('  Hex:', decoded.toString('hex').substring(0, 100));
    console.log('  ASCII:', decoded.toString('ascii').substring(0, 100).replace(/[\x00-\x1f]/g, '.'));
    
    // The decoded data might be encrypted
    // Let's look at the byte distribution
    const bytes = [...decoded];
    console.log('\n  First 20 bytes:', bytes.slice(0, 20).join(', '));
    console.log('  Byte range:', Math.min(...bytes), '-', Math.max(...bytes));
  } catch (e) {
    console.log('Base64 decode error:', e.message);
  }
}

// Look for the decryption function in the original code
console.log('\n\n=== Looking for PAGE_DATA usage ===');
const original = fs.readFileSync('rapidshare-app.js', 'utf8');

// Search for __PAGE_DATA or PAGE_DATA
const pageDataRefs = original.match(/__PAGE_DATA|PAGE_DATA/g);
console.log('PAGE_DATA references:', pageDataRefs ? pageDataRefs.length : 0);

// Look for window references
const windowRefs = original.match(/window\s*\[/g);
console.log('window[] references:', windowRefs ? windowRefs.length : 0);

// The decryption might use:
// 1. AES/DES encryption
// 2. XOR with a key
// 3. Custom algorithm

// Look for crypto-related patterns
console.log('\n=== Crypto Patterns ===');
const cryptoPatterns = [
  /CryptoJS/g,
  /AES/g,
  /DES/g,
  /RC4/g,
  /MD5/g,
  /SHA/g,
  /PBKDF/g,
  /iv\s*:/g,
  /key\s*:/g,
  /mode\s*:/g,
  /padding\s*:/g
];

cryptoPatterns.forEach(pattern => {
  const matches = original.match(pattern);
  if (matches) {
    console.log(`${pattern.source}: ${matches.length} matches`);
  }
});

// The k[] string table might contain the decryption key
// Let's look for strings that could be keys
console.log('\n\n=== Potential Key Strings ===');
const kAssignments = {};
const kPattern = /k\[(\d+)\]\s*=\s*["']([^"']*)["']/g;
let match;
while ((match = kPattern.exec(original)) !== null) {
  kAssignments[parseInt(match[1])] = match[2];
}

// Look for strings that look like keys (alphanumeric, specific lengths)
Object.entries(kAssignments).forEach(([idx, value]) => {
  if (value.length >= 8 && value.length <= 32 && /^[a-zA-Z0-9]+$/.test(value)) {
    console.log(`  k[${idx}] = "${value}" (len: ${value.length})`);
  }
});

// Try XOR decryption with common keys
console.log('\n\n=== XOR Decryption Attempts ===');
const decoded = Buffer.from(pageData.replace(/-/g, '+').replace(/_/g, '/') + '==', 'base64');

// Try single-byte XOR
for (let key = 0; key < 256; key++) {
  const xored = Buffer.from(decoded.map(b => b ^ key));
  const str = xored.toString('ascii');
  // Check if result looks like a URL or JSON
  if (str.includes('http') || str.includes('{') || str.includes('file')) {
    console.log(`XOR key 0x${key.toString(16)}: ${str.substring(0, 100)}`);
  }
}

// Try multi-byte XOR with potential keys
const potentialKeys = ['rapidshare', 'player', 'video', 'stream', 'secret'];
potentialKeys.forEach(key => {
  const xored = Buffer.from(decoded.map((b, i) => b ^ key.charCodeAt(i % key.length)));
  const str = xored.toString('ascii');
  if (str.includes('http') || str.includes('{') || str.includes('file')) {
    console.log(`XOR key "${key}": ${str.substring(0, 100)}`);
  }
});
