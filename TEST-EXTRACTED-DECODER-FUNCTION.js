/**
 * TEST THE EXTRACTED DECODER FUNCTION
 * Extract the GuxKGDsA2T function and test it with our div content
 */

const fs = require('fs');

// Read the div content
const divContent = fs.readFileSync('hidden-div-content.txt', 'utf8');
const divId = fs.readFileSync('hidden-div-id.txt', 'utf8').trim();

console.log('🔥 TESTING EXTRACTED DECODER FUNCTION\n');
console.log('Div ID:', divId);
console.log('Content length:', divContent.length);

// The decoder uses these transformations based on the script analysis:
// 1. Reverse the string
// 2. Replace certain characters
// 3. Base64 decode
// 4. Apply some transformation

// Let's try the pattern from the script
function testDecoder(encoded) {
  console.log('\n📝 Testing decoder pattern...');
  
  // Pattern 1: Reverse + base64
  try {
    const reversed = encoded.split('').reverse().join('');
    const decoded = Buffer.from(reversed, 'base64').toString('utf8');
    console.log('Pattern 1 (Reverse + Base64):');
    console.log('  Length:', decoded.length);
    console.log('  Preview:', decoded.substring(0, 100));
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log('  🎯 CONTAINS URL!');
      console.log('  Full:', decoded);
      return decoded;
    }
  } catch (e) {
    console.log('Pattern 1 failed:', e.message);
  }
  
  // Pattern 2: Character substitution then reverse
  try {
    // The script shows character mapping like x->a, y->b, etc.
    const charMap = {
      'x': 'a', 'y': 'b', 'z': 'c', 'a': 'd', 'b': 'e', 'c': 'f',
      'd': 'g', 'e': 'h', 'f': 'i', 'g': 'j', 'h': 'k', 'i': 'l',
      'j': 'm', 'k': 'n', 'l': 'o', 'm': 'p', 'n': 'q', 'o': 'r',
      'p': 's', 'q': 't', 'r': 'u', 's': 'v', 't': 'w', 'u': 'x',
      'v': 'y', 'w': 'z',
      'X': 'A', 'Y': 'B', 'Z': 'C', 'A': 'D', 'B': 'E', 'C': 'F',
      'D': 'G', 'E': 'H', 'F': 'I', 'G': 'J', 'H': 'K', 'I': 'L',
      'J': 'M', 'K': 'N', 'L': 'O', 'M': 'P', 'N': 'Q', 'O': 'R',
      'P': 'S', 'Q': 'T', 'R': 'U', 'S': 'V', 'T': 'W', 'U': 'X',
      'V': 'Y', 'W': 'Z'
    };
    
    const substituted = encoded.replace(/[xyzabcdefghijklmnopqrstuvwXYZABCDEFGHIJKLMNOPQRSTUVW]/g, 
      char => charMap[char] || char);
    const reversed = substituted.split('').reverse().join('');
    const decoded = Buffer.from(reversed, 'base64').toString('utf8');
    
    console.log('\nPattern 2 (Substitute + Reverse + Base64):');
    console.log('  Length:', decoded.length);
    console.log('  Preview:', decoded.substring(0, 100));
    if (decoded.includes('http') || decoded.includes('.m3u8')) {
      console.log('  🎯 CONTAINS URL!');
      console.log('  Full:', decoded);
      return decoded;
    }
  } catch (e) {
    console.log('Pattern 2 failed:', e.message);
  }
  
  return null;
}

const result = testDecoder(divContent);

if (result) {
  console.log('\n✅ ✅ ✅ SUCCESS! ✅ ✅ ✅');
  fs.writeFileSync('DECODED-M3U8-URL.txt', result);
  console.log('💾 Saved to DECODED-M3U8-URL.txt');
} else {
  console.log('\n❌ Decoding failed');
}
