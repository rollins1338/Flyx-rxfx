/**
 * Find the actual key source in the obfuscated code
 * 
 * The key is built by i3() which uses:
 * - J(u7dV1j(W3.N0M(212))) - initializes from string table entry 212
 * - f() - gets cleaned pathname
 * - M() - gets something.toString(16)
 * - A regex match
 */

const fs = require('fs');

console.log('=== Finding Key Source ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// The key is initialized from string table entry 212
// J(u7dV1j(W3.N0M(212))) splits a string and gets charCodes

// Find the J function
console.log('=== J function ===\n');
const jFuncPattern = /function J\(a\)\{W3\.z3U\(\);[^}]+\}/;
const jMatch = code.match(jFuncPattern);
if (jMatch) {
  console.log(jMatch[0]);
}

// J splits the input string by empty string and gets charCode of each char
// So J("abc") would return [97, 98, 99]

// The string table entry 212 is the initial key
// We need to find what string is at index 212

// The string table is built dynamically by M2OpVfE
// It XORs with "C|B%" key

// Let's find the base string that gets XOR decoded
console.log('\n=== Finding base string ===\n');

// The base string is accessed via u7dV1j which uses the string table
// The string table is built from a long encoded string

// Look for the encoded string
const encodedPattern = /b\s*=\s*u6JBF\.V4a\(\)\(([^)]+)\)/;
const encodedMatch = code.match(encodedPattern);
if (encodedMatch) {
  console.log(`Base string source: ${encodedMatch[1]}`);
}

// The t() function transforms an array by adding 36 to each element
// t([17,64,75,32,15,76]) -> [53,100,111,68,51,112] -> "5doD3p"

// This is likely a property name on window or some object
// Let's find what "5doD3p" refers to

console.log('\n=== Looking for 5doD3p ===\n');
const propMatch = code.match(/5doD3p/);
if (propMatch) {
  console.log('Found 5doD3p in code');
  const start = Math.max(0, propMatch.index - 100);
  const end = Math.min(code.length, propMatch.index + 100);
  console.log(code.substring(start, end));
}

// The string table might be stored in a global variable
// Let's look for where it's assigned

console.log('\n=== Looking for string table storage ===\n');

// The Q variable accumulates the decoded string
const qPattern = /Q\s*=\s*["']([^"']+)["']/g;
let match;
while ((match = qPattern.exec(code)) !== null) {
  if (match[1].length > 10) {
    console.log(`Q = "${match[1].substring(0, 50)}..."`);
  }
}

// The string table might be in the k[] array
// Let's count how many entries there are
const kEntries = code.match(/k\[\d+\]/g);
if (kEntries) {
  const indices = kEntries.map(k => parseInt(k.match(/\d+/)[0]));
  const maxIdx = Math.max(...indices);
  console.log(`\nk[] array has entries up to index ${maxIdx}`);
}

// The key derivation might use window.__PAGE_DATA directly
// Let's look for where it's accessed

console.log('\n=== Looking for __PAGE_DATA access ===\n');

// The code might access window["__PAGE_DATA"] using obfuscated property names
// Look for patterns like window[variable]

const windowAccessPattern = /window\s*\[\s*(\w+)\s*\]/g;
const windowAccesses = [];
while ((match = windowAccessPattern.exec(code)) !== null) {
  windowAccesses.push(match[1]);
}
console.log('Window access variables:', [...new Set(windowAccesses)].join(', '));

// These variables are likely from the string table
// Let's find their definitions

const varDefs = {};
windowAccesses.forEach(varName => {
  const defPattern = new RegExp(`${varName}\\s*=\\s*W3\\.N[04][FM]\\((\\d+)\\)`);
  const defMatch = code.match(defPattern);
  if (defMatch) {
    varDefs[varName] = defMatch[1];
  }
});

console.log('\nVariable definitions:');
Object.entries(varDefs).forEach(([name, idx]) => {
  console.log(`  ${name} = N4F/N0M(${idx})`);
});

// The key might be derived from the PAGE_DATA itself
// Let's look for where PAGE_DATA is used in calculations

console.log('\n=== Looking for PAGE_DATA usage ===\n');

// The decryption function T(a) takes input and decrypts it
// The input is likely the PAGE_DATA

// Find where T is called
const tCallPattern = /T\s*\(\s*([^)]+)\s*\)/g;
const tCalls = [];
while ((match = tCallPattern.exec(code)) !== null) {
  tCalls.push(match[1]);
}
console.log('T() calls:', tCalls.slice(0, 10).join(', '));

// The key might be derived from the embed ID in the URL
// Let's look for URL parsing

console.log('\n=== Looking for URL parsing ===\n');

const urlPatterns = [
  /location\.pathname/g,
  /location\.href/g,
  /location\.search/g,
  /\.split\s*\(\s*["']\/["']\s*\)/g,
  /\.match\s*\(\s*\/[^/]+\/\s*\)/g,
];

urlPatterns.forEach(pattern => {
  const matches = code.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// The key derivation might involve the app.js path hash
// 2457433dff868594ecbf3b15e9f22a46efd70a

console.log('\n=== Looking for app.js hash ===\n');

const appHash = '2457433dff868594ecbf3b15e9f22a46efd70a';
const hashMatch = code.match(new RegExp(appHash.substring(0, 10)));
if (hashMatch) {
  console.log('Found app.js hash in code');
}

// The key might be hardcoded somewhere
// Let's look for 32-byte hex strings

console.log('\n=== Looking for hardcoded keys ===\n');

const hexPattern = /["']([0-9a-f]{32,64})["']/gi;
const hexMatches = code.match(hexPattern);
if (hexMatches) {
  console.log('Potential hardcoded keys:');
  [...new Set(hexMatches)].slice(0, 10).forEach(h => console.log(`  ${h}`));
}

console.log('\n=== Done ===');
