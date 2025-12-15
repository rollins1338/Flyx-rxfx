/**
 * Comprehensive DLHD key fetch test
 * Tries multiple approaches to see what works
 */

const https = require('https');
const { spawn } = require('child_process');

const KEY_URL = 'https://chevy.kiko2.ru/key/premium51/5885923';

// Test 1: Basic fetch
async function testBasicFetch() {
  console.log('=== Test 1: Basic Node.js fetch ===');
  return new Promise((resolve) => {
    https.get(KEY_URL, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log(`Status: ${res.statusCode}, Length: ${data.length}`);
        console.log(`Data: ${data.toString('utf8').substring(0, 50)}`);
        resolve();
      });
    }).on('error', (e) => {
      console.log(`Error: ${e.message}`);
      resolve();
    });
  });
}

// Test 2: With browser headers
async function testWithBrowserHeaders() {
  console.log('\n=== Test 2: With browser headers ===');
  return new Promise((resolve) => {
    const url = new URL(KEY_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
        'Sec-Ch-Ua': '"Chromium";v="143", "Not A(Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        console.log(`Status: ${res.statusCode}, Length: ${data.length}`);
        console.log(`Data: ${data.toString('utf8').substring(0, 50)}`);
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log(`Error: ${e.message}`);
      resolve();
    });
    req.end();
  });
}

// Test 3: With different origins
async function testDifferentOrigins() {
  console.log('\n=== Test 3: Different origins ===');
  const origins = [
    'https://epicplayplay.cfd',
    'https://dlhd.so',
    'https://dlhd.dad',
    'https://daddyhd.com',
    null, // No origin
  ];
  
  for (const origin of origins) {
    await new Promise((resolve) => {
      const url = new URL(KEY_URL);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      };
      if (origin) {
        headers['Origin'] = origin;
        headers['Referer'] = origin + '/';
      }
      
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname,
        method: 'GET',
        headers
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          const isValid = data.length === 16 && !data.toString('utf8').includes('error');
          console.log(`Origin: ${origin || 'none'} -> ${res.statusCode} (${data.length}b) ${isValid ? 'VALID!' : data.toString('utf8').substring(0, 20)}`);
          resolve();
        });
      });
      req.on('error', () => resolve());
      req.end();
    });
  }
}

// Test 4: With curl (bypasses Node TLS)
async function testWithCurl() {
  console.log('\n=== Test 4: With curl ===');
  return new Promise((resolve) => {
    const curl = spawn('curl', [
      '-s', '-i', '--http2', '-k',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      '-H', 'Origin: https://epicplayplay.cfd',
      '-H', 'Referer: https://epicplayplay.cfd/',
      KEY_URL
    ], { shell: true });
    
    const chunks = [];
    curl.stdout.on('data', (data) => chunks.push(data));
    curl.on('close', () => {
      const output = Buffer.concat(chunks);
      // Parse status from headers
      const statusMatch = output.toString().match(/HTTP\/[\d.]+ (\d+)/);
      const status = statusMatch ? statusMatch[1] : 'unknown';
      
      // Find body after headers
      const headerEnd = output.indexOf(Buffer.from('\r\n\r\n'));
      const body = headerEnd > 0 ? output.slice(headerEnd + 4) : output;
      
      console.log(`Status: ${status}, Length: ${body.length}`);
      console.log(`Data: ${body.toString('utf8').substring(0, 50)}`);
      resolve();
    });
    curl.on('error', () => {
      console.log('Curl not available');
      resolve();
    });
  });
}

// Test 5: Check if key changes over time
async function testKeyRotation() {
  console.log('\n=== Test 5: Check key ID from fresh M3U8 ===');
  return new Promise((resolve) => {
    https.get('https://zekonew.kiko2.ru/zeko/premium51/mono.css', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const keyMatch = data.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
        if (keyMatch) {
          console.log(`Current key URL: ${keyMatch[1]}`);
          
          // Extract key ID
          const idMatch = keyMatch[1].match(/\/(\d+)$/);
          if (idMatch) {
            console.log(`Key ID: ${idMatch[1]}`);
          }
        } else {
          console.log('No key URL found in M3U8');
        }
        resolve();
      });
    }).on('error', (e) => {
      console.log(`Error: ${e.message}`);
      resolve();
    });
  });
}

async function main() {
  console.log('Comprehensive DLHD key fetch test');
  console.log('Key URL:', KEY_URL);
  console.log('');
  
  await testBasicFetch();
  await testWithBrowserHeaders();
  await testDifferentOrigins();
  await testWithCurl();
  await testKeyRotation();
  
  console.log('\n=== Summary ===');
  console.log('If all tests return E3 error, the IP is blocked.');
  console.log('The key server requires a residential IP.');
  console.log('Run test-ip-type.js on the RPI to check its IP type.');
}

main();
