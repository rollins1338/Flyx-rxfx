/**
 * Test DLHD key fetching through the proxy chain
 */

const https = require('https');
const http = require('http');

// Test key URL from the error logs
const KEY_URL = 'https://chevy.kiko2.ru/key/premium51/5885916';

// Your RPI proxy URL (update this)
const RPI_PROXY_URL = process.env.RPI_PROXY_URL || 'http://localhost:3001';
const RPI_API_KEY = process.env.RPI_API_KEY || 'change-this-secret-key';

async function testDirectKeyFetch() {
  console.log('\n=== Test 1: Direct key fetch (will likely fail) ===');
  console.log('URL:', KEY_URL);
  
  return new Promise((resolve) => {
    const url = new URL(KEY_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log('Status:', res.statusCode);
        console.log('Content-Type:', res.headers['content-type']);
        console.log('Data length:', data.length);
        if (data.length === 16) {
          console.log('✓ Valid AES-128 key!');
        } else {
          console.log('✗ Invalid key size, preview:', data.toString('utf8').substring(0, 100));
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('Error:', err.message);
      resolve();
    });
    
    req.end();
  });
}

async function testRpiProxy() {
  console.log('\n=== Test 2: Fetch via RPI proxy ===');
  console.log('RPI Proxy:', RPI_PROXY_URL);
  
  const proxyUrl = `${RPI_PROXY_URL}/proxy?url=${encodeURIComponent(KEY_URL)}`;
  console.log('Proxy URL:', proxyUrl);
  
  return new Promise((resolve) => {
    const url = new URL(proxyUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-API-Key': RPI_API_KEY,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log('Status:', res.statusCode);
        console.log('Content-Type:', res.headers['content-type']);
        console.log('Data length:', data.length);
        if (data.length === 16) {
          console.log('✓ Valid AES-128 key!');
          console.log('Key (hex):', data.toString('hex'));
        } else {
          console.log('✗ Invalid key size');
          console.log('Preview:', data.toString('utf8').substring(0, 200));
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('Error:', err.message);
      resolve();
    });
    
    req.end();
  });
}

async function testCfWorker() {
  console.log('\n=== Test 3: Fetch via CF Worker ===');
  const cfUrl = `https://media-proxy.vynx.workers.dev/dlhd/key?url=${encodeURIComponent(KEY_URL)}`;
  console.log('CF URL:', cfUrl);
  
  return new Promise((resolve) => {
    const url = new URL(cfUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log('Status:', res.statusCode);
        console.log('Content-Type:', res.headers['content-type']);
        console.log('Data length:', data.length);
        if (data.length === 16) {
          console.log('✓ Valid AES-128 key!');
          console.log('Key (hex):', data.toString('hex'));
        } else {
          console.log('✗ Invalid response');
          console.log('Preview:', data.toString('utf8').substring(0, 500));
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('Error:', err.message);
      resolve();
    });
    
    req.end();
  });
}

async function main() {
  console.log('Testing DLHD key fetching...');
  console.log('Key URL:', KEY_URL);
  
  await testDirectKeyFetch();
  await testRpiProxy();
  await testCfWorker();
  
  console.log('\n=== Done ===');
}

main();
