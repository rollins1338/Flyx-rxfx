/**
 * Download WASM using Puppeteer
 * 
 * The WASM file might be protected or require proper headers.
 * Let's intercept it from the actual page load.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const OUTPUT_DIR = 'source-testing/tests/wasm-analysis';

async function downloadWasm() {
  console.log('=== Download WASM via Puppeteer ===\n');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM requests
  let wasmBuffer = null;
  let wasmUrl = null;
  
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    request.continue();
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('.wasm') || url.includes('img_data')) {
      console.log(`Found potential WASM: ${url}`);
      try {
        const buffer = await response.buffer();
        // Check if it's actually WASM (magic number 0x00 0x61 0x73 0x6d)
        if (buffer[0] === 0x00 && buffer[1] === 0x61 && buffer[2] === 0x73 && buffer[3] === 0x6d) {
          console.log(`Valid WASM found! Size: ${buffer.length} bytes`);
          wasmBuffer = buffer;
          wasmUrl = url;
        }
      } catch (e) {
        // Ignore errors
      }
    }
  });
  
  console.log('Loading flixer.sh...');
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM to be ready
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Also try to get the WASM URL from the page
  const wasmInfo = await page.evaluate(() => {
    // Look for WASM module info
    const scripts = Array.from(document.querySelectorAll('script'));
    const wasmScripts = scripts.filter(s => s.src && s.src.includes('wasm'));
    
    return {
      wasmScripts: wasmScripts.map(s => s.src),
      hasWasmImgData: !!window.wasmImgData,
      wasmReady: window.wasmImgData?.ready,
    };
  });
  
  console.log('\nPage WASM info:', wasmInfo);
  
  await browser.close();
  
  if (wasmBuffer) {
    const wasmPath = path.join(OUTPUT_DIR, 'img_data_bg.wasm');
    fs.writeFileSync(wasmPath, wasmBuffer);
    console.log(`\nWASM saved to ${wasmPath}`);
    console.log(`Size: ${wasmBuffer.length} bytes`);
    console.log(`URL: ${wasmUrl}`);
    return wasmPath;
  } else {
    console.log('\nNo WASM intercepted. Using existing file...');
    const existingPath = 'source-testing/tests/flixer_img_data.wasm';
    if (fs.existsSync(existingPath)) {
      const buffer = fs.readFileSync(existingPath);
      console.log(`Using existing WASM: ${buffer.length} bytes`);
      const wasmPath = path.join(OUTPUT_DIR, 'img_data_bg.wasm');
      fs.copyFileSync(existingPath, wasmPath);
      return wasmPath;
    }
  }
  
  return null;
}

downloadWasm().then(wasmPath => {
  if (wasmPath) {
    console.log('\nWASM file ready for analysis.');
  }
}).catch(console.error);
