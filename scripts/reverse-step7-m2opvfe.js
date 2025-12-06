/**
 * Step 7: Analyze M2OpVfE - the main string decoder
 */

const fs = require('fs');

const original = fs.readFileSync('rapidshare-app.js', 'utf8');

console.log('=== Step 7: M2OpVfE Decoder Analysis ===\n');

// Find M2OpVfE definition
console.log('=== M2OpVfE Definition ===');
const m2opIdx = original.indexOf('M2OpVfE');
if (m2opIdx !== -1) {
  // Get a larger context
  const start = Math.max(0, m2opIdx - 100);
  const end = Math.min(original.length, m2opIdx + 2000);
  console.log(original.substring(start, end));
}

// The M2OpVfE is in u6JBF[266647] - let's find its full definition
console.log('\n\n=== u6JBF[266647] Full Definition ===');
const u266647Idx = original.indexOf('u6JBF[266647]');
if (u266647Idx !== -1) {
  // Find the closing of this function
  let depth = 0;
  let started = false;
  let endIdx = u266647Idx;
  
  for (let i = u266647Idx; i < original.length && i < u266647Idx + 5000; i++) {
    if (original[i] === '{' || original[i] === '(') {
      depth++;
      started = true;
    } else if (original[i] === '}' || original[i] === ')') {
      depth--;
      if (started && depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  
  console.log(original.substring(u266647Idx, endIdx));
}

// Look for the Q8Q function which is used in M2OpVfE
console.log('\n\n=== Q8Q Function ===');
const q8qIdx = original.indexOf('Q8Q');
if (q8qIdx !== -1) {
  const start = Math.max(0, q8qIdx - 50);
  const end = Math.min(original.length, q8qIdx + 500);
  console.log(original.substring(start, end));
}

// Find where the encoded string (V2AsvL result) is actually decoded
console.log('\n\n=== Looking for decodeURIComponent usage ===');
const decodeURIMatches = original.match(/decodeURIComponent[^)]*\)/g);
if (decodeURIMatches) {
  console.log('decodeURIComponent calls:', decodeURIMatches.length);
  decodeURIMatches.slice(0, 5).forEach(m => console.log('  ', m));
}

// The V2AsvL string is URL-encoded, let's decode it
console.log('\n\n=== Decoding V2AsvL string ===');
const v2asvlMatch = original.match(/function V2AsvL\(\)\{return"([^"]+)"\}/);
if (v2asvlMatch) {
  const encoded = v2asvlMatch[1];
  console.log('Encoded length:', encoded.length);
  
  try {
    const decoded = decodeURIComponent(encoded);
    console.log('Decoded length:', decoded.length);
    console.log('\nFirst 500 chars of decoded:');
    console.log(decoded.substring(0, 500));
    
    // Save for further analysis
    fs.writeFileSync('rapidshare-v2asvl-decoded.txt', decoded);
    console.log('\nSaved to rapidshare-v2asvl-decoded.txt');
  } catch (e) {
    console.log('Decode error:', e.message);
  }
}
