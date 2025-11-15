// Search PlayerJS directly for decoder patterns
const fs = require('fs');

const content = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('='.repeat(70));
console.log('🔍 SEARCHING PLAYERJS FOR DECODER');
console.log('='.repeat(70));

// Search for patterns that match our known encoding:
// 1. URL-safe base64 (replace _ and -)
// 2. Reverse
// 3. Base64 decode
// 4. Possibly XOR

console.log('\n[1] Searching for URL-safe base64 conversion...');
const urlSafePattern = /replace\([^)]*_[^)]*\/[^)]*\).*replace\([^)]*-[^)]*\+[^)]*\)/g;
const urlSafeMatches = content.match(urlSafePattern);

if (urlSafeMatches) {
  console.log(`✅ Found ${urlSafeMatches.length} URL-safe base64 patterns`);
  urlSafeMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
}

console.log('\n[2] Searching for reverse + atob pattern...');
const reverseAtobPattern = /reverse\(\).*atob|atob.*reverse\(\)/g;
const reverseAtobMatches = content.match(reverseAtobPattern);

if (reverseAtobMatches) {
  console.log(`✅ Found ${reverseAtobMatches.length} reverse+atob patterns`);
  reverseAtobMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
}

console.log('\n[3] Searching for complete decoder function...');
// Look for a function that does all the steps
const completePattern = /.{0,500}replace.{0,100}_.*\/.{0,100}replace.{0,100}-.*\+.{0,100}reverse.{0,100}atob.{0,500}/g;
const completeMatches = content.match(completePattern);

if (completeMatches) {
  console.log(`✅ Found ${completeMatches.length} complete decoder patterns`);
  completeMatches.slice(0, 3).forEach((m, i) => {
    console.log(`\n[${i + 1}]`);
    console.log(m);
  });
}

console.log('\n[4] Searching for .sbx property...');
const sbxPattern = /\.sbx\s*[=:]\s*function[^{]*\{[^}]{0,1000}\}/g;
const sbxMatches = content.match(sbxPattern);

if (sbxMatches) {
  console.log(`✅ Found ${sbxMatches.length} .sbx functions`);
  sbxMatches.forEach((m, i) => {
    console.log(`\n[${i + 1}]`);
    console.log(m);
  });
}

console.log('\n[5] Searching for any atob usage...');
const atobPattern = /atob\([^)]+\)/g;
const atobMatches = content.match(atobPattern);

if (atobMatches) {
  console.log(`✅ Found ${atobMatches.length} atob calls`);
  // Show unique patterns
  const unique = [...new Set(atobMatches)];
  console.log(`   Unique patterns: ${unique.length}`);
  unique.slice(0, 10).forEach((m, i) => {
    console.log(`   [${i + 1}] ${m}`);
  });
}

console.log('\n[6] Manual search for specific variable names...');
// Search for common obfuscated variable patterns
const varPatterns = ['_0x', 'var ', 'function ', '.decode', '.decrypt'];

varPatterns.forEach(pattern => {
  const count = (content.match(new RegExp(pattern, 'g')) || []).length;
  console.log(`   "${pattern}": ${count} occurrences`);
});

console.log('\n' + '='.repeat(70));
console.log('SEARCH COMPLETE');
console.log('='.repeat(70));

console.log('\n💡 RECOMMENDATION:');
console.log('The PlayerJS code is heavily minified. The decoder is likely:');
console.log('1. Inline in the player initialization');
console.log('2. Using variable names like _0x1234');
console.log('3. Split across multiple statements');
console.log('\nBest approach: Use browser DevTools to:');
console.log('1. Set breakpoint on atob() calls');
console.log('2. Watch what gets passed to atob()');
console.log('3. Trace back to see the transformation steps');
