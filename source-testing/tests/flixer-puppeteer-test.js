/**
 * Test if Flixer actually returns URLs in a real browser
 */
const puppeteer = require('puppeteer');

async function testRealBrowser() {
  console.log('=== Testing Flixer in Real Browser ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set up request interception to capture API responses
  await page.setRequestInterception(true);
  
  const apiResponses = [];
  
  page.on('request', request => {
    request.continue();
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('plsdontscrapemelove.flixer.sh') && url.includes('/images')) {
      try {
        const text = await response.text();
        apiResponses.push({ url, status: response.status(), body: text });
        console.log('📥 Captured API response from:', url);
      } catch (e) {}
    }
  });
  
  // Navigate to a TV show page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout (expected), continuing...');
  }
  
  // Wait a bit more for any delayed API calls
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('\n=== API Responses Captured ===');
  for (const resp of apiResponses) {
    console.log('\nURL:', resp.url);
    console.log('Status:', resp.status);
    console.log('Body (first 500 chars):', resp.body.substring(0, 500));
  }
  
  // Try to get the decrypted data from the page
  console.log('\n=== Checking Page State ===');
  try {
    const wasmState = await page.evaluate(() => {
      if (window.wasmImgData) {
        return {
          ready: window.wasmImgData.ready,
          hasKey: !!window.wasmImgData.key,
          keyLength: window.wasmImgData.key?.length
        };
      }
      return null;
    });
    console.log('WASM state:', wasmState);
  } catch (e) {
    console.log('Could not get WASM state:', e.message);
  }
  
  await browser.close();
  console.log('\nDone!');
}

testRealBrowser().catch(console.error);
