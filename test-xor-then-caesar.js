const fs = require('fs');

const encoded = fs.readFileSync('encoded-full.txt', 'utf8').trim();
const divId = 'TsA2KGDGux';

console.log('Testing URL-safe Base64 + XOR + Caesar...');

function tryUrlSafeBase64Xor(str, key) {
  try {
    let cleaned = str.replace(/^=+/, '');
    cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
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
    return null;
  }
}

function caesarShift(text, shift) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    return c;
  }).join('');
}

const xored = tryUrlSafeBase64Xor(encoded, divId);

if (xored) {
  console.log('✓ XOR decoded');
  
  // Try Caesar shifts
  for (let shift = -25; shift <= 25; shift++) {
    if (shift === 0) continue;
    
    const caesarResult = caesarShift(xored, shift);
    
    if (caesarResult.includes('http://') || caesarResult.includes('https://')) {
      console.log(`\n✓✓✓ SUCCESS with Caesar ${shift}!`);
      console.log('First 200 chars:', caesarResult.substring(0, 200));
      
      const m3u8Match = caesarResult.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
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
      }
      break;
    }
  }
  
  console.log('\nDone!');
} else {
  console.log('✗ XOR decode failed');
}
