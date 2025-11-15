const fs = require('fs');

const obfuscated = fs.readFileSync('obfuscated-decoder.js', 'utf8');

console.log('🔍 Extracting decoder functions...\n');

// Find the GTAxQyTyBx function
const gtaxMatch = obfuscated.match(/function GTAxQyTyBx\([^)]*\)\{[^}]+\{[^}]+\}[^}]+\}/);
if (gtaxMatch) {
    console.log('Found GTAxQyTyBx function:\n');
    console.log(gtaxMatch[0]);
    console.log('\n');
}

// Find the bMGyx71TzQLfdonN function  
const bmgMatch = obfuscated.match(/function bMGyx71TzQLfdonN\([^)]*\)\{[^}]+\}/);
if (bmgMatch) {
    console.log('Found bMGyx71TzQLfdonN function:\n');
    console.log(bmgMatch[0]);
    console.log('\n');
}

// Find the actual decoder call
const decoderCallMatch = obfuscated.match(/window\[bMGyx71TzQLfdonN[^\;]+\;/);
if (decoderCallMatch) {
    console.log('Found decoder call:\n');
    console.log(decoderCallMatch[0]);
    console.log('\n');
}

// Try to find what bMGyx71TzQLfdonN("GTAxQyTyBx") returns
// It's likely a simple string reversal or base64 decode
console.log('Testing bMGyx71TzQLfdonN("GTAxQyTyBx"):\n');

// Common transformations
const input = "GTAxQyTyBx";
console.log(`Input: ${input}`);
console.log(`Reversed: ${input.split('').reverse().join('')}`);
console.log(`Base64 decoded: ${Buffer.from(input, 'base64').toString('utf8').substring(0, 50)}`);

// Try ROT13
const rot13 = input.replace(/[a-zA-Z]/g, c => 
    String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26)
);
console.log(`ROT13: ${rot13}`);

console.log('\n✅ Done\n');
