/**
 * Step 14: Analyze control character patterns
 * 
 * The decoded strings have control characters interspersed.
 * These might be:
 * 1. Indices into another table
 * 2. Part of a two-byte encoding
 * 3. Escape sequences
 */

const fs = require('fs');

console.log('=== Step 14: Control Character Analysis ===\n');

const v2asvl = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');

// XOR with "C|B%" 
const xorKey = "C|B%";
let xored = '';
for (let i = 0; i < v2asvl.length; i++) {
  xored += String.fromCharCode(v2asvl.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
}

// Look at the pattern of control characters
console.log('=== Control Character Positions ===');
const controlPositions = [];
for (let i = 0; i < xored.length; i++) {
  if (xored.charCodeAt(i) < 32) {
    controlPositions.push({ pos: i, char: xored.charCodeAt(i) });
  }
}

console.log('Total control chars:', controlPositions.length);
console.log('First 50 control char positions:');
controlPositions.slice(0, 50).forEach(({ pos, char }) => {
  const before = xored.substring(Math.max(0, pos - 3), pos);
  const after = xored.substring(pos + 1, Math.min(xored.length, pos + 4));
  console.log(`  pos ${pos}: 0x${char.toString(16).padStart(2, '0')} between "${before}" and "${after}"`);
});

// Check if control chars come in pairs
console.log('\n\n=== Control Character Pairs ===');
const pairs = [];
for (let i = 0; i < controlPositions.length - 1; i++) {
  const curr = controlPositions[i];
  const next = controlPositions[i + 1];
  if (next.pos === curr.pos + 1) {
    pairs.push({ pos: curr.pos, chars: [curr.char, next.char] });
  }
}
console.log('Adjacent control char pairs:', pairs.length);
console.log('First 30 pairs:');
pairs.slice(0, 30).forEach(({ pos, chars }) => {
  const hex = chars.map(c => c.toString(16).padStart(2, '0')).join('');
  const before = xored.substring(Math.max(0, pos - 5), pos);
  const after = xored.substring(pos + 2, Math.min(xored.length, pos + 7));
  console.log(`  pos ${pos}: 0x${hex} between "${before}" and "${after}"`);
});

// Maybe the control chars are length prefixes or indices
// Let's see if removing them gives readable text
console.log('\n\n=== Removing Control Characters ===');
let cleaned = '';
for (let i = 0; i < xored.length; i++) {
  if (xored.charCodeAt(i) >= 32) {
    cleaned += xored[i];
  }
}

// Split by backtick
const cleanParts = cleaned.split('`');
console.log('Clean parts:', cleanParts.length);
console.log('\nFirst 30 clean parts:');
cleanParts.slice(0, 30).forEach((p, i) => {
  console.log(`  [${i}]: "${p.substring(0, 60)}"`);
});

// Look for recognizable strings
console.log('\n\n=== Recognizable Strings ===');
const words = cleaned.match(/[a-zA-Z]{3,}/g);
const uniqueWords = [...new Set(words)].sort();
console.log('Unique words (3+ chars):', uniqueWords.length);
console.log('Sample:', uniqueWords.slice(0, 100).join(', '));

// Check if the control chars might be XOR keys for the next segment
console.log('\n\n=== Testing Control Chars as XOR Keys ===');
// Take a sample segment and try XORing with the preceding control char
for (let i = 0; i < Math.min(10, pairs.length); i++) {
  const { pos, chars } = pairs[i];
  const segment = xored.substring(pos + 2, pos + 20);
  
  // Try XOR with the control char pair as a 16-bit value
  const key16 = (chars[0] << 8) | chars[1];
  let decoded16 = '';
  for (let j = 0; j < segment.length; j++) {
    decoded16 += String.fromCharCode(segment.charCodeAt(j) ^ ((key16 >> (8 * (j % 2))) & 0xFF));
  }
  
  // Try XOR with just the first control char
  let decoded8 = '';
  for (let j = 0; j < segment.length; j++) {
    decoded8 += String.fromCharCode(segment.charCodeAt(j) ^ chars[0]);
  }
  
  console.log(`\nPair at ${pos}: 0x${chars.map(c => c.toString(16).padStart(2, '0')).join('')}`);
  console.log(`  Original: "${segment.replace(/[\x00-\x1f]/g, '·')}"`);
  console.log(`  XOR 16-bit: "${decoded16.replace(/[\x00-\x1f]/g, '·')}"`);
  console.log(`  XOR 8-bit: "${decoded8.replace(/[\x00-\x1f]/g, '·')}"`);
}
