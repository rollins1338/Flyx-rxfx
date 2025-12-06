/**
 * Step 1: Extract and decode all string literals from the obfuscated code
 * The code uses URL-encoded strings in the V2AsvL function
 */

const fs = require('fs');

const code = fs.readFileSync('rapidshare-app.js', 'utf8');

console.log('=== Step 1: String Extraction ===\n');

// Find the V2AsvL function which returns encoded strings
const v2asvlMatch = code.match(/function V2AsvL\(\)\{return"([^"]+)"\}/);
if (v2asvlMatch) {
  const encoded = v2asvlMatch[1];
  const decoded = decodeURIComponent(encoded);
  
  console.log('V2AsvL encoded string length:', encoded.length);
  console.log('Decoded length:', decoded.length);
  
  // Save decoded string
  fs.writeFileSync('rapidshare-strings-decoded.txt', decoded);
  console.log('Saved to rapidshare-strings-decoded.txt\n');
  
  // The decoded string appears to be a custom encoding
  // Let's analyze its structure
  console.log('First 500 chars of decoded:');
  console.log(decoded.substring(0, 500));
  
  // Look for patterns - the string seems to have delimiters
  console.log('\n\nAnalyzing character frequency:');
  const freq = {};
  for (const char of decoded) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  // Sort by frequency
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  console.log('Top 20 most frequent characters:');
  sorted.slice(0, 20).forEach(([char, count]) => {
    const code = char.charCodeAt(0);
    console.log(`  '${char}' (0x${code.toString(16).padStart(2, '0')}): ${count} times`);
  });
}

// Find the u6JBF namespace initialization
console.log('\n\n=== u6JBF Namespace ===');
const u6jbfInit = code.match(/u6JBF\[(\d+)\]\s*=\s*\([^)]+\)/g);
if (u6jbfInit) {
  console.log('u6JBF initializations found:', u6jbfInit.length);
  u6jbfInit.slice(0, 5).forEach(init => {
    console.log('  ', init.substring(0, 100));
  });
}

// Find the d5p3Do assignment (this seems to be the string decoder)
const d5p3DoMatch = code.match(/u6JBF\.d5p3Do\s*=\s*(\w+)/);
if (d5p3DoMatch) {
  console.log('\n\nu6JBF.d5p3Do assigned to:', d5p3DoMatch[1]);
  
  // Find the function definition
  const funcName = d5p3DoMatch[1];
  const funcMatch = code.match(new RegExp(`function ${funcName}\\([^)]*\\)\\{[^}]+\\}`));
  if (funcMatch) {
    console.log('Function definition:', funcMatch[0].substring(0, 200));
  }
}

// Look for the string array that the decoder uses
console.log('\n\n=== Looking for string array ===');
const arrayMatches = code.match(/\[['"][^'"]{1,30}['"](?:,['"][^'"]{1,30}['"]\s*){5,}\]/g);
if (arrayMatches) {
  console.log('Found potential string arrays:', arrayMatches.length);
  arrayMatches.forEach((arr, i) => {
    console.log(`\nArray ${i + 1} (${arr.length} chars):`);
    console.log(arr.substring(0, 200) + '...');
  });
}
