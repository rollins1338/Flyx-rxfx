const fs = require('fs');

// Read the obfuscated decoder
const script = fs.readFileSync('decoder-external.js', 'utf8');

console.log('📦 Analyzing decoder script...');
console.log('Length:', script.length);

// Extract the character mapping we found
console.log('\n🔍 Character Mapping Found:');
console.log('x→a, y→b, z→c, a→d, b→e, c→f, d→g, e→h, f→i, g→j, h→k, i→l, j→m, k→n, l→o, m→p, n→q, o→r, p→s, q→t, r→u, s→v, t→w, u→x, v→y, w→z');
console.log('X→A, Y→B, Z→C, A→D, B→E, C→F, D→G, E→H, F→I, G→J, H→K, I→L, J→M, K→N, L→O, M→P, N→Q, O→R, P→S, Q→T, R→U, S→V, T→W, U→X, V→Y, W→Z');

// This is a Caesar cipher with shift of 3
// To decode: reverse the mapping

const reverseMapping = {
  // Lowercase
  'a': 'x', 'b': 'y', 'c': 'z',
  'd': 'a', 'e': 'b', 'f': 'c', 'g': 'd', 'h': 'e', 'i': 'f',
  'j': 'g', 'k': 'h', 'l': 'i', 'm': 'j', 'n': 'k', 'o': 'l',
  'p': 'm', 'q': 'n', 'r': 'o', 's': 'p', 't': 'q', 'u': 'r',
  'v': 's', 'w': 't', 'x': 'u', 'y': 'v', 'z': 'w',
  // Uppercase
  'A': 'X', 'B': 'Y', 'C': 'Z',
  'D': 'A', 'E': 'B', 'F': 'C', 'G': 'D', 'H': 'E', 'I': 'F',
  'J': 'G', 'K': 'H', 'L': 'I', 'M': 'J', 'N': 'K', 'O': 'L',
  'P': 'M', 'Q': 'N', 'R': 'O', 'S': 'P', 'T': 'Q', 'U': 'R',
  'V': 'S', 'W': 'T', 'X': 'U', 'Y': 'V', 'Z': 'W'
};

console.log('\n✅ Reverse mapping created');

// Now let's test with the actual encoded content from the intercepted data
const encodedContent = "b3t7d3pBNjZ7dHp7eTw1gn04hDZ3czZPO3pQSEhISEhISEhIfl9JOmFSSlBJbkg3TWpwSk9mOXpwcnhVeDhYV3dYPklOaGp+UGlhOXFdQDVxOU9LS2g6fGp8UnlPWlZzd3VhdHpTcX1KcFJ1TVJMgGFsbTVPUWF/aXp0QGx8aXpNelVaWXpgPFtKXVlvUFlfWElwdFtpX1deP0xNe1hudE9cYE+BPVxoZlxUXktbc3tdTzd5VXl/dkppUoFqd310fUp0PW5YOVs8TlRmU0k1OFtUSE9QYXFbUHldUTs3Zn9IbHU+d01rdlV9QHBeV2ZqPD9SVHJxVU5mXmhzbFJuN2xodlhUfko3XDg+TnltOW5RYUl3WllwNVFxbntVOks3enA6QFVMe1d6YWlvX3dwT3I8eFV0Pj5hPXdqYFJSSjpoZn1rclBNb1J8XmFpO0BpPT1UOFt2fmCATX85PlN/Tzc8Tl5bem9IWEhINnRoentseTV0Onw/J3Z5J287";

console.log('\n🧪 Testing decoder...');
console.log('Input:', encodedContent.substring(0, 100));

// Apply reverse Caesar cipher
let decoded = '';
for (let i = 0; i < encodedContent.length; i++) {
  const char = encodedContent[i];
  decoded += reverseMapping[char] || char;
}

console.log('\n✅ After reverse Caesar:');
console.log('   Length:', decoded.length);
console.log('   Sample:', decoded.substring(0, 100));

// Now base64 decode
try {
  const base64Decoded = Buffer.from(decoded, 'base64').toString('utf8');
  console.log('\n✅ After base64 decode:');
  console.log('   Length:', base64Decoded.length);
  console.log('   Content:', base64Decoded.substring(0, 500));
  
  // Look for another base64 string in the result
  const base64Pattern = /([A-Za-z0-9+/]{50,}={0,2})/g;
  const matches = base64Decoded.match(base64Pattern);
  
  if (matches) {
    console.log(`\n🔍 Found ${matches.length} potential base64 strings in decoded content`);
    
    for (let i = 0; i < Math.min(matches.length, 5); i++) {
      console.log(`\n   Testing match ${i + 1}:`);
      console.log('   ', matches[i].substring(0, 80));
      
      try {
        const innerDecoded = Buffer.from(matches[i], 'base64').toString('utf8');
        console.log('   Decoded to:', innerDecoded);
        
        if (innerDecoded.includes('/') || innerDecoded.includes('.m3u8') || innerDecoded.includes('.mp4')) {
          console.log('   🎯 THIS LOOKS LIKE A FILE PATH!');
        }
      } catch (e) {
        console.log('   ❌ Not valid base64');
      }
    }
  }
  
} catch (e) {
  console.error('\n❌ Base64 decode failed:', e.message);
}
