/**
 * Compare browser vs Node.js requests to Flixer
 * This script captures what the real browser sends and compares it to our Node.js implementation
 */
const puppeteer = require('puppeteer');

async function captureRealBrowserRequest() {
  console.log('=== Capturing Real Browser Request ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--disable-web-security']
  });
  
  const page = await browser.newPage();
  
  // Capture all requests to the API
  const capturedRequests = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('plsdontscrapemelove.flixer.sh')) {
      capturedRequests.push({
        url,
        method: request.method(),
        headers: request.headers(),
      });
      console.log('\n📤 REQUEST:', url);
      console.log('Headers:', JSON.stringify(request.headers(), null, 2));
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('plsdontscrapemelove.flixer.sh') && url.includes('/images')) {
      console.log('\n📥 RESPONSE:', url);
      console.log('Status:', response.status());
      try {
        const text = await response.text();
        console.log('Body (first 200 chars):', text.substring(0, 200));
      } catch (e) {}
    }
  });
  
  // Navigate to a TV show page
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/94605/1/1', { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait for API calls
  console.log('\nWaiting for API calls...');
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('\n=== Captured Requests ===');
  for (const req of capturedRequests) {
    console.log('\nURL:', req.url);
    console.log('Headers:');
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'accept' || key.toLowerCase() === 'user-agent') {
        console.log(`  ${key}: ${value}`);
      }
    }
  }
  
  // Keep browser open for manual inspection
  console.log('\n\nBrowser is open for manual inspection. Press Ctrl+C to close.');
  await new Promise(() => {}); // Keep running
}

captureRealBrowserRequest().catch(console.error);
