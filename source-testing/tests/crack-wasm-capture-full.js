/**
 * Capture and decrypt the full response (without X-Only-Sources)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function captureFullResponse() {
  console.log('=== Capture Full Flixer Response ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Capture the /images responses
  const imageResponses = [];
  page.on('response', async response => {
    if (response.url().includes('/images') && !response.url().includes('?')) {
      try {
        const text = await response.text();
        const headers = response.request().headers();
        imageResponses.push({
          url: response.url(),
          status: response.status(),
          data: text,
          headers: headers,
        });
      } catch (e) {
        // Ignore
      }
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for the page to make its requests
  await new Promise(r => setTimeout(r, 5000));
  
  console.log(`Captured ${imageResponses.length} /images responses\n`);
  
  // Now decrypt each response using the WASM
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  for (let i = 0; i < imageResponses.length; i++) {
    const resp = imageResponses[i];
    console.log(`\n=== Response ${i + 1} ===`);
    console.log(`URL: ${resp.url}`);
    console.log(`Status: ${resp.status}`);
    console.log(`Data length: ${resp.data.length} chars`);
    console.log(`Has X-Only-Sources: ${resp.headers['x-only-sources'] || 'no'}`);
    console.log(`API Key: ${resp.headers['x-api-key']}`);
    
    // Decrypt using the captured API key
    const apiKey = resp.headers['x-api-key'];
    if (apiKey) {
      const decrypted = await page.evaluate(async (encData, key) => {
        try {
          return await window.wasmImgData.process_img_data(encData, key);
        } catch (e) {
          return `Error: ${e.message}`;
        }
      }, resp.data, apiKey);
      
      console.log(`\nDecrypted (${decrypted.length} chars):`);
      
      try {
        const data = JSON.parse(decrypted);
        console.log(JSON.stringify(data, null, 2));
        
        // Check for URLs
        if (data.sources) {
          for (const source of data.sources) {
            if (source.url && source.url.length > 0) {
              console.log(`\n*** FOUND URL for ${source.server}! ***`);
              console.log(`URL: ${source.url}`);
            }
          }
        }
      } catch (e) {
        console.log(decrypted);
      }
    }
  }
  
  await browser.close();
}

captureFullResponse().catch(console.error);
