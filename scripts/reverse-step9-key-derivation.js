/**
 * Step 9: Properly derive the XOR key
 * 
 * Looking at the code again:
 * - t([17,64,75,32,15,76]) creates a function that returns the decoded V2AsvL string
 * - The result is passed to V4a() which is decodeURIComponent
 * - Then it's called as a function: ()
 * 
 * Wait, let me re-read the code:
 * b=u6JBF.V4a()(t([17,64,75,32,15,76])())
 * 
 * t([17,64,75,32,15,76]) returns a function that looks up a property on u6JBF
 * The property name is derived from [17,64,75,32,15,76] + 36 = "5doD3p"
 * But then it's shuffled...
 * 
 * Actually, looking at t():
 * P[t]=s(a[t]+36) - converts each number to char
 * Then Q4k shuffles it
 * Then D3I joins it
 * Then n[e] looks up that property on u6JBF
 * 
 * So the property name is a shuffled version of "5doD3p"
 * And that property returns the V2AsvL string!
 * 
 * So b = decodeURIComponent(V2AsvL())
 * And a = "C|B%" (from "C%7CB%")
 * 
 * The XOR is: key.charCodeAt(r) ^ input.charCodeAt(c)
 * where key = decoded V2AsvL, input = "C|B%"
 */

const fs = require('fs');

console.log('=== Step 9: Correct Key Derivation ===\n');

// The V2AsvL string (URL decoded)
const v2asvlDecoded = fs.readFileSync('rapidshare-v2asvl-decoded.txt', 'utf8');
console.log('V2AsvL decoded length:', v2asvlDecoded.length);

// The XOR key is "C|B%" (from "C%7CB%")
// %7C is | so "C%7CB%" = "C|B%"
const xorKey = "C|B%";
console.log('XOR key:', xorKey, '(length:', xorKey.length + ')');

// Now XOR: result = V2AsvL[i] ^ key[i % key.length]
let decoded = '';
for (let i = 0; i < v2asvlDecoded.length; i++) {
  const v2char = v2asvlDecoded.charCodeAt(i);
  const keyChar = xorKey.charCodeAt(i % xorKey.length);
  decoded += String.fromCharCode(v2char ^ keyChar);
}

console.log('\n=== Decoded Result ===');
console.log('Length:', decoded.length);
console.log('First 1000 chars:');
console.log(decoded.substring(0, 1000));

// Check for readable content
const words = decoded.match(/[a-zA-Z]{3,}/g);
if (words) {
  console.log('\n\nWords found:', words.length);
  console.log('Sample words:', [...new Set(words)].slice(0, 50).join(', '));
}

// The result should be split by backtick (`) based on: Q=u6JBF.T3P(Q,"`")
// T3P likely splits by backtick
console.log('\n\n=== Split by backtick ===');
const parts = decoded.split('`');
console.log('Parts count:', parts.length);
console.log('\nFirst 30 parts:');
parts.slice(0, 30).forEach((p, i) => {
  console.log(`  [${i}]: "${p.substring(0, 60)}${p.length > 60 ? '...' : ''}"`);
});

// Save the decoded string table
fs.writeFileSync('rapidshare-string-table.txt', parts.join('\n'));
console.log('\nSaved string table to rapidshare-string-table.txt');

// Look for interesting strings
console.log('\n\n=== Interesting Strings ===');
const interesting = parts.filter(p => 
  p.includes('http') || p.includes('url') || p.includes('file') || 
  p.includes('source') || p.includes('stream') || p.includes('video') ||
  p.includes('play') || p.includes('api') || p.includes('key') ||
  p.includes('setup') || p.includes('jwplayer') || p.includes('hls') ||
  p.includes('.m3u8') || p.includes('.mp4')
);
console.log('Interesting strings found:', interesting.length);
interesting.forEach(s => console.log('  ', s));
