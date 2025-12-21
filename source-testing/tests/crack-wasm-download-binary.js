/**
 * Download the WASM binary and analyze it
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function downloadWasm() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Intercept and save WASM
  await page.setRequestInterception(true);
  
  let wasmUrl = null;
  
  page.on('request', (request) => {
    request.continue();
  });
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('img_data') && url.includes('.wasm')) {
      wasmUrl = url;
      console.log('Found WASM URL:', url);
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Get WASM bytes from page
  const wasmBytes = await page.evaluate(async () => {
    // Find the WASM URL
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      if (script.src && script.src.includes('wasm')) {
        console.log('Script with wasm:', script.src);
      }
    }
    
    // Try to get WASM from the module
    if (window.__wasmModule) {
      return null; // Can't serialize module
    }
    
    return null;
  });
  
  // Download WASM directly
  if (wasmUrl) {
    console.log('Downloading WASM from:', wasmUrl);
    const response = await page.goto(wasmUrl);
    const buffer = await response.buffer();
    fs.writeFileSync('source-testing/tests/wasm-analysis/img_data_bg.wasm', buffer);
    console.log('Saved WASM:', buffer.length, 'bytes');
  }
  
  await browser.close();
}

downloadWasm().catch(console.error);
