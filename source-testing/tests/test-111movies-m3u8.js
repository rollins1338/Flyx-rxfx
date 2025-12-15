/**
 * Test that 111movies m3u8 URLs are valid
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
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  const utf8Bytes = Buffer.from(xored, 'utf8');
  const base64 = utf8Bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return result;
}

async function testM3u8() {
  console.log('=== TESTING 111MOVIES M3U8 VALIDITY ===\n');
  
  // Get a stream URL
  const pageRes = await fetch(`${BASE_URL}/movie/155`, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
  const html = await pageRes.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  
  const encoded = encodePageData(pageData);
  const sourcesRes = await fetch(`${BASE_URL}/${API_HASH}/${encoded}/sr`, { method: 'GET', headers: HEADERS });
  const sources = await sourcesRes.json();
  
  // Get first working source
  for (const source of sources) {
    const streamRes = await fetch(`${BASE_URL}/${API_HASH}/${source.data}`, { method: 'GET', headers: HEADERS });
    if (!streamRes.ok) continue;
    
    const data = await streamRes.json();
    if (!data.url) continue;
    
    console.log(`Source: ${source.name}`);
    console.log(`M3U8 URL: ${data.url}\n`);
    
    // Test the m3u8 URL
    console.log('Testing m3u8 URL...');
    const m3u8Res = await fetch(data.url, {
      headers: {
        'User-Agent': HEADERS['User-Agent'],
        'Referer': 'https://111movies.com/',
      }
    });
    
    console.log(`Status: ${m3u8Res.status}`);
    
    if (m3u8Res.ok) {
      const m3u8Content = await m3u8Res.text();
      console.log(`\nM3U8 Content (first 500 chars):\n${m3u8Content.substring(0, 500)}`);
      
      if (m3u8Content.includes('#EXTM3U')) {
        console.log('\n✓ Valid M3U8 playlist!');
      }
    } else {
      console.log(`Failed to fetch m3u8: ${m3u8Res.status}`);
    }
    
    break;
  }
}

testM3u8().catch(console.error);
