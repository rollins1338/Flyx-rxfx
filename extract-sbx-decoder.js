// Extract the SBX decoder from playerjs
const fs = require('fs');

// Read the playerjs file
const playerjs = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('Playerjs file length:', playerjs.length);
console.log('\n=== Searching for SBX-related patterns ===\n');

// Look for common decryption patterns
const patterns = [
  /\.sbx\s*[=:]\s*function/gi,
  /function\s+sbx\s*\(/gi,
  /sbx\s*:\s*function/gi,
  /"sbx"/gi,
  /'sbx'/gi,
  /\bsbx\b/gi
];

patterns.forEach((pattern, i) => {
  const matches = playerjs.match(pattern);
  if (matches) {
    console.log(`Pattern ${i + 1} (${pattern}):`, matches.length, 'matches');
    matches.slice(0, 5).forEach(m => console.log('  -', m));
  }
});

// Look for the eval wrapper pattern
console.log('\n=== Looking for eval wrapper ===\n');
const evalMatch = playerjs.match(/eval\(function\(p,a,c,k,e,d\)/);
if (evalMatch) {
  console.log('Found eval wrapper - this is packed JavaScript');
  console.log('Need to unpack it first');
}

// Try to find hex/base64 decode patterns
console.log('\n=== Looking for decode patterns ===\n');
const decodePatterns = [
  /parseInt\([^,]+,\s*16\)/gi,  // hex decode
  /fromCharCode/gi,              // char code conversion
  /atob\(/gi,                    // base64 decode
  /btoa\(/gi,                    // base64 encode
  /charCodeAt/gi,                // get char code
  /String\.fromCharCode/gi       // string from char code
];

decodePatterns.forEach((pattern, i) => {
  const matches = playerjs.match(pattern);
  if (matches) {
    console.log(`Decode pattern ${i + 1}:`, matches.length, 'matches');
  }
});
