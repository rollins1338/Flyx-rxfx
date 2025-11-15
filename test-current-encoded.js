const fs = require('fs');

const encoded = fs.readFileSync('encoded-full.txt', 'utf8').trim();
const divId = 'TsA2KGDGux';

console.log('Testing current encoded data...');
console.log('Div ID:', divId);
console.log('Encoded length:', encoded.length);
console.log('First 50:', encoded.substring(0, 50));

function tryUrlSafeBase64Xor(str, key) {
  try {
    // Remove leading = signs
    let cleaned = str.replace(/^=+/, '');
    
    // Replace URL-safe characters with standard Base64
    cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (cleaned.length % 4 !== 0) {
      cleaned += '=';
    }
    
    const base64Decoded = Buffer.from(cleaned, 'base64');
    const keyBytes = Buffer.from(key, 'utf8');
    const xored = Buffer.alloc(base64Decoded.length);
    
    for (let i = 0; i < base64Decoded.length; i++) {
      xored[i] = base64Decoded[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return xored.toString('utf8');
  } catch (err) {
    console.error('Error:', err.message);
    return null;
  }
}

const result = tryUrlSafeBase64Xor(encoded, divId);

if (result) {
  console.log('\n✓ Decoded!');
  console.log('Length:', result.length);
  console.log('First 200 chars:', result.substring(0, 200));
  
  if (result.includes('http')) {
    console.log('\n✓✓ Found HTTP!');
    
    const m3u8Match = result.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (m3u8Match) {
      console.log('\n✓✓✓ M3U8 URL:');
      console.log(m3u8Match[0]);
      
      // Check for placeholders
      if (m3u8Match[0].includes('{v') || m3u8Match[0].includes('{s')) {
        console.log('\nResolving placeholders...');
        
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
  } else {
    console.log('\n✗ No HTTP found');
    console.log('Checking for non-printable chars...');
    const nonPrintable = result.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g);
    if (nonPrintable) {
      console.log(`Found ${nonPrintable.length} non-printable chars out of ${result.length} total`);
      console.log(`Percentage: ${(nonPrintable.length / result.length * 100).toFixed(2)}%`);
    }
  }
} else {
  console.log('\n✗ Decode failed');
}
