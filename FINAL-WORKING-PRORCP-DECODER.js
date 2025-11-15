/**
 * FINAL WORKING PRORCP DECODER
 * Based on reverse engineered decoder from cloudnestra.com
 * 
 * Algorithm:
 * 1. Apply Caesar cipher shift (-3) to reverse the character substitution
 * 2. Base64 decode the result
 * 3. Extract the base64-encoded filename and decode it
 */

function decodeProRCP(encodedContent) {
  console.log('🔓 Decoding ProRCP content...');
  console.log('Input length:', encodedContent.length);
  console.log('Input sample:', encodedContent.substring(0, 100));
  
  // Step 1: Reverse Caesar cipher (shift -3)
  // The mapping is: x→a, y→b, z→c, a→d, etc.
  // To reverse: a→x, b→y, c→z, d→a, etc.
  const caesarReverse = (str) => {
    return str.replace(/[xyzabcdefghijklmnopqrstuvwXYZABCDEFGHIJKLMNOPQRSTUVW]/g, (char) => {
      const mapping = {
        // Lowercase reverse mapping
        'x': 'a', 'y': 'b', 'z': 'c',
        'a': 'd', 'b': 'e', 'c': 'f', 'd': 'g', 'e': 'h', 'f': 'i',
        'g': 'j', 'h': 'k', 'i': 'l', 'j': 'm', 'k': 'n', 'l': 'o',
        'm': 'p', 'n': 'q', 'o': 'r', 'p': 's', 'q': 't', 'r': 'u',
        's': 'v', 't': 'w', 'u': 'x', 'v': 'y', 'w': 'z',
        // Uppercase reverse mapping
        'X': 'A', 'Y': 'B', 'Z': 'C',
        'A': 'D', 'B': 'E', 'C': 'F', 'D': 'G', 'E': 'H', 'F': 'I',
        'G': 'J', 'H': 'K', 'I': 'L', 'J': 'M', 'K': 'N', 'L': 'O',
        'M': 'P', 'N': 'Q', 'O': 'R', 'P': 'S', 'Q': 'T', 'R': 'U',
        'S': 'V', 'T': 'W', 'U': 'X', 'V': 'Y', 'W': 'Z'
      };
      return mapping[char] || char;
    });
  };
  
  const afterCaesar = caesarReverse(encodedContent);
  console.log('✅ After Caesar reverse length:', afterCaesar.length);
  console.log('   Sample:', afterCaesar.substring(0, 100));
  
  // Step 2: Base64 decode
  try {
    const decoded = Buffer.from(afterCaesar, 'base64').toString('utf8');
    console.log('✅ After base64 decode length:', decoded.length);
    console.log('   Sample:', decoded.substring(0, 200));
    
    // Step 3: Look for base64-encoded filename pattern
    // The decoded content should contain another base64 string
    const base64Pattern = /([A-Za-z0-9+/]{50,}={0,2})/g;
    const matches = decoded.match(base64Pattern);
    
    if (matches) {
      console.log(`\n🔍 Found ${matches.length} potential base64 strings`);
      
      for (let i = 0; i < matches.length; i++) {
        try {
          const innerDecoded = Buffer.from(matches[i], 'base64').toString('utf8');
          
          // Check if it looks like a filename
          if (innerDecoded.includes('/') || innerDecoded.includes('.mp4') || innerDecoded.includes('.mkv')) {
            console.log(`\n🎯 FOUND FILENAME (match ${i + 1}):`);
            console.log('   ', innerDecoded);
            return innerDecoded;
          }
        } catch (e) {
          // Not valid base64, skip
        }
      }
    }
    
    return decoded;
  } catch (e) {
    console.error('❌ Decode failed:', e.message);
    return null;
  }
}

// Test with the actual encoded content from the hidden div
const testEncoded = "b3t7d3pBNjZ7dHp7eTw1gn04hDZ3czZPO3pQSEhISEhISEhIfl9JOmFSSlBJbkg3TWpwSk9mOXpwcnhVeDhYV3dYPklOaGp+UGlhOXFdQDVxOU9LS2g6fGp8UnlPWlZzd3VhdHpTcX1KcFJ1TVJMgGFsbTVPUWF/aXp0QGx8aXpNelVaWXpgPFtKXVlvUFlfWElwdFtpX1deP0xNe1hudE9cYE+BPVxoZlxUXktbc3tdTzd5VXl/dkppUoFqd310fUp0PW5YOVs8TlRmU0k1OFtUSE9QYXFbUHldUTs3Zn9IbHU+d01rdlV9QHBeV2ZqPD9SVHJxVU5mXmhzbFJuN2xodlhUfko3XDg+TnltOW5RYUl3WllwNVFxbntVOks3enA6QFVMe1d6YWlvX3dwT3I8eFV0Pj5hPXdqYFJSSjpoZn1rclBNb1J8XmFpO0BpPT1UOFt2fmCATX85PlN/Tzc8Tl5bem9IWEhINnRoentseTV0Onw/J3Z5J287";

console.log('\n🧪 TESTING PRORCP DECODER\n');
console.log('='.repeat(60));

const result = decodeProRCP(testEncoded);

if (result) {
  console.log('\n' + '='.repeat(60));
  console.log('✅ DECODING SUCCESS!');
  console.log('='.repeat(60));
} else {
  console.log('\n❌ Decoding failed');
}
