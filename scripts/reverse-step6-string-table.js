/**
 * Step 6: Extract and analyze the string table (k array)
 */

const fs = require('fs');

const original = fs.readFileSync('rapidshare-app.js', 'utf8');

console.log('=== Step 6: String Table Analysis ===\n');

// Find all k[number] = "string" assignments
console.log('=== Extracting k[] string assignments ===');
const kAssignments = original.match(/k\[\d+\]\s*=\s*["'][^"']*["']/g);
if (kAssignments) {
  console.log('k[] assignments found:', kAssignments.length);
  
  // Parse into a map
  const kMap = {};
  kAssignments.forEach(assignment => {
    const match = assignment.match(/k\[(\d+)\]\s*=\s*["']([^"']*)["']/);
    if (match) {
      const idx = parseInt(match[1]);
      const value = match[2];
      kMap[idx] = value;
    }
  });
  
  // Sort by index and show
  const sorted = Object.entries(kMap).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  console.log('\nString table entries (first 50):');
  sorted.slice(0, 50).forEach(([idx, value]) => {
    console.log(`  k[${idx}] = "${value}"`);
  });
  
  // Look for interesting strings
  console.log('\n\nInteresting strings:');
  sorted.forEach(([idx, value]) => {
    if (value.includes('http') || value.includes('url') || value.includes('file') || 
        value.includes('source') || value.includes('stream') || value.includes('video') ||
        value.includes('play') || value.includes('api') || value.includes('key') ||
        value.includes('decrypt') || value.includes('encode') || value.includes('decode')) {
      console.log(`  k[${idx}] = "${value}"`);
    }
  });
}

// Look for the N4F and N0M functions which seem to be string decoders
console.log('\n\n=== N4F and N0M Functions ===');
const n4fIdx = original.indexOf('N4F');
if (n4fIdx !== -1) {
  // Find the function definition
  const n4fDefMatch = original.match(/N4F\s*[=:]\s*function[^{]*\{[^}]+\}/);
  if (n4fDefMatch) {
    console.log('N4F definition:', n4fDefMatch[0].substring(0, 300));
  }
}

// Look for how N4F is used
console.log('\n\n=== N4F Usage Examples ===');
const n4fUsages = original.match(/N4F\(\d+\)/g);
if (n4fUsages) {
  const unique = [...new Set(n4fUsages)];
  console.log('N4F calls:', unique.length);
  console.log('Sample calls:', unique.slice(0, 20).join(', '));
}

// Look for the Q8Q function
console.log('\n\n=== Q8Q Function (string decoder?) ===');
const q8qMatch = original.match(/Q8Q\s*[=:]\s*function[^{]*\{[\s\S]{0,1000}\}/);
if (q8qMatch) {
  console.log('Q8Q definition:', q8qMatch[0].substring(0, 500));
}

// Find the actual string decoding mechanism
console.log('\n\n=== Looking for string concatenation patterns ===');
// k[x]+=k[y] patterns suggest string building
const concatPatterns = original.match(/k\[\d+\]\s*\+=\s*k\[\d+\]/g);
if (concatPatterns) {
  console.log('String concatenation patterns:', concatPatterns.length);
  console.log('Sample:', concatPatterns.slice(0, 10).join('\n'));
}

// Look for the actual decoder that uses the V2AsvL string
console.log('\n\n=== Tracing V2AsvL usage ===');
// Find where d5p3Do is used (it's assigned to V2AsvL)
const d5p3DoUsages = original.match(/d5p3Do[^,;\n]{0,100}/g);
if (d5p3DoUsages) {
  console.log('d5p3Do usages:', d5p3DoUsages.length);
  d5p3DoUsages.slice(0, 10).forEach(u => console.log('  ', u));
}
