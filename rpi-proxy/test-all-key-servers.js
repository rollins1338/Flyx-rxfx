#!/usr/bin/env node
/**
 * Test ALL DLHD key servers
 */

const https = require('https');

const CHANNEL = '51';
const KEY_ID = '5885921';

// All known key server prefixes
const KEY_SERVERS = [
  'chevy',
  'zeko', 
  'top1',
  'top2',
  'top3',
  'ford',
  'dodge',
  'tesla',
  'honda',
  'toyota',
];

// Both domains
const DOMAINS = ['kiko2.ru', 'giokko.ru'];

async function testKeyServer(server, domain) {
  const keyUrl = `https://${server}.${domain}/key/premium${CHANNEL}/${KEY_ID}`;
  
  return new Promise((resolve) => {
    const url = new URL(keyUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        const isValid = data.length === 16 && !data.toString('utf8').includes('error');
        resolve({
          server,
          domain,
          url: keyUrl,
          status: res.statusCode,
          length: data.length,
          valid: isValid,
          data: isValid ? data.toString('hex') : data.toString('utf8').substring(0, 50),
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        server,
        domain,
        url: keyUrl,
        error: err.message,
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        server,
        domain,
        url: keyUrl,
        error: 'timeout',
      });
    });
    
    req.end();
  });
}

// Also test the old wmsxx.php format
async function testOldFormat(server, domain) {
  const keyUrl = `https://${server}.${domain}/wmsxx.php?channel=premium${CHANNEL}`;
  
  return new Promise((resolve) => {
    const url = new URL(keyUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        const isValid = data.length === 16 && !data.toString('utf8').includes('error');
        resolve({
          server,
          domain,
          format: 'wmsxx.php',
          url: keyUrl,
          status: res.statusCode,
          length: data.length,
          valid: isValid,
          data: isValid ? data.toString('hex') : data.toString('utf8').substring(0, 50),
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({ server, domain, format: 'wmsxx.php', error: err.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ server, domain, format: 'wmsxx.php', error: 'timeout' });
    });
    
    req.end();
  });
}

async function main() {
  console.log('Testing ALL DLHD key servers...');
  console.log('Channel:', CHANNEL);
  console.log('Key ID:', KEY_ID);
  console.log('');
  
  const results = [];
  
  // Test new /key/premium format
  console.log('=== Testing /key/premium format ===');
  for (const domain of DOMAINS) {
    for (const server of KEY_SERVERS) {
      const result = await testKeyServer(server, domain);
      results.push(result);
      
      if (result.valid) {
        console.log(`✓ ${server}.${domain} - VALID KEY: ${result.data}`);
      } else if (result.error) {
        console.log(`✗ ${server}.${domain} - ${result.error}`);
      } else {
        console.log(`✗ ${server}.${domain} - ${result.status} (${result.length} bytes): ${result.data}`);
      }
    }
  }
  
  // Test old wmsxx.php format
  console.log('\n=== Testing wmsxx.php format ===');
  for (const domain of DOMAINS) {
    for (const server of ['top1', 'top2', 'top3']) {
      const result = await testOldFormat(server, domain);
      results.push(result);
      
      if (result.valid) {
        console.log(`✓ ${server}.${domain}/wmsxx.php - VALID KEY: ${result.data}`);
      } else if (result.error) {
        console.log(`✗ ${server}.${domain}/wmsxx.php - ${result.error}`);
      } else {
        console.log(`✗ ${server}.${domain}/wmsxx.php - ${result.status} (${result.length} bytes)`);
      }
    }
  }
  
  // Summary
  const validResults = results.filter(r => r.valid);
  console.log('\n=== Summary ===');
  console.log(`Total tested: ${results.length}`);
  console.log(`Valid keys found: ${validResults.length}`);
  
  if (validResults.length > 0) {
    console.log('\nWorking servers:');
    validResults.forEach(r => {
      console.log(`  - ${r.url}`);
    });
  }
}

main();
