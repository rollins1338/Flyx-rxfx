/**
 * Step 21: Deep XOR analysis - find the actual decryption
 * 
 * Found patterns:
 * 1. Q+=t(s(r)^w(c)) with key "C%7CB%" - string table decoding
 * 2. c[5]^=c[8][c[1]%32] - 32-byte key XOR
 */

const fs = require('fs');

console.log('=== Step 21: Deep XOR Analysis ===\n');

const original = fs.readFileSync('rapidshare-app.js', 'utf8');

// Find the context around the 32-byte XOR
console.log('=== Finding 32-byte XOR context ===');
const xor32Idx = original.indexOf('%32]');
if (xor32Idx !== -1) {
  const start = Math.max(0, xor32Idx - 500);
  const end = Math.min(original.length, xor32Idx + 500);
  console.log('Context around %32]:');
  console.log(original.substring(start, end));
}

// Find all %32 patterns
console.log('\n\n=== All %32 patterns ===');
const mod32Pattern = /%32/g;
let match;
const mod32Contexts = [];
while ((match = mod32Pattern.exec(original)) !== null) {
  const start = Math.max(0, match.index - 100);
  const end = Math.min(original.length, match.index + 100);
  mod32Contexts.push(original.substring(start, end).replace(/\s+/g, ' '));
}
console.log('Found', mod32Contexts.length, 'occurrences');
mod32Contexts.forEach((ctx, i) => {
  console.log(`\n--- Context ${i + 1} ---`);
  console.log(ctx);
});

// Look for the key generation - likely involves the URL or some constant
console.log('\n\n=== Looking for key generation ===');
// The key might be derived from location.href or a constant
const keyPatterns = [
  /location\.href/g,
  /location\.pathname/g,
  /location\.host/g,
  /document\.referrer/g,
  /\.split\s*\(/g
];

keyPatterns.forEach(pattern => {
  const matches = original.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// Find the function that does the actual decryption
// Look for functions that use charCodeAt and XOR
console.log('\n\n=== Functions with charCodeAt and XOR ===');
const charCodeIdx = original.indexOf('charCodeAt');
if (charCodeIdx !== -1) {
  // Find the enclosing function
  let depth = 0;
  let funcStart = charCodeIdx;
  for (let i = charCodeIdx; i >= 0; i--) {
    if (original[i] === '}') depth++;
    if (original[i] === '{') {
      depth--;
      if (depth < 0) {
        // Find function keyword before this
        const before = original.substring(Math.max(0, i - 100), i);
        const funcMatch = before.match(/function\s*\w*\s*\([^)]*\)\s*$/);
        if (funcMatch) {
          funcStart = i - 100 + funcMatch.index;
          break;
        }
      }
    }
  }
  
  // Get the full function
  const funcEnd = Math.min(original.length, charCodeIdx + 500);
  console.log('Function containing charCodeAt:');
  console.log(original.substring(funcStart, funcEnd));
}

// Look for the R3 variable which seems to hold location info
console.log('\n\n=== R3 variable (location) ===');
const r3Pattern = /R3\s*[=\[]/g;
const r3Matches = original.match(r3Pattern);
if (r3Matches) {
  console.log('R3 references:', r3Matches.length);
  
  // Find R3 definition
  const r3DefIdx = original.indexOf('R3=');
  if (r3DefIdx !== -1) {
    const start = Math.max(0, r3DefIdx - 50);
    const end = Math.min(original.length, r3DefIdx + 200);
    console.log('R3 definition context:');
    console.log(original.substring(start, end));
  }
}

// Look for the actual PAGE_DATA usage in the decoded strings
console.log('\n\n=== Searching in decoded string table ===');
const v2asvl = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');
const xorKey = "C|B%";
let decoded = '';
for (let i = 0; i < v2asvl.length; i++) {
  decoded += String.fromCharCode(v2asvl.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
}

// Search for PAGE_DATA related strings
const searchTerms = ['PAGE', 'DATA', '__', 'source', 'file', 'setup', 'jw', 'player', 'm3u8', 'hls'];
searchTerms.forEach(term => {
  if (decoded.toLowerCase().includes(term.toLowerCase())) {
    const idx = decoded.toLowerCase().indexOf(term.toLowerCase());
    const context = decoded.substring(Math.max(0, idx - 20), Math.min(decoded.length, idx + 50));
    console.log(`Found "${term}" at ${idx}: "${context.replace(/[\x00-\x1f]/g, '.')}"`);
  }
});
