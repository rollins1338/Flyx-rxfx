/**
 * Step 2: Analyze the decoded string pattern
 * The string appears to use a custom encoding with specific delimiters
 */

const fs = require('fs');

const decoded = fs.readFileSync('rapidshare-strings-decoded.txt', 'utf8');

console.log('=== Step 2: Pattern Analysis ===\n');
console.log('Total length:', decoded.length);

// The string seems to have repeating patterns
// Let's look for common substrings

// Split by common delimiters
const delimiters = ['#', '&', '@', ',', '-', "'", '"'];

console.log('\n=== Splitting by delimiters ===');
for (const delim of delimiters) {
  const parts = decoded.split(delim);
  console.log(`Split by '${delim}': ${parts.length} parts`);
  
  // Show first few parts
  if (parts.length > 5 && parts.length < 500) {
    console.log('  First 10 parts:', parts.slice(0, 10).map(p => `"${p}"`).join(', '));
  }
}

// Look for repeating patterns of specific lengths
console.log('\n\n=== Looking for repeating patterns ===');

function findRepeatingPatterns(str, minLen, maxLen) {
  const patterns = {};
  
  for (let len = minLen; len <= maxLen; len++) {
    for (let i = 0; i <= str.length - len; i++) {
      const pattern = str.substring(i, i + len);
      if (!patterns[pattern]) {
        patterns[pattern] = 0;
      }
      patterns[pattern]++;
    }
  }
  
  // Filter patterns that appear more than once
  return Object.entries(patterns)
    .filter(([_, count]) => count > 2)
    .sort((a, b) => b[1] - a[1]);
}

const patterns = findRepeatingPatterns(decoded, 3, 8);
console.log('Top 30 repeating patterns (3-8 chars):');
patterns.slice(0, 30).forEach(([pattern, count]) => {
  const hex = [...pattern].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
  console.log(`  "${pattern}" (${hex}): ${count} times`);
});

// The decoded string might be XOR encoded or use a substitution cipher
// Let's check if it could be XOR with a key

console.log('\n\n=== XOR Analysis ===');

// If the string is XOR encoded, XORing with the same key should reveal patterns
// Common XOR keys are short strings or single bytes

// Try to find the XOR key by looking at common plaintext patterns
// In JavaScript, common strings are: "function", "return", "var", "this", etc.

const commonStrings = ['function', 'return', 'var ', 'this', 'window', 'document', 'setup', 'file', 'source', 'http'];

for (const target of commonStrings) {
  // For each position in decoded, try to find if XORing produces the target
  for (let i = 0; i <= decoded.length - target.length; i++) {
    const chunk = decoded.substring(i, i + target.length);
    
    // Calculate what key would produce target from chunk
    const key = [];
    for (let j = 0; j < target.length; j++) {
      key.push(chunk.charCodeAt(j) ^ target.charCodeAt(j));
    }
    
    // Check if key is printable/reasonable
    const keyStr = String.fromCharCode(...key);
    const isPrintable = key.every(k => k >= 32 && k < 127);
    
    if (isPrintable && new Set(key).size <= 4) { // Key has few unique values
      console.log(`Potential key for "${target}" at pos ${i}: "${keyStr}" (${key.join(',')})`);
    }
  }
}

// Let's also look at the structure - maybe it's a lookup table
console.log('\n\n=== Structure Analysis ===');

// Check if there are numeric patterns
const numbers = decoded.match(/\d+/g);
if (numbers) {
  console.log('Numbers found:', numbers.length);
  const uniqueNums = [...new Set(numbers)].sort((a, b) => parseInt(a) - parseInt(b));
  console.log('Unique numbers:', uniqueNums.slice(0, 30).join(', '));
}

// Check for letter patterns
const letters = decoded.match(/[A-Za-z]+/g);
if (letters) {
  console.log('\nLetter sequences found:', letters.length);
  const uniqueLetters = [...new Set(letters)].slice(0, 30);
  console.log('Sample sequences:', uniqueLetters.join(', '));
}
