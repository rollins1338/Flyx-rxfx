/**
 * Step 15: Final decoding attempt
 * 
 * Looking at the cleaned strings, they seem to be fragments that need to be
 * reassembled. The control characters might indicate how to combine them.
 * 
 * Let's try a different approach - look at the actual k[] string table
 * in the original code and see how it maps to the decoded strings.
 */

const fs = require('fs');

console.log('=== Step 15: Final Decoding ===\n');

const original = fs.readFileSync('rapidshare-app.js', 'utf8');

// Extract all k[] assignments with their values
const kAssignments = {};
const kPattern = /k\[(\d+)\]\s*=\s*["']([^"']*)["']/g;
let match;
while ((match = kPattern.exec(original)) !== null) {
  const idx = parseInt(match[1]);
  const value = match[2];
  if (!kAssignments[idx]) {
    kAssignments[idx] = value;
  }
}

// Also extract k[x]+=k[y] concatenations
const concatPattern = /k\[(\d+)\]\s*\+=\s*k\[(\d+)\]/g;
const concatenations = [];
while ((match = concatPattern.exec(original)) !== null) {
  concatenations.push({ target: parseInt(match[1]), source: parseInt(match[2]) });
}

console.log('=== k[] String Table ===');
console.log('Direct assignments:', Object.keys(kAssignments).length);
console.log('Concatenations:', concatenations.length);

// Build the final string table by applying concatenations
const finalStrings = { ...kAssignments };
concatenations.forEach(({ target, source }) => {
  if (finalStrings[target] !== undefined && finalStrings[source] !== undefined) {
    finalStrings[target] += finalStrings[source];
  }
});

// Show the final strings
console.log('\n=== Final String Table (sorted by index) ===');
const sortedIndices = Object.keys(finalStrings).map(Number).sort((a, b) => a - b);
sortedIndices.slice(0, 100).forEach(idx => {
  const value = finalStrings[idx];
  if (value && value.length > 0) {
    console.log(`  k[${idx}] = "${value}"`);
  }
});

// Look for interesting strings
console.log('\n\n=== Interesting Strings ===');
sortedIndices.forEach(idx => {
  const value = finalStrings[idx];
  if (value && (
    value.includes('http') || value.includes('url') || value.includes('file') || 
    value.includes('source') || value.includes('stream') || value.includes('video') ||
    value.includes('play') || value.includes('api') || value.includes('key') ||
    value.includes('setup') || value.includes('jwplayer') || value.includes('hls') ||
    value.includes('.m3u8') || value.includes('.mp4') || value.includes('decrypt') ||
    value.includes('encode') || value.includes('decode') || value.includes('crypto')
  )) {
    console.log(`  k[${idx}] = "${value}"`);
  }
});

// Now let's look at how these strings are used
console.log('\n\n=== String Usage Patterns ===');

// Find patterns like k[x]+k[y]+k[z] which build longer strings
const buildPatterns = original.match(/k\[\d+\](?:\s*\+\s*k\[\d+\])+/g);
if (buildPatterns) {
  console.log('String building patterns found:', buildPatterns.length);
  
  // Try to resolve some of them
  const uniquePatterns = [...new Set(buildPatterns)].slice(0, 20);
  uniquePatterns.forEach(pattern => {
    const indices = pattern.match(/\d+/g).map(Number);
    const resolved = indices.map(i => finalStrings[i] || '?').join('');
    if (resolved.length > 3 && !resolved.includes('?')) {
      console.log(`  ${pattern} => "${resolved}"`);
    }
  });
}

// Look for the actual API endpoints or URLs
console.log('\n\n=== Looking for URL patterns ===');
const urlPatterns = original.match(/["']https?:\/\/[^"']+["']/g);
if (urlPatterns) {
  console.log('Direct URLs found:', urlPatterns.length);
  urlPatterns.slice(0, 10).forEach(url => console.log('  ', url));
}

// Look for base64 encoded strings
console.log('\n\n=== Looking for Base64 patterns ===');
const base64Pattern = /["'][A-Za-z0-9+/]{20,}={0,2}["']/g;
const base64Matches = original.match(base64Pattern);
if (base64Matches) {
  console.log('Potential Base64 strings:', base64Matches.length);
  base64Matches.slice(0, 5).forEach(b64 => {
    console.log('  ', b64.substring(0, 50) + '...');
    try {
      const decoded = Buffer.from(b64.slice(1, -1), 'base64').toString();
      if (decoded.length > 0 && /^[\x20-\x7e]+$/.test(decoded)) {
        console.log('    Decoded:', decoded.substring(0, 100));
      }
    } catch (e) {}
  });
}
