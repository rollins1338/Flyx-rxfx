/**
 * Investigate p.XXXXX.workers.dev CDN Blocking Mechanism
 * 
 * Goal: Understand exactly what causes the CDN to block requests
 * so we can bypass it without a residential proxy.
 * 
 * Hypothesis to test:
 * 1. IP-based blocking (datacenter vs residential)
 * 2. TLS fingerprint detection (JA3/JA4)
 * 3. Header-based detection (specific headers that trigger blocking)
 * 4. Cloudflare Worker-to-Worker detection
 * 5. ASN-based blocking (specific cloud provider ASNs)
 * 6. Request timing/pattern detection
 * 7. Missing browser-specific headers
 * 
 * The CDN is itself a Cloudflare Worker (p.XXXXX.workers.dev)
 * which means it has access to CF-specific headers and metadata.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Sample CDN URL (you'll need to get a fresh one from 111movies)
// These URLs expire, so we need to fetch a fresh one first
const SAMPLE_CDN_URL = 'https://p.10014.workers.dev/test';

// Different header combinations to test
const HEADER_TESTS = [
  {
    name: 'Minimal (no headers)',
    headers: {}
  },
  {
    name: 'User-Agent only',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  },
  {
    name: 'Browser-like (full)',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    }
  },
  {
    name: 'With Origin (111movies)',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://111movies.com',
      'Referer': 'https://111movies.com/',
    }
  },
  {
    name: 'With Origin (flixer)',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://flixer.sh',
      'Referer': 'https://flixer.sh/',
    }
  },
  {
    name: 'No Origin, with Referer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://111movies.com/',
    }
  },
  {
    name: 'Curl-like',
    headers: {
      'User-Agent': 'curl/8.0.0',
      'Accept': '*/*',
    }
  },
  {
    name: 'With CF-Connecting-IP spoof attempt',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'CF-Connecting-IP': '73.45.123.45', // Fake residential IP
      'X-Forwarded-For': '73.45.123.45',
    }
  },
  {
    name: 'With X-Real-IP spoof attempt',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Real-IP': '73.45.123.45',
      'X-Forwarded-For': '73.45.123.45',
    }
  },
];

/**
 * Make a request and capture detailed response info
 */
async function testRequest(url, headers, options = {}) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers,
      timeout: 10000,
      ...options,
    };
    
    const startTime = Date.now();
    
    const req = client.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const duration = Date.now() - startTime;
        
        resolve({
          success: true,
          status: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: body.toString('utf8').substring(0, 500),
          bodyLength: body.length,
          duration,
          // Check for specific CF headers
          cfRay: res.headers['cf-ray'],
          cfCacheStatus: res.headers['cf-cache-status'],
          server: res.headers['server'],
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        code: err.code,
        duration: Date.now() - startTime,
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout',
        duration: Date.now() - startTime,
      });
    });
    
    req.end();
  });
}

/**
 * Analyze response to determine blocking type
 */
function analyzeResponse(result) {
  if (!result.success) {
    return { blocked: true, reason: `Error: ${result.error}` };
  }
  
  if (result.status === 403) {
    // Check body for clues
    if (result.body.includes('blocked')) {
      return { blocked: true, reason: '403 - Explicitly blocked' };
    }
    if (result.body.includes('cloudflare')) {
      return { blocked: true, reason: '403 - Cloudflare block' };
    }
    return { blocked: true, reason: '403 - Forbidden (unknown reason)' };
  }
  
  if (result.status === 429) {
    return { blocked: true, reason: '429 - Rate limited' };
  }
  
  if (result.status === 503) {
    return { blocked: true, reason: '503 - Service unavailable (possibly blocked)' };
  }
  
  if (result.status === 200) {
    // Check if it's a valid HLS response
    if (result.body.includes('#EXTM3U')) {
      return { blocked: false, reason: 'Success - Valid HLS' };
    }
    if (result.body.includes('#EXT')) {
      return { blocked: false, reason: 'Success - HLS content' };
    }
    return { blocked: false, reason: `Success - ${result.bodyLength} bytes` };
  }
  
  return { blocked: true, reason: `HTTP ${result.status}` };
}

/**
 * Get a fresh CDN URL from 111movies
 */
async function getFreshCdnUrl() {
  console.log('Fetching fresh CDN URL from 111movies...\n');
  
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
  
  try {
    // Fetch page to get data
    const pageRes = await fetch(`${BASE_URL}/movie/155`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await pageRes.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (!nextDataMatch) throw new Error('__NEXT_DATA__ not found');
    
    const nextData = JSON.parse(nextDataMatch[1]);
    const pageData = nextData.props?.pageProps?.data;
    if (!pageData) throw new Error('pageProps.data not found');
    
    const encoded = encodePageData(pageData);
    
    // Get sources
    const sourcesRes = await fetch(`${BASE_URL}/${API_HASH}/${encoded}/sr`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://111movies.com/',
      }
    });
    const sources = await sourcesRes.json();
    
    // Get first source stream URL
    for (const source of sources.slice(0, 3)) {
      const streamRes = await fetch(`${BASE_URL}/${API_HASH}/${source.data}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://111movies.com/',
        }
      });
      if (!streamRes.ok) continue;
      
      const data = await streamRes.json();
      if (data.url && data.url.includes('workers.dev')) {
        console.log(`Found CDN URL from source: ${source.name}`);
        return data.url;
      }
    }
    
    throw new Error('No workers.dev URL found in sources');
  } catch (err) {
    console.error('Failed to get fresh CDN URL:', err.message);
    return null;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('='.repeat(70));
  console.log('INVESTIGATING p.XXXXX.workers.dev CDN BLOCKING MECHANISM');
  console.log('='.repeat(70));
  console.log();
  
  // Get fresh CDN URL
  const cdnUrl = await getFreshCdnUrl();
  
  if (!cdnUrl) {
    console.log('\n❌ Could not get fresh CDN URL. Using placeholder for header tests.\n');
    console.log('The tests below will show what headers are being sent,');
    console.log('but actual blocking behavior requires a valid CDN URL.\n');
  } else {
    console.log(`\n✅ Got CDN URL: ${cdnUrl.substring(0, 80)}...\n`);
  }
  
  const testUrl = cdnUrl || 'https://p.10014.workers.dev/test';
  
  console.log('Testing different header combinations...\n');
  console.log('-'.repeat(70));
  
  for (const test of HEADER_TESTS) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Headers: ${JSON.stringify(test.headers).substring(0, 100)}...`);
    
    const result = await testRequest(testUrl, test.headers);
    const analysis = analyzeResponse(result);
    
    console.log(`   Status: ${result.status || 'N/A'} (${result.duration}ms)`);
    console.log(`   CF-Ray: ${result.cfRay || 'N/A'}`);
    console.log(`   Server: ${result.server || 'N/A'}`);
    console.log(`   Result: ${analysis.blocked ? '🚫 BLOCKED' : '✅ SUCCESS'} - ${analysis.reason}`);
    
    if (result.body && result.body.length > 0 && result.body.length < 200) {
      console.log(`   Body: ${result.body.replace(/\n/g, ' ').substring(0, 100)}`);
    }
    
    // Small delay between tests
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS');
  console.log('='.repeat(70));
  console.log(`
Key observations to look for:
1. If ALL requests fail with 403 → IP-based blocking (datacenter detection)
2. If some header combos work → Header-based detection
3. If CF-Ray header is present → Request reached Cloudflare
4. If server is "cloudflare" → Standard CF response
5. If body contains specific error → May reveal blocking mechanism

The p.XXXXX.workers.dev CDN is a Cloudflare Worker, which means:
- It can access CF-specific request metadata (CF-Connecting-IP, CF-IPCountry, etc.)
- It can detect if the request comes from another CF Worker
- It can check ASN/datacenter information
- It CANNOT be spoofed with fake CF headers (CF strips/overwrites them)

Possible bypass strategies:
1. Route through residential proxy (current solution)
2. Find a header combination that bypasses detection
3. Use a non-datacenter IP (home server, VPS with residential IP)
4. Reverse engineer the Worker's blocking logic
5. Find an alternative CDN endpoint that doesn't block
`);
}

main().catch(console.error);
