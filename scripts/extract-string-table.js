/**
 * Extract the full string table from the obfuscated code
 * 
 * The string table is built by M2OpVfE which XORs with "C|B%"
 * We need to find the base string and decode it
 */

const fs = require('fs');

console.log('=== Extracting String Table ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// Find the V2AsvL function which contains the encoded string
// The pattern is: b=u6JBF.V4a()(t([17,64,75,32,15,76])())

// First, find the t() function that transforms the array
// t([17,64,75,32,15,76]) -> adds 36 to each -> [53,100,111,68,51,112] -> "5doD3p"
// This is likely a property name

const arrayMatch = code.match(/t\(\[([0-9,\s]+)\]\)/);
if (arrayMatch) {
  const nums = arrayMatch[1].split(',').map(n => parseInt(n.trim()));
  const transformed = nums.map(n => String.fromCharCode(n + 36)).join('');
  console.log(`Array: [${nums.join(', ')}]`);
  console.log(`Transformed (+36): "${transformed}"`);
}

// The string table is built by XORing with "C|B%"
// Find the encoded string that gets XOR decoded
const xorKey = 'C|B%';

// Look for the Q variable that accumulates the decoded string
// Q+=t(s(r)^w(c)) where s and w are bound to different strings

// Find the b variable (base string)
const bMatch = code.match(/b\s*=\s*u6JBF\.V4a\(\)\(([^)]+)\)/);
if (bMatch) {
  console.log(`\nb source: ${bMatch[1]}`);
}

// The string table is accessed via N4F(index) or N0M(index)
// Let's find all the indices used and their context

console.log('\n=== Finding string table indices ===\n');

// Find all N4F/N0M calls with their context
const n4fPattern = /N[04][FM]\((\d+)\)/g;
const indices = new Map();
let match;

while ((match = n4fPattern.exec(code)) !== null) {
  const idx = parseInt(match[1]);
  const start = Math.max(0, match.index - 50);
  const end = Math.min(code.length, match.index + 50);
  const context = code.substring(start, end).replace(/\s+/g, ' ');
  
  if (!indices.has(idx)) {
    indices.set(idx, []);
  }
  indices.get(idx).push(context);
}

// Find the most important indices
const importantIndices = [90, 148, 212, 380, 419, 128, 393, 41, 171, 114];

console.log('Important string table indices:');
importantIndices.forEach(idx => {
  const contexts = indices.get(idx);
  if (contexts) {
    console.log(`\nN4F/N0M(${idx}):`);
    contexts.slice(0, 2).forEach(c => console.log(`  ${c.substring(0, 100)}`));
  }
});

// The k[] array contains some strings
// Let's extract all of them
console.log('\n=== k[] string table ===\n');

const kPattern = /k\[(\d+)\]\s*=\s*["']([^"']+)["']/g;
const kTable = {};
while ((match = kPattern.exec(code)) !== null) {
  kTable[parseInt(match[1])] = match[2];
}

// Print relevant entries
const relevantK = Object.entries(kTable).filter(([idx, val]) => 
  val.includes('location') || val.includes('path') || val.includes('href') ||
  val.includes('host') || val.includes('char') || val.includes('Code') ||
  val.includes('length') || val.includes('split') || val.includes('replace') ||
  val.includes('match') || val.includes('exec') || val.includes('slice') ||
  val.includes('sub') || val.includes('__')
);

console.log('Relevant k[] entries:');
relevantK.forEach(([idx, val]) => console.log(`  k[${idx}] = "${val}"`));

// Find the u7dV1j function which accesses the string table
console.log('\n=== u7dV1j function ===\n');

const u7dvMatch = code.match(/u7dV1j\s*=\s*function[^{]*\{[^}]+\}/);
if (u7dvMatch) {
  console.log(u7dvMatch[0]);
}

// The key derivation uses:
// t4TD2P[u7dV1j(E3)][u7dV1j(B3)] - likely window.location.pathname
// Let's find E3 and B3 values

console.log('\n=== Variable definitions ===\n');

const varPatterns = [
  /E3\s*=\s*W3\.N[04][FM]\((\d+)\)/g,
  /B3\s*=\s*W3\.N[04][FM]\((\d+)\)/g,
  /L\s*=\s*W3\.N[04][FM]\((\d+)\)/g,
  /A\s*=\s*W3\.N[04][FM]\((\d+)\)/g,
  /I3\s*=\s*W3\.N[04][FM]\((\d+)\)/g,
  /A3\s*=\s*W3\.N[04][FM]\((\d+)\)/g,
  /S3\s*=\s*W3\.N[04][FM]\((\d+)\)/g,
];

varPatterns.forEach(pattern => {
  while ((match = pattern.exec(code)) !== null) {
    const varName = pattern.source.split('\\s')[0];
    console.log(`${varName} = N4F/N0M(${match[1]})`);
  }
});

// The string table might be built from a long encoded string
// Let's find any long strings in the code
console.log('\n=== Long strings in code ===\n');

const longStrPattern = /["']([^"']{100,})["']/g;
const longStrings = [];
while ((match = longStrPattern.exec(code)) !== null) {
  if (!match[1].includes('function') && !match[1].includes('return')) {
    longStrings.push(match[1].substring(0, 100) + '...');
  }
}

console.log(`Found ${longStrings.length} long strings`);
longStrings.slice(0, 5).forEach(s => console.log(`  ${s}`));

// Try to decode the string table
console.log('\n=== Attempting string table decode ===\n');

// The string table is built by:
// 1. Getting a base string from window[something]
// 2. XORing each character with "C|B%" key
// 3. Building up Q string

// Let's try to find the base string
const windowAccessPattern = /window\s*\[\s*["']([^"']+)["']\s*\]/g;
while ((match = windowAccessPattern.exec(code)) !== null) {
  console.log(`window["${match[1]}"]`);
}

console.log('\n=== Done ===');
