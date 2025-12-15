/**
 * Test 111movies encoding with AES-128 (truncated key)
 */

const crypto = require('crypto');

// Static API hash
const API_HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';

// Encryption keys - use first 16 bytes for AES-128
const FULL_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_KEY = FULL_KEY.slice(0, 16); // Truncate to 16 bytes for AES-128
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

// Alphabets
const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

const CHAR_MAP = new Map();
for (let i = 0; i < STANDARD_ALPHABET.length; i++) {
  CHAR_MAP.set(STANDARD_ALPHABET[i], SHUFFLED_ALPHABET[i]);
}

function encodePageData(pageData) {
  console.log('Input:', pageData.substring(0, 50) + '...');
  
  // Step 1: AES-128-CBC encrypt
  const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY, AES_IV);
  let encrypted = cipher.update(pageData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  console.log('After AES-128 (hex):', encrypted.substring(0, 50) + '... (len:', encrypted.length, ')');
  
  // Step 2: XOR with key
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  console.log('After XOR (hex):', Buffer.from(xored, 'binary').toString('hex').substring(0, 50) + '... (len:', xored.length, ')');
  
  // Step 3: Convert to URL-safe base64
  const base64 = Buffer.from(xored, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  console.log('After base64:', base64.substring(0, 50) + '... (len:', base64.length, ')');
  
  // Step 4: Character substitution
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  console.log('After substitution:', result.substring(0, 50) + '... (len:', result.length, ')');
  
  return result;
}

async function testEncoding() {
  console.log('=== TESTING 111MOVIES ENCODING V4 (AES-128) ===\n');
  
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await pageRes.text();
  
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  
  console.log('Page data:', pageData);
  console.log('Page data length:', pageData.length);
  
  console.log('\n=== ENCODING ===');
  const encoded = encodePageData(pageData);
  
  const apiUrl = `https://111movies.com/${API_HASH}/${encoded}/sr`;
  
  console.log('\n=== TESTING API ===');
  try {
    const apiRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://111movies.com/movie/155',
        'Origin': 'https://111movies.com'
      }
    });
    
    console.log('Status:', apiRes.status);
    const text = await apiRes.text();
    console.log('Response:', text.substring(0, 300));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testEncoding().catch(console.error);
