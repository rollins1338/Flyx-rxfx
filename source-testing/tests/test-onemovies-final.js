/**
 * Test the final 1movies extractor implementation
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
  'Accept-Language': 'en-US,en;q=0.9',
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

async function testExtractor(tmdbId, type, season, episode) {
  console.log(`\n=== Testing ${type} ${tmdbId}${season ? ` S${season}E${episode}` : ''} ===\n`);
  
  // Step 1: Fetch page
  const url = type === 'movie'
    ? `${BASE_URL}/movie/${tmdbId}`
    : `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
  
  console.log(`Fetching: ${url}`);
  const pageRes = await fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
  
  if (!pageRes.ok) {
    console.log(`Page fetch failed: ${pageRes.status}`);
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
    console.log('No pageProps.data found');
    return;
  }
  
  console.log(`Page data: ${pageData.substring(0, 50)}...`);
  
  // Step 2: Encode and fetch sources
  const encoded = encodePageData(pageData);
  const sourcesUrl = `${BASE_URL}/${API_HASH}/${encoded}/sr`;
  
  const sourcesRes = await fetch(sourcesUrl, { method: 'GET', headers: HEADERS });
  
  if (!sourcesRes.ok) {
    console.log(`Sources fetch failed: ${sourcesRes.status}`);
    return;
  }
  
  const sources = await sourcesRes.json();
  console.log(`Got ${sources.length} sources: ${sources.map(s => s.name).join(', ')}`);
  
  // Step 3: Get stream URLs
  console.log('\nFetching stream URLs...');
  
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

async function main() {
  console.log('=== 1MOVIES EXTRACTOR TEST ===');
  
  // Test movie
  await testExtractor('155', 'movie'); // The Dark Knight
  
  // Test TV show
  await testExtractor('1396', 'tv', 1, 1); // Breaking Bad S01E01
  
  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch(console.error);
