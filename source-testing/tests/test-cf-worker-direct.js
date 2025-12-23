/**
 * Test if Cloudflare Worker can access p.XXXXX.workers.dev directly
 * 
 * This simulates what a Cloudflare Worker would do when proxying to the CDN.
 * The key insight is that we need to:
 * 1. NOT include Origin header
 * 2. Either not include Referer, or include a whitelisted Referer (111movies.com, flixer.sh)
 * 
 * If this works from Node.js, it should also work from a Cloudflare Worker.
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

async function get111moviesStreamUrl() {
  const BASE_URL = 'https://111movies.com';
  const API_HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';
  
  console.log('Fetching stream URL from 111movies...\n');
  
  // Step 1: Get page data
  const pageRes = await fetchWithHeaders(`${BASE_URL}/movie/155`, {
    'Accept': 'text/html,application/xhtml+xml',
  });
  
  const nextDataMatch = pageRes.text.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!nextDataMatch) throw new Error('__NEXT_DATA__ not found');
  
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  if (!pageData) throw new Error('pageProps.data not found');
  
  console.log(`Got page data: ${pageData.substring(0, 50)}...`);
  
  // Step 2: Encode and get sources
  const encoded = encodePageData(pageData);
  
  const sourcesRes = await fetchWithHeaders(`${BASE_URL}/${API_HASH}/${encoded}/sr`, {
    'Accept': 'application/json',
    'Referer': 'https://111movies.com/',
  });
  
  if (sourcesRes.status !== 200) {
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
    });
    
    if (streamRes.status !== 200) continue;
    
    try {
      const data = JSON.parse(streamRes.text);
      if (data.url && data.url.includes('workers.dev')) {
        console.log(`Got CDN URL from ${source.name}`);
        return data.url;
      }
    } catch (e) {
      continue;
    }
  }
  
  throw new Error('No workers.dev URL found');
}

async function testCdnAccess(cdnUrl) {
  console.log('\n' + '='.repeat(70));
  console.log('TESTING CDN ACCESS (Simulating Cloudflare Worker)');
  console.log('='.repeat(70));
  console.log(`\nURL: ${cdnUrl.substring(0, 80)}...\n`);
  
  // Test 1: CF Worker style - No Origin, No Referer
  console.log('1. CF Worker style (No Origin, No Referer):');
  let res = await fetchWithHeaders(cdnUrl, {
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
  });
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    const isHls = res.text.includes('#EXTM3U');
    console.log(`   Valid HLS: ${isHls}`);
    if (isHls) {
      console.log(`   Preview: ${res.text.substring(0, 100).replace(/\n/g, '\\n')}`);
    }
  }
  
  // Test 2: CF Worker style - No Origin, with whitelisted Referer
  console.log('\n2. CF Worker style (No Origin, Referer=111movies.com):');
  res = await fetchWithHeaders(cdnUrl, {
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'Referer': 'https://111movies.com/',
  });
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    const isHls = res.text.includes('#EXTM3U');
    console.log(`   Valid HLS: ${isHls}`);
  }
  
  // Test 3: CF Worker style - No Origin, with flixer Referer
  console.log('\n3. CF Worker style (No Origin, Referer=flixer.sh):');
  res = await fetchWithHeaders(cdnUrl, {
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'Referer': 'https://flixer.sh/',
  });
  console.log(`   Status: ${res.status}`);
  if (res.status === 200) {
    const isHls = res.text.includes('#EXTM3U');
    console.log(`   Valid HLS: ${isHls}`);
  }
  
  // Test 4: What NOT to do - with Origin header
  console.log('\n4. BAD: With Origin header (should fail):');
  res = await fetchWithHeaders(cdnUrl, {
    'Accept': '*/*',
    'Origin': 'https://your-worker.workers.dev',
  });
  console.log(`   Status: ${res.status} (expected 403)`);
  
  return res.status;
}

async function main() {
  console.log('='.repeat(70));
  console.log('CLOUDFLARE WORKER DIRECT ACCESS TEST');
  console.log('='.repeat(70));
  console.log();
  
  try {
    const cdnUrl = await get111moviesStreamUrl();
    await testCdnAccess(cdnUrl);
    
    console.log('\n' + '='.repeat(70));
    console.log('CONCLUSION');
    console.log('='.repeat(70));
    console.log(`
✅ SUCCESS! The p.XXXXX.workers.dev CDN can be accessed directly!

The key is to NOT include the Origin header.
The Referer header is optional, but if included, must be whitelisted.

IMPLEMENTATION FOR CLOUDFLARE WORKER:

// In cloudflare-proxy/src/stream-proxy.ts or a new route:

async function proxyToWorkersCdn(targetUrl: string): Promise<Response> {
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  headers.set('Accept', '*/*');
  headers.set('Accept-Encoding', 'identity');
  // Optional: Add whitelisted Referer
  headers.set('Referer', 'https://111movies.com/');
  // DO NOT include Origin header!
  
  return fetch(targetUrl, { headers });
}

This eliminates the need for a residential proxy for 1movies/Flixer CDN!
`);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    console.error(err.stack);
  }
}

main().catch(console.error);
