/**
 * Investigate p.XXXXX.workers.dev CDN Blocking - Version 3
 * 
 * This version focuses on understanding the Cloudflare Worker's blocking mechanism.
 * 
 * Key insight: The p.XXXXX.workers.dev is itself a Cloudflare Worker, which means:
 * 1. It has access to CF-specific request metadata
 * 2. It can detect the source IP's ASN (Autonomous System Number)
 * 3. It can detect if the request comes from another CF Worker
 * 4. It can check CF-Connecting-IP (the real client IP)
 * 
 * The Worker likely checks:
 * - ASN of CF-Connecting-IP (datacenter ASNs like AWS, GCP, Azure, Cloudflare)
 * - CF-Worker header (present when request comes from another Worker)
 * - IP reputation/type from Cloudflare's threat intelligence
 */

const https = require('https');
const { URL } = require('url');

// Known datacenter ASNs that are commonly blocked
const DATACENTER_ASNS = {
  'AS13335': 'Cloudflare',
  'AS14618': 'Amazon AWS',
  'AS16509': 'Amazon AWS',
  'AS15169': 'Google Cloud',
  'AS8075': 'Microsoft Azure',
  'AS396982': 'Google Cloud',
  'AS14061': 'DigitalOcean',
  'AS63949': 'Linode',
  'AS20473': 'Vultr',
  'AS24940': 'Hetzner',
};

/**
 * Make a request and capture detailed response info
 */
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
    
    const startTime = Date.now();
    
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          success: true,
          status: res.statusCode,
          headers: res.headers,
          body: body.toString('utf8'),
          bodyLength: body.length,
          duration: Date.now() - startTime,
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
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
 * Check what IP we're making requests from
 */
async function checkOurIP() {
  console.log('Checking our IP address...\n');
  
  // Use multiple IP check services
  const services = [
    { url: 'https://api.ipify.org?format=json', parse: (d) => JSON.parse(d).ip },
    { url: 'https://ipinfo.io/json', parse: (d) => JSON.parse(d) },
  ];
  
  for (const service of services) {
    try {
      const res = await testRequest(service.url);
      if (res.success && res.status === 200) {
        const data = service.parse(res.body);
        if (typeof data === 'object') {
          console.log(`IP Info from ${service.url}:`);
          console.log(`  IP: ${data.ip}`);
          console.log(`  City: ${data.city || 'N/A'}`);
          console.log(`  Region: ${data.region || 'N/A'}`);
          console.log(`  Country: ${data.country || 'N/A'}`);
          console.log(`  Org: ${data.org || 'N/A'}`);
          
          // Check if it's a known datacenter ASN
          const asn = data.org?.split(' ')[0];
          if (asn && DATACENTER_ASNS[asn]) {
            console.log(`  ⚠️ DATACENTER IP DETECTED: ${DATACENTER_ASNS[asn]}`);
          } else {
            console.log(`  ✅ Not a known datacenter ASN`);
          }
        } else {
          console.log(`IP: ${data}`);
        }
        return;
      }
    } catch (e) {
      console.log(`Failed to check IP via ${service.url}: ${e.message}`);
    }
  }
}

/**
 * Test the p.XXXXX.workers.dev CDN directly
 */
async function testWorkersCdn() {
  console.log('\n' + '='.repeat(70));
  console.log('TESTING p.XXXXX.workers.dev CDN');
  console.log('='.repeat(70));
  
  // Test the base worker domain
  const workerDomain = 'p.10014.workers.dev';
  
  console.log(`\nTesting worker domain: ${workerDomain}`);
  
  // Test 1: Root path
  console.log('\n1. Testing root path (/)...');
  let res = await testRequest(`https://${workerDomain}/`);
  console.log(`   Status: ${res.status}`);
  console.log(`   CF-Ray: ${res.headers?.['cf-ray'] || 'N/A'}`);
  console.log(`   Body: ${res.body?.substring(0, 100) || 'N/A'}`);
  
  // Test 2: Random path
  console.log('\n2. Testing random path (/test)...');
  res = await testRequest(`https://${workerDomain}/test`);
  console.log(`   Status: ${res.status}`);
  console.log(`   CF-Ray: ${res.headers?.['cf-ray'] || 'N/A'}`);
  console.log(`   Body: ${res.body?.substring(0, 100) || 'N/A'}`);
  
  // Test 3: With a path that looks like a real CDN path
  console.log('\n3. Testing CDN-like path...');
  res = await testRequest(`https://${workerDomain}/dewshine74.xyz/file2/test.m3u8`);
  console.log(`   Status: ${res.status}`);
  console.log(`   CF-Ray: ${res.headers?.['cf-ray'] || 'N/A'}`);
  console.log(`   Body: ${res.body?.substring(0, 100) || 'N/A'}`);
  
  // Test 4: Check response headers for clues
  console.log('\n4. Analyzing response headers...');
  res = await testRequest(`https://${workerDomain}/`);
  console.log('   Response headers:');
  for (const [key, value] of Object.entries(res.headers || {})) {
    if (key.startsWith('cf-') || key.startsWith('x-') || key === 'server') {
      console.log(`     ${key}: ${value}`);
    }
  }
}

/**
 * Analyze what the Worker might be checking
 */
async function analyzeBlockingMechanism() {
  console.log('\n' + '='.repeat(70));
  console.log('ANALYZING BLOCKING MECHANISM');
  console.log('='.repeat(70));
  
  console.log(`
The p.XXXXX.workers.dev CDN is a Cloudflare Worker that acts as a proxy.
When a request comes in, the Worker has access to:

1. CF-Connecting-IP: The real client IP (set by Cloudflare, cannot be spoofed)
2. CF-IPCountry: The country of the client IP
3. CF-Ray: Unique request ID
4. CF-Worker: Present if request comes from another Worker
5. request.cf object: Contains ASN, colo, tlsVersion, etc.

The Worker likely checks:
- request.cf.asn: The ASN of the client IP
- request.cf.asOrganization: The organization name (e.g., "Amazon.com, Inc.")
- request.cf.isBot: Cloudflare's bot detection score

Possible blocking logic:
\`\`\`javascript
export default {
  async fetch(request, env) {
    const cf = request.cf;
    
    // Block datacenter IPs
    const datacenterASNs = [13335, 14618, 16509, 15169, 8075, ...];
    if (datacenterASNs.includes(cf.asn)) {
      return new Response('Forbidden', { status: 403 });
    }
    
    // Block requests from other Workers
    if (request.headers.get('CF-Worker')) {
      return new Response('Forbidden', { status: 403 });
    }
    
    // Forward to backend CDN
    return fetch(backendUrl, { headers: request.headers });
  }
}
\`\`\`

To bypass this, we need:
1. A residential IP (not from a datacenter ASN)
2. OR find a way to make the Worker think we're residential
3. OR find an alternative endpoint that doesn't have this check
`);
}

/**
 * Test if the blocking is ASN-based or IP-based
 */
async function testBlockingType() {
  console.log('\n' + '='.repeat(70));
  console.log('TESTING BLOCKING TYPE');
  console.log('='.repeat(70));
  
  // If we're on a datacenter IP, all requests should fail
  // If we're on a residential IP, requests should work
  
  const workerDomain = 'p.10014.workers.dev';
  
  // Test with different header combinations
  const tests = [
    { name: 'No headers', headers: {} },
    { name: 'With Accept', headers: { 'Accept': '*/*' } },
    { name: 'With Range', headers: { 'Range': 'bytes=0-1000' } },
    { name: 'With Referer', headers: { 'Referer': 'https://111movies.com/' } },
    { name: 'With Origin', headers: { 'Origin': 'https://111movies.com' } },
    { name: 'Full browser headers', headers: {
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://111movies.com/',
      'Origin': 'https://111movies.com',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    }},
  ];
  
  console.log(`\nTesting ${workerDomain} with different headers...\n`);
  
  let allFailed = true;
  let allSucceeded = true;
  
  for (const test of tests) {
    const res = await testRequest(`https://${workerDomain}/test`, test.headers);
    const status = res.status || 'Error';
    const isSuccess = res.status === 200;
    
    if (isSuccess) allFailed = false;
    else allSucceeded = false;
    
    console.log(`${isSuccess ? '✅' : '❌'} ${test.name}: ${status}`);
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log('\n' + '-'.repeat(70));
  
  if (allFailed) {
    console.log(`
CONCLUSION: ALL requests failed
→ This indicates IP-based blocking (ASN check)
→ Your IP is likely from a datacenter ASN
→ Solution: Use a residential proxy
`);
  } else if (allSucceeded) {
    console.log(`
CONCLUSION: ALL requests succeeded
→ Your IP is not blocked
→ The CDN works from your current IP
→ The blocking only affects datacenter IPs
`);
  } else {
    console.log(`
CONCLUSION: MIXED results
→ Some header combinations work, others don't
→ This indicates header-based blocking
→ We can potentially bypass by using the right headers
`);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('p.XXXXX.workers.dev CDN BLOCKING INVESTIGATION - v3');
  console.log('='.repeat(70));
  console.log();
  
  // Check our IP first
  await checkOurIP();
  
  // Test the CDN
  await testWorkersCdn();
  
  // Analyze blocking mechanism
  await analyzeBlockingMechanism();
  
  // Test blocking type
  await testBlockingType();
  
  console.log('\n' + '='.repeat(70));
  console.log('NEXT STEPS');
  console.log('='.repeat(70));
  console.log(`
Based on the analysis:

1. If IP-based blocking (most likely):
   - Continue using residential proxy (current solution)
   - Consider: Cloudflare WARP (might work as it uses residential-like IPs)
   - Consider: Finding the backend CDN directly (dewshine74.xyz, etc.)

2. If header-based blocking:
   - Update the proxy to use the correct headers
   - Test which specific headers are required

3. Alternative approaches:
   - Reverse engineer the Worker's source code (if accessible)
   - Find the backend CDN and access it directly
   - Use a different provider that doesn't have this blocking

4. To test from a residential IP:
   - Run this script from a home computer
   - Use a VPN with residential IPs
   - Use a mobile hotspot
`);
}

main().catch(console.error);
