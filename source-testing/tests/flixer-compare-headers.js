/**
 * Compare headers between browser and our Node.js implementation
 */
const puppeteer = require('puppeteer');

async function compareHeaders() {
  console.log('=== Comparing Browser vs Node.js Headers ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture the exact headers the browser sends
  const capturedHeaders = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/images')) {
      capturedHeaders.push({
        url,
        headers: request.headers()
      });
    }
  });
  
  // Navigate to a TV show page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout, continuing...');
  }
  
  // Wait for requests
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('\n=== Browser Headers ===');
  for (const req of capturedHeaders.slice(0, 3)) {
    console.log('\nURL:', req.url);
    console.log('Headers:');
    const importantHeaders = [
      'accept', 'accept-encoding', 'accept-language', 'cache-control',
      'origin', 'referer', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
      'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'user-agent',
      'x-api-key', 'x-client-fingerprint', 'x-only-sources', 'x-request-nonce',
      'x-request-signature', 'x-request-timestamp', 'x-server', 'bw90agfmywth'
    ];
    
    for (const key of Object.keys(req.headers).sort()) {
      if (importantHeaders.includes(key.toLowerCase()) || key.toLowerCase().startsWith('x-')) {
        console.log(`  ${key}: ${req.headers[key]}`);
      }
    }
  }
  
  await browser.close();
  
  // Now show what our Node.js implementation sends
  console.log('\n\n=== Node.js Headers (our implementation) ===');
  const crypto = require('crypto');
  
  const apiKey = 'a'.repeat(64); // Placeholder
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '').substring(0, 22);
  const path = '/api/tmdb/tv/94605/season/1/episode/1/images';
  const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
  const signature = crypto.createHmac('sha256', apiKey).update(message).digest('base64');
  
  // Generate fingerprint like our implementation
  const screenWidth = 1920, screenHeight = 1080, colorDepth = 24;
  const platform = 'Win32', language = 'en-US';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  const timezoneOffset = new Date().getTimezoneOffset();
  const canvasData = `canvas-fp-${screenWidth}x${screenHeight}-${colorDepth}-${platform}-${language}`;
  const canvasDataUrl = 'data:image/png;base64,' + Buffer.from(canvasData).toString('base64');
  const canvasSubstr = canvasDataUrl.substring(22, 50);
  const fpString = `${screenWidth}x${screenHeight}:${colorDepth}:${userAgent.substring(0, 50)}:${platform}:${language}:${timezoneOffset}:${canvasSubstr}`;
  let hash = 0;
  for (let i = 0; i < fpString.length; i++) {
    hash = (hash << 5) - hash + fpString.charCodeAt(i);
    hash &= hash;
  }
  const fingerprint = Math.abs(hash).toString(36);
  
  console.log('Headers we send:');
  console.log(`  X-Api-Key: ${apiKey.substring(0, 16)}...`);
  console.log(`  X-Request-Timestamp: ${timestamp}`);
  console.log(`  X-Request-Nonce: ${nonce}`);
  console.log(`  X-Request-Signature: ${signature}`);
  console.log(`  X-Client-Fingerprint: ${fingerprint}`);
  console.log(`  X-Only-Sources: 1`);
  console.log(`  X-Server: alpha`);
  console.log(`  bW90aGFmYWth: 1`);
  console.log(`  Accept: text/plain`);
  console.log(`  User-Agent: ${userAgent}`);
  console.log(`  Origin: https://flixer.sh`);
  console.log(`  Referer: https://flixer.sh/`);
  
  console.log('\n\nDone!');
}

compareHeaders().catch(console.error);
