const fs = require('fs');

console.log('\n🔍 EXTRACTING RC4 DECODER FROM OBFUSCATED CODE\n');

const decoder = fs.readFileSync('prorcp-decoder-script.js', 'utf8');

// The RC4 implementation is in the pattern we found
// Let's extract the actual RC4 function

// Search for the RC4 characteristic pattern
const rc4Pattern = /const\s+_0x[a-f0-9]+\s*=\s*function\([^)]+\)\{[^}]*charCodeAt[^}]*%[^}]*\^[^}]*\}/s;

// Better approach: find the function that does the decoding
// Look for the pattern: charCodeAt, array manipulation, XOR

// Extract a large chunk around the RC4 code
const rc4Index = decoder.search(/charCodeAt.*%.*charCodeAt.*\^/);
if (rc4Index > 0) {
  console.log('✅ Found RC4 pattern at index:', rc4Index);
  
  // Get 5000 chars around it
  const context = decoder.substring(Math.max(0, rc4Index - 2000), rc4Index + 3000);
  
  fs.writeFileSync('rc4-context.txt', context);
  console.log('💾 Saved RC4 context to rc4-context.txt');
  
  // Now let's manually implement RC4 based on the pattern
  console.log('\n' + '='.repeat(80));
  console.log('IMPLEMENTING RC4 DECODER');
  console.log('='.repeat(80));
  
  const rc4Code = `
// RC4 Cipher Implementation (extracted from obfuscated code)
function rc4(data, key) {
  const S = [];
  const keyLength = key.length;
  let j = 0;
  
  // KSA (Key Scheduling Algorithm)
  for (let i = 0; i < 256; i++) {
    S[i] = i;
  }
  
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % keyLength)) % 256;
    [S[i], S[j]] = [S[j], S[i]]; // Swap
  }
  
  // PRGA (Pseudo-Random Generation Algorithm)
  let i = 0;
  j = 0;
  let result = '';
  
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]]; // Swap
    
    const K = S[(S[i] + S[j]) % 256];
    result += String.fromCharCode(data.charCodeAt(n) ^ K);
  }
  
  return result;
}

// Custom base64 decode (they might use a custom alphabet)
function customBase64Decode(input) {
  // Standard base64 alphabet
  const alphabet = 'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz0123456789+/=';
  
  let output = '';
  let chr1, chr2, chr3;
  let enc1, enc2, enc3, enc4;
  let i = 0;
  
  // Remove non-alphabet characters
  input = input.replace(/[^A-Za-z0-9\\+\\/\\=]/g, '');
  
  while (i < input.length) {
    enc1 = alphabet.indexOf(input.charAt(i++));
    enc2 = alphabet.indexOf(input.charAt(i++));
    enc3 = alphabet.indexOf(input.charAt(i++));
    enc4 = alphabet.indexOf(input.charAt(i++));
    
    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;
    
    output += String.fromCharCode(chr1);
    
    if (enc3 !== 64) {
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output += String.fromCharCode(chr3);
    }
  }
  
  return output;
}

module.exports = { rc4, customBase64Decode };
`;
  
  fs.writeFileSync('rc4-decoder.js', rc4Code);
  console.log('\n💾 Created rc4-decoder.js');
  
  console.log('\n✅ RC4 implementation complete!');
  console.log('\nNext: Test with actual div content');
}

// Now let's test with the actual div content from the page
console.log('\n' + '='.repeat(80));
console.log('TESTING WITH CAPTURED DATA');
console.log('='.repeat(80));

const captured = JSON.parse(fs.readFileSync('decoder-data-captured.json', 'utf8'));

console.log('\nDiv ID:', captured.divId);
console.log('Div Content:', captured.divContent ? 'CAPTURED' : 'NOT CAPTURED');

if (!captured.divContent) {
  console.log('\n⚠️  Div content not captured!');
  console.log('We need to run Puppeteer again to capture the div innerHTML');
  console.log('\nThe div content is the KEY to decoding!');
}

// Check the atob calls
console.log('\n' + '='.repeat(80));
console.log('ANALYZING ATOB CALLS');
console.log('='.repeat(80));

if (captured.atobCalls && captured.atobCalls.length > 0) {
  console.log(`\nFound ${captured.atobCalls.length} atob calls`);
  
  captured.atobCalls.forEach((call, i) => {
    console.log(`\nCall ${i + 1}:`);
    console.log(`  Input length: ${call.inputLength}`);
    console.log(`  Output length: ${call.outputLength}`);
    console.log(`  Input sample: ${call.inputSample.substring(0, 80)}`);
    console.log(`  Output sample: ${call.outputSample.substring(0, 80)}`);
  });
  
  // The first call is likely the div content being decoded
  if (captured.atobCalls[0].inputLength > 1000) {
    console.log('\n✅ First atob call is likely the div content!');
    console.log('This is base64 encoded data that needs to be decoded');
  }
}

console.log('\n✅ Analysis complete!');
console.log('\nNEXT STEPS:');
console.log('1. Capture the actual div innerHTML (the 5028 char base64 string)');
console.log('2. Decode it with atob');
console.log('3. Apply RC4 decryption with the correct key');
console.log('4. Result should be the M3U8 URL');
