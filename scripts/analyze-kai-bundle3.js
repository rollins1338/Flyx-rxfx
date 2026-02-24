#!/usr/bin/env node
const fs = require('fs');
const bundle = fs.readFileSync('scripts/animekai-crypto-bundle-1771726946134.js', 'utf8');

// The bundle is a webpack/rollup bundle. Let's find the crypto module.
// Key indicators: atob, btoa, fromCharCode, charCodeAt are used in the crypto

// Find all occurrences of these and show surrounding context
const terms = ['atob', 'btoa', 'fromCharCode', 'charCodeAt', 'replace(/-/g', 'replace(/_/g', 'replace(/\\+/g', 'replace(/\\//g'];

for (const term of terms) {
  let idx = 0;
  while ((idx = bundle.indexOf(term, idx)) >= 0) {
    const start = Math.max(0, idx - 150);
    const end = Math.min(bundle.length, idx + 150);
    console.log(`\n=== "${term}" at ${idx} ===`);
    console.log(bundle.substring(start, end));
    idx += term.length;
  }
}

// Also search for the specific switch-case pattern around these
// The obfuscator uses: case NNN: ... break; case NNN: ...
// Find the section containing fromCharCode
const fcIdx = bundle.indexOf('fromCharCode');
if (fcIdx >= 0) {
  // Go back to find the function boundary
  let funcStart = fcIdx;
  let braceCount = 0;
  for (let i = fcIdx; i >= 0; i--) {
    if (bundle[i] === '}') braceCount++;
    if (bundle[i] === '{') {
      braceCount--;
      if (braceCount < 0) { funcStart = i; break; }
    }
    if (i < fcIdx - 5000) break;
  }
  
  // Find the function end
  let funcEnd = fcIdx;
  braceCount = 1;
  for (let i = funcStart + 1; i < bundle.length; i++) {
    if (bundle[i] === '{') braceCount++;
    if (bundle[i] === '}') {
      braceCount--;
      if (braceCount === 0) { funcEnd = i + 1; break; }
    }
    if (i > fcIdx + 50000) break;
  }
  
  console.log(`\n\n=== Function containing fromCharCode: ${funcStart} to ${funcEnd} (${funcEnd - funcStart} chars) ===`);
  const funcBody = bundle.substring(funcStart, funcEnd);
  
  // Look for the state machine cases
  const cases = funcBody.match(/case\s+\d+:/g);
  if (cases) {
    console.log('Number of switch cases:', cases.length);
  }
  
  // Save this function for detailed analysis
  fs.writeFileSync('scripts/kai-crypto-func.js', funcBody);
  console.log('Saved crypto function to scripts/kai-crypto-func.js');
  
  // Look for array/table definitions within this function
  const arrayDefs = funcBody.match(/\[[\d,\s]{100,}\]/g);
  if (arrayDefs) {
    console.log('\nLarge arrays in crypto function:', arrayDefs.length);
    arrayDefs.forEach((a, i) => {
      const nums = a.match(/\d+/g);
      console.log(`  Array ${i}: ${nums.length} numbers, first 10: [${nums.slice(0, 10).join(',')}]`);
    });
  }
}
