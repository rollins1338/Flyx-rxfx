/**
 * Test 111movies encoding v6
 * 
 * Re-reading the JS code more carefully:
 * 
 * u = c.update(n._data, "utf8", "hex") + c.final("hex")
 * 
 * Then XOR loop on u (the hex string)
 * Then base64 encode the XORed result
 * Then character substitution
 * 
 * The issue might be that we're not getting the same encrypted output.
 * Let me try different approaches.
 */

const crypto = require('crypto');

const API_HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';

const FULL_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_KEY_128 = FULL_KEY.slice(0, 16);
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

const CHAR_MAP = new Map();
for (let i = 0; i < STANDARD_ALPHABET.length; i++) {
  CHAR_MAP.set(STANDARD_ALPHABET[i], SHUFFLED_ALPHABET[i]);
}

// Try different encoding approaches
function tryEncode(pageData, approach) {
  console.log(`\n=== APPROACH: ${approach} ===`);
  
  let encrypted;
  
  if (approach === 'utf8-aes128') {
    const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY_128, AES_IV);
    encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  } else if (approach === 'utf8-aes256') {
    const cipher = crypto.createCipheriv('aes-256-cbc', FULL_KEY, AES_IV);
    encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  } else if (approach === 'binary-aes128') {
    // Decode page data from base64 first
    const decoded = Buffer.from(pageData.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY_128, AES_IV);
    encrypted = cipher.update(decoded).toString('hex') + cipher.final('hex');
  } else if (approach === 'binary-aes256') {
    const decoded = Buffer.from(pageData.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const cipher = crypto.createCipheriv('aes-256-cbc', FULL_KEY, AES_IV);
    encrypted = cipher.update(decoded).toString('hex') + cipher.final('hex');
  }
  
  console.log('Encrypted hex length:', encrypted.length);
  console.log('Encrypted hex:', encrypted.substring(0, 50) + '...');
  
  // XOR
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  // Base64
  const base64 = Buffer.from(xored, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Substitution
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  console.log('Final length:', result.length);
  console.log('Final:', result.substring(0, 80) + '...');
  
  return result;
}

async function testAllApproaches() {
  console.log('=== TESTING ALL ENCODING APPROACHES ===');
  
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  
  console.log('Page data:', pageData);
  console.log('Page data length:', pageData.length);
  console.log('Expected browser encoded length: ~783');
  
  const approaches = ['utf8-aes128', 'utf8-aes256', 'binary-aes128', 'binary-aes256'];
  
  for (const approach of approaches) {
    const encoded = tryEncode(pageData, approach);
    
    // Test API
    const apiUrl = `https://111movies.com/${API_HASH}/${encoded}/sr`;
    try {
      const apiRes = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://111movies.com/movie/155'
        }
      });
      console.log('API Status:', apiRes.status);
      if (apiRes.status === 200) {
        const text = await apiRes.text();
        console.log('SUCCESS! Response:', text.substring(0, 200));
        break;
      }
    } catch (e) {
      console.log('API Error:', e.message);
    }
  }
}

testAllApproaches().catch(console.error);
