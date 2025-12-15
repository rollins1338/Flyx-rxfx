/**
 * Test 111movies encoding algorithm v2
 * 
 * The page data is passed directly to the cipher as a string
 * The cipher encrypts it and outputs hex
 */

const crypto = require('crypto');

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
 * 
 * Flow from JS:
 * 1. c = createCipheriv("aes-???-cbc", key, iv)
 * 2. u = c.update(n._data, "utf8", "hex") + c.final("hex")
 * 3. XOR loop: for each char in u, XOR with d[i % d.length]
 * 4. x = Buffer.from(p, "binary").toString("base64").replace(+,-).replace(/,_).replace(=,"")
 * 5. Map each char using h -> m substitution
 */
function encodePageData(pageData) {
  console.log('Input page data:', pageData.substring(0, 50) + '...');
  console.log('Input length:', pageData.length);
  
  // Step 1: AES encrypt
  // Key is 32 bytes = AES-256-CBC
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  let encrypted = cipher.update(pageData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  console.log('After AES (hex):', encrypted.substring(0, 50) + '...');
  console.log('Encrypted length:', encrypted.length);
  
  // Step 2: XOR with key d
  // The JS code: (t^n^n)===t ? p+=String.fromCharCode(t^n) : p+=t
  // This simplifies to: always XOR (since t^n^n === t is always true)
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  console.log('After XOR (first 50 bytes hex):', Buffer.from(xored, 'binary').toString('hex').substring(0, 100));
  console.log('XORed length:', xored.length);
  
  // Step 3: Convert to URL-safe base64
  const base64 = Buffer.from(xored, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  console.log('After base64:', base64.substring(0, 50) + '...');
  console.log('Base64 length:', base64.length);
  
  // Step 4: Character substitution (h -> m)
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  console.log('After substitution:', result.substring(0, 50) + '...');
  console.log('Result length:', result.length);
  
  return result;
}

/**
 * Fetch page data and test encoding
 */
async function testEncoding() {
  console.log('=== TESTING 111MOVIES ENCODING V2 ===\n');
  
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
  console.log('\n=== ENCODING ===\n');
  const encoded = encodePageData(pageProps.data);
  
  // Build API URL
  // Format: /fcd552c4{hash}/{encoded}/sr
  // The hash might be empty or come from somewhere else
  const apiUrl = `https://111movies.com/fcd552c4/${encoded}/sr`;
  
  console.log('\n=== API URL ===');
  console.log('URL length:', apiUrl.length);
  console.log('URL:', apiUrl.substring(0, 150) + '...');
  
  // Test the API
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
    console.log('Response:', text.substring(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testEncoding().catch(console.error);
