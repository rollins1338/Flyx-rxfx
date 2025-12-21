/**
 * Capture the exact headers of requests that get URLs
 */
const puppeteer = require('puppeteer');

async function captureSuccessfulHeaders() {
  console.log('=== Capturing Successful Request Headers ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track requests with their full headers
  const requests = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/tmdb') && url.includes('/images')) {
      requests.push({
        url,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
    }
  });
  
  // Inject interceptor to track which responses have URLs
  await page.evaluateOnNewDocument(() => {
    window.__responseResults = [];
    
    const checkAndIntercept = () => {
      if (window.wasmImgData && window.wasmImgData.process_img_data) {
        const original = window.wasmImgData.process_img_data;
        window.wasmImgData.process_img_data = async function(encrypted, key) {
          const result = await original.call(this, encrypted, key);
          try {
            const parsed = JSON.parse(result);
            const hasUrl = parsed.sources?.some(s => s.url && s.url.length > 0);
            window.__responseResults.push({
              encrypted: encrypted.substring(0, 30),
              hasUrl,
              url: hasUrl ? parsed.sources.find(s => s.url)?.url?.substring(0, 50) : null
            });
          } catch (e) {}
          return result;
        };
      } else {
        setTimeout(checkAndIntercept, 100);
      }
    };
    setTimeout(checkAndIntercept, 500);
  });
  
  // Navigate to watch page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout, continuing...');
  }
  
  // Wait for all requests
  await new Promise(r => setTimeout(r, 10000));
  
  // Get response results
  const responseResults = await page.evaluate(() => window.__responseResults);
  
  console.log('\n=== Request/Response Analysis ===');
  console.log('Total requests:', requests.length);
  console.log('Total responses with decryption:', responseResults.length);
  
  // Match requests with responses
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const resp = responseResults[i] || { hasUrl: 'unknown' };
    
    console.log(`\n--- Request ${i + 1} ---`);
    console.log('Method:', req.method);
    console.log('Has URL in response:', resp.hasUrl);
    
    // Print all headers
    console.log('Headers:');
    const importantHeaders = [
      'accept', 'accept-encoding', 'accept-language',
      'origin', 'referer', 
      'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
      'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
      'user-agent',
      'x-api-key', 'x-client-fingerprint', 'x-only-sources', 
      'x-request-nonce', 'x-request-signature', 'x-request-timestamp', 
      'x-server', 'bw90agfmywth'
    ];
    
    for (const key of Object.keys(req.headers).sort()) {
      const value = req.headers[key];
      if (key === 'x-api-key') {
        console.log(`  ${key}: ${value.substring(0, 16)}...`);
      } else if (key === 'x-request-signature') {
        console.log(`  ${key}: ${value.substring(0, 20)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    
    if (resp.hasUrl) {
      console.log('✅ URL:', resp.url);
    }
  }
  
  await browser.close();
  console.log('\nDone!');
}

captureSuccessfulHeaders().catch(console.error);
