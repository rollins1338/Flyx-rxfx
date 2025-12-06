/**
 * Find the crypto logic in rapidshare app.js
 */

const fs = require('fs');

const code = fs.readFileSync('rapidshare-app.js', 'utf8');

console.log('=== Finding Crypto Logic ===\n');

// The "0123456789abcdef" is used for hex encoding
// Find where it's used
const hexAlphabetIdx = code.indexOf('"0123456789abcdef"');
if (hexAlphabetIdx !== -1) {
  console.log('Hex alphabet found at index:', hexAlphabetIdx);
  console.log('Context:', code.substring(hexAlphabetIdx - 200, hexAlphabetIdx + 200));
}

// Look for MD5 or hash-related patterns (the hex alphabet is often used in MD5)
console.log('\n\n=== Looking for hash/MD5 patterns ===');
const md5Pattern = code.match(/md5|hash|digest/gi);
if (md5Pattern) {
  console.log('MD5/hash patterns:', md5Pattern.length);
}

// Look for the actual function that uses the hex alphabet
// It's likely a function that converts bytes to hex
const hexFuncMatch = code.match(/function\s*\w*\s*\([^)]*\)\s*\{[^}]*0123456789abcdef[^}]*\}/);
if (hexFuncMatch) {
  console.log('\n\nHex conversion function:');
  console.log(hexFuncMatch[0]);
}

// Look for charCodeAt and fromCharCode together (common in encryption)
console.log('\n\n=== CharCode operations ===');
const charCodeIdx = code.indexOf('charCodeAt');
if (charCodeIdx !== -1) {
  console.log('charCodeAt context:');
  console.log(code.substring(charCodeIdx - 100, charCodeIdx + 200));
}

// Look for XOR operations (^)
console.log('\n\n=== XOR operations ===');
const xorMatches = code.match(/\w+\s*\^\s*\w+/g);
if (xorMatches) {
  console.log('XOR operations found:', xorMatches.length);
  [...new Set(xorMatches)].slice(0, 10).forEach(x => console.log('  ', x));
}

// Look for the actual player setup
console.log('\n\n=== Looking for player/video setup ===');

// Search for patterns that might indicate video source setup
const videoPatterns = [
  /sources?\s*[=:]/gi,
  /file\s*[=:]/gi,
  /playlist/gi,
  /\.m3u8/gi,
  /\.mp4/gi,
  /video/gi,
  /player/gi,
  /jwplayer/gi,
];

videoPatterns.forEach(pattern => {
  const matches = code.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// The key insight: the app.js is mostly anti-devtools code
// The actual video player logic might be in a different file or loaded dynamically
console.log('\n\n=== Checking for dynamic script loading ===');
const dynamicLoad = code.match(/createElement\s*\(\s*['"]script['"]\s*\)/g);
if (dynamicLoad) {
  console.log('Dynamic script creation:', dynamicLoad.length);
}

const evalMatch = code.match(/eval\s*\(/g);
if (evalMatch) {
  console.log('eval() calls:', evalMatch.length);
}

const functionConstructor = code.match(/Function\s*\(/g);
if (functionConstructor) {
  console.log('Function() constructor:', functionConstructor.length);
}
