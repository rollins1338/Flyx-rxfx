/**
 * Step 20: Find the actual PAGE_DATA decryption algorithm
 * 
 * We need to find where __PAGE_DATA is read and decrypted
 */

const fs = require('fs');

console.log('=== Step 20: Finding PAGE_DATA Decryption ===\n');

const original = fs.readFileSync('rapidshare-app.js', 'utf8');

// Search for patterns that might access PAGE_DATA
console.log('=== Searching for PAGE_DATA access patterns ===');

// Look for window access patterns
const windowPatterns = [
  /window\s*\[\s*["'][^"']+["']\s*\]/g,
  /window\s*\.\s*__/g,
  /__PAGE_DATA/g,
  /PAGE_DATA/g
];

windowPatterns.forEach(pattern => {
  const matches = original.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
    [...new Set(matches)].slice(0, 5).forEach(m => console.log('  ', m));
  }
});

// Look for base64 decoding patterns
console.log('\n=== Base64/Decoding Patterns ===');
const decodePatterns = [
  /atob\s*\(/g,
  /btoa\s*\(/g,
  /Buffer/g,
  /base64/gi,
  /fromCharCode/g,
  /charCodeAt/g
];

decodePatterns.forEach(pattern => {
  const matches = original.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// Look for the k[] string table entries that might be "PAGE_DATA" or similar
console.log('\n=== Looking for relevant k[] entries ===');
const kPattern = /k\[(\d+)\]\s*=\s*["']([^"']+)["']/g;
let match;
const relevantK = [];
while ((match = kPattern.exec(original)) !== null) {
  const value = match[2];
  if (value.includes('PAGE') || value.includes('DATA') || value.includes('__') ||
      value.includes('decode') || value.includes('atob') || value.includes('source') ||
      value.includes('file') || value.includes('setup') || value.includes('jw')) {
    relevantK.push({ idx: match[1], value });
  }
}
console.log('Relevant k[] entries:', relevantK.length);
relevantK.forEach(({ idx, value }) => console.log(`  k[${idx}] = "${value}"`));

// Look for the actual decryption function
// It likely involves XOR, base64, or some transformation
console.log('\n=== Looking for transformation functions ===');

// Find functions that take a string and return a transformed string
const funcPatterns = [
  /function\s*\w*\s*\([^)]*\)\s*\{[^}]*return[^}]*\}/g,
  /\([^)]*\)\s*=>\s*\{[^}]*return[^}]*\}/g
];

// Look for specific crypto operations
console.log('\n=== XOR and bit operations ===');
const xorContext = [];
let idx = 0;
while ((idx = original.indexOf('^', idx)) !== -1) {
  const start = Math.max(0, idx - 50);
  const end = Math.min(original.length, idx + 50);
  const context = original.substring(start, end);
  // Only include if it looks like XOR operation (not regex)
  if (!context.includes('/') || context.includes('charCodeAt')) {
    xorContext.push(context.replace(/\s+/g, ' ').trim());
  }
  idx++;
}
console.log('XOR operations found:', xorContext.length);
console.log('Sample XOR contexts:');
[...new Set(xorContext)].slice(0, 10).forEach(c => console.log('  ', c.substring(0, 80)));

// Look for the setup function that initializes the player
console.log('\n=== Looking for player setup ===');
const setupPatterns = [
  /setup\s*\(/g,
  /jwplayer/gi,
  /player/gi,
  /sources?\s*:/g,
  /file\s*:/g
];

setupPatterns.forEach(pattern => {
  const matches = original.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// Find where the decoded string is used to build URLs
console.log('\n=== URL building patterns ===');
const urlPatterns = [
  /https?:\/\//g,
  /\.m3u8/g,
  /\.mp4/g,
  /\/api\//g,
  /\/ajax\//g
];

urlPatterns.forEach(pattern => {
  const matches = original.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// Look for the N4F/N0M function calls that might decode PAGE_DATA related strings
console.log('\n=== N4F/N0M calls analysis ===');
const n4fCalls = original.match(/N4F\(\d+\)|N0M\(\d+\)/g);
if (n4fCalls) {
  const indices = n4fCalls.map(c => parseInt(c.match(/\d+/)[0]));
  const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);
  console.log('Unique indices:', uniqueIndices.length);
  console.log('Index range:', Math.min(...uniqueIndices), '-', Math.max(...uniqueIndices));
}
