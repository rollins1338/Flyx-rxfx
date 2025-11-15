const fs = require('fs');

const encoded = fs.readFileSync('encoded-full.txt', 'utf8').trim();

console.log('Testing ASCII hex decode...');
console.log('First 100:', encoded.substring(0, 100));

// First replace g with 8 and : with nothing (or try different replacements)
const variants = [
  { name: 'g=8, :=/', data: encoded.replace(/g/g, '8').replace(/:/g, '/') },
  { name: 'g=8, :=0', data: encoded.replace(/g/g, '8').replace(/:/g, '0') },
  { name: 'g=8, remove :', data: encoded.replace(/g/g, '8').replace(/:/g, '') },
  { name: 'g=6, :=/', data: encoded.replace(/g/g, '6').replace(/:/g, '/') },
  { name: 'original', data: encoded },
];

for (const variant of variants) {
  console.log(`\n--- Trying ${variant.name} ---`);
  
  try {
    // Try hex decode
    const cleaned = variant.data.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length % 2 !== 0) {
      console.log('Odd length after cleaning, skipping');
      continue;
    }
    
    const decoded = Buffer.from(cleaned, 'hex').toString('utf8');
    
    if (decoded.includes('http')) {
      console.log('✓✓✓ Found HTTP!');
      console.log('First 200 chars:', decoded.substring(0, 200));
      
      const m3u8Match = decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
      if (m3u8Match) {
        console.log('\n✓✓✓ M3U8 URL:');
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
        break;
      }
    } else {
      console.log('No HTTP found');
      console.log('First 100 chars:', decoded.substring(0, 100));
    }
  } catch (err) {
    console.log('Error:', err.message);
  }
}
