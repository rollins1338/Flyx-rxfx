/**
 * Step 13: Understand the string lookup mechanism
 * 
 * Looking at the code:
 * - V2AsvL() returns the encoded string
 * - It's split by backtick into parts
 * - M2OpVfE(index) returns the string at that index
 * - But there's XOR involved: Q+=t(s(r)^w(c))
 * 
 * The XOR is between:
 * - s(r) = b.charCodeAt(r) where b is the V2AsvL decoded string
 * - w(c) = a.charCodeAt(c) where a is "C|B%" (cycling)
 * 
 * So the final string table is: XOR(V2AsvL, "C|B%")
 * Then split by backtick
 */

const fs = require('fs');

console.log('=== Step 13: String Lookup Mechanism ===\n');

const v2asvl = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');

// XOR with "C|B%" 
const xorKey = "C|B%";
let xored = '';
for (let i = 0; i < v2asvl.length; i++) {
  xored += String.fromCharCode(v2asvl.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
}

// Split by backtick
const parts = xored.split('`');
console.log('String table has', parts.length, 'entries\n');

// Show all entries
console.log('=== String Table ===');
parts.forEach((p, i) => {
  // Clean up control characters for display
  const clean = p.replace(/[\x00-\x1f]/g, c => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
  console.log(`[${i}]: "${clean}"`);
});

// Now let's look at the N4F calls in the original code
// N4F(330), N4F(352), N4F(150), etc.
// These indices are much larger than 215 (our parts count)
// So there must be additional processing

console.log('\n\n=== Analyzing N4F indices ===');
const original = fs.readFileSync('rapidshare-app.js', 'utf8');
const n4fCalls = original.match(/N4F\((\d+)\)/g);
const indices = n4fCalls.map(c => parseInt(c.match(/\d+/)[0]));
const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);

console.log('Unique N4F indices:', uniqueIndices.length);
console.log('Range:', Math.min(...uniqueIndices), 'to', Math.max(...uniqueIndices));
console.log('Sample indices:', uniqueIndices.slice(0, 30).join(', '));

// The indices are much larger than the string count
// This suggests there's a mapping function
// Looking at the code: u6JBF.u40(u6JBF.u40(Q,-10,10),0,8)
// This looks like array rotation/shuffling

// Let's see if there's a pattern
console.log('\n\n=== Index Modulo Analysis ===');
for (let mod = 10; mod <= 300; mod += 10) {
  const modIndices = uniqueIndices.map(i => i % mod);
  const uniqueMod = new Set(modIndices);
  if (uniqueMod.size <= parts.length + 10) {
    console.log(`Mod ${mod}: ${uniqueMod.size} unique values`);
  }
}

// The string table might be accessed differently
// Let's look at the actual M2OpVfE return function
console.log('\n\n=== M2OpVfE Return Analysis ===');
// The function returns P(a) where P is: function(a){return Q[a]}
// Q is the XORed and split string
// But there's also shuffling with u40 and e2f

// Let's try to understand the shuffling
// u40(Q,-10,10) might be: Q.slice(-10).concat(Q.slice(0, Q.length-10))
// Then u40(result, 0, 8) might be: result.slice(0, 8)

// Actually, looking more carefully at the code:
// case 5: u6JBF.e2f(u6JBF.F0b(),Q,u6JBF.u40(u6JBF.u40(Q,-4,4),0,2))
// This is called when k=0 and a=330

// Let's try to figure out the mapping
console.log('\n\n=== Trying to map indices to strings ===');

// The shuffling might be based on the index value
// Let's see if simple modulo works
const testIndices = [330, 352, 150, 190, 228, 297, 249, 32, 270, 176];
console.log('Test indices and their mod values:');
testIndices.forEach(idx => {
  console.log(`  ${idx} % ${parts.length} = ${idx % parts.length} -> "${parts[idx % parts.length]?.substring(0, 30) || 'N/A'}"`);
});
