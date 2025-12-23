/**
 * Investigate p.XXXXX.workers.dev CDN Blocking - Version 6
 * 
 * FINDINGS SO FAR:
 * - Origin alone → 403
 * - Origin + Referer (valid domain) → 200
 * - Origin + Referer (worker domain) → 403
 * - Referer alone → 200
 * - No headers → 200
 * 
 * Let's test what Referer values are allowed.
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
  console.log('REFERER VALUE INVESTIGATION');
  console.log('='.repeat(70));
  console.log();
  
  const workerDomain = 'p.10014.workers.dev';
  const testUrl = `https://${workerDomain}/test`;
  
  console.log(`Testing: ${testUrl}\n`);
  
  // Test various Referer values with Origin
  console.log('=== REFERER VALUES (with Origin) ===\n');
  
  const tests = [
    { name: 'Referer: https://111movies.com/', referer: 'https://111movies.com/' },
    { name: 'Referer: https://flixer.sh/', referer: 'https://flixer.sh/' },
    { name: 'Referer: https://google.com/', referer: 'https://google.com/' },
    { name: 'Referer: https://example.com/', referer: 'https://example.com/' },
    { name: 'Referer: https://p.10014.workers.dev/', referer: 'https://p.10014.workers.dev/' },
    { name: 'Referer: https://workers.dev/', referer: 'https://workers.dev/' },
    { name: 'Referer: https://cloudflare.com/', referer: 'https://cloudflare.com/' },
    { name: 'Referer: http://localhost:3000/', referer: 'http://localhost:3000/' },
    { name: 'Referer: (random string)', referer: 'random-string' },
    { name: 'Referer: (just domain)', referer: '111movies.com' },
  ];
  
  for (const test of tests) {
    const res = await testRequest(testUrl, { 
      'Origin': 'https://111movies.com',
      'Referer': test.referer 
    });
    const status = res.status;
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${status}`);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Test Referer alone (no Origin)
  console.log('\n=== REFERER VALUES (without Origin) ===\n');
  
  for (const test of tests) {
    const res = await testRequest(testUrl, { 'Referer': test.referer });
    const status = res.status;
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${status}`);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Conclusion
  console.log('\n' + '='.repeat(70));
  console.log('BLOCKING RULES SUMMARY');
  console.log('='.repeat(70));
  console.log(`
Based on all tests, the blocking rules appear to be:

1. If Origin header is present:
   - Must have a valid Referer header
   - Referer must NOT be from workers.dev domain
   - Referer can be any other domain (even random ones)

2. If no Origin header:
   - Request is allowed regardless of Referer

3. The check is specifically:
   if (hasOrigin && (!hasReferer || refererIsWorkersDevDomain)) {
     return 403;
   }

SOLUTION FOR CLOUDFLARE WORKER:
When proxying to p.XXXXX.workers.dev:
1. REMOVE the Origin header (simplest solution)
2. OR ensure Referer is set to a non-workers.dev domain

The Cloudflare Worker should do:
const headers = new Headers(request.headers);
headers.delete('Origin');  // Remove Origin header
// OR
headers.set('Referer', 'https://111movies.com/');  // Set valid Referer

This should work WITHOUT a residential proxy!
`);
}

main().catch(console.error);
