/**
 * Test 111movies encoding algorithm
 * 
 * Flow:
 * 1. Get page data (n._data) from __NEXT_DATA__
 * 2. AES-128-CBC encrypt with key/iv
 * 3. XOR with key d
 * 4. Convert to base64 (URL-safe)
 * 5. Substitute characters using h -> m mapping
 */

const crypto = require('crypto');

// Encryption keys from 860-58807119fccb267b.js
const AES_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

// Alphabets
const STANDARD_ALPHABET = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9","-","_"];
const SHUFFLED_ALPHABET = ["T","u","z","H","O","x","l","7","b","0","R","W","9","o","_","1","F","P","V","3","e","G","f","m","L","4","Z","5","p","D","8","c","a","h","B","Q","r","2","U","-","6","y","v","E","Y","w","n","g","X","C","d","J","j","A","N","t","q","K","I","M","i","S","k","s"];

// Build substitution map (h -> m)
const CHAR_MAP = new Map();
STANDARD_ALPHABET.forEach((char, idx) => {
  CHAR_MAP.set(char, SHUFFLED_ALPHABET[idx]);
});

/**
 * Encode page data for API call
 */
function encodePageData(pageData) {
  console.log('Input page data:', pageData.substring(0, 50) + '...');
  console.log('Input length:', pageData.length);
  
  // Step 1: AES-128-CBC encrypt
  // The original code uses: createCipheriv("aes-128-cbc", key, iv)
  // But our key is 32 bytes (256 bits), so it's actually AES-256-CBC
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  let encrypted = cipher.update(pageData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  console.log('After AES encryption (hex):', encrypted.substring(0, 50) + '...');
  console.log('Encrypted length:', encrypted.length);
  
  // Step 2: XOR with key d
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    // The original code: (t^n^n)===t ? p+=String.fromCharCode(t^n) : p+=t
    // This means: if XOR doesn't change the char, use XOR result, else use original
    // Actually this is: always XOR (since t^n^n === t is always true for any t,n)
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  console.log('After XOR:', xored.substring(0, 50) + '...');
  console.log('XORed length:', xored.length);
  
  // Step 3: Convert to base64 (URL-safe)
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
 * Fetch page data from 111movies
 */
async function fetchPageData(tmdbId, type = 'movie', season, episode) {
  let url;
  if (type === 'movie') {
    url = `https://111movies.com/movie/${tmdbId}`;
  } else {
    url = `https://111movies.com/tv/${tmdbId}/${season}/${episode}`;
  }
  
  console.log('Fetching:', url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const html = await response.text();
  
  // Extract __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!nextDataMatch) {
    throw new Error('__NEXT_DATA__ not found');
  }
  
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageProps = nextData.props?.pageProps || {};
  
  console.log('Page props keys:', Object.keys(pageProps));
  
  return pageProps;
}

/**
 * Test the encoding
 */
async function testEncoding() {
  console.log('=== TESTING 111MOVIES ENCODING ===\n');
  
  // Fetch page data
  const pageProps = await fetchPageData('155', 'movie');
  
  if (!pageProps.data) {
    console.log('No data field found in page props');
    console.log('Available fields:', Object.keys(pageProps));
    return;
  }
  
  console.log('\n=== PAGE DATA ===');
  console.log('Data:', pageProps.data.substring(0, 100) + '...');
  console.log('Data length:', pageProps.data.length);
  
  // The page data is already encoded - we need to understand what n._data is
  // Looking at the code: c.update(n._data, "utf8", "hex")
  // n._data is the input to the cipher
  
  // Let's try to decode the page data first to understand the format
  console.log('\n=== ANALYZING PAGE DATA FORMAT ===');
  
  // The page data looks like URL-safe base64
  // Let's try to decode it
  try {
    const decoded = Buffer.from(pageProps.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    console.log('Decoded length:', decoded.length);
    console.log('Decoded (hex):', decoded.toString('hex').substring(0, 100));
    console.log('Decoded (utf8):', decoded.toString('utf8').substring(0, 50));
  } catch (e) {
    console.log('Base64 decode failed:', e.message);
  }
  
  // The encoding flow in the JS is:
  // 1. n._data (some input) -> AES encrypt -> hex string
  // 2. hex string -> XOR -> xored string
  // 3. xored string -> base64 (URL-safe) -> base64 string
  // 4. base64 string -> char substitution -> final encoded
  
  // So the page data might be the n._data (input to the cipher)
  // Let's try encoding it
  console.log('\n=== ENCODING PAGE DATA ===');
  const encoded = encodePageData(pageProps.data);
  
  console.log('\n=== RESULT ===');
  console.log('Encoded:', encoded.substring(0, 100) + '...');
  console.log('Encoded length:', encoded.length);
  
  // The API URL format is: /fcd552c4{hash}/{encoded}/sr
  // Let's construct the URL
  const hash = pageProps.hash || '';
  const apiUrl = `https://111movies.com/fcd552c4${hash}/${encoded}/sr`;
  console.log('\n=== API URL ===');
  console.log(apiUrl.substring(0, 150) + '...');
  
  // Try to call the API
  console.log('\n=== TESTING API CALL ===');
  try {
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://111movies.com/',
        'Origin': 'https://111movies.com'
      }
    });
    
    console.log('API Status:', apiResponse.status);
    const apiData = await apiResponse.text();
    console.log('API Response:', apiData.substring(0, 500));
  } catch (e) {
    console.log('API call failed:', e.message);
  }
}

testEncoding().catch(console.error);
