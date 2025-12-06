/**
 * Step 12: Two-layer decoding
 * 
 * The control characters might indicate that there's a second layer of encoding.
 * Looking at the hex dump, the pattern seems to be:
 * - Readable chars followed by control chars
 * - The control chars might be indices or offsets
 */

const fs = require('fs');

console.log('=== Step 12: Two-Layer Decoding ===\n');

const v2asvl = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');

// First, let's look at the raw V2AsvL string more carefully
console.log('=== Raw V2AsvL Analysis ===');
console.log('First 200 chars (hex):');
let hexStr = '';
for (let i = 0; i < 200; i++) {
  hexStr += v2asvl.charCodeAt(i).toString(16).padStart(2, '0') + ' ';
  if ((i + 1) % 20 === 0) hexStr += '\n';
}
console.log(hexStr);

// The V2AsvL string might already be the string table
// Let's see if splitting by backtick gives us anything
console.log('\n=== V2AsvL split by backtick ===');
const v2parts = v2asvl.split('`');
console.log('Parts:', v2parts.length);
if (v2parts.length > 1) {
  console.log('First 20 parts:');
  v2parts.slice(0, 20).forEach((p, i) => {
    const hex = [...p].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    console.log(`  [${i}]: "${p.substring(0, 30)}" (${hex.substring(0, 60)})`);
  });
}

// Maybe the string is not XOR encoded at all
// Let's look for patterns that suggest a lookup table
console.log('\n\n=== Looking for index patterns ===');

// Check if there are repeating sequences that could be indices
const sequences = {};
for (let len = 2; len <= 4; len++) {
  for (let i = 0; i <= v2asvl.length - len; i++) {
    const seq = v2asvl.substring(i, i + len);
    // Only count sequences with at least one control char
    if ([...seq].some(c => c.charCodeAt(0) < 32)) {
      sequences[seq] = (sequences[seq] || 0) + 1;
    }
  }
}

const sortedSeqs = Object.entries(sequences)
  .filter(([_, count]) => count > 3)
  .sort((a, b) => b[1] - a[1]);

console.log('Repeating sequences with control chars:');
sortedSeqs.slice(0, 20).forEach(([seq, count]) => {
  const hex = [...seq].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  console.log(`  ${hex}: ${count} times`);
});

// Let's try a completely different approach
// Maybe the string is a custom base-N encoding
console.log('\n\n=== Custom Base Encoding Analysis ===');

// Count unique characters
const uniqueChars = new Set(v2asvl);
console.log('Unique characters:', uniqueChars.size);

// If it's base64-like, we'd expect ~64 unique chars
// If it's base256, we'd expect more

// Let's see the distribution
const charCounts = {};
for (const char of v2asvl) {
  const code = char.charCodeAt(0);
  charCounts[code] = (charCounts[code] || 0) + 1;
}

const sortedChars = Object.entries(charCounts).sort((a, b) => b[1] - a[1]);
console.log('\nTop 40 characters by frequency:');
sortedChars.slice(0, 40).forEach(([code, count]) => {
  const char = parseInt(code) >= 32 && parseInt(code) < 127 
    ? String.fromCharCode(code) 
    : `\\x${parseInt(code).toString(16).padStart(2, '0')}`;
  console.log(`  ${char} (${code}): ${count} (${(count/v2asvl.length*100).toFixed(1)}%)`);
});

// The high frequency of certain chars suggests a substitution cipher
// Let's try frequency analysis
console.log('\n\n=== Frequency Analysis ===');
// In English text, 'e' is most common (~12%), then 't' (~9%), 'a' (~8%), etc.
// In JavaScript, common chars are: e, t, a, o, i, n, s, r, function, return, var, etc.

// Map the most frequent chars to common English letters
const englishFreq = 'etaoinshrdlcumwfgypbvkjxqz';
const mapping = {};
sortedChars.slice(0, 26).forEach(([code, _], i) => {
  mapping[parseInt(code)] = englishFreq[i];
});

console.log('Frequency-based substitution:');
let substituted = '';
for (let i = 0; i < Math.min(500, v2asvl.length); i++) {
  const code = v2asvl.charCodeAt(i);
  substituted += mapping[code] || '?';
}
console.log(substituted);

// This probably won't work directly, but let's see the pattern
