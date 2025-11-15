/**
 * DECODE THE RCP HASH PARTS
 * The hash has format: MD5:BASE64
 * Let's decode the BASE64 part
 */

const fs = require('fs');

const fullHash = fs.readFileSync('rcp-hash-decoded.txt', 'utf8').trim();

console.log('🔍 Decoding RCP hash parts...\n');

// Split by colon
const parts = fullHash.split(':');
console.log(`Part 1 (MD5): ${parts[0]}`);
console.log(`Part 2 (Base64) length: ${parts[1].length}\n`);

// Decode the second part (base64)
try {
  const decoded = Buffer.from(parts[1], 'base64').toString('utf8');
  console.log('✅ Decoded Part 2:');
  console.log(decoded);
  console.log(`\nLength: ${decoded.length} characters`);
  
  fs.writeFileSync('rcp-hash-part2-decoded.txt', decoded);
  console.log('\n💾 Saved to rcp-hash-part2-decoded.txt');
  
  // Check if it looks like a URL
  if (decoded.includes('http') || decoded.includes('.m3u8')) {
    console.log('\n🎯 FOUND M3U8 URL!');
  }
  
  // Check if it's another encoded format
  if (decoded.match(/^[A-Za-z0-9+/=]+$/)) {
    console.log('\n🔍 Looks like another base64 string, trying to decode again...');
    try {
      const decoded2 = Buffer.from(decoded, 'base64').toString('utf8');
      console.log('✅ Double-decoded:');
      console.log(decoded2);
      fs.writeFileSync('rcp-hash-part2-double-decoded.txt', decoded2);
    } catch (e) {
      console.log('❌ Failed to double-decode');
    }
  }
  
} catch (e) {
  console.log('❌ Failed to decode:', e.message);
}
