#!/usr/bin/env node
const fs = require('fs');
const bundle = fs.readFileSync('scripts/animekai-crypto-bundle-1771726946134.js', 'utf8');
console.log('Bundle size:', bundle.length);

// Look for large numeric arrays (substitution tables)
let m;
const re = /\[(\d+(?:,\d+){50,})\]/g;
let count = 0;
while ((m = re.exec(bundle)) !== null) {
  const nums = m[1].split(',');
  console.log(`Numeric array @${m.index}: ${nums.length} elements: ${m[1].substring(0, 120)}...`);
  count++;
}
console.log('Total large numeric arrays:', count);

// Look for the main data/constant array
// The obfuscator typically puts all strings/numbers in one big array
const bigArrayMatch = bundle.match(/var\s+(\w+)\s*=\s*\[/);
if (bigArrayMatch) {
  const varName = bigArrayMatch[1];
  const startIdx = bundle.indexOf(bigArrayMatch[0]);
  // Find the end of this array
  let depth = 0;
  let endIdx = startIdx;
  for (let i = startIdx; i < bundle.length; i++) {
    if (bundle[i] === '[') depth++;
    if (bundle[i] === ']') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }
  const arrayStr = bundle.substring(startIdx, endIdx);
  console.log(`\nMain array var ${varName}: ${arrayStr.length} chars`);
  console.log('First 300 chars:', arrayStr.substring(0, 300));
}

// Search for patterns related to encryption
const searchTerms = ['encrypt', 'decrypt', 'encode', 'decode', 'cipher', 'table', 'substitut', 'xor', 'base64'];
for (const term of searchTerms) {
  const idx = bundle.toLowerCase().indexOf(term);
  if (idx >= 0) {
    console.log(`\n"${term}" found at ${idx}:`);
    console.log('  ', bundle.substring(Math.max(0, idx - 40), idx + 80).replace(/\n/g, '\\n'));
  }
}

// Look for the window.__$ usage pattern
const dollarMatches = [...bundle.matchAll(/__\$/g)];
console.log('\n__$ occurrences:', dollarMatches.length);
dollarMatches.slice(0, 5).forEach(m => {
  console.log('  @' + m.index + ':', bundle.substring(m.index - 20, m.index + 60).replace(/\n/g, '\\n'));
});

// Look for AJAX URL patterns
const ajaxPatterns = [...bundle.matchAll(/["'](\/ajax\/[^"']+)["']/g)];
console.log('\nAJAX URLs:', ajaxPatterns.length);
[...new Set(ajaxPatterns.map(m => m[1]))].forEach(u => console.log('  ', u));

// Look for the specific pattern of building encrypted tokens
// The _ parameter in AJAX calls
const underscoreParam = [...bundle.matchAll(/[&?]_=/g)];
console.log('\n&_= parameter occurrences:', underscoreParam.length);
underscoreParam.slice(0, 3).forEach(m => {
  console.log('  @' + m.index + ':', bundle.substring(m.index - 40, m.index + 60).replace(/\n/g, '\\n'));
});
