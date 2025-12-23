/**
 * Investigate p.XXXXX.workers.dev CDN Blocking - Version 5
 * 
 * DISCOVERY: Origin header alone causes 403, but Origin + Referer passes!
 * Let's investigate this more carefully.
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
  console.log('ORIGIN + REFERER INTERACTION INVESTIGATION');
  console.log('='.repeat(70));
  console.log();
  
  const workerDomain = 'p.10014.workers.dev';
  const testPath = '/test';
  const testUrl = `https://${workerDomain}${testPath}`;
  
  console.log(`Testing: ${testUrl}\n`);
  
  // Test Origin + Referer combinations
  console.log('=== ORIGIN + REFERER COMBINATIONS ===\n');
  
  const tests = [
    { name: 'No headers', headers: {} },
    { name: 'Origin only', headers: { 'Origin': 'https://111movies.com' } },
    { name: 'Referer only', headers: { 'Referer': 'https://111movies.com/' } },
    { name: 'Origin + Referer (same domain)', headers: { 
      'Origin': 'https://111movies.com', 
      'Referer': 'https://111movies.com/' 
    }},
    { name: 'Origin + Referer (different domains)', headers: { 
      'Origin': 'https://flixer.sh', 
      'Referer': 'https://111movies.com/' 
    }},
    { name: 'Origin + Referer (flixer)', headers: { 
      'Origin': 'https://flixer.sh', 
      'Referer': 'https://flixer.sh/' 
    }},
    { name: 'Origin + empty Referer', headers: { 
      'Origin': 'https://111movies.com', 
      'Referer': '' 
    }},
    { name: 'Origin + Referer (worker domain)', headers: { 
      'Origin': 'https://111movies.com', 
      'Referer': 'https://p.10014.workers.dev/' 
    }},
  ];
  
  for (const test of tests) {
    const res = await testRequest(testUrl, test.headers);
    const status = res.status;
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${status}`);
    if (res.body && res.body.length > 0 && res.body.length < 100) {
      console.log(`   Body: ${res.body}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Test with actual CDN path
  console.log('\n=== TESTING WITH CDN-LIKE PATH ===\n');
  
  const cdnPath = '/dewshine74.xyz/file2/test.m3u8';
  const cdnUrl = `https://${workerDomain}${cdnPath}`;
  
  console.log(`Testing: ${cdnUrl}\n`);
  
  const cdnTests = [
    { name: 'No headers', headers: {} },
    { name: 'Origin only', headers: { 'Origin': 'https://111movies.com' } },
    { name: 'Referer only', headers: { 'Referer': 'https://111movies.com/' } },
    { name: 'Origin + Referer', headers: { 
      'Origin': 'https://111movies.com', 
      'Referer': 'https://111movies.com/' 
    }},
  ];
  
  for (const test of cdnTests) {
    const res = await testRequest(cdnUrl, test.headers);
    const status = res.status;
    const icon = status === 200 || status === 404 ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${status}`);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Conclusion
  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS');
  console.log('='.repeat(70));
  console.log(`
The blocking logic appears to be:
- Origin header ALONE → 403 (blocked)
- Origin + Referer → 200 (allowed)
- Referer alone → 200 (allowed)
- No headers → 200 (allowed)

This suggests the Worker checks:
if (request.headers.get('Origin') && !request.headers.get('Referer')) {
  return new Response('Forbidden', { status: 403 });
}

The rationale might be:
- Browser XHR always sends both Origin AND Referer
- A request with Origin but no Referer is suspicious (likely a bot/scraper)
- The Worker blocks these "suspicious" requests

SOLUTION FOR CLOUDFLARE WORKER PROXY:
When forwarding to p.XXXXX.workers.dev:
1. If Origin is present, ensure Referer is also present
2. OR remove the Origin header entirely
3. The Referer header should match the expected source (111movies.com, flixer.sh)

This should work from a Cloudflare Worker without needing a residential proxy!
`);
}

main().catch(console.error);
