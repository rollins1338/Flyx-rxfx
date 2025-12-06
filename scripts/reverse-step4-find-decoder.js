/**
 * Step 4: Find the actual decoder function
 * Look for charCodeAt and fromCharCode usage context
 */

const fs = require('fs');

const original = fs.readFileSync('rapidshare-app.js', 'utf8');

console.log('=== Step 4: Finding Decoder Logic ===\n');

// Find context around charCodeAt
console.log('=== charCodeAt Context ===');
let idx = 0;
let count = 0;
while ((idx = original.indexOf('charCodeAt', idx)) !== -1 && count < 5) {
  const start = Math.max(0, idx - 200);
  const end = Math.min(original.length, idx + 200);
  console.log(`\n--- Match ${count + 1} at position ${idx} ---`);
  console.log(original.substring(start, end));
  console.log('---');
  idx++;
  count++;
}

// Find context around fromCharCode
console.log('\n\n=== fromCharCode Context ===');
idx = original.indexOf('fromCharCode');
if (idx !== -1) {
  const start = Math.max(0, idx - 300);
  const end = Math.min(original.length, idx + 300);
  console.log(original.substring(start, end));
}

// Look for the E5dlxF function which is used with V2AsvL
console.log('\n\n=== E5dlxF Function ===');
const e5dlxfMatch = original.match(/E5dlxF\s*[=:]\s*function[^{]*\{[^}]+\}/);
if (e5dlxfMatch) {
  console.log(e5dlxfMatch[0]);
}

// Look for function definitions that might be decoders
console.log('\n\n=== Looking for decoder-like functions ===');
// Find functions that use both charCodeAt and some math operations
const funcPattern = /function\s*\w*\s*\([^)]*\)\s*\{[^}]*charCodeAt[^}]*\}/g;
const funcMatches = original.match(funcPattern);
if (funcMatches) {
  console.log('Functions using charCodeAt:', funcMatches.length);
  funcMatches.forEach((m, i) => {
    console.log(`\n--- Function ${i + 1} ---`);
    console.log(m.substring(0, 500));
  });
}

// Look for the u6JBF[44438] function definition
console.log('\n\n=== u6JBF[44438] Definition ===');
const u6jbf44438 = original.match(/u6JBF\[44438\]\s*=\s*\([^)]*\)\s*=>\s*\{[^}]+\}|u6JBF\[44438\]\s*=\s*function[^{]*\{[^}]+\}/);
if (u6jbf44438) {
  console.log(u6jbf44438[0]);
}

// Find all function-like patterns that could be decoders
console.log('\n\n=== Arrow functions with string operations ===');
const arrowFuncs = original.match(/\([^)]*\)\s*=>\s*\{[^}]*(?:charCodeAt|fromCharCode|split|join)[^}]*\}/g);
if (arrowFuncs) {
  console.log('Arrow functions with string ops:', arrowFuncs.length);
  arrowFuncs.slice(0, 3).forEach((m, i) => {
    console.log(`\n--- Arrow ${i + 1} ---`);
    console.log(m);
  });
}

// Look for XOR operations
console.log('\n\n=== XOR Operations ===');
const xorOps = original.match(/\^\s*\d+|\d+\s*\^/g);
if (xorOps) {
  console.log('XOR operations found:', xorOps.length);
  const unique = [...new Set(xorOps)];
  console.log('Unique XOR values:', unique.slice(0, 20).join(', '));
}

// Look for modulo operations (often used in ciphers)
console.log('\n\n=== Modulo Operations ===');
const modOps = original.match(/%\s*\d+|\d+\s*%/g);
if (modOps) {
  console.log('Modulo operations found:', modOps.length);
  const unique = [...new Set(modOps)];
  console.log('Unique modulo values:', unique.join(', '));
}
