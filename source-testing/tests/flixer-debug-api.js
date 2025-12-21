/**
 * Debug Flixer API - Check what's happening with the API
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugFlixerApi() {
  console.log('=== Debug Flixer API ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Enable request interception to see all requests
  await page.setRequestInterception(true);
  
  const apiRequests = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('plsdontscrapemelove') || url.includes('flixer.sh/api')) {
      console.log('[REQ]', request.method(), url.substring(0, 100));
      apiRequests.push({
        url,
        method: request.method(),
        headers: request.headers(),
      });
    }
    request.continue();
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('plsdontscrapemelove') || url.includes('flixer.sh/api')) {
      console.log('[RES]', response.status(), url.substring(0, 100));
      try {
        const text = await response.text();
        console.log('[BODY]', text.substring(0, 200));
      } catch (e) {}
    }
  });
  
  // Navigate to a watch page
  console.log('Navigating to watch page...');
  await page.goto('https://flixer.sh/watch/tv/94605/1/1', { // Arcane
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  
  console.log('\nWaiting for video player...');
  await page.waitForTimeout(10000);
  
  // Check if video player loaded
  const hasVideo = await page.evaluate(() => {
    const video = document.querySelector('video');
    const iframe = document.querySelector('iframe[src*="embed"]');
    return { video: !!video, iframe: !!iframe, src: video?.src || iframe?.src };
  });
  
  console.log('\nVideo element:', hasVideo);
  
  // Check WASM state
  const wasmState = await page.evaluate(() => {
    return {
      ready: window.wasmImgData?.ready,
      hasGetKey: typeof window.wasmImgData?.get_img_key === 'function',
      hasProcess: typeof window.wasmImgData?.process_img_data === 'function',
    };
  });
  
  console.log('WASM state:', wasmState);
  
  // Get the key
  if (wasmState.ready) {
    const key = await page.evaluate(() => window.wasmImgData.get_img_key());
    console.log('API Key:', key);
  }
  
  console.log('\n--- API Requests Made ---');
  for (const req of apiRequests) {
    console.log(`${req.method} ${req.url}`);
    if (req.headers['x-server']) {
      console.log(`  X-Server: ${req.headers['x-server']}`);
    }
  }
  
  // Keep browser open for manual inspection
  console.log('\nBrowser will stay open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

debugFlixerApi().catch(console.error);
