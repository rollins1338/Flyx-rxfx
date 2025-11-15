const fs = require('fs');

const encoded = fs.readFileSync('encoded-full.txt', 'utf8').trim();

console.log('Testing g/colon format...');
console.log('Length:', encoded.length);
console.log('First 100:', encoded.substring(0, 100));

// Replace g with 8 and : with /
const replaced = encoded.replace(/g/g, '8').replace(/:/g, '/');

console.log('\nAfter replacement:');
console.log('First 100:', replaced.substring(0, 100));

if (replaced.includes('http')) {
  console.log('\n✓✓✓ Found HTTP directly!');
  const m3u8Match = replaced.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
  if (m3u8Match) {
    console.log('\nM3U8 URL:');
    console.log(m3u8Match[0]);
    
    if (m3u8Match[0].includes('{v') || m3u8Match[0].includes('{s')) {
      const cdnMappings = {
        '{v1}': 'shadowlandschronicles.com',
        '{v2}': 'shadowlandschronicles.net',
        '{v3}': 'shadowlandschronicles.io',
        '{v4}': 'shadowlandschronicles.org',
        '{s1}': 'com',
        '{s2}': 'net',
        '{s3}': 'io',
        '{s4}': 'org'
      };
      
      let resolved = m3u8Match[0];
      for (const [placeholder, replacement] of Object.entries(cdnMappings)) {
        resolved = resolved.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
      }
      
      console.log('\n✓✓✓ FINAL M3U8 URL:');
      console.log(resolved);
    }
  }
}
