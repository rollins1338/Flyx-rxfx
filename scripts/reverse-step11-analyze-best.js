/**
 * Step 11: Analyze the best XOR result with key "C%"
 */

const fs = require('fs');

console.log('=== Step 11: Analyzing Best XOR Result ===\n');

const v2asvl = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');

// XOR with "C%"
const key = "C%";
let decoded = '';
for (let i = 0; i < v2asvl.length; i++) {
  const v2char = v2asvl.charCodeAt(i);
  const keyChar = key.charCodeAt(i % key.length);
  decoded += String.fromCharCode(v2char ^ keyChar);
}

console.log('Decoded length:', decoded.length);

// The result has control characters - let's see the pattern
console.log('\n=== Character Analysis ===');
const charFreq = {};
for (let i = 0; i < decoded.length; i++) {
  const code = decoded.charCodeAt(i);
  charFreq[code] = (charFreq[code] || 0) + 1;
}

const sorted = Object.entries(charFreq).sort((a, b) => b[1] - a[1]);
console.log('Top 30 characters:');
sorted.slice(0, 30).forEach(([code, count]) => {
  const char = parseInt(code) >= 32 && parseInt(code) < 127 
    ? String.fromCharCode(code) 
    : `\\x${parseInt(code).toString(16).padStart(2, '0')}`;
  console.log(`  ${char} (0x${parseInt(code).toString(16).padStart(2, '0')}): ${count}`);
});

// The control characters might be delimiters
// Let's try splitting by common control chars
console.log('\n=== Splitting by control characters ===');
const controlChars = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f];

for (const cc of controlChars) {
  const parts = decoded.split(String.fromCharCode(cc));
  if (parts.length > 5 && parts.length < 500) {
    console.log(`\nSplit by 0x${cc.toString(16).padStart(2, '0')}: ${parts.length} parts`);
    // Show parts that look like words
    const goodParts = parts.filter(p => /^[a-zA-Z]{2,}$/.test(p.trim()));
    if (goodParts.length > 10) {
      console.log('  Clean word parts:', goodParts.slice(0, 30).join(', '));
    }
  }
}

// Try to find the actual string table by looking for patterns
console.log('\n\n=== Looking for string patterns ===');

// The strings might be separated by a specific byte sequence
// Let's look for repeating patterns
const twoBytePatterns = {};
for (let i = 0; i < decoded.length - 1; i++) {
  const pattern = decoded.charCodeAt(i).toString(16).padStart(2, '0') + 
                  decoded.charCodeAt(i+1).toString(16).padStart(2, '0');
  twoBytePatterns[pattern] = (twoBytePatterns[pattern] || 0) + 1;
}

const sortedPatterns = Object.entries(twoBytePatterns).sort((a, b) => b[1] - a[1]);
console.log('Top 20 two-byte patterns:');
sortedPatterns.slice(0, 20).forEach(([pattern, count]) => {
  console.log(`  0x${pattern}: ${count}`);
});

// Let's try a different approach - maybe the XOR key changes
// Look at the original code again for clues
console.log('\n\n=== Trying alternating XOR ===');

// Maybe odd/even positions use different keys
const keys = ['C', '%', '|', 'B'];
for (let keyLen = 1; keyLen <= 4; keyLen++) {
  for (let k1 = 0; k1 < 128; k1++) {
    for (let k2 = 0; k2 < 128; k2++) {
      if (keyLen === 2) {
        const testKey = String.fromCharCode(k1) + String.fromCharCode(k2);
        let testDecoded = '';
        for (let i = 0; i < Math.min(100, v2asvl.length); i++) {
          testDecoded += String.fromCharCode(v2asvl.charCodeAt(i) ^ testKey.charCodeAt(i % 2));
        }
        // Check if it starts with common words
        if (testDecoded.startsWith('dis') || testDecoded.startsWith('doc') || 
            testDecoded.startsWith('win') || testDecoded.startsWith('fun') ||
            testDecoded.startsWith('var') || testDecoded.startsWith('let') ||
            testDecoded.startsWith('con')) {
          console.log(`Key "${testKey}" (0x${k1.toString(16)}, 0x${k2.toString(16)}): ${testDecoded.substring(0, 50)}`);
        }
      }
    }
  }
}

// Save the best result for manual inspection
fs.writeFileSync('rapidshare-decoded-c-percent.txt', decoded);
console.log('\nSaved to rapidshare-decoded-c-percent.txt');

// Also save a hex dump
let hexDump = '';
for (let i = 0; i < Math.min(500, decoded.length); i++) {
  hexDump += decoded.charCodeAt(i).toString(16).padStart(2, '0') + ' ';
  if ((i + 1) % 16 === 0) hexDump += '\n';
}
console.log('\n=== Hex dump of first 500 bytes ===');
console.log(hexDump);
