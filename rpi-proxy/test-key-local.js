#!/usr/bin/env node
/**
 * Test key fetching directly from the RPI
 * Run this ON the Raspberry Pi to verify the residential IP works
 */

const https = require('https');
const { spawn } = require('child_process');

const KEY_URL = 'https://chevy.kiko2.ru/key/premium51/5885920';

// Test 1: Simple Node.js https
async function testNodeHttps() {
  console.log('\n=== Test 1: Node.js https (no special headers) ===');
  
  return new Promise((resolve) => {
    const url = new URL(KEY_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log('Status:', res.statusCode);
        console.log('Data length:', data.length);
        console.log('Data:', data.toString('utf8').substring(0, 100));
        if (data.length === 16 && !data.toString('utf8').includes('error')) {
          console.log('✓ Valid key! Hex:', data.toString('hex'));
        }
        resolve();
      });
    });
    req.on('error', (err) => { console.log('Error:', err.message); resolve(); });
    req.end();
  });
}

// Test 2: Node.js with Origin/Referer
async function testNodeWithHeaders() {
  console.log('\n=== Test 2: Node.js https with Origin/Referer ===');
  
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
        console.log('Status:', res.statusCode);
        console.log('Data length:', data.length);
        console.log('Data:', data.toString('utf8').substring(0, 100));
        if (data.length === 16 && !data.toString('utf8').includes('error')) {
          console.log('✓ Valid key! Hex:', data.toString('hex'));
        }
        resolve();
      });
    });
    req.on('error', (err) => { console.log('Error:', err.message); resolve(); });
    req.end();
  });
}

// Test 3: Curl with full browser headers
async function testCurl() {
  console.log('\n=== Test 3: Curl with full browser headers ===');
  
  return new Promise((resolve) => {
    const args = [
      '-s', '--max-time', '30', '--http2', '-k',
      '-H', 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      '-H', 'sec-ch-ua: "Brave";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      '-H', 'sec-ch-ua-mobile: ?0',
      '-H', 'sec-ch-ua-platform: "Windows"',
      '-H', 'sec-fetch-site: cross-site',
      '-H', 'sec-fetch-mode: cors',
      '-H', 'sec-fetch-dest: empty',
      '-H', 'origin: https://epicplayplay.cfd',
      '-H', 'referer: https://epicplayplay.cfd/',
      '-H', 'accept: */*',
      '-w', '\\nHTTP_CODE:%{http_code}',
      KEY_URL
    ];
    
    console.log('Curl command:', 'curl', args.join(' '));
    
    const curl = spawn('curl', args);
    const chunks = [];
    
    curl.stdout.on('data', (data) => chunks.push(data));
    curl.stderr.on('data', (data) => console.log('stderr:', data.toString()));
    
    curl.on('close', (code) => {
      const output = Buffer.concat(chunks);
      const outputStr = output.toString();
      
      // Extract HTTP code from the end
      const httpCodeMatch = outputStr.match(/HTTP_CODE:(\d+)/);
      const httpCode = httpCodeMatch ? httpCodeMatch[1] : 'unknown';
      
      // Remove the HTTP_CODE suffix to get actual data
      const dataEnd = outputStr.indexOf('\nHTTP_CODE:');
      const data = dataEnd > 0 ? output.slice(0, dataEnd) : output;
      
      console.log('Exit code:', code);
      console.log('HTTP status:', httpCode);
      console.log('Data length:', data.length);
      console.log('Data:', data.toString('utf8').substring(0, 100));
      
      if (data.length === 16 && !data.toString('utf8').includes('error')) {
        console.log('✓ Valid key! Hex:', data.toString('hex'));
      }
      resolve();
    });
  });
}

// Test 4: Simple curl without special headers
async function testCurlSimple() {
  console.log('\n=== Test 4: Simple curl (minimal headers) ===');
  
  return new Promise((resolve) => {
    const curl = spawn('curl', ['-s', '-w', '\\nHTTP_CODE:%{http_code}', KEY_URL]);
    const chunks = [];
    
    curl.stdout.on('data', (data) => chunks.push(data));
    
    curl.on('close', (code) => {
      const output = Buffer.concat(chunks);
      const outputStr = output.toString();
      const httpCodeMatch = outputStr.match(/HTTP_CODE:(\d+)/);
      const httpCode = httpCodeMatch ? httpCodeMatch[1] : 'unknown';
      const dataEnd = outputStr.indexOf('\nHTTP_CODE:');
      const data = dataEnd > 0 ? output.slice(0, dataEnd) : output;
      
      console.log('HTTP status:', httpCode);
      console.log('Data length:', data.length);
      console.log('Data:', data.toString('utf8').substring(0, 100));
      
      if (data.length === 16 && !data.toString('utf8').includes('error')) {
        console.log('✓ Valid key! Hex:', data.toString('hex'));
      }
      resolve();
    });
  });
}

// Test 5: curl-impersonate (Chrome TLS fingerprint)
async function testCurlImpersonate() {
  console.log('\n=== Test 5: curl-impersonate (Chrome fingerprint) ===');
  console.log('Install: https://github.com/lwthiker/curl-impersonate');
  
  return new Promise((resolve) => {
    // Try curl_chrome116 if installed
    const curl = spawn('curl_chrome116', [
      '-s',
      '-H', 'origin: https://epicplayplay.cfd',
      '-H', 'referer: https://epicplayplay.cfd/',
      '-w', '\\nHTTP_CODE:%{http_code}',
      KEY_URL
    ]);
    const chunks = [];
    let hasError = false;
    
    curl.stdout.on('data', (data) => chunks.push(data));
    curl.stderr.on('data', (data) => {
      if (!hasError) {
        console.log('curl-impersonate not installed or error');
        hasError = true;
      }
    });
    
    curl.on('error', () => {
      console.log('curl-impersonate not installed');
      resolve();
    });
    
    curl.on('close', (code) => {
      if (hasError || chunks.length === 0) {
        resolve();
        return;
      }
      const output = Buffer.concat(chunks);
      const outputStr = output.toString();
      const httpCodeMatch = outputStr.match(/HTTP_CODE:(\d+)/);
      const httpCode = httpCodeMatch ? httpCodeMatch[1] : 'unknown';
      const dataEnd = outputStr.indexOf('\nHTTP_CODE:');
      const data = dataEnd > 0 ? output.slice(0, dataEnd) : output;
      
      console.log('HTTP status:', httpCode);
      console.log('Data length:', data.length);
      console.log('Data:', data.toString('utf8').substring(0, 100));
      
      if (data.length === 16 && !data.toString('utf8').includes('error')) {
        console.log('✓ Valid key! Hex:', data.toString('hex'));
      }
      resolve();
    });
  });
}

async function main() {
  console.log('Testing DLHD key fetch from RPI...');
  console.log('Key URL:', KEY_URL);
  console.log('Run this script ON the Raspberry Pi to test residential IP');
  
  await testNodeHttps();
  await testNodeWithHeaders();
  await testCurl();
  await testCurlSimple();
  
  console.log('\n=== Done ===');
  console.log('If all tests return E3 error, the RPI IP may be blocked.');
  console.log('If any test returns a valid 16-byte key, use that method.');
}

main();
