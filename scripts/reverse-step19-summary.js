/**
 * Step 19: Summary of Reverse Engineering Findings
 * 
 * This script summarizes what we've discovered about the RapidShare player.
 */

const fs = require('fs');

console.log('=== RapidShare Reverse Engineering Summary ===\n');

// Read the decoded string table
const v2asvl = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');

// XOR with "C|B%" 
const xorKey = "C|B%";
let xored = '';
for (let i = 0; i < v2asvl.length; i++) {
  xored += String.fromCharCode(v2asvl.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
}

// Split by backtick
const parts = xored.split('`');

console.log('1. STRING TABLE ANALYSIS');
console.log('========================');
console.log('Total entries:', parts.length);

// Extract readable words from the string table
const allText = parts.join(' ').replace(/[\x00-\x1f]/g, ' ');
const words = allText.match(/[a-zA-Z]{3,}/g) || [];
const uniqueWords = [...new Set(words)].sort();

console.log('Unique words found:', uniqueWords.length);

// Categorize words
const jsKeywords = uniqueWords.filter(w => 
  ['function', 'return', 'var', 'let', 'const', 'this', 'window', 'document', 
   'prototype', 'constructor', 'apply', 'call', 'bind', 'new', 'typeof',
   'undefined', 'null', 'true', 'false', 'if', 'else', 'for', 'while'].includes(w.toLowerCase())
);

const domMethods = uniqueWords.filter(w =>
  w.toLowerCase().includes('element') || w.toLowerCase().includes('query') ||
  w.toLowerCase().includes('append') || w.toLowerCase().includes('create') ||
  w.toLowerCase().includes('style') || w.toLowerCase().includes('class')
);

const playerRelated = uniqueWords.filter(w =>
  w.toLowerCase().includes('play') || w.toLowerCase().includes('video') ||
  w.toLowerCase().includes('source') || w.toLowerCase().includes('file') ||
  w.toLowerCase().includes('stream') || w.toLowerCase().includes('hls') ||
  w.toLowerCase().includes('setup') || w.toLowerCase().includes('config')
);

console.log('\nJS Keywords found:', jsKeywords.length);
console.log('DOM methods found:', domMethods.length);
console.log('Player-related words:', playerRelated.length);

if (playerRelated.length > 0) {
  console.log('  Player words:', playerRelated.join(', '));
}

console.log('\n2. OBFUSCATION TECHNIQUES');
console.log('=========================');
console.log('- Control flow flattening (switch-case state machines)');
console.log('- String table encoding (XOR with "C|B%")');
console.log('- Property access obfuscation (u6JBF namespace)');
console.log('- Anti-debugging (disable-devtool library)');

console.log('\n3. KEY FUNCTIONS IDENTIFIED');
console.log('===========================');
console.log('- V2AsvL(): Returns encoded string table');
console.log('- M2OpVfE(index): Decodes and returns string at index');
console.log('- N4F(index) / N0M(index): String lookup wrappers');
console.log('- w(): Method wrapper/interceptor');
console.log('- D4OebUt(): Array shuffling function');

console.log('\n4. PAGE_DATA ENCRYPTION');
console.log('=======================');
console.log('The video source is encrypted in window.__PAGE_DATA');
console.log('Format: URL-safe Base64 encoded binary data');
console.log('Decryption: Requires running the full obfuscated code');
console.log('The decryption key is likely derived from:');
console.log('  - Domain/URL information');
console.log('  - Timestamp or session data');
console.log('  - Server-provided token');

console.log('\n5. RECOMMENDED APPROACH');
console.log('=======================');
console.log('To extract video sources from RapidShare:');
console.log('1. Use browser automation (Puppeteer/Playwright)');
console.log('2. Hook JWPlayer.setup() to capture config');
console.log('3. Intercept network requests for .m3u8/.mp4 URLs');
console.log('4. Or use the existing extractor that makes API calls');

console.log('\n6. FILES CREATED');
console.log('================');
const files = [
  'rapidshare-strings-decoded.txt - URL-decoded V2AsvL string',
  'rapidshare-v2asvl-decoded.txt - Same as above',
  'rapidshare-string-table.txt - XOR decoded string table',
  'rapidshare-hook.js - Browser hook script',
  'rapidshare-test.html - Test page for browser debugging',
  'rapidshare-node-test.js - Node.js test script',
  'docs/RAPIDSHARE-DECRYPTION-ANALYSIS.md - Full analysis document'
];
files.forEach(f => console.log('  ' + f));

// Save a clean version of the string table
const cleanParts = parts.map((p, i) => {
  const clean = p.replace(/[\x00-\x1f]/g, '').trim();
  return `[${i}]: ${clean}`;
}).filter(p => p.length > 5);

fs.writeFileSync('rapidshare-clean-strings.txt', cleanParts.join('\n'));
console.log('\nSaved clean string table to rapidshare-clean-strings.txt');
