/**
 * Investigate p.XXXXX.workers.dev CDN Blocking - Version 4
 * 
 * DISCOVERY: The blocking is HEADER-BASED, not IP-based!
 * Specifically, the Origin header causes a 403 block.
 * 
 * This script tests various header combinations to find the exact blocking rules.
 */

const https = require('https');
const { URL } = require('url');

async function testRequest(url, headers = {}) {
  return new Promise((resolve) => {
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
          body: body.toString('utf8'),
          bodyLength: body.length,
        });
      });
    });
    
    req.on('error', (err) => resolve({ status: 'Error', error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'Timeout' }); });
    req.end();
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('HEADER-BASED BLOCKING INVESTIGATION');
  console.log('='.repeat(70));
  console.log();
  
  const workerDomain = 'p.10014.workers.dev';
  const testPath = '/test';
  const testUrl = `https://${workerDomain}${testPath}`;
  
  console.log(`Testing: ${testUrl}\n`);
  
  // Test 1: Origin header variations
  console.log('=== ORIGIN HEADER TESTS ===\n');
  
  const originTests = [
    { name: 'No Origin', headers: {} },
    { name: 'Origin: https://111movies.com', headers: { 'Origin': 'https://111movies.com' } },
    { name: 'Origin: https://flixer.sh', headers: { 'Origin': 'https://flixer.sh' } },
    { name: 'Origin: null', headers: { 'Origin': 'null' } },
    { name: 'Origin: (empty)', headers: { 'Origin': '' } },
    { name: 'Origin: https://p.10014.workers.dev', headers: { 'Origin': 'https://p.10014.workers.dev' } },
  ];
  
  for (const test of originTests) {
    const res = await testRequest(testUrl, test.headers);
    const status = res.status;
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${status}`);
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Test 2: Referer header variations
  console.log('\n=== REFERER HEADER TESTS ===\n');
  
  const refererTests = [
    { name: 'No Referer', headers: {} },
    { name: 'Referer: https://111movies.com/', headers: { 'Referer': 'https://111movies.com/' } },
    { name: 'Referer: https://flixer.sh/', headers: { 'Referer': 'https://flixer.sh/' } },
    { name: 'Referer + Origin', headers: { 'Referer': 'https://111movies.com/', 'Origin': 'https://111movies.com' } },
  ];
  
  for (const test of refererTests) {
    const res = await testRequest(testUrl, test.headers);
    const status = res.status;
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${status}`);
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Test 3: Sec-Fetch headers
  console.log('\n=== SEC-FETCH HEADER TESTS ===\n');
  
  const secFetchTests = [
    { name: 'No Sec-Fetch headers', headers: {} },
    { name: 'Sec-Fetch-Mode: cors', headers: { 'Sec-Fetch-Mode': 'cors' } },
    { name: 'Sec-Fetch-Mode: no-cors', headers: { 'Sec-Fetch-Mode': 'no-cors' } },
    { name: 'Sec-Fetch-Site: cross-site', headers: { 'Sec-Fetch-Site': 'cross-site' } },
    { name: 'Sec-Fetch-Site: same-origin', headers: { 'Sec-Fetch-Site': 'same-origin' } },
    { name: 'All Sec-Fetch (cors)', headers: {
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    }},
    { name: 'All Sec-Fetch (no-cors)', headers: {
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    }},
  ];
  
  for (const test of secFetchTests) {
    const res = await testRequest(testUrl, test.headers);
    const status = res.status;
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${status}`);
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Test 4: Combined tests
  console.log('\n=== COMBINED HEADER TESTS ===\n');
  
  const combinedTests = [
    { 
      name: 'Browser XHR (with Origin)', 
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://111movies.com',
        'Referer': 'https://111movies.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      }
    },
    { 
      name: 'Browser XHR (NO Origin)', 
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://111movies.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      }
    },
    { 
      name: 'Video player style', 
      headers: {
        'Accept': '*/*',
        'Range': 'bytes=0-',
      }
    },
    { 
      name: 'HLS.js style', 
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    },
  ];
  
  for (const test of combinedTests) {
    const res = await testRequest(testUrl, test.headers);
    const status = res.status;
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${status}`);
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Conclusion
  console.log('\n' + '='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));
  console.log(`
KEY FINDING: The p.XXXXX.workers.dev CDN blocks requests with Origin header!

This is significant because:
1. Browser XHR/fetch requests ALWAYS include Origin header for cross-origin requests
2. This is why the CDN works in a browser's video player but not from our proxy
3. The browser's video player uses <video> tag which doesn't send Origin

SOLUTION:
1. When proxying through Cloudflare Worker, do NOT include Origin header
2. The Cloudflare Worker should strip the Origin header before forwarding
3. This should work WITHOUT needing a residential proxy!

IMPLEMENTATION:
In the Cloudflare Worker proxy, when forwarding to p.XXXXX.workers.dev:
- Remove the Origin header
- Keep the Referer header (it's allowed)
- Keep other headers as-is

This is a much simpler solution than using a residential proxy!
`);
}

main().catch(console.error);
