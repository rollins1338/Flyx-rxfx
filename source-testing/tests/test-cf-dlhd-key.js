#!/usr/bin/env node
/**
 * Test the Cloudflare Worker DLHD key proxy
 */

const https = require('https');

async function fetchBinary(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    
    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: buffer });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const channel = '51';
  
  console.log('=== Testing CF Worker DLHD Proxy ===\n');
  
  // Step 1: Get M3U8 from CF Worker
  console.log('Step 1: Fetching M3U8 from CF Worker...\n');
  
  const m3u8Url = `https://media-proxy.vynx.workers.dev/dlhd?channel=${channel}`;
  const m3u8Res = await fetchBinary(m3u8Url);
  
  console.log('M3U8 status:', m3u8Res.status);
  
  if (m3u8Res.status !== 200) {
    console.log('M3U8 response:', m3u8Res.body.toString());
    return;
  }
  
  const m3u8 = m3u8Res.body.toString();
  console.log('M3U8 preview:');
  console.log(m3u8.substring(0, 500));
  
  // Extract key URL from M3U8
  const keyUrlMatch = m3u8.match(/URI="([^"]+)"/);
  if (!keyUrlMatch) {
    console.log('\nNo key URL found in M3U8');
    return;
  }
  
  const keyProxyUrl = keyUrlMatch[1];
  console.log('\nKey proxy URL:', keyProxyUrl);
  
  // Step 2: Fetch key through CF Worker
  console.log('\nStep 2: Fetching key through CF Worker...\n');
  
  const keyRes = await fetchBinary(keyProxyUrl);
  
  console.log('Key status:', keyRes.status);
  console.log('Key size:', keyRes.body.length, 'bytes');
  
  if (keyRes.body.length === 16) {
    console.log('Key hex:', keyRes.body.toString('hex'));
    console.log('\n✅ SUCCESS! Valid 16-byte AES-128 key');
  } else {
    console.log('\n❌ Invalid key response');
    const text = keyRes.body.toString();
    try {
      const json = JSON.parse(text);
      console.log('Error response:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Response:', text.substring(0, 500));
    }
  }
}

main().catch(console.error);
