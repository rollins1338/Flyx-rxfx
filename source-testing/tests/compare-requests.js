/**
 * Compare Requests - Compare our requests with the site's requests
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function compareRequests() {
  console.log('=== Comparing Requests ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Capture all requests to the images endpoint
  const imageRequests = [];
  
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/images')) {
      imageRequests.push({
        url,
        method: request.method(),
        headers: request.headers(),
      });
    }
    request.continue();
  });
  
  // Navigate to Flixer
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/1396/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for sources to load
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('\n=== Site Requests ===\n');
  for (const req of imageRequests) {
    console.log('URL:', req.url);
    console.log('Headers:');
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.startsWith('x-') || key === 'accept' || key.includes('fingerprint')) {
        console.log(`  ${key}: ${value}`);
      }
    }
    console.log('---');
  }
  
  // Now make our own request and compare
  console.log('\n=== Our Request ===\n');
  
  const ourRequest = await page.evaluate(async () => {
    const apiKey = window.wasmImgData.get_img_key();
    const path = '/api/tmdb/tv/1396/season/1/episode/1/images';
    
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    return {
      apiKey,
      timestamp,
      nonce,
      signature,
      path,
    };
  });
  
  console.log('API Key:', ourRequest.apiKey);
  console.log('Timestamp:', ourRequest.timestamp);
  console.log('Nonce:', ourRequest.nonce);
  console.log('Signature:', ourRequest.signature.slice(0, 30) + '...');
  
  // Compare with site's request
  if (imageRequests.length > 0) {
    const siteReq = imageRequests[0];
    console.log('\n=== Comparison ===\n');
    console.log('Site X-Api-Key:', siteReq.headers['x-api-key']);
    console.log('Our X-Api-Key:', ourRequest.apiKey);
    console.log('Keys match:', siteReq.headers['x-api-key'] === ourRequest.apiKey);
  }
  
  await browser.close();
}

compareRequests().catch(console.error);
