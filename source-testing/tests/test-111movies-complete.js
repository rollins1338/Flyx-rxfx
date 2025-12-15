/**
 * Complete end-to-end test for 111movies extractor
 * Tests the exact same flow as the TypeScript implementation
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

async function extractOneMoviesStreams(tmdbId, type, season, episode) {
  console.log(`\n[1movies] Extracting streams for ${type} ${tmdbId}${season ? ` S${season}E${episode}` : ''}`);
  
  // Step 1: Fetch page data
  const url = type === 'movie'
    ? `${BASE_URL}/movie/${tmdbId}`
    : `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
  
  console.log(`[1movies] Fetching page: ${url}`);
  const pageRes = await fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
  
  if (!pageRes.ok) {
    return { success: false, sources: [], error: `Page fetch failed: ${pageRes.status}` };
  }
  
  const html = await pageRes.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  
  if (!nextDataMatch) {
    return { success: false, sources: [], error: 'Could not find __NEXT_DATA__' };
  }
  
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  
  if (!pageData) {
    return { success: false, sources: [], error: 'No pageProps.data found' };
  }
  
  console.log(`[1movies] Got page data: ${pageData.substring(0, 50)}...`);
  
  // Step 2: Encode page data
  const encoded = encodePageData(pageData);
  console.log(`[1movies] Encoded data length: ${encoded.length}`);
  
  // Step 3: Fetch sources
  const sourcesUrl = `${BASE_URL}/${API_HASH}/${encoded}/sr`;
  console.log(`[1movies] Fetching sources...`);
  
  const sourcesRes = await fetch(sourcesUrl, { method: 'GET', headers: HEADERS });
  
  if (!sourcesRes.ok) {
    return { success: false, sources: [], error: `Sources fetch failed: ${sourcesRes.status}` };
  }
  
  const sources = await sourcesRes.json();
  console.log(`[1movies] Got ${sources.length} sources`);
  
  // Step 4: Fetch stream URLs
  const results = [];
  
  for (let i = 0; i < Math.min(sources.length, 6); i += 3) {
    const batch = sources.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (source) => {
        try {
          const streamUrl = `${BASE_URL}/${API_HASH}/${source.data}`;
          const streamRes = await fetch(streamUrl, { method: 'GET', headers: HEADERS });
          
          if (!streamRes.ok) {
            console.log(`[1movies] ✗ ${source.name}: ${streamRes.status}`);
            return null;
          }
          
          const data = await streamRes.json();
          
          if (data?.url) {
            console.log(`[1movies] ✓ ${source.name}: ${data.url.substring(0, 60)}...`);
            return {
              quality: 'auto',
              title: `1movies ${source.name}`,
              url: data.url,
              type: 'hls',
              referer: BASE_URL,
              requiresSegmentProxy: true,
              status: 'working',
              language: 'en',
            };
          }
          
          console.log(`[1movies] ✗ ${source.name}: No URL`);
          return null;
        } catch (e) {
          console.log(`[1movies] ✗ ${source.name}: ${e.message}`);
          return null;
        }
      })
    );
    
    for (const r of batchResults) {
      if (r !== null) results.push(r);
    }
    
    if (results.length >= 2) break;
  }
  
  if (results.length === 0) {
    return { success: false, sources: [], error: 'Failed to extract stream URLs' };
  }
  
  console.log(`[1movies] Successfully extracted ${results.length} sources`);
  
  return { success: true, sources: results };
}

async function main() {
  console.log('=== 111MOVIES COMPLETE END-TO-END TEST ===');
  
  // Test 1: Movie (The Dark Knight)
  const movieResult = await extractOneMoviesStreams('155', 'movie');
  console.log('\nMovie Result:', movieResult.success ? `✓ ${movieResult.sources.length} sources` : `✗ ${movieResult.error}`);
  
  // Test 2: TV Show (Breaking Bad S01E01)
  const tvResult = await extractOneMoviesStreams('1396', 'tv', 1, 1);
  console.log('\nTV Result:', tvResult.success ? `✓ ${tvResult.sources.length} sources` : `✗ ${tvResult.error}`);
  
  // Test 3: Verify m3u8 is valid
  if (movieResult.success && movieResult.sources.length > 0) {
    console.log('\n--- Verifying M3U8 ---');
    const m3u8Url = movieResult.sources[0].url;
    const m3u8Res = await fetch(m3u8Url, {
      headers: { 'User-Agent': HEADERS['User-Agent'], 'Referer': BASE_URL }
    });
    
    if (m3u8Res.ok) {
      const content = await m3u8Res.text();
      console.log(`M3U8 Status: ${m3u8Res.status}`);
      console.log(`Valid HLS: ${content.includes('#EXTM3U') ? '✓ YES' : '✗ NO'}`);
      console.log(`Has 1080p: ${content.includes('1920x1080') ? '✓ YES' : '✗ NO'}`);
      console.log(`Has 720p: ${content.includes('1280x720') ? '✓ YES' : '✗ NO'}`);
    }
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

main().catch(console.error);
