/**
 * Test 111movies encoding algorithm v3
 * 
 * Now with the correct static hash!
 */

const crypto = require('crypto');

// Static API hash (confirmed static across multiple movies)
const API_HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';

// Encryption keys from 860-58807119fccb267b.js
const AES_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

// Alphabets
const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

// Build substitution map (h -> m)
const CHAR_MAP = new Map();
for (let i = 0; i < STANDARD_ALPHABET.length; i++) {
  CHAR_MAP.set(STANDARD_ALPHABET[i], SHUFFLED_ALPHABET[i]);
}

/**
 * Encode page data for API call
 */
function encodePageData(pageData) {
  // Step 1: AES-256-CBC encrypt
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  let encrypted = cipher.update(pageData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Step 2: XOR with key
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  // Step 3: Convert to URL-safe base64
  const base64 = Buffer.from(xored, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Step 4: Character substitution (h -> m)
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return result;
}

/**
 * Fetch page data and test encoding
 */
async function testEncoding() {
  console.log('=== TESTING 111MOVIES ENCODING V3 ===\n');
  
  // Fetch page data
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await pageRes.text();
  
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageProps = nextData.props?.pageProps || {};
  
  console.log('Page data:', pageProps.data);
  console.log('Page data length:', pageProps.data.length);
  
  // Encode the page data
  console.log('\n=== ENCODING ===');
  const encoded = encodePageData(pageProps.data);
  console.log('Encoded length:', encoded.length);
  console.log('Encoded:', encoded.substring(0, 100) + '...');
  
  // Build API URL with static hash
  const apiUrl = `https://111movies.com/${API_HASH}/${encoded}/sr`;
  
  console.log('\n=== API URL ===');
  console.log('URL length:', apiUrl.length);
  
  // Test the API
  console.log('\n=== TESTING API ===');
  try {
    const apiRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://111movies.com/movie/155',
        'Origin': 'https://111movies.com',
        'Content-Type': 'application/octet-stream',
        'Accept': '*/*'
      }
    });
    
    console.log('Status:', apiRes.status);
    const text = await apiRes.text();
    console.log('Response:', text.substring(0, 500));
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(text);
      console.log('\n=== PARSED RESPONSE ===');
      console.log(JSON.stringify(json, null, 2).substring(0, 1000));
    } catch (e) {}
    
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testEncoding().catch(console.error);
