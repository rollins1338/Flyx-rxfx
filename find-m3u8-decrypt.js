// Find m3u8 decryption logic in playerjs
const fs = require('fs');

const content = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('=== Searching for M3U8 Decryption Logic ===\n');

// Search for key-related patterns
const patterns = [
  { name: 'EXT-X-KEY', regex: /EXT-X-KEY/gi },
  { name: 'decrypt', regex: /decrypt/gi },
  { name: 'AES-128', regex: /AES-128/gi },
  { name: 'keyUri or key URL', regex: /keyUri|keyUrl|key.*uri/gi },
  { name: 'createDecipheriv', regex: /createDecipheriv/gi },
  { name: 'CryptoJS', regex: /CryptoJS/gi },
  { name: 'crypto.subtle', regex: /crypto\.subtle/gi },
  { name: 'AES.decrypt', regex: /AES\.decrypt/gi },
];

patterns.forEach(({ name, regex }) => {
  const matches = content.match(regex);
  if (matches) {
    console.log(`✓ Found "${name}": ${matches.length} occurrences`);
    
    // Get context around first match
    const firstIndex = content.search(regex);
    if (firstIndex > -1) {
      const start = Math.max(0, firstIndex - 200);
      const end = Math.min(content.length, firstIndex + 300);
      console.log(`  Context: ...${content.substring(start, end)}...\n`);
    }
  } else {
    console.log(`✗ No matches for "${name}"`);
  }
});

// Look for HLS.js library (common for m3u8 playback)
console.log('\n=== Checking for HLS.js ===');
if (content.includes('Hls.js') || content.includes('hls.js')) {
  console.log('✓ Found HLS.js references');
} else {
  console.log('✗ No HLS.js found');
}

// Check file structure
console.log('\n=== File Info ===');
console.log(`Total size: ${content.length} bytes`);
console.log(`First 200 chars: ${content.substring(0, 200)}`);

// Check if it's obfuscated
if (content.startsWith('eval(function(p,a,c,k,e,d)')) {
  console.log('\n⚠️  File is obfuscated with eval packer');
  console.log('Need to unpack first...');
} else if (content.includes('!function') && content.length > 100000) {
  console.log('\n⚠️  File appears to be minified/bundled');
}
