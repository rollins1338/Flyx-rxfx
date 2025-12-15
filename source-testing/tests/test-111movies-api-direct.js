/**
 * Test 111movies API with our encoding - fetch page data and immediately encode/call API
 */

const crypto = require('crypto');

const API_HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';

const AES_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

const CHAR_MAP = new Map();
for (let i = 0; i < STANDARD_ALPHABET.length; i++) {
  CHAR_MAP.set(STANDARD_ALPHABET[i], SHUFFLED_ALPHABET[i]);
}

function encodePageData(pageData) {
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  const encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  const utf8Bytes = Buffer.from(xored, 'utf8');
  
  const base64 = utf8Bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return result;
}

async function testAPI() {
  console.log('=== TESTING 111MOVIES API DIRECTLY ===\n');
  
  // Fetch page to get cookies and page data
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  // Get cookies from response
  const cookies = pageRes.headers.get('set-cookie');
  console.log('Cookies:', cookies?.substring(0, 100) || 'none');
  
  const html = await pageRes.text();
  
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  
  console.log('Page data:', pageData);
  console.log('Page data length:', pageData.length);
  
  // Encode
  const encoded = encodePageData(pageData);
  console.log('\nEncoded length:', encoded.length);
  console.log('Encoded:', encoded.substring(0, 100) + '...');
  
  // Call API
  const apiUrl = `https://111movies.com/${API_HASH}/${encoded}/sr`;
  console.log('\nAPI URL:', apiUrl.substring(0, 150) + '...');
  
  const apiRes = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://111movies.com/movie/155',
      'Origin': 'https://111movies.com',
      'Cookie': cookies || '',
    }
  });
  
  console.log('\nAPI Status:', apiRes.status);
  console.log('API Headers:', Object.fromEntries(apiRes.headers.entries()));
  
  const text = await apiRes.text();
  console.log('\nResponse:', text.substring(0, 500));
  
  if (apiRes.status === 200) {
    try {
      const json = JSON.parse(text);
      console.log('\n=== SUCCESS! ===');
      console.log('Sources:', JSON.stringify(json, null, 2));
    } catch (e) {}
  }
}

testAPI().catch(console.error);
