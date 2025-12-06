/**
 * 1movies.bz - Intercept all requests with minimal automation
 * Just load the page and wait for user interaction
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function intercept() {
  console.log('=== 1movies.bz Request Interceptor ===\n');
  console.log('This will open a browser. Please manually:');
  console.log('1. Wait for page to load');
  console.log('2. Click on a server button');
  console.log('3. Watch the console for captured requests\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  
  // Log ALL requests
  page.on('request', (req: any) => {
    const url = req.url();
    // Only log interesting requests
    if (url.includes('ajax') || 
        url.includes('embed') || 
        url.includes('m3u8') ||
        url.includes('player') ||
        url.includes('stream') ||
        (url.includes('.') && !url.includes('1movies.bz') && !url.includes('cloudflare') && !url.includes('google'))) {
      console.log(`\n[REQ] ${req.method()} ${url}`);
    }
  });
  
  page.on('response', async (res: any) => {
    const url = res.url();
    
    // Capture embed/source responses
    if (url.includes('ajax/links') || 
        url.includes('embed') || 
        url.includes('m3u8') ||
        url.includes('source')) {
      console.log(`\n[RES] ${res.status()} ${url}`);
      try {
        const text = await res.text();
        console.log('Response:', text.substring(0, 1000));
        
        // Save to file
        const filename = `1movies-capture-${Date.now()}.txt`;
        fs.writeFileSync(filename, `URL: ${url}\n\nResponse:\n${text}`);
        console.log(`>>> Saved to ${filename}`);
      } catch (e) {}
    }
  });
  
  // Also capture any new pages/tabs (for popups)
  browser.on('targetcreated', async (target: any) => {
    if (target.type() === 'page') {
      const newPage = await target.page();
      if (newPage) {
        const url = newPage.url();
        console.log(`\n[NEW TAB] ${url}`);
        
        newPage.on('request', (req: any) => {
          const reqUrl = req.url();
          if (reqUrl.includes('m3u8') || reqUrl.includes('embed') || reqUrl.includes('stream')) {
            console.log(`[TAB REQ] ${reqUrl}`);
          }
        });
      }
    }
  });

  try {
    console.log('Loading page...');
    await page.goto('https://1movies.bz/watch/movie-five-nights-at-freddys-2-xrbnrp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    console.log('\n>>> Page loaded. Please interact with the page manually.');
    console.log('>>> The script will capture all network requests.');
    console.log('>>> Press Ctrl+C to stop.\n');
    
    // Keep running indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error);
  }
}

intercept().catch(console.error);
