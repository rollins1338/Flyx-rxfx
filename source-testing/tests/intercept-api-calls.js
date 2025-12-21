/**
 * Intercept API Calls - Capture the actual API responses the site receives
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function interceptApiCalls() {
  console.log('=== Intercepting API Calls ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept and log all API responses
  const apiCalls = [];
  
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    request.continue();
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('plsdontscrapemelove.flixer.sh/api/tmdb')) {
      try {
        const text = await response.text();
        const headers = response.headers();
        
        apiCalls.push({
          url,
          status: response.status(),
          headers: {
            'content-type': headers['content-type'],
            'content-length': headers['content-length'],
          },
          bodyLength: text.length,
          body: text,
        });
        
        console.log(`API Call: ${url.split('?')[0]}`);
        console.log(`  Status: ${response.status()}`);
        console.log(`  Body length: ${text.length}`);
      } catch (e) {
        console.log(`Error reading response: ${e.message}`);
      }
    }
  });
  
  // Navigate to Flixer
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/1396/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for sources to load
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('\n=== API Calls Summary ===\n');
  console.log(`Total API calls: ${apiCalls.length}`);
  
  for (const call of apiCalls) {
    console.log(`\n--- ${call.url.split('?')[0]} ---`);
    console.log(`Status: ${call.status}`);
    console.log(`Body length: ${call.bodyLength}`);
    console.log(`Body preview: ${call.body.slice(0, 200)}`);
    
    // Try to decrypt
    if (call.bodyLength > 100) {
      const decrypted = await page.evaluate(async (encryptedData) => {
        try {
          const apiKey = window.wasmImgData.get_img_key();
          const result = window.wasmImgData.process_img_data(encryptedData, apiKey);
          return { success: true, result: typeof result === 'string' ? result : JSON.stringify(result) };
        } catch (e) {
          return { error: e.message };
        }
      }, call.body);
      
      console.log(`Decrypted: ${decrypted.success ? decrypted.result.slice(0, 500) : decrypted.error}`);
    }
  }
  
  await browser.close();
}

interceptApiCalls().catch(console.error);
