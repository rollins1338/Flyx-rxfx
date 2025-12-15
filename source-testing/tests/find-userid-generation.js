/**
 * Find userId generation and token creation in SmashyStream
 */

const fs = require('fs');

const bundle = fs.readFileSync('source-testing/smashystream-bundle.js', 'utf8');

console.log('=== FINDING USER ID GENERATION ===\n');

// The function hx stores userIdData - find where it's called
console.log('--- Finding hx function calls ---');
// hx is the function that stores userIdData
const hxPattern = /hx\s*\([^)]+\)/g;
const hxCalls = bundle.match(hxPattern);
if (hxCalls) {
  console.log('hx calls found:');
  for (const call of hxCalls.slice(0, 10)) {
    console.log(`  ${call}`);
  }
}

// Find where userId is generated
console.log('\n--- Finding userId generation ---');
// Look for random string generation that might be userId
const randomIdPatterns = [
  /[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*Math\.random\(\)\.toString\(36\)[^;]+/g,
  /[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*crypto\.randomUUID\(\)/g,
  /[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*[`'"][a-f0-9-]+[`'"]/g,
];

for (const pattern of randomIdPatterns) {
  const matches = bundle.match(pattern);
  if (matches) {
    console.log(`\nPattern: ${pattern.source.substring(0, 40)}...`);
    for (const m of matches.slice(0, 5)) {
      console.log(`  ${m}`);
    }
  }
}

// Find the actual API request function
console.log('\n--- Finding API request implementation ---');
// Search for where headers are constructed with Token
const tokenHeaderIdx = bundle.indexOf('"Token"');
if (tokenHeaderIdx > -1) {
  const context = bundle.substring(Math.max(0, tokenHeaderIdx - 500), tokenHeaderIdx + 500);
  console.log('Context around "Token" header:');
  console.log(context);
}

// Also search for 'Token' (single quotes)
const tokenHeaderIdx2 = bundle.indexOf("'Token'");
if (tokenHeaderIdx2 > -1) {
  const context = bundle.substring(Math.max(0, tokenHeaderIdx2 - 500), tokenHeaderIdx2 + 500);
  console.log('\nContext around \'Token\' header:');
  console.log(context);
}

// Search for user_id in request
console.log('\n--- Finding user_id in request ---');
const userIdReqIdx = bundle.indexOf('"user_id"');
if (userIdReqIdx > -1) {
  const context = bundle.substring(Math.max(0, userIdReqIdx - 500), userIdReqIdx + 500);
  console.log('Context around "user_id":');
  console.log(context);
}

// Look for the actual fetch with headers
console.log('\n--- Finding fetch with custom headers ---');
// Search for fetch calls that include headers
const fetchWithHeadersPattern = /fetch\s*\([^,]+,\s*\{[^}]*headers[^}]*\}\s*\)/g;
const fetchWithHeaders = bundle.match(fetchWithHeadersPattern);
if (fetchWithHeaders) {
  console.log('Fetch calls with headers:');
  for (const f of fetchWithHeaders.slice(0, 5)) {
    console.log(`  ${f.substring(0, 200)}...`);
  }
}

// Look for axios or other HTTP client config
console.log('\n--- Finding HTTP client config ---');
const httpConfigPattern = /\{[^}]*method\s*:\s*['"](?:GET|POST)['"]/gi;
const httpConfigs = bundle.match(httpConfigPattern);
if (httpConfigs) {
  for (const config of httpConfigs.slice(0, 5)) {
    // Get more context
    const idx = bundle.indexOf(config);
    const context = bundle.substring(idx, Math.min(bundle.length, idx + 300));
    console.log(`  ${context}`);
    console.log('---');
  }
}
