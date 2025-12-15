/**
 * Find the actual fetch implementation that adds Token and user_id
 */

const fs = require('fs');

const bundle = fs.readFileSync('source-testing/smashystream-bundle.js', 'utf8');

console.log('=== FINDING FETCH IMPLEMENTATION ===\n');

// Search for where the player URLs are fetched
// The URLs are built by cx, fx, dx functions
// Need to find where these are called and how the fetch happens

// Look for where player.url is used
console.log('--- Searching for player URL fetch ---');
const playerUrlPattern = /\.url[^a-zA-Z]/g;
let match;
const urlUsages = [];
while ((match = playerUrlPattern.exec(bundle)) !== null) {
  const context = bundle.substring(Math.max(0, match.index - 100), match.index + 150);
  if (context.includes('fetch') || context.includes('axios') || context.includes('request')) {
    urlUsages.push(context);
  }
}

console.log(`Found ${urlUsages.length} potential fetch usages`);
for (const usage of urlUsages.slice(0, 5)) {
  console.log('\n' + usage);
  console.log('---');
}

// Search for async functions that might do the fetching
console.log('\n\n--- Searching for async fetch functions ---');
const asyncFetchPattern = /async\s+(?:function\s+)?[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*\{[^}]*fetch/g;
const asyncFetches = bundle.match(asyncFetchPattern);
if (asyncFetches) {
  console.log(`Found ${asyncFetches.length} async fetch functions`);
  for (const f of asyncFetches.slice(0, 5)) {
    console.log(`\n${f.substring(0, 300)}`);
  }
}

// Look for the specific pattern where headers are constructed
console.log('\n\n--- Searching for headers construction ---');
// The API requires Token and user_id in headers
const headersPattern = /headers\s*:\s*\{[^}]+\}/g;
const headers = bundle.match(headersPattern);
if (headers) {
  console.log(`Found ${headers.length} headers objects`);
  for (const h of headers.slice(0, 10)) {
    console.log(`\n${h}`);
  }
}

// Search for where token state is accessed
console.log('\n\n--- Searching for token state access ---');
const tokenStatePattern = /\.token\b/g;
const tokenAccesses = [];
while ((match = tokenStatePattern.exec(bundle)) !== null) {
  const context = bundle.substring(Math.max(0, match.index - 50), match.index + 100);
  if (!tokenAccesses.includes(context)) {
    tokenAccesses.push(context);
  }
}

console.log(`Found ${tokenAccesses.length} unique token accesses`);
for (const access of tokenAccesses.slice(0, 10)) {
  console.log(`\n${access}`);
}

// Search for uid state access
console.log('\n\n--- Searching for uid state access ---');
const uidStatePattern = /\.uid\b/g;
const uidAccesses = [];
while ((match = uidStatePattern.exec(bundle)) !== null) {
  const context = bundle.substring(Math.max(0, match.index - 50), match.index + 100);
  if (!uidAccesses.includes(context)) {
    uidAccesses.push(context);
  }
}

console.log(`Found ${uidAccesses.length} unique uid accesses`);
for (const access of uidAccesses.slice(0, 10)) {
  console.log(`\n${access}`);
}

// Look for the createAsyncThunk or similar Redux patterns
console.log('\n\n--- Searching for Redux async actions ---');
const asyncThunkPattern = /createAsyncThunk\s*\([^)]+/g;
const asyncThunks = bundle.match(asyncThunkPattern);
if (asyncThunks) {
  console.log(`Found ${asyncThunks.length} async thunks`);
  for (const thunk of asyncThunks.slice(0, 5)) {
    const idx = bundle.indexOf(thunk);
    const context = bundle.substring(idx, Math.min(bundle.length, idx + 500));
    console.log(`\n${context}`);
    console.log('---');
  }
}
