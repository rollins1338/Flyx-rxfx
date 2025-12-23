/**
 * Investigate p.XXXXX.workers.dev CDN Blocking - Version 2
 * 
 * This version:
 * 1. Fetches a real CDN URL from 111movies
 * 2. Tests various request patterns
 * 3. Analyzes the blocking mechanism
 */

const https = require('https');
const crypto = require('crypto');

// 111movies encoding keys
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
    xored += String.fromCharCode(encrypted.charCodeAt(i) ^ XOR_KEY[i % XOR_KEY.length]);
  }
  
  const base64 = Buffer.from(xored, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return result;
}

async function fetchWithHeaders(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      },
      timeout: 15000,
    };
    
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body,
          text: body.toString('utf8'),
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

async function get111moviesStream(tmdbId = '155') {
  const BASE_URL = 'https://111movies.com';
  const API_HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';
  
  console.log(`Fetching stream URL for TMDB ${tmdbId}...`);
  
  // Step 1: Get page data
  const pageRes = await fetchWithHeaders(`${BASE_URL}/movie/${tmdbId}`, {
    'Accept': 'text/html,application/xhtml+xml',
  });
  
  const nextDataMatch = pageRes.text.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!nextDataMatch) {
    throw new Error('__NEXT_DATA__ not found');
  }
  
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  if (!pageData) {
    throw new Error('pageProps.data not found');
  }
  
  console.log(`Got page data: ${pageData.substring(0, 50)}...`);
  
  // Step 2: Encode and get sources
  const encoded = encodePageData(pageData);
  console.log(`Encoded: ${encoded.substring(0, 50)}...`);
  
  const sourcesRes = await fetchWithHeaders(`${BASE_URL}/${API_HASH}/${encoded}/sr`, {
    'Accept': 'application/json',
    'Referer': 'https://111movies.com/',
    'X-Requested-With': 'XMLHttpRequest',
  });
  
  if (sourcesRes.status !== 200) {
    console.log(`Sources response: ${sourcesRes.status}`);
    console.log(`Body: ${sourcesRes.text.substring(0, 200)}`);
    throw new Error(`Sources API returned ${sourcesRes.status}`);
  }
  
  const sources = JSON.parse(sourcesRes.text);
  console.log(`Got ${sources.length} sources`);
  
  // Step 3: Get stream URL from first source
  for (const source of sources) {
    console.log(`Trying source: ${source.name}...`);
    
    const streamRes = await fetchWithHeaders(`${BASE_URL}/${API_HASH}/${source.data}`, {
      'Accept': 'application/json',
      'Referer': 'https://111movies.com/',
      'X-Requested-With': 'XMLHttpRequest',
    });
    
    if (streamRes.status !== 200) {
      console.log(`  Status: ${streamRes.status}`);
      continue;
    }
    
    try {
      const data = JSON.parse(streamRes.text);
      if (data.url) {
        console.log(`  Got URL: ${data.url.substring(0, 80)}...`);
        return {
          url: data.url,
          source: source.name,
          tracks: data.tracks || [],
        };
      }
    } catch (e) {
      console.log(`  Parse error: ${e.message}`);
    }
  }
  
  throw new Error('No stream URL found');
}

async function testCdnAccess(cdnUrl) {
  console.log('\n' + '='.repeat(70));
  console.log('TESTING CDN ACCESS');
  console.log('='.repeat(70));
  console.log(`URL: ${cdnUrl.substring(0, 80)}...`);
  
  const tests = [
    {
      name: 'Direct (no extra headers)',
      headers: {}
    },
    {
      name: 'With Referer (111movies)',
      headers: {
        'Referer': 'https://111movies.com/',
      }
    },
    {
      name: 'With Origin + Referer',
      headers: {
        'Origin': 'https://111movies.com',
        'Referer': 'https://111movies.com/',
      }
    },
    {
      name: 'Browser-like (full sec-* headers)',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://111movies.com',
        'Referer': 'https://111movies.com/',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      }
    },
    {
      name: 'Range request (byte 0-1000)',
      headers: {
        'Range': 'bytes=0-1000',
        'Referer': 'https://111movies.com/',
      }
    },
  ];
  
  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    
    try {
      const res = await fetchWithHeaders(cdnUrl, test.headers);
      
      console.log(`   Status: ${res.status}`);
      console.log(`   CF-Ray: ${res.headers['cf-ray'] || 'N/A'}`);
      console.log(`   Content-Type: ${res.headers['content-type'] || 'N/A'}`);
      console.log(`   Content-Length: ${res.headers['content-length'] || res.body.length}`);
      
      if (res.status === 200 || res.status === 206) {
        // Check if it's valid HLS
        const isHls = res.text.includes('#EXTM3U') || res.text.includes('#EXT');
        const isBinary = res.body[0] === 0x47; // MPEG-TS sync byte
        
        if (isHls) {
          console.log(`   ✅ SUCCESS - Valid HLS playlist`);
          console.log(`   Preview: ${res.text.substring(0, 100).replace(/\n/g, '\\n')}`);
        } else if (isBinary) {
          console.log(`   ✅ SUCCESS - Binary data (likely video segment)`);
        } else {
          console.log(`   ✅ SUCCESS - ${res.body.length} bytes`);
          if (res.body.length < 200) {
            console.log(`   Body: ${res.text}`);
          }
        }
      } else if (res.status === 403) {
        console.log(`   🚫 BLOCKED - 403 Forbidden`);
        console.log(`   Body: ${res.text.substring(0, 200)}`);
      } else {
        console.log(`   ⚠️ Unexpected status`);
        console.log(`   Body: ${res.text.substring(0, 200)}`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 300));
  }
}

async function analyzeWorkerBehavior(cdnUrl) {
  console.log('\n' + '='.repeat(70));
  console.log('ANALYZING WORKER BEHAVIOR');
  console.log('='.repeat(70));
  
  const urlObj = new URL(cdnUrl);
  const workerDomain = urlObj.hostname; // e.g., p.10014.workers.dev
  
  console.log(`\nWorker domain: ${workerDomain}`);
  console.log(`Path structure: ${urlObj.pathname}`);
  
  // Parse the path to understand the structure
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  console.log(`Path parts: ${JSON.stringify(pathParts)}`);
  
  // The path typically looks like:
  // /dewshine74.xyz/file2/{encoded_path}/playlist.m3u8
  // or
  // /afc7d47f/{encoded_path}.m3u8
  
  if (pathParts.length > 0) {
    const firstPart = pathParts[0];
    console.log(`\nFirst path segment: ${firstPart}`);
    
    // Check if it's a domain-like pattern
    if (firstPart.includes('.')) {
      console.log(`  → Looks like a backend domain: ${firstPart}`);
    } else {
      console.log(`  → Looks like an identifier: ${firstPart}`);
    }
  }
  
  // Try to understand what the worker is doing
  console.log(`
Analysis:
- The p.XXXXX.workers.dev is a Cloudflare Worker acting as a proxy
- It likely forwards requests to a backend CDN (dewshine74.xyz, etc.)
- The blocking could happen at:
  1. The Worker level (checking request metadata)
  2. The backend CDN level (checking forwarded headers)
  
Key questions:
- Does the Worker add/modify headers before forwarding?
- Does the backend CDN check the original IP or the Worker's IP?
- Is there a signature/token in the URL that validates the request?
`);
}

async function main() {
  console.log('='.repeat(70));
  console.log('p.XXXXX.workers.dev CDN INVESTIGATION - v2');
  console.log('='.repeat(70));
  console.log();
  
  try {
    // Get a fresh stream URL
    const stream = await get111moviesStream('155'); // The Dark Knight
    
    console.log(`\n✅ Got stream from ${stream.source}`);
    console.log(`URL: ${stream.url}`);
    
    // Test CDN access
    await testCdnAccess(stream.url);
    
    // Analyze worker behavior
    await analyzeWorkerBehavior(stream.url);
    
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    console.error(err.stack);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('CONCLUSIONS');
  console.log('='.repeat(70));
  console.log(`
Based on the tests above, we can determine:

1. If ALL tests return 403 → The blocking is IP-based
   - The Worker or backend checks the source IP
   - Cloudflare Workers have access to CF-Connecting-IP
   - This cannot be spoofed (CF overwrites it)
   
2. If some tests work → The blocking is header-based
   - We can find the right header combination
   - No residential proxy needed
   
3. If tests work from Node.js but not from CF Worker → Worker-to-Worker detection
   - CF Workers can detect requests from other Workers
   - May need to route through a non-CF proxy

Next steps:
- If IP-based: Need residential proxy (current solution)
- If header-based: Update proxy to use correct headers
- If Worker-to-Worker: Route through non-CF intermediary
`);
}

main().catch(console.error);
