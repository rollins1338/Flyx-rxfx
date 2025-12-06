/**
 * Step 3: Try different decoding approaches
 * Based on the pattern analysis, the string seems to use a custom encoding
 */

const fs = require('fs');

const decoded = fs.readFileSync('rapidshare-strings-decoded.txt', 'utf8');

console.log('=== Step 3: Decoding Attempts ===\n');

// The high frequency of #, E, &, @, W suggests these might be delimiters or part of encoding
// Let's look at the raw bytes more carefully

console.log('=== Byte Distribution Analysis ===');
const byteFreq = {};
for (let i = 0; i < decoded.length; i++) {
  const byte = decoded.charCodeAt(i);
  byteFreq[byte] = (byteFreq[byte] || 0) + 1;
}

// Sort by frequency
const sortedBytes = Object.entries(byteFreq)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40);

console.log('Top 40 bytes by frequency:');
sortedBytes.forEach(([byte, count]) => {
  const char = String.fromCharCode(byte);
  const printable = byte >= 32 && byte < 127 ? char : `\\x${parseInt(byte).toString(16).padStart(2, '0')}`;
  console.log(`  0x${parseInt(byte).toString(16).padStart(2, '0')} (${printable}): ${count} (${(count/decoded.length*100).toFixed(1)}%)`);
});

// Check if it could be base64-like encoding
console.log('\n\n=== Base64-like Analysis ===');
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const customBase64Chars = new Set();
for (const char of decoded) {
  if (!base64Chars.includes(char)) {
    customBase64Chars.add(char);
  }
}
console.log('Non-base64 characters found:', customBase64Chars.size);
console.log('Sample:', [...customBase64Chars].slice(0, 30).map(c => {
  const code = c.charCodeAt(0);
  return code >= 32 && code < 127 ? c : `\\x${code.toString(16).padStart(2, '0')}`;
}).join(' '));

// Try to find if there's a pattern every N characters
console.log('\n\n=== Periodic Pattern Analysis ===');
for (let period = 2; period <= 8; period++) {
  const buckets = Array(period).fill(0).map(() => ({}));
  
  for (let i = 0; i < decoded.length; i++) {
    const byte = decoded.charCodeAt(i);
    const bucket = i % period;
    buckets[bucket][byte] = (buckets[bucket][byte] || 0) + 1;
  }
  
  // Check if each bucket has a dominant character
  const dominants = buckets.map(bucket => {
    const sorted = Object.entries(bucket).sort((a, b) => b[1] - a[1]);
    const total = Object.values(bucket).reduce((a, b) => a + b, 0);
    const topPercent = (sorted[0][1] / total * 100).toFixed(1);
    return { byte: sorted[0][0], percent: topPercent };
  });
  
  const avgDominance = dominants.reduce((a, b) => a + parseFloat(b.percent), 0) / period;
  console.log(`Period ${period}: avg dominance ${avgDominance.toFixed(1)}%`);
}

// Look for the u6JBF namespace functions in the original file
console.log('\n\n=== Looking at u6JBF namespace in original ===');
const original = fs.readFileSync('rapidshare-app.js', 'utf8');

// Find all u6JBF assignments
const u6JBFMatches = original.match(/u6JBF\[\d+\]/g);
if (u6JBFMatches) {
  const uniqueIndices = [...new Set(u6JBFMatches)].sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)[0]);
    const numB = parseInt(b.match(/\d+/)[0]);
    return numA - numB;
  });
  console.log('u6JBF indices found:', uniqueIndices.length);
  console.log('Sample indices:', uniqueIndices.slice(0, 20).join(', '));
}

// Find the V2AsvL function and see how it's used
console.log('\n\n=== V2AsvL Usage Analysis ===');
const v2asvlUsages = original.match(/V2AsvL[^(]*\([^)]*\)/g);
if (v2asvlUsages) {
  console.log('V2AsvL usages found:', v2asvlUsages.length);
  console.log('Sample usages:', v2asvlUsages.slice(0, 5));
}

// Look for decoding functions
console.log('\n\n=== Looking for decode/decrypt functions ===');
const decodePatterns = [
  /function\s+\w*[Dd]ecode\w*/g,
  /function\s+\w*[Dd]ecrypt\w*/g,
  /\.decode\s*\(/g,
  /atob\s*\(/g,
  /btoa\s*\(/g,
  /fromCharCode/g,
  /charCodeAt/g,
  /String\.fromCharCode/g
];

for (const pattern of decodePatterns) {
  const matches = original.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
    if (matches.length < 10) {
      console.log('  ', matches.join(', '));
    }
  }
}

// Look for the actual decoding logic
console.log('\n\n=== Searching for string manipulation patterns ===');
const stringManipPatterns = [
  /split\s*\(\s*["'][^"']+["']\s*\)/g,
  /join\s*\(\s*["'][^"']*["']\s*\)/g,
  /replace\s*\(\s*\/[^/]+\//g,
  /substring\s*\(\s*\d+/g,
  /slice\s*\(\s*-?\d+/g
];

for (const pattern of stringManipPatterns) {
  const matches = original.match(pattern);
  if (matches) {
    const unique = [...new Set(matches)];
    console.log(`${pattern.source}: ${matches.length} matches (${unique.length} unique)`);
    console.log('  Samples:', unique.slice(0, 5).join(', '));
  }
}
