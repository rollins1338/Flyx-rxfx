/**
 * Find the i3() function that returns the 32-byte decryption key
 */

const fs = require('fs');

console.log('=== Finding i3() function ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// Find i3 function definition
const i3Pattern = /function\s+i3\s*\([^)]*\)\s*\{/g;
let match;
while ((match = i3Pattern.exec(code)) !== null) {
  const start = match.index;
  // Find the end of the function
  let braceCount = 0;
  let end = start;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    if (code[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        end = i + 1;
        break;
      }
    }
  }
  
  console.log('i3 function:');
  console.log(code.substring(start, end).substring(0, 2000));
  console.log('\n');
}

// Also look for i3 = function pattern
const i3AssignPattern = /i3\s*=\s*function\s*\([^)]*\)\s*\{/g;
while ((match = i3AssignPattern.exec(code)) !== null) {
  const start = match.index;
  let braceCount = 0;
  let end = start;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    if (code[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        end = i + 1;
        break;
      }
    }
  }
  
  console.log('i3 assignment:');
  console.log(code.substring(start, end).substring(0, 2000));
  console.log('\n');
}

// Look for where i3 is called
console.log('=== i3() calls ===\n');
const i3CallPattern = /i3\s*\(\s*\)/g;
const calls = [];
while ((match = i3CallPattern.exec(code)) !== null) {
  const start = Math.max(0, match.index - 100);
  const end = Math.min(code.length, match.index + 100);
  calls.push(code.substring(start, end));
}
console.log(`Found ${calls.length} i3() calls`);
calls.slice(0, 5).forEach((c, i) => {
  console.log(`\nCall ${i + 1}:`);
  console.log(c);
});

// Look for the key derivation
// The key might be derived from location.pathname or similar
console.log('\n=== Looking for key derivation ===\n');

// Find where location is used
const locationPatterns = [
  /location\s*\.\s*pathname/g,
  /location\s*\.\s*href/g,
  /location\s*\.\s*host/g,
  /location\s*\.\s*search/g,
];

locationPatterns.forEach(pattern => {
  const matches = code.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// Look for the W3.N4F/N0M calls that might return key-related strings
console.log('\n=== Key-related N4F/N0M indices ===\n');

// Find indices used near i3
const i3Idx = code.indexOf('i3()');
if (i3Idx !== -1) {
  const context = code.substring(Math.max(0, i3Idx - 500), i3Idx + 500);
  const n4fMatches = context.match(/N[04][FM]\((\d+)\)/g);
  if (n4fMatches) {
    console.log('N4F/N0M indices near i3():');
    [...new Set(n4fMatches)].forEach(m => console.log(`  ${m}`));
  }
}

// Look for the actual key generation
// It might involve MD5 or some transformation
console.log('\n=== Looking for MD5/hash usage ===\n');

// Find ce() calls (MD5 function)
const cePattern = /ce\s*\([^)]+\)/g;
const ceCalls = code.match(cePattern);
if (ceCalls) {
  console.log(`Found ${ceCalls.length} ce() calls (MD5)`);
  ceCalls.slice(0, 10).forEach(c => console.log(`  ${c}`));
}

// Look for the string table entries that might be used for key
console.log('\n=== String table entries ===\n');

// The string table is built by M2OpVfE
// Let's find what strings are in it

// Find the encoded string
const encodedMatch = code.match(/\("C%7CB%"\)/);
if (encodedMatch) {
  console.log('Found XOR key: C|B%');
  
  // Find the string that gets XOR decoded
  const contextStart = code.indexOf('M2OpVfE');
  const contextEnd = code.indexOf('return N', contextStart);
  const context = code.substring(contextStart, contextEnd);
  
  // Look for the b variable which holds the encoded string
  const bMatch = context.match(/b\s*=\s*u6JBF\.V4a\(\)\(([^)]+)\)/);
  if (bMatch) {
    console.log('Encoded string source:', bMatch[1]);
  }
}

// Try to find the actual key by looking at the runtime behavior
console.log('\n=== Analyzing runtime key generation ===\n');

// The key might be derived from:
// 1. The embed ID in the URL
// 2. A constant in the code
// 3. The domain name
// 4. A combination of the above

// Look for split operations that might extract the embed ID
const splitPattern = /\.split\s*\([^)]+\)/g;
const splits = code.match(splitPattern);
if (splits) {
  console.log(`Found ${splits.length} split operations`);
  [...new Set(splits)].slice(0, 10).forEach(s => console.log(`  ${s}`));
}

// Look for the /e/ path pattern
const ePathPattern = /\/e\//g;
const ePaths = code.match(ePathPattern);
if (ePaths) {
  console.log(`\nFound ${ePaths.length} /e/ path references`);
}

console.log('\n=== Done ===');
