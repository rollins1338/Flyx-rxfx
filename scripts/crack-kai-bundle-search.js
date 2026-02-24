#!/usr/bin/env node
/**
 * Search the bundle for the actual decrypt function.
 * We know:
 * - _.G3v calls p_mLjDq (the permutation generator)
 * - _.K76 also calls p_mLjDq
 * - The decrypt function must call G3v or K76 and use the result
 * - It must also use fromCharCode to convert back to string
 * - It must handle base64 decoding
 */
const fs = require('fs');

const bundle = fs.readFileSync('scripts/animekai-crypto-bundle-1771726946134.js', 'utf8');

// Find all function definitions that reference G3v or K76
// These are the functions that USE the permutation table

// Search for patterns like: _.G3v( or _.K76(
const g3vCalls = [];
const k76Calls = [];

let idx = 0;
while (true) {
  idx = bundle.indexOf('_.G3v(', idx);
  if (idx === -1) break;
  // Get surrounding context (500 chars before and after)
  const start = Math.max(0, idx - 300);
  const end = Math.min(bundle.length, idx + 500);
  g3vCalls.push({ pos: idx, context: bundle.substring(start, end) });
  idx++;
}

idx = 0;
while (true) {
  idx = bundle.indexOf('_.K76(', idx);
  if (idx === -1) break;
  const start = Math.max(0, idx - 300);
  const end = Math.min(bundle.length, idx + 500);
  k76Calls.push({ pos: idx, context: bundle.substring(start, end) });
  idx++;
}

console.log(`Found ${g3vCalls.length} calls to _.G3v`);
console.log(`Found ${k76Calls.length} calls to _.K76`);

// Print each call with context
for (const call of g3vCalls) {
  console.log(`\n=== _.G3v call at position ${call.pos} ===`);
  console.log(call.context);
  console.log('---');
}

for (const call of k76Calls) {
  console.log(`\n=== _.K76 call at position ${call.pos} ===`);
  console.log(call.context);
  console.log('---');
}

// Also search for the decrypt-related patterns
// Look for atob or base64 decode near the permutation calls
const atobCalls = [];
idx = 0;
while (true) {
  idx = bundle.indexOf('atob', idx);
  if (idx === -1) break;
  // Check if near a G3v/K76 call (within 2000 chars)
  const nearG3v = g3vCalls.some(c => Math.abs(c.pos - idx) < 2000);
  const nearK76 = k76Calls.some(c => Math.abs(c.pos - idx) < 2000);
  if (nearG3v || nearK76) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(bundle.length, idx + 200);
    atobCalls.push({ pos: idx, context: bundle.substring(start, end) });
  }
  idx++;
}

console.log(`\nFound ${atobCalls.length} atob calls near permutation functions`);
for (const call of atobCalls) {
  console.log(`\n=== atob at ${call.pos} ===`);
  console.log(call.context);
}

// Search for charCodeAt near permutation calls
const charCodeCalls = [];
idx = 0;
while (true) {
  idx = bundle.indexOf('charCodeAt', idx);
  if (idx === -1) break;
  const nearG3v = g3vCalls.some(c => Math.abs(c.pos - idx) < 3000);
  const nearK76 = k76Calls.some(c => Math.abs(c.pos - idx) < 3000);
  if (nearG3v || nearK76) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(bundle.length, idx + 200);
    charCodeCalls.push({ pos: idx, context: bundle.substring(start, end) });
  }
  idx++;
}

console.log(`\nFound ${charCodeCalls.length} charCodeAt calls near permutation functions`);
for (const call of charCodeCalls.slice(0, 5)) {
  console.log(`\n=== charCodeAt at ${call.pos} ===`);
  console.log(call.context);
}

// Search for fromCharCode near permutation calls
const fromCharCalls = [];
idx = 0;
while (true) {
  idx = bundle.indexOf('fromCharCode', idx);
  if (idx === -1) break;
  const nearG3v = g3vCalls.some(c => Math.abs(c.pos - idx) < 3000);
  const nearK76 = k76Calls.some(c => Math.abs(c.pos - idx) < 3000);
  if (nearG3v || nearK76) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(bundle.length, idx + 200);
    fromCharCalls.push({ pos: idx, context: bundle.substring(start, end) });
  }
  idx++;
}

console.log(`\nFound ${fromCharCalls.length} fromCharCode calls near permutation functions`);
for (const call of fromCharCalls.slice(0, 5)) {
  console.log(`\n=== fromCharCode at ${call.pos} ===`);
  console.log(call.context);
}
