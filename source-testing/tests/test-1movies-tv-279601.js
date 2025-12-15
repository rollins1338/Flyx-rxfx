/**
 * Test 1movies extraction for TV show 279601 S1E1
 */

const crypto = require('crypto');

const BASE_URL = 'https://111movies.com';
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

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://111movies.com/',
  'X-Requested-With': 'XMLHttpRequest',
  'Content-Type': 'application/octet-stream',
};

function encodePageData(pageData) {
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  const encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    xored += String.fromCharCode(encrypted.charCodeAt(i) ^ XOR_KEY[i % XOR_KEY.length]);
  }
  
  const base64 = Buffer.from(xored, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return result;
}

async function test() {
  console.log('=== TESTING 1MOVIES FOR TV 279601 S1E1 ===\n');
  
  const url = `${BASE_URL}/tv/279601/1/1`;
  console.log(`Fetching: ${url}`);
  
  const pageRes = await fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
  console.log(`Page status: ${pageRes.status}`);
  
  if (!pageRes.ok) {
    console.log('Page not found - content may not be available');
    return;
  }
  
  const html = await pageRes.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  
  if (!nextDataMatch) {
    console.log('No __NEXT_DATA__ found');
    return;
  }
  
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  
  if (!pageData) {
    console.log('No pageProps.data found - content may not be available');
    console.log('pageProps:', JSON.stringify(nextData.props?.pageProps, null, 2).substring(0, 500));
    return;
  }
  
  console.log(`Page data: ${pageData.substring(0, 50)}...`);
  
  const encoded = encodePageData(pageData);
  console.log(`Encoded length: ${encoded.length}`);
  
  const sourcesUrl = `${BASE_URL}/${API_HASH}/${encoded}/sr`;
  const sourcesRes = await fetch(sourcesUrl, { method: 'GET', headers: HEADERS });
  console.log(`Sources status: ${sourcesRes.status}`);
  
  if (!sourcesRes.ok) {
    console.log('Failed to get sources');
    return;
  }
  
  const sources = await sourcesRes.json();
  console.log(`Got ${sources.length} sources: ${sources.map(s => s.name).join(', ')}`);
  
  // Get stream URLs
  for (const source of sources.slice(0, 3)) {
    const streamUrl = `${BASE_URL}/${API_HASH}/${source.data}`;
    const streamRes = await fetch(streamUrl, { method: 'GET', headers: HEADERS });
    
    if (streamRes.ok) {
      const data = await streamRes.json();
      if (data.url) {
        console.log(`✓ ${source.name}: ${data.url.substring(0, 80)}...`);
      } else {
        console.log(`✗ ${source.name}: No URL in response`);
      }
    } else {
      console.log(`✗ ${source.name}: ${streamRes.status}`);
    }
  }
}

test().catch(console.error);
