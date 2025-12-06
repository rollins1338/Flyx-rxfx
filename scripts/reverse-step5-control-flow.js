/**
 * Step 5: Analyze control flow and the w() wrapper function
 */

const fs = require('fs');

const original = fs.readFileSync('rapidshare-app.js', 'utf8');

console.log('=== Step 5: Control Flow Analysis ===\n');

// Find the w() function definition
console.log('=== Looking for w() function ===');
// It's likely defined as: function w(...) or var w = function or const w =
const wFuncPatterns = [
  /function\s+w\s*\([^)]*\)\s*\{/,
  /\bw\s*=\s*function\s*\([^)]*\)\s*\{/,
  /\bw\s*=\s*\([^)]*\)\s*=>\s*\{/
];

for (const pattern of wFuncPatterns) {
  const match = original.match(pattern);
  if (match) {
    const idx = original.indexOf(match[0]);
    console.log(`Found w() at position ${idx}`);
    // Get more context
    const end = Math.min(original.length, idx + 500);
    console.log(original.substring(idx, end));
    break;
  }
}

// Look for the main decoding function that uses V2AsvL
console.log('\n\n=== V2AsvL and E5dlxF relationship ===');
const v2asvlIdx = original.indexOf('V2AsvL,E5dlxF');
if (v2asvlIdx !== -1) {
  const start = Math.max(0, v2asvlIdx - 500);
  const end = Math.min(original.length, v2asvlIdx + 500);
  console.log(original.substring(start, end));
}

// Find the u6JBF[611046] function which takes 3 params (a,e,r)
console.log('\n\n=== u6JBF[611046] - Main decoder? ===');
const u611046Idx = original.indexOf('u6JBF[611046]');
if (u611046Idx !== -1) {
  const end = Math.min(original.length, u611046Idx + 1500);
  console.log(original.substring(u611046Idx, end));
}

// Look for the actual string decoding logic
console.log('\n\n=== Looking for string array access patterns ===');
// Often obfuscated code uses array[index] to get strings
const arrayAccessPattern = /\w+\[\d+\]/g;
const arrayAccesses = original.match(arrayAccessPattern);
if (arrayAccesses) {
  const unique = [...new Set(arrayAccesses)];
  console.log('Unique array accesses:', unique.length);
  // Group by array name
  const byArray = {};
  unique.forEach(access => {
    const name = access.match(/(\w+)\[/)[1];
    if (!byArray[name]) byArray[name] = [];
    byArray[name].push(access);
  });
  
  // Show arrays with most accesses
  const sorted = Object.entries(byArray).sort((a, b) => b[1].length - a[1].length);
  console.log('\nTop arrays by access count:');
  sorted.slice(0, 10).forEach(([name, accesses]) => {
    console.log(`  ${name}: ${accesses.length} unique indices`);
    if (accesses.length < 20) {
      console.log(`    Indices: ${accesses.join(', ')}`);
    }
  });
}

// Look for the switch-case state machine pattern
console.log('\n\n=== State Machine Analysis ===');
const switchCases = original.match(/case\s+\d+:/g);
if (switchCases) {
  console.log('Total case statements:', switchCases.length);
  const caseNumbers = switchCases.map(c => parseInt(c.match(/\d+/)[0]));
  const maxCase = Math.max(...caseNumbers);
  const minCase = Math.min(...caseNumbers);
  console.log(`Case range: ${minCase} to ${maxCase}`);
}

// Find where the encoded string is actually used
console.log('\n\n=== Where is V2AsvL() result used? ===');
const v2asvlCallIdx = original.indexOf('V2AsvL()');
if (v2asvlCallIdx !== -1) {
  const start = Math.max(0, v2asvlCallIdx - 200);
  const end = Math.min(original.length, v2asvlCallIdx + 300);
  console.log(original.substring(start, end));
}
