#!/usr/bin/env node
/**
 * Extract the decrypt function from the bundle around position 66347
 * where _.G3v() is called.
 */
const fs = require('fs');

const bundle = fs.readFileSync('scripts/animekai-crypto-bundle-1771726946134.js', 'utf8');

// Get a large chunk around the G3v call at 66347
const start = 66000;
const end = 70000;
const chunk = bundle.substring(start, end);

// Write it to a file for analysis
fs.writeFileSync('scripts/kai-decrypt-function.js', chunk);
console.log('Wrote decrypt function region to kai-decrypt-function.js');
console.log('Length:', chunk.length);

// Also get the region around 569657 (the other K76 call)
const start2 = 569000;
const end2 = 572000;
const chunk2 = bundle.substring(start2, end2);
fs.writeFileSync('scripts/kai-decrypt-function2.js', chunk2);
console.log('Wrote second region to kai-decrypt-function2.js');

// Also look for the string table functions q6h and G_h
// These resolve obfuscated string references
// Let's find where q6h and G_h are defined
let idx = bundle.indexOf('q6h=function');
if (idx === -1) idx = bundle.indexOf('q6h=');
console.log('\nq6h defined at:', idx);
if (idx > 0) {
  console.log('Context:', bundle.substring(idx, idx + 200));
}

idx = bundle.indexOf('G_h=function');
if (idx === -1) idx = bundle.indexOf('G_h=');
console.log('\nG_h defined at:', idx);
if (idx > 0) {
  console.log('Context:', bundle.substring(idx, idx + 200));
}

// Let's also look for the actual encrypt/decrypt function names
// The bundle likely has functions like "encrypt" and "decrypt" as string literals
const encIdx = bundle.indexOf('"encrypt"');
const decIdx = bundle.indexOf('"decrypt"');
console.log('\n"encrypt" at:', encIdx);
console.log('"decrypt" at:', decIdx);

// Search for the actual API response handling
// The response from /ajax/links/view returns { result: "encrypted_string" }
// The client must decode this. Look for "result" near the decrypt area
const resultIdx = bundle.indexOf('"result"');
console.log('"result" at:', resultIdx);

// Look for the URL pattern that calls /ajax/links/view
let viewIdx = 0;
const viewCalls = [];
while (true) {
  viewIdx = bundle.indexOf('links/view', viewIdx);
  if (viewIdx === -1) break;
  viewCalls.push(viewIdx);
  viewIdx++;
}
console.log('\n"links/view" found at:', viewCalls);
for (const vi of viewCalls) {
  console.log('Context:', bundle.substring(Math.max(0, vi - 200), vi + 200));
}

// Also look for "links/list" 
let listIdx = 0;
const listCalls = [];
while (true) {
  listIdx = bundle.indexOf('links/list', listIdx);
  if (listIdx === -1) break;
  listCalls.push(listIdx);
  listIdx++;
}
console.log('\n"links/list" found at:', listCalls);

// Look for "episodes/list"
let epIdx = 0;
const epCalls = [];
while (true) {
  epIdx = bundle.indexOf('episodes/list', epIdx);
  if (epIdx === -1) break;
  epCalls.push(epIdx);
  epIdx++;
}
console.log('"episodes/list" found at:', epCalls);
