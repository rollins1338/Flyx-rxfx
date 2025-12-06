/**
 * Step 8: Trace and implement the decoder
 * 
 * Key observations:
 * 1. V2AsvL() returns a URL-encoded string
 * 2. M2OpVfE decodes it using XOR with a key
 * 3. The key is derived from "C%7CB%" (which is "C|B%")
 * 4. Q8Q() returns charCodeAt function
 * 5. The XOR: Q+=t(s(r)^w(c)) where s is bound to b (the key), w is bound to a (the input)
 */

const fs = require('fs');

console.log('=== Step 8: Implementing the Decoder ===\n');

// The V2AsvL string (URL decoded)
const v2asvlEncoded = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');
console.log('Input string length:', v2asvlEncoded.length);

// The key appears to be derived from "C%7CB%" which URL-decodes to "C|B%"
// But there's more - it goes through t([17,64,75,32,15,76])
// t() function: P[t]=s(a[t]+36) - adds 36 to each number and converts to char
// [17,64,75,32,15,76] + 36 = [53,100,111,68,51,112] = "5doDp" (wait, let me check)

const keyArray = [17, 64, 75, 32, 15, 76];
const keyChars = keyArray.map(n => String.fromCharCode(n + 36));
console.log('Key array + 36:', keyChars.join(''));
// This gives us: 5doDp (53='5', 100='d', 111='o', 68='D', 51='3', 112='p')
// Actually: 17+36=53='5', 64+36=100='d', 75+36=111='o', 32+36=68='D', 15+36=51='3', 76+36=112='p'
console.log('Key derived: "5doD3p"');

// But wait, the key goes through more processing
// It's shuffled by Q4k with a random function, then joined
// Let's try a simpler approach - the XOR key might be simpler

// Looking at the code: b=u6JBF.V4a()(t([17,64,75,32,15,76])())
// V4a() is likely decodeURIComponent
// So the key is decodeURIComponent("5doD3p") = "5doD3p" (no change)

// But then there's also "C%7CB%" which decodes to "C|B%"
// This is passed to M2OpVfE as the parameter 'a'

// Let me try XOR decoding with different keys
function xorDecode(input, key) {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const inputChar = input.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(inputChar ^ keyChar);
  }
  return result;
}

// Try with "5doD3p" as key
const key1 = "5doD3p";
const decoded1 = xorDecode(v2asvlEncoded, key1);
console.log('\n=== XOR with "5doD3p" ===');
console.log('First 200 chars:', decoded1.substring(0, 200));

// Try with "C|B%" as key
const key2 = "C|B%";
const decoded2 = xorDecode(v2asvlEncoded, key2);
console.log('\n=== XOR with "C|B%" ===');
console.log('First 200 chars:', decoded2.substring(0, 200));

// The actual key might be the result of XORing the two
// Or it might be something else entirely

// Let's look at the actual algorithm more carefully
// case 14: Q+=t(s(r)^w(c))
// s is bound to b (the key string)
// w is bound to a (the input "C|B%")
// t is String.fromCharCode (H4q)

// So it's: result += fromCharCode(key.charCodeAt(r) ^ input.charCodeAt(c))
// where r and c both increment, but c resets when it reaches input.length

// Wait, looking again:
// case 8: e=r<b.length?7:12 - loop while r < key.length
// case 7: e=c===a.length?6:14 - if c === input.length, go to case 6
// case 6: c=0 - reset c
// case 14: Q+=t(s(r)^w(c)) - XOR and append
// case 13: r++,c++ - increment both

// So the key is the longer string (b), and the input (a="C|B%") is the shorter one that cycles

// Let me re-read: b is from t([17,64,75,32,15,76])() which is the decoded V2AsvL string!
// And a is "C|B%" which is the XOR key!

console.log('\n=== Corrected: XOR V2AsvL with "C|B%" cycling ===');
const xorKey = "C|B%";
let decoded3 = '';
for (let i = 0; i < v2asvlEncoded.length; i++) {
  const inputChar = v2asvlEncoded.charCodeAt(i);
  const keyChar = xorKey.charCodeAt(i % xorKey.length);
  decoded3 += String.fromCharCode(inputChar ^ keyChar);
}
console.log('First 500 chars:', decoded3.substring(0, 500));

// Check if it looks like valid strings
const hasReadableStrings = decoded3.match(/[a-zA-Z]{4,}/g);
if (hasReadableStrings) {
  console.log('\nReadable strings found:', hasReadableStrings.slice(0, 20).join(', '));
}

// Save the result
fs.writeFileSync('rapidshare-decoded-strings.txt', decoded3);
console.log('\nSaved to rapidshare-decoded-strings.txt');

// Let's also try to find the actual string table
console.log('\n=== Looking for string patterns ===');
// The decoded string might be split by a delimiter
const delimiters = ['`', '|', '\x00', '\n', '\t'];
for (const delim of delimiters) {
  const parts = decoded3.split(delim);
  if (parts.length > 10 && parts.length < 1000) {
    console.log(`Split by '${delim.replace(/\x00/g, '\\x00')}': ${parts.length} parts`);
    console.log('First 10 parts:', parts.slice(0, 10).map(p => `"${p.substring(0, 30)}"`).join(', '));
  }
}
