/**
 * Quick analysis of rapidshare app.js
 */

const fs = require('fs');

const code = fs.readFileSync('rapidshare-app.js', 'utf8');

console.log('=== Quick Analysis ===\n');

// Find all string literals
const strings = code.match(/"[^"]{3,50}"/g) || [];
const uniqueStrings = [...new Set(strings)];
console.log('Unique string literals (3-50 chars):', uniqueStrings.length);
uniqueStrings.slice(0, 30).forEach(s => console.log('  ', s));

// Look for base64 patterns
const base64 = code.match(/[A-Za-z0-9+/=]{40,}/g) || [];
console.log('\n\nBase64-like strings:', base64.length);
base64.slice(0, 5).forEach(s => console.log('  ', s.substring(0, 60)));

// Look for hex strings
const hex = code.match(/0x[0-9a-fA-F]+/g) || [];
console.log('\n\nHex values:', hex.length);
[...new Set(hex)].slice(0, 20).forEach(h => console.log('  ', h));

// Look for the decryption key pattern
// Often keys are 16, 24, or 32 bytes (128, 192, 256 bit)
const potentialKeys = code.match(/"[A-Za-z0-9]{16}"|"[A-Za-z0-9]{24}"|"[A-Za-z0-9]{32}"/g) || [];
console.log('\n\nPotential encryption keys:');
[...new Set(potentialKeys)].forEach(k => console.log('  ', k));

// Look for common crypto function names
const cryptoNames = ['encrypt', 'decrypt', 'cipher', 'aes', 'des', 'rc4', 'xor', 'key', 'iv'];
console.log('\n\nCrypto-related patterns:');
cryptoNames.forEach(name => {
  const regex = new RegExp(name, 'gi');
  const matches = code.match(regex);
  if (matches) {
    console.log(`  ${name}: ${matches.length} occurrences`);
  }
});

// Check the decoded strings file
console.log('\n\n=== Decoded Strings Analysis ===\n');
const decoded = fs.readFileSync('rapidshare-decoded-strings.txt', 'utf8');

// Look for any recognizable words
const words = decoded.match(/[a-zA-Z]{4,}/g) || [];
const uniqueWords = [...new Set(words)].filter(w => w.length > 4);
console.log('Recognizable words:', uniqueWords.length);
uniqueWords.slice(0, 50).forEach(w => console.log('  ', w));
