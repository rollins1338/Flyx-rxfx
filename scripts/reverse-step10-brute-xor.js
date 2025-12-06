/**
 * Step 10: Brute force different XOR approaches
 * 
 * The partial words suggest we're close but something is off.
 * Let's try different key variations and offsets.
 */

const fs = require('fs');

console.log('=== Step 10: Brute Force XOR ===\n');

const v2asvl = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');

// Function to count readable words
function countReadableWords(str) {
  const words = str.match(/[a-zA-Z]{4,}/g) || [];
  // Filter for common programming words
  const commonWords = ['function', 'return', 'window', 'document', 'string', 'number', 
    'object', 'array', 'length', 'value', 'type', 'name', 'data', 'error', 'true', 'false',
    'null', 'undefined', 'this', 'that', 'self', 'prototype', 'constructor', 'apply', 'call',
    'bind', 'push', 'slice', 'split', 'join', 'replace', 'match', 'test', 'exec', 'index',
    'source', 'file', 'play', 'video', 'audio', 'stream', 'setup', 'config', 'option'];
  
  let score = words.length;
  for (const word of words) {
    if (commonWords.some(cw => word.toLowerCase().includes(cw))) {
      score += 10;
    }
  }
  return { score, words: words.length };
}

// Try different keys
const keysToTry = [
  "C|B%",
  "|B%C",
  "B%C|",
  "%C|B",
  "C|B",
  "|B%",
  "B%C",
  "%C|",
  "CB%|",
  "C%|B",
  "|CB%",
  "%|CB",
  // Single char XOR
  ...Array.from({length: 128}, (_, i) => String.fromCharCode(i)),
  // Two char combinations
  "CB", "C%", "C|", "|B", "|%", "B%",
];

console.log('Testing', keysToTry.length, 'keys...\n');

let bestResults = [];

for (const key of keysToTry) {
  let decoded = '';
  for (let i = 0; i < v2asvl.length; i++) {
    const v2char = v2asvl.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    decoded += String.fromCharCode(v2char ^ keyChar);
  }
  
  const result = countReadableWords(decoded);
  if (result.score > 100) {
    bestResults.push({ key, ...result, sample: decoded.substring(0, 200) });
  }
}

// Sort by score
bestResults.sort((a, b) => b.score - a.score);

console.log('Top 10 results:');
bestResults.slice(0, 10).forEach((r, i) => {
  const keyDisplay = r.key.length === 1 
    ? `0x${r.key.charCodeAt(0).toString(16)} (${r.key.charCodeAt(0)})`
    : `"${r.key}"`;
  console.log(`\n${i + 1}. Key: ${keyDisplay}, Score: ${r.score}, Words: ${r.words}`);
  console.log('   Sample:', r.sample.replace(/[\x00-\x1f]/g, '·'));
});

// Now try with the best single-byte key
if (bestResults.length > 0) {
  const bestKey = bestResults[0].key;
  console.log('\n\n=== Best Result Details ===');
  
  let decoded = '';
  for (let i = 0; i < v2asvl.length; i++) {
    const v2char = v2asvl.charCodeAt(i);
    const keyChar = bestKey.charCodeAt(i % bestKey.length);
    decoded += String.fromCharCode(v2char ^ keyChar);
  }
  
  // Split by backtick
  const parts = decoded.split('`');
  console.log('Parts:', parts.length);
  console.log('\nFirst 50 parts:');
  parts.slice(0, 50).forEach((p, i) => {
    const clean = p.replace(/[\x00-\x1f]/g, '·').substring(0, 50);
    console.log(`  [${i}]: "${clean}"`);
  });
  
  // Save
  fs.writeFileSync('rapidshare-best-decode.txt', decoded);
  fs.writeFileSync('rapidshare-best-parts.txt', parts.join('\n'));
}

// Also try XOR with offset
console.log('\n\n=== Trying with offset ===');
for (let offset = 0; offset < 4; offset++) {
  const key = "C|B%";
  let decoded = '';
  for (let i = 0; i < v2asvl.length; i++) {
    const v2char = v2asvl.charCodeAt(i);
    const keyChar = key.charCodeAt((i + offset) % key.length);
    decoded += String.fromCharCode(v2char ^ keyChar);
  }
  
  const result = countReadableWords(decoded);
  console.log(`Offset ${offset}: Score ${result.score}, Words ${result.words}`);
  console.log('  Sample:', decoded.substring(0, 100).replace(/[\x00-\x1f]/g, '·'));
}
