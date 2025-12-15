/**
 * Test DLHD key fetching directly - simulating what CF Worker does
 */

const https = require('https');

const KEY_URL = 'https://chevy.kiko2.ru/key/premium51/5885919';

async function testDirectFetch() {
  console.log('Testing direct key fetch...');
  console.log('URL:', KEY_URL);
  
  return new Promise((resolve) => {
    const url = new URL(KEY_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log('\n=== Response ===');
        console.log('Status:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
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

async function testWithoutOrigin() {
  console.log('\n\nTesting WITHOUT Origin header...');
  
  return new Promise((resolve) => {
    const url = new URL(KEY_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log('\n=== Response ===');
        console.log('Status:', res.statusCode);
        console.log('Data length:', data.length);
        
        if (data.length === 16) {
          console.log('✓ Valid AES-128 key!');
          console.log('Key (hex):', data.toString('hex'));
        } else {
          console.log('✗ Invalid');
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

async function main() {
  await testDirectFetch();
  await testWithoutOrigin();
  console.log('\n=== Done ===');
}

main();
