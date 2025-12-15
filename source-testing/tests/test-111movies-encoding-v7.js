/**
 * Test 111movies encoding v7 - with UTF-8 encoding
 * 
 * The correct flow:
 * 1. AES encrypt page data → hex string
 * 2. XOR each hex char with key → produces chars (some > 127)
 * 3. The XORed string is treated as UTF-8 (chars > 127 become multi-byte)
 * 4. Base64 encode the UTF-8 bytes
 * 5. Character substitution
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

function encodePageData(pageData) {
  // Step 1: AES-128-CBC encrypt
  const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY_128, AES_IV);
  const encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  console.log('Encrypted hex length:', encrypted.length);
  
  // Step 2: XOR each hex char
  // The result is a string where each char is charCode XOR xorKey
  // Some results will be > 127
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  console.log('XORed string length:', xored.length);
  
  // Step 3: Convert to UTF-8 bytes
  // In JavaScript, String.fromCharCode creates a UTF-16 string
  // When we convert to Buffer, chars > 127 become multi-byte UTF-8
  const utf8Bytes = Buffer.from(xored, 'utf8');
  console.log('UTF-8 bytes length:', utf8Bytes.length);
  
  // Step 4: Base64 encode
  const base64 = utf8Bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  console.log('Base64 length:', base64.length);
  
  // Step 5: Character substitution
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  console.log('Final length:', result.length);
  
  return result;
}

async function testEncoding() {
  console.log('=== TESTING 111MOVIES ENCODING V7 (UTF-8) ===\n');
  
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  
  console.log('Page data:', pageData);
  console.log('Page data length:', pageData.length);
  
  console.log('\n=== ENCODING ===');
  const encoded = encodePageData(pageData);
  console.log('Encoded:', encoded.substring(0, 100) + '...');
  
  // Test API
  console.log('\n=== TESTING API ===');
  const apiUrl = `https://111movies.com/${API_HASH}/${encoded}/sr`;
  
  try {
    const apiRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://111movies.com/movie/155',
        'Origin': 'https://111movies.com'
      }
    });
    
    console.log('Status:', apiRes.status);
    const text = await apiRes.text();
    console.log('Response:', text.substring(0, 300));
    
    if (apiRes.status === 200) {
      console.log('\n=== SUCCESS! ===');
      try {
        const json = JSON.parse(text);
        console.log('Sources:', JSON.stringify(json, null, 2).substring(0, 500));
      } catch (e) {}
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testEncoding().catch(console.error);
