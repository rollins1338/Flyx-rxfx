/**
 * Test 111movies stream extraction - get m3u8 from source data
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

async function testStreamExtraction() {
  console.log('=== TESTING 111MOVIES STREAM EXTRACTION ===\n');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://111movies.com/',
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/octet-stream',
    'sec-ch-ua': '"Chromium";v="120", "Not A(Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };
  
  // Step 1: Fetch page to get pageData
  console.log('Step 1: Fetching page...');
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': headers['User-Agent'] }
  });
  
  const html = await pageRes.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  console.log('Page data:', pageData);
  
  // Step 2: Get sources
  console.log('\nStep 2: Getting sources...');
  const encoded = encodePageData(pageData);
  const sourcesUrl = `https://111movies.com/${API_HASH}/${encoded}/sr`;
  
  const sourcesRes = await fetch(sourcesUrl, { method: 'GET', headers });
  const sources = await sourcesRes.json();
  console.log(`Got ${sources.length} sources`);
  
  // Step 3: Try to get stream from first source
  const firstSource = sources[0];
  console.log('\nStep 3: Getting stream for source:', firstSource.name);
  console.log('Source data:', firstSource.data);
  
  // Try different URL patterns
  const patterns = [
    `https://111movies.com/${API_HASH}/${firstSource.data}`,
    `https://111movies.com/${API_HASH}/${firstSource.data}/st`,
    `https://111movies.com/${API_HASH}/${firstSource.data}/stream`,
    `https://111movies.com/${API_HASH}/${firstSource.data}/m3u8`,
    `https://111movies.com/api/stream/${firstSource.data}`,
    `https://111movies.com/stream/${firstSource.data}`,
  ];
  
  for (const url of patterns) {
    console.log(`\nTrying: ${url.substring(0, 80)}...`);
    try {
      const res = await fetch(url, { method: 'GET', headers });
      console.log(`  Status: ${res.status}`);
      
      if (res.ok) {
        const text = await res.text();
        console.log(`  Response (first 300 chars): ${text.substring(0, 300)}`);
        
        // Check if it's m3u8
        if (text.includes('#EXTM3U') || text.includes('.m3u8')) {
          console.log('\n=== FOUND M3U8! ===');
          console.log('URL pattern:', url);
          return;
        }
        
        // Check if it's JSON with URL
        try {
          const json = JSON.parse(text);
          console.log('  JSON response:', JSON.stringify(json, null, 2).substring(0, 500));
        } catch (e) {}
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Also try decoding the source data
  console.log('\n\n=== ANALYZING SOURCE DATA FORMAT ===');
  const [hash, encryptedData] = firstSource.data.split(':');
  console.log('Hash part:', hash);
  console.log('Encrypted part:', encryptedData);
  console.log('Encrypted length:', encryptedData.length);
  
  // Try to decrypt with same keys
  console.log('\nTrying to decrypt source data...');
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);
    const decrypted = decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');
    console.log('Decrypted:', decrypted);
  } catch (e) {
    console.log('Decryption failed:', e.message);
  }
}

testStreamExtraction().catch(console.error);
