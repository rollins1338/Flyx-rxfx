/**
 * Capture the EXACT headers from a successful browser request
 * and compare with what our Node.js sends
 */
const puppeteer = require('puppeteer');
const crypto = require('crypto');

async function exactHeaderCompare() {
  console.log('=== Exact Header Comparison ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Enable CDP for detailed request capture
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  
  let successfulRequest = null;
  
  // Track which requests get URLs
  await page.evaluateOnNewDocument(() => {
    window.__requestsWithUrls = [];
    
    const checkIntercept = () => {
      if (window.wasmImgData && window.wasmImgData.process_img_data) {
        const original = window.wasmImgData.process_img_data;
        window.wasmImgData.process_img_data = async function(encrypted, key) {
          const result = await original.call(this, encrypted, key);
          try {
            const parsed = JSON.parse(result);
            if (parsed.sources?.some(s => s.url && s.url.length > 0)) {
              window.__requestsWithUrls.push(Date.now());
            }
          } catch (e) {}
          return result;
        };
      } else {
        setTimeout(checkIntercept, 100);
      }
    };
    setTimeout(checkIntercept, 500);
  });
  
  client.on('Network.requestWillBeSent', event => {
    if (event.request.url.includes('/images') && 
        event.request.headers['X-Server'] === 'alpha') {
      successfulRequest = {
        url: event.request.url,
        method: event.request.method,
        headers: event.request.headers
      };
    }
  });
  
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
    waitUntil: 'networkidle2', 
    timeout: 60000 
  });
  
  await new Promise(r => setTimeout(r, 5000));
  
  if (successfulRequest) {
    console.log('\n=== Browser Request Headers (that got URL) ===');
    const browserHeaders = successfulRequest.headers;
    
    // Sort and print all headers
    const sortedKeys = Object.keys(browserHeaders).sort();
    for (const key of sortedKeys) {
      const value = browserHeaders[key];
      if (key === 'X-Api-Key') {
        console.log(`${key}: ${value.substring(0, 32)}...`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    
    // Now generate what our Node.js would send
    console.log('\n=== Node.js Headers (what we send) ===');
    
    const apiKey = 'a'.repeat(64); // Placeholder
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('base64')
      .replace(/[/+=]/g, '').substring(0, 22);
    const path = '/api/tmdb/tv/94605/season/1/episode/1/images';
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    const signature = crypto.createHmac('sha256', apiKey).update(message).digest('base64');
    
    const nodeHeaders = {
      'Accept': 'text/plain',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://flixer.sh',
      'Referer': 'https://flixer.sh/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'X-Api-Key': apiKey.substring(0, 32) + '...',
      'X-Client-Fingerprint': 'i2gnkv',
      'X-Only-Sources': '1',
      'X-Request-Nonce': nonce,
      'X-Request-Signature': signature,
      'X-Request-Timestamp': timestamp.toString(),
      'X-Server': 'alpha',
      'bW90aGFmYWth': '1',
      'sec-ch-ua': '"Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
    };
    
    const nodeSortedKeys = Object.keys(nodeHeaders).sort();
    for (const key of nodeSortedKeys) {
      console.log(`${key}: ${nodeHeaders[key]}`);
    }
    
    // Compare
    console.log('\n=== Differences ===');
    const browserKeys = new Set(Object.keys(browserHeaders).map(k => k.toLowerCase()));
    const nodeKeys = new Set(Object.keys(nodeHeaders).map(k => k.toLowerCase()));
    
    console.log('Headers in browser but not in Node.js:');
    for (const key of browserKeys) {
      if (!nodeKeys.has(key)) {
        console.log(`  + ${key}: ${browserHeaders[Object.keys(browserHeaders).find(k => k.toLowerCase() === key)]}`);
      }
    }
    
    console.log('\nHeaders in Node.js but not in browser:');
    for (const key of nodeKeys) {
      if (!browserKeys.has(key)) {
        console.log(`  - ${key}`);
      }
    }
    
    console.log('\nHeaders with different values:');
    for (const key of browserKeys) {
      if (nodeKeys.has(key)) {
        const browserKey = Object.keys(browserHeaders).find(k => k.toLowerCase() === key);
        const nodeKey = Object.keys(nodeHeaders).find(k => k.toLowerCase() === key);
        const browserVal = browserHeaders[browserKey];
        const nodeVal = nodeHeaders[nodeKey];
        
        // Skip dynamic values
        if (['x-api-key', 'x-request-nonce', 'x-request-signature', 'x-request-timestamp'].includes(key)) {
          continue;
        }
        
        if (browserVal !== nodeVal) {
          console.log(`  ${key}:`);
          console.log(`    Browser: ${browserVal}`);
          console.log(`    Node.js: ${nodeVal}`);
        }
      }
    }
  }
  
  await browser.close();
}

exactHeaderCompare().catch(console.error);
