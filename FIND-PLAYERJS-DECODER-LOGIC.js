const fs = require('fs');

/**
 * Find the PlayerJS decoder logic
 * 
 * Key insight: The div ID (xTyBxQyGTA) is used as a variable name
 * PlayerJS must be reading document.getElementById(divId).textContent
 * and decoding it, then assigning it to window[divId]
 */

console.log('🔍 Searching for PlayerJS decoder logic...\n');

const playerjs = fs.readFileSync('deobfuscation/playerjs.js', 'utf8');

console.log(`PlayerJS size: ${playerjs.length} bytes\n`);

// Search for patterns that:
// 1. Get element by ID
// 2. Read textContent
// 3. Decode it
// 4. Assign to window variable

console.log('Searching for getElementById + textContent patterns...\n');

const pattern1 = /getElementById\s*\([^)]+\)[^;]*textContent/g;
const matches1 = [];
let match;

while ((match = pattern1.exec(playerjs)) !== null) {
  const start = Math.max(0, match.index - 300);
  const end = Math.min(playerjs.length, match.index + 500);
  matches1.push(playerjs.substring(start, end));
}

console.log(`Found ${matches1.length} getElementById + textContent patterns\n`);

if (matches1.length > 0) {
  console.log('='.repeat(80));
  matches1.forEach((m, i) => {
    console.log(`\nMatch ${i + 1}:`);
    console.log('-'.repeat(80));
    console.log(m);
  });
  console.log('='.repeat(80));
}

// Search for atob + assignment patterns
console.log('\n\nSearching for atob + window assignment patterns...\n');

const pattern2 = /window\[[^\]]+\]\s*=\s*[^;]*atob/g;
const matches2 = [];

while ((match = pattern2.exec(playerjs)) !== null) {
  const start = Math.max(0, match.index - 200);
  const end = Math.min(playerjs.length, match.index + 400);
  matches2.push(playerjs.substring(start, end));
}

console.log(`Found ${matches2.length} window assignment + atob patterns\n`);

if (matches2.length > 0) {
  console.log('='.repeat(80));
  matches2.forEach((m, i) => {
    console.log(`\nMatch ${i + 1}:`);
    console.log('-'.repeat(80));
    console.log(m);
  });
  console.log('='.repeat(80));
}

// Search for any function that does: atob, replace, charCodeAt
console.log('\n\nSearching for decoder function patterns...\n');

// Look for functions with atob + charCodeAt (XOR pattern)
const pattern3 = /function\s+\w+\s*\([^)]*\)\s*{[^}]{0,1000}atob[^}]{0,500}charCodeAt[^}]{0,500}}/g;
const matches3 = [];

while ((match = pattern3.exec(playerjs)) !== null) {
  matches3.push(match[0]);
}

console.log(`Found ${matches3.length} decoder function candidates\n`);

if (matches3.length > 0) {
  console.log('='.repeat(80));
  matches3.forEach((m, i) => {
    console.log(`\nCandidate ${i + 1}:`);
    console.log('-'.repeat(80));
    console.log(m);
  });
  console.log('='.repeat(80));
}

// Save all findings
const findings = {
  getElementByIdMatches: matches1,
  windowAssignmentMatches: matches2,
  decoderFunctionCandidates: matches3
};

fs.writeFileSync('playerjs-decoder-findings.json', JSON.stringify(findings, null, 2));
console.log('\n💾 All findings saved to: playerjs-decoder-findings.json\n');

console.log('\n✅ Search complete!\n');
