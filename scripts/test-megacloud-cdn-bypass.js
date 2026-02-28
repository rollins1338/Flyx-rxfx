#!/usr/bin/env node
/**
 * Test different approaches to bypass MegaCloud CDN Cloudflare 403
 * The CDN URL is valid but Cloudflare blocks all requests.
 * Let's figure out what headers/TLS fingerprint they need.
 */

const https = require('https');
const http2 = require('http2');

const CDN_URL = process.argv[2] || '';

if (!CDN_URL) {
  console.log('Usage: node test-megacloud-cdn-bypass.js <cdn_url>');
  console.log('Get a CDN URL from: node scripts/test-megacloud-e2e.js');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

async function testMethod(name, fn) {
  console.log(`\n--- ${name} ---`);
  try {
    const result = await fn();
    console.log(`  Status: ${result.status}`);
    console.log(`  Content-Type: ${result.contentType}`);
    console.log(`  Size: ${result.size} bytes`);
    if (result.isM3u8) console.log(`  ✓✓✓ GOT M3U8!`);
    else console.log(`  Body preview: ${result.body.substring(0, 150)}`);
    return result.status;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return -1;
  }
}

// Method 1: Node fetch (undici) — default
async function fetchDefault() {
  const res = await fetch(CDN_URL, {
    headers: { 'User-Agent': UA, 'Accept': '*/*' },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  return { status: res.status, contentType: res.headers.get('content-type'), size: text.length, body: text, isM3u8: text.includes('#EXTM3U') };
}

// Method 2: Node https.request with IPv4
function httpsIPv4() {
  return new Promise((resolve, reject) => {
    const url = new URL(CDN_URL);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
      },
      family: 4,
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, contentType: res.headers['content-type'], size: text.length, body: text, isM3u8: text.includes('#EXTM3U') });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// Method 3: With Referer header (megacloud.blog)
async function fetchWithReferer() {
  const res = await fetch(CDN_URL, {
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Referer': 'https://megacloud.blog/',
      'Origin': 'https://megacloud.blog',
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  return { status: res.status, contentType: res.headers.get('content-type'), size: text.length, body: text, isM3u8: text.includes('#EXTM3U') };
}

// Method 4: With sec-fetch headers (browser-like)
async function fetchBrowserLike() {
  const res = await fetch(CDN_URL, {
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://megacloud.blog/',
      'Origin': 'https://megacloud.blog',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Ch-Ua': '"Chromium";v="137", "Not/A)Brand";v="24", "Google Chrome";v="137"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  return { status: res.status, contentType: res.headers.get('content-type'), size: text.length, body: text, isM3u8: text.includes('#EXTM3U') };
}

// Method 5: Minimal headers
async function fetchMinimal() {
  const res = await fetch(CDN_URL, {
    headers: { 'Accept': '*/*' },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  return { status: res.status, contentType: res.headers.get('content-type'), size: text.length, body: text, isM3u8: text.includes('#EXTM3U') };
}

// Method 6: https with TLS options
function httpsWithTLS() {
  return new Promise((resolve, reject) => {
    const url = new URL(CDN_URL);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Referer': 'https://megacloud.blog/',
        'Origin': 'https://megacloud.blog',
      },
      family: 4,
      timeout: 15000,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, contentType: res.headers['content-type'], size: text.length, body: text, isM3u8: text.includes('#EXTM3U') });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function main() {
  console.log('=== MEGACLOUD CDN BYPASS TEST ===');
  console.log(`URL: ${CDN_URL.substring(0, 80)}...`);
  console.log(`Host: ${new URL(CDN_URL).hostname}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // First, check what the 403 page actually says
  console.log('--- Checking 403 response details ---');
  try {
    const res = await fetch(CDN_URL, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    console.log(`  Status: ${res.status}`);
    console.log(`  CF-Ray: ${res.headers.get('cf-ray')}`);
    console.log(`  Server: ${res.headers.get('server')}`);
    // Check for specific Cloudflare block types
    if (text.includes('Sorry, you have been blocked')) console.log('  Block type: IP/ASN block');
    else if (text.includes('Checking your browser')) console.log('  Block type: JS Challenge');
    else if (text.includes('challenge-platform')) console.log('  Block type: Turnstile/Managed Challenge');
    else if (text.includes('Access denied')) console.log('  Block type: WAF rule');
    else if (text.includes('Ray ID')) console.log('  Block type: Generic CF block');
    else console.log(`  Block type: Unknown (first 200: ${text.substring(0, 200)})`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  const results = {};
  results['1-fetch-default'] = await testMethod('1. Node fetch (undici) default', fetchDefault);
  results['2-https-ipv4'] = await testMethod('2. https.request IPv4', httpsIPv4);
  results['3-with-referer'] = await testMethod('3. fetch + Referer: megacloud.blog', fetchWithReferer);
  results['4-browser-like'] = await testMethod('4. fetch + full browser headers', fetchBrowserLike);
  results['5-minimal'] = await testMethod('5. fetch minimal headers', fetchMinimal);
  results['6-https-tls'] = await testMethod('6. https + TLS options + Referer', httpsWithTLS);

  console.log('\n\n=== SUMMARY ===');
  for (const [method, status] of Object.entries(results)) {
    console.log(`  ${method}: ${status === 200 ? '✓ OK' : `✗ ${status}`}`);
  }
}

main();
