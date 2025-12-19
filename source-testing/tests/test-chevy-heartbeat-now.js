#!/usr/bin/env node
/**
 * Test what chevy.kiko2.ru/heartbeat returns RIGHT NOW
 */

const https = require('https');

async function main() {
  // First get auth token
  console.log('1. Getting auth token...');
  
  const playerHtml = await new Promise((resolve) => {
    https.get('https://epicplayplay.cfd/premiumtv/daddyhd.php?id=51', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (e) => resolve('ERROR: ' + e.message));
  });
  
  const tokenMatch = playerHtml.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
  if (!tokenMatch) {
    console.log('No token found!');
    return;
  }
  const token = tokenMatch[1];
  console.log('Token:', token.substring(0, 40) + '...');
  
  // Test heartbeat
  console.log('\n2. Testing chevy.kiko2.ru/heartbeat...');
  
  const hbResult = await new Promise((resolve) => {
    https.get('https://chevy.kiko2.ru/heartbeat', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': `Bearer ${token}`,
        'X-Channel-Key': 'premium51',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', (e) => resolve({ status: 'ERROR', error: e.message }));
  });
  
  console.log('Status:', hbResult.status);
  console.log('Response:', hbResult.data);
  
  // Test key fetch
  console.log('\n3. Testing key fetch...');
  
  const keyResult = await new Promise((resolve) => {
    https.get('https://chevy.kiko2.ru/key/premium51/5886983', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': `Bearer ${token}`,
        'X-Channel-Key': 'premium51',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
      }
    }, (res) => {
      let data = Buffer.alloc(0);
      res.on('data', chunk => data = Buffer.concat([data, chunk]));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', (e) => resolve({ status: 'ERROR', error: e.message }));
  });
  
  console.log('Status:', keyResult.status);
  console.log('Size:', keyResult.data.length);
  if (keyResult.data.length === 16) {
    console.log('Valid key:', keyResult.data.toString('hex'));
  } else {
    console.log('Response:', keyResult.data.toString('utf8').substring(0, 200));
  }
}

main().catch(console.error);
