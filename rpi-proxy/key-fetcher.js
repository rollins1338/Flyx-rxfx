/**
 * Browser-based key fetcher using Puppeteer
 * This bypasses TLS fingerprint detection by using a real browser
 */

let browser = null;
let browserPage = null;
let puppeteer = null;

// Try to load puppeteer
try {
  puppeteer = require('puppeteer-core');
} catch (e) {
  console.log('[KeyFetcher] puppeteer-core not installed, browser-based key fetching disabled');
}

async function initBrowser() {
  if (!puppeteer) return false;
  if (browser) return true;
  
  try {
    console.log('[KeyFetcher] Launching browser...');
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
      ],
    });
    
    browserPage = await browser.newPage();
    
    // Navigate to player domain first to set proper origin
    await browserPage.goto('https://epicplayplay.cfd/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('[KeyFetcher] Browser ready');
    return true;
  } catch (e) {
    console.error('[KeyFetcher] Failed to launch browser:', e.message);
    browser = null;
    browserPage = null;
    return false;
  }
}

async function fetchKeyWithBrowser(keyUrl) {
  if (!browserPage) {
    const ready = await initBrowser();
    if (!ready) return null;
  }
  
  try {
    console.log('[KeyFetcher] Fetching key via browser:', keyUrl.substring(0, 60));
    
    // Use page.evaluate to fetch the key from within the browser context
    const result = await browserPage.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
        });
        
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        // Convert to array for transfer (can't transfer ArrayBuffer directly)
        return {
          status: response.status,
          ok: response.ok,
          bytes: Array.from(bytes),
        };
      } catch (e) {
        return { error: e.message };
      }
    }, keyUrl);
    
    if (result.error) {
      console.error('[KeyFetcher] Browser fetch error:', result.error);
      return null;
    }
    
    const keyBuffer = Buffer.from(result.bytes);
    console.log('[KeyFetcher] Got response:', result.status, keyBuffer.length, 'bytes');
    
    // Check if it's the E3 error
    if (keyBuffer.length === 16) {
      const text = keyBuffer.toString('utf8');
      if (text.includes('error') || text.includes('E3')) {
        console.log('[KeyFetcher] Got E3 error even with browser');
        return null;
      }
    }
    
    return keyBuffer;
  } catch (e) {
    console.error('[KeyFetcher] Error:', e.message);
    return null;
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    browserPage = null;
  }
}

// Clean up on exit
process.on('exit', closeBrowser);
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit();
});

module.exports = {
  initBrowser,
  fetchKeyWithBrowser,
  closeBrowser,
  isAvailable: () => !!puppeteer,
};
