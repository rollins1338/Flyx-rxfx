/**
 * Decode the string table to find entry 212
 * 
 * The string table is built by M2OpVfE which:
 * 1. Gets a base string from window[something]
 * 2. XORs each character with "C|B%" key
 * 3. Builds up the Q string
 * 
 * The N4F/N0M functions access this string table
 */

const fs = require('fs');

console.log('=== Decoding String Table ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// The string table is built from a base string
// The base string is accessed via: u6JBF.V4a()(t([17,64,75,32,15,76])())
// t([17,64,75,32,15,76]) adds 36 to each: [53,100,111,68,51,112] = "5doD3p"

// This is likely a property name: window["5doD3p"] or similar
// But "5doD3p" doesn't look like a standard property

// Let's look at the actual M2OpVfE function more carefully
console.log('=== M2OpVfE function ===\n');

const m2opvfeStart = code.indexOf('M2OpVfE');
const m2opvfeEnd = code.indexOf('return N', m2opvfeStart);
const m2opvfeCode = code.substring(m2opvfeStart, m2opvfeEnd + 50);

// The function builds Q by XORing characters
// Q+=t(s(r)^w(c))
// s is bound to b (the base string)
// w is bound to a (the XOR key "C|B%")

// The XOR key is "C|B%" (URL encoded as C%7CB%)
const xorKey = 'C|B%';

// Let's find the base string
// It's stored in b which comes from u6JBF.V4a()(t([17,64,75,32,15,76])())

// u6JBF.V4a() likely returns a function that accesses a property
// t([17,64,75,32,15,76])() returns "5doD3p" and calls it as a function

// Wait - t() returns a function that when called returns a string
// Let's trace this more carefully

console.log('Looking for V4a function...');
const v4aPattern = /V4a\s*=\s*function[^{]*\{[^}]+\}/;
const v4aMatch = code.match(v4aPattern);
if (v4aMatch) {
  console.log(v4aMatch[0]);
}

// The string table might be pre-computed
// Let's look for a long string that could be the decoded table

console.log('\n=== Looking for long strings ===\n');

// Find strings longer than 100 characters
const longStrPattern = /["']([^"']{100,500})["']/g;
let match;
const longStrings = [];
while ((match = longStrPattern.exec(code)) !== null) {
  // Skip obvious non-string-table content
  if (!match[1].includes('function') && !match[1].includes('return') && !match[1].includes('break')) {
    longStrings.push(match[1]);
  }
}

console.log(`Found ${longStrings.length} long strings`);
longStrings.slice(0, 3).forEach((s, i) => {
  console.log(`\nString ${i + 1} (${s.length} chars):`);
  console.log(s.substring(0, 100) + '...');
});

// The string table entries are accessed by index
// Let's find what indices are used and their context

console.log('\n=== String table index usage ===\n');

// Find all N4F/N0M calls and group by index
const n4fPattern = /N[04][FM]\((\d+)\)/g;
const indexUsage = new Map();
while ((match = n4fPattern.exec(code)) !== null) {
  const idx = parseInt(match[1]);
  const start = Math.max(0, match.index - 30);
  const end = Math.min(code.length, match.index + 30);
  const context = code.substring(start, end).replace(/\s+/g, ' ');
  
  if (!indexUsage.has(idx)) {
    indexUsage.set(idx, []);
  }
  indexUsage.get(idx).push(context);
}

// Show usage for key indices
const keyIndices = [212, 380, 419, 90, 148, 125];
keyIndices.forEach(idx => {
  const contexts = indexUsage.get(idx);
  if (contexts) {
    console.log(`\nIndex ${idx} (${contexts.length} uses):`);
    contexts.slice(0, 2).forEach(c => console.log(`  ${c.substring(0, 80)}`));
  }
});

// The k[] array contains some strings
// Let's see if any of them could be the key source

console.log('\n=== k[] array analysis ===\n');

const kPattern = /k\[(\d+)\]\s*=\s*["']([^"']+)["']/g;
const kTable = {};
while ((match = kPattern.exec(code)) !== null) {
  kTable[parseInt(match[1])] = match[2];
}

// Look for entries that could be property names
const propLikeEntries = Object.entries(kTable).filter(([idx, val]) => 
  /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val) && val.length > 3
);

console.log('Property-like k[] entries:');
propLikeEntries.slice(0, 20).forEach(([idx, val]) => console.log(`  k[${idx}] = "${val}"`));

// The string at index 212 is used to initialize the key
// It might be a constant string like "0123456789abcdef..." or similar

// Let's try to find what string would produce a valid key
console.log('\n=== Trying to find key string ===\n');

// If the key is built from charCodes of a string,
// and we know the first 8 bytes of the key are: b7 77 7a 5c 80 b8 39 b5
// Then the string would have characters with those codes

const knownKeyBytes = [0xb7, 0x77, 0x7a, 0x5c, 0x80, 0xb8, 0x39, 0xb5];
console.log('Known key bytes:', knownKeyBytes.map(b => `0x${b.toString(16)}`).join(', '));
console.log('As characters:', knownKeyBytes.map(b => String.fromCharCode(b)).join('').replace(/[^\x20-\x7e]/g, '.'));

// These bytes are not printable ASCII, so the key is not directly from a string
// It must be derived through some transformation

// The key derivation involves:
// 1. J(string) - split and get charCodes
// 2. XOR with something
// 3. Possibly rotation or other transforms

// Let's try to reverse engineer the key derivation
// If key[i] = string.charCodeAt(i) XOR constant
// Then string.charCodeAt(i) = key[i] XOR constant

// Try different constants
console.log('\nTrying to find source string with different XOR constants:');

for (let constant = 0; constant < 256; constant++) {
  const sourceChars = knownKeyBytes.map(b => b ^ constant);
  const allPrintable = sourceChars.every(c => c >= 32 && c <= 126);
  
  if (allPrintable) {
    const sourceStr = String.fromCharCode(...sourceChars);
    console.log(`  XOR 0x${constant.toString(16)}: "${sourceStr}"`);
  }
}

console.log('\n=== Done ===');
