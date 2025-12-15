/**
 * Search for the actual API call pattern in SmashyStream
 * Looking for where Token and user_id headers are added
 */

const fs = require('fs');

const bundle = fs.readFileSync('source-testing/smashystream-bundle.js', 'utf8');

console.log('=== SEARCHING FOR API CALL PATTERN ===\n');

// The API returns: {"status": 403, "message": "Token and user_id are required"}
// So we need to find where these are added as headers

// Search for "Token" as a string (header name)
console.log('--- Searching for Token header ---');
let idx = bundle.indexOf('Token');
let count = 0;
while (idx !== -1 && count < 20) {
  const context = bundle.substring(Math.max(0, idx - 100), idx + 150);
  // Only show if it looks like a header
  if (context.includes(':') || context.includes('header')) {
    console.log(`\n[${++count}] ${context}`);
  }
  idx = bundle.indexOf('Token', idx + 1);
}

// Search for "user_id" as a string
console.log('\n\n--- Searching for user_id ---');
idx = bundle.indexOf('user_id');
count = 0;
while (idx !== -1 && count < 10) {
  const context = bundle.substring(Math.max(0, idx - 100), idx + 150);
  console.log(`\n[${++count}] ${context}`);
  idx = bundle.indexOf('user_id', idx + 1);
}

// Search for fetch with method POST or GET
console.log('\n\n--- Searching for fetch calls ---');
const fetchCallPattern = /fetch\s*\(\s*[^,]+,\s*\{/g;
let match;
const fetchCalls = [];
while ((match = fetchCallPattern.exec(bundle)) !== null) {
  const start = match.index;
  // Get more context after the match
  const context = bundle.substring(start, Math.min(bundle.length, start + 400));
  fetchCalls.push(context);
}

console.log(`Found ${fetchCalls.length} fetch calls with options`);
for (const call of fetchCalls.slice(0, 10)) {
  console.log(`\n${call.substring(0, 300)}`);
  console.log('---');
}

// Search for the specific function that makes API calls
// Look for patterns like: fetch(url, { headers: { Token: ..., user_id: ... } })
console.log('\n\n--- Searching for API request function ---');

// Find functions that reference both api.smashystream.top and token
const apiIdx = bundle.indexOf('api.smashystream.top');
if (apiIdx > -1) {
  // Search backwards and forwards for a function boundary
  let funcStart = apiIdx;
  let funcEnd = apiIdx;
  
  // Find function start (look for 'function' or '=>')
  for (let i = apiIdx; i > Math.max(0, apiIdx - 5000); i--) {
    const substr = bundle.substring(i, i + 10);
    if (substr.startsWith('function') || substr.includes('=>{') || substr.includes('=> {')) {
      funcStart = i;
      break;
    }
  }
  
  // Find function end (matching braces)
  let braceCount = 0;
  let inFunc = false;
  for (let i = funcStart; i < Math.min(bundle.length, funcStart + 10000); i++) {
    if (bundle[i] === '{') {
      braceCount++;
      inFunc = true;
    }
    if (bundle[i] === '}') {
      braceCount--;
      if (inFunc && braceCount === 0) {
        funcEnd = i + 1;
        break;
      }
    }
  }
  
  const funcCode = bundle.substring(funcStart, funcEnd);
  console.log(`Function containing API URL (${funcCode.length} chars):`);
  console.log(funcCode.substring(0, 2000));
}

// Also search for where the token is retrieved from state
console.log('\n\n--- Searching for state.token access ---');
const stateTokenPattern = /state\.token/g;
const stateTokenMatches = [];
while ((match = stateTokenPattern.exec(bundle)) !== null) {
  const context = bundle.substring(Math.max(0, match.index - 50), match.index + 100);
  stateTokenMatches.push(context);
}

for (const m of stateTokenMatches.slice(0, 5)) {
  console.log(`\n${m}`);
}
