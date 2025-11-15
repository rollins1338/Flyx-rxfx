// Test reverse base64 decoding on the real data
const divId = 'JoAHUMCLXV';
const encoded = '=sDe2AXM3ZHbvJDRERERRlWe1lzdiV0eTJWR8RXUpJWSqlUR64';

console.log('='.repeat(70));
console.log('🔓 TESTING REVERSE BASE64 DECODE');
console.log('='.repeat(70));

console.log(`\nDiv ID: ${divId}`);
console.log(`Encoded (first 100): ${encoded.substring(0, 100)}`);
console.log(`Length: ${encoded.length}`);

// Method 1: Reverse the string then base64 decode
console.log(`\n[1] Reverse + Base64 Decode:`);
try {
  const reversed = encoded.split('').reverse().join('');
  console.log(`   Reversed (first 100): ${reversed.substring(0, 100)}`);
  
  const decoded = Buffer.from(reversed, 'base64').toString('utf8');
  console.log(`   Decoded length: ${decoded.length}`);
  console.log(`   Decoded (first 200): ${decoded.substring(0, 200)}`);
  
  if (decoded.includes('http')) {
    console.log(`\n   ✅ FOUND HTTP URL!`);
    console.log(`   Full URL: ${decoded}`);
  } else {
    console.log(`\n   ❌ No HTTP URL found`);
    console.log(`   Trying XOR with divId...`);
    
    // Try XOR with divId
    const xored = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      xored[i] = decoded.charCodeAt(i) ^ divId.charCodeAt(i % divId.length);
    }
    
    const xorResult = xored.toString('utf8');
    console.log(`   XOR result (first 200): ${xorResult.substring(0, 200)}`);
    
    if (xorResult.includes('http')) {
      console.log(`\n   ✅ FOUND HTTP URL WITH XOR!`);
      console.log(`   Full URL: ${xorResult}`);
    }
  }
} catch (e) {
  console.log(`   ❌ Error: ${e.message}`);
}

// Method 2: Base64 decode then reverse
console.log(`\n[2] Base64 Decode + Reverse:`);
try {
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const reversed = decoded.split('').reverse().join('');
  
  console.log(`   Decoded then reversed (first 200): ${reversed.substring(0, 200)}`);
  
  if (reversed.includes('http')) {
    console.log(`\n   ✅ FOUND HTTP URL!`);
    console.log(`   Full URL: ${reversed}`);
  }
} catch (e) {
  console.log(`   ❌ Error: ${e.message}`);
}

// Method 3: Remove leading = then reverse and decode
console.log(`\n[3] Remove '=' + Reverse + Base64:`);
try {
  const cleaned = encoded.replace(/^=+/, '');
  const reversed = cleaned.split('').reverse().join('');
  const decoded = Buffer.from(reversed, 'base64').toString('utf8');
  
  console.log(`   Result (first 200): ${decoded.substring(0, 200)}`);
  
  if (decoded.includes('http')) {
    console.log(`\n   ✅ FOUND HTTP URL!`);
    console.log(`   Full URL: ${decoded}`);
  }
} catch (e) {
  console.log(`   ❌ Error: ${e.message}`);
}

console.log(`\n${'='.repeat(70)}`);
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(70));
