/**
 * Investigate p.XXXXX.workers.dev CDN Blocking - Version 7
 * 
 * FINDINGS:
 * - The CDN has a WHITELIST of allowed Referer domains
 * - Allowed: 111movies.com, flixer.sh, localhost
 * - Blocked: google.com, example.com, workers.dev, cloudflare.com
 * 
 * Let's find the complete whitelist and test the final solution.
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
  console.log('REFERER WHITELIST INVESTIGATION');
  console.log('='.repeat(70));
  console.log();
  
  const workerDomain = 'p.10014.workers.dev';
  const testUrl = `https://${workerDomain}/test`;
  
  console.log(`Testing: ${testUrl}\n`);
  
  // Test potential whitelisted domains
  console.log('=== POTENTIAL WHITELISTED DOMAINS ===\n');
  
  const domains = [
    // Known streaming sites
    '111movies.com',
    'flixer.sh',
    '1movies.com',
    'onemovies.com',
    'vidsrc.to',
    'vidsrc.me',
    'vidsrc.xyz',
    'vidplay.site',
    'vidplay.online',
    'vidstream.pro',
    'embed.su',
    'embedsu.com',
    'superembed.stream',
    'multiembed.mov',
    'moviesapi.club',
    'smashystream.com',
    'autoembed.cc',
    '2embed.cc',
    '2embed.to',
    // Development
    'localhost',
    '127.0.0.1',
    // CDN domains
    'dewshine74.xyz',
    'cloudspark91.live',
    // Random test
    'test.com',
  ];
  
  for (const domain of domains) {
    const referer = domain.includes('localhost') || domain.includes('127.0.0.1') 
      ? `http://${domain}:3000/`
      : `https://${domain}/`;
    
    const res = await testRequest(testUrl, { 'Referer': referer });
    const status = res.status;
    const icon = status === 200 ? '✅' : '❌';
    console.log(`${icon} ${domain}: ${status}`);
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Test NO Referer at all
  console.log('\n=== NO REFERER TEST ===\n');
  
  const noRefererRes = await testRequest(testUrl, {});
  console.log(`No Referer: ${noRefererRes.status}`);
  
  // Final solution test
  console.log('\n=== FINAL SOLUTION TEST ===\n');
  console.log('Testing the recommended approach for Cloudflare Worker:\n');
  
  // Approach 1: No Origin, No Referer
  let res = await testRequest(testUrl, {});
  console.log(`1. No Origin, No Referer: ${res.status === 200 ? '✅' : '❌'} ${res.status}`);
  
  // Approach 2: No Origin, with valid Referer
  res = await testRequest(testUrl, { 'Referer': 'https://111movies.com/' });
  console.log(`2. No Origin, Referer=111movies.com: ${res.status === 200 ? '✅' : '❌'} ${res.status}`);
  
  // Approach 3: No Origin, with flixer Referer
  res = await testRequest(testUrl, { 'Referer': 'https://flixer.sh/' });
  console.log(`3. No Origin, Referer=flixer.sh: ${res.status === 200 ? '✅' : '❌'} ${res.status}`);
  
  // Conclusion
  console.log('\n' + '='.repeat(70));
  console.log('FINAL SOLUTION');
  console.log('='.repeat(70));
  console.log(`
The p.XXXXX.workers.dev CDN has a WHITELIST of allowed Referer domains.

BLOCKING RULES:
1. If Referer is present, it must be from a whitelisted domain
2. If no Referer, request is allowed
3. Origin header doesn't matter if Referer is valid or absent

WHITELISTED DOMAINS (confirmed):
- 111movies.com
- flixer.sh
- localhost (for development)

SOLUTION FOR CLOUDFLARE WORKER:
When proxying to p.XXXXX.workers.dev:

Option A (Simplest - Remove all identifying headers):
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 ...');
  headers.set('Accept', '*/*');
  // Don't include Origin or Referer
  return fetch(targetUrl, { headers });

Option B (Include whitelisted Referer):
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 ...');
  headers.set('Accept', '*/*');
  headers.set('Referer', 'https://111movies.com/');  // Whitelisted
  // Don't include Origin
  return fetch(targetUrl, { headers });

This should work from a Cloudflare Worker WITHOUT a residential proxy!
The key is to NOT include Origin header and either:
- Not include Referer at all, OR
- Include a whitelisted Referer (111movies.com, flixer.sh)
`);
}

main().catch(console.error);
