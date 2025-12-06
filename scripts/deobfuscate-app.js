/**
 * Try to deobfuscate the rapidshare app.js
 * by executing parts of it to extract the string table
 */

const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('rapidshare-app.js', 'utf8');

console.log('=== Attempting Deobfuscation ===\n');

// The code uses W3 object with methods like N4F, N0M, Q66, w3P
// These are likely string lookup functions

// Try to extract the string table by finding the initialization
const stringTableMatch = code.match(/\[("[^"]+",?\s*)+\]/);
if (stringTableMatch) {
  console.log('Found potential string table');
  try {
    const table = eval(stringTableMatch[0]);
    console.log('String table entries:', table.length);
    table.slice(0, 50).forEach((s, i) => console.log(`  ${i}: ${s}`));
  } catch (e) {
    console.log('Could not eval string table:', e.message);
  }
}

// Look for the W3 initialization
const w3Init = code.match(/W3\s*=\s*\{[\s\S]{100,500}\}/);
if (w3Init) {
  console.log('\n\nW3 initialization:');
  console.log(w3Init[0].substring(0, 500));
}

// Try to find the actual decryption function by looking for patterns
// that process __PAGE_DATA

// The decryption likely involves:
// 1. Reading window.__PAGE_DATA
// 2. Some transformation (base64, XOR, etc.)
// 3. JSON.parse or similar
// 4. Setting up jwplayer with the result

// Look for JSON.parse usage
const jsonParseMatch = code.match(/JSON\.parse[^;]+/g);
if (jsonParseMatch) {
  console.log('\n\nJSON.parse usage:');
  jsonParseMatch.slice(0, 5).forEach(m => console.log('  ', m.substring(0, 100)));
}

// Look for atob usage (base64 decode)
const atobMatch = code.match(/atob[^;]+/g);
if (atobMatch) {
  console.log('\n\natob usage:');
  atobMatch.forEach(m => console.log('  ', m.substring(0, 100)));
}

// Try to find where the player is set up
// JWPlayer setup typically looks like: jwplayer("player").setup({...})
const playerSetup = code.match(/jwplayer\s*\([^)]+\)\s*\.\s*setup\s*\([^)]+\)/g);
if (playerSetup) {
  console.log('\n\nJWPlayer setup calls:');
  playerSetup.forEach(p => console.log('  ', p.substring(0, 150)));
}

// The key insight: the obfuscated code uses a state machine pattern
// with switch statements. Let's count them
const switchCount = (code.match(/switch\s*\(/g) || []).length;
const caseCount = (code.match(/case\s+/g) || []).length;
console.log('\n\nObfuscation metrics:');
console.log('  switch statements:', switchCount);
console.log('  case statements:', caseCount);

// This is a control flow flattening obfuscation
// Very difficult to reverse without specialized tools

console.log('\n\n=== Conclusion ===');
console.log('The app.js uses control flow flattening obfuscation.');
console.log('This makes static analysis extremely difficult.');
console.log('Options:');
console.log('1. Use a specialized deobfuscator (like synchrony, webcrack)');
console.log('2. Dynamic analysis with browser debugging');
console.log('3. Hook the jwplayer.setup() call to capture the decrypted data');
