/**
 * Deep network capture - find ALL API endpoints and how they're accessed
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== DEEP NETWORK CAPTURE ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture ALL network activity
    const allRequests = [];
    
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      const url = request.url();
      allRequests.push({
        url,
        method: request.method(),
        headers: request.headers(),
        resourceType: request.resourceType()
      });
      request.continue();
    });
    
    page.on('response', async response => {
      const url = response.url();
      const req = allRequests.find(r => r.url === url);
      if (req) {
        req.status = response.status();
        req.responseHeaders = response.headers();
        try {
          if (response.headers()['content-type']?.includes('json') || 
              url.includes('api') || url.includes('data')) {
            req.body = await response.text();
          }
        } catch (e) {}
      }
    });
    
    console.log('Loading player page...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    
    // Wait a bit more for any delayed requests
    await new Promise(r => setTimeout(r, 10000));
    
    // Filter for interesting requests
    console.log('\n=== ALL UNIQUE DOMAINS ===\n');
    const domains = new Set();
    for (const req of allRequests) {
      try {
        const url = new URL(req.url);
        domains.add(url.hostname);
      } catch (e) {}
    }
    console.log([...domains].sort().join('\n'));
    
    console.log('\n=== API/DATA REQUESTS ===\n');
    const apiRequests = allRequests.filter(r => 
      r.url.includes('api') || 
      r.url.includes('data') || 
      r.url.includes('stream') ||
      r.url.includes('video') ||
      r.url.includes('.json')
    );
    
    for (const req of apiRequests) {
      console.log(`\n${req.method} ${req.url}`);
      console.log(`  Status: ${req.status || 'pending'}`);
      if (req.body) {
        console.log(`  Body: ${req.body.substring(0, 300)}`);
      }
    }
    
    // Look for any XHR/fetch calls in the page
    console.log('\n=== CHECKING PAGE STATE ===\n');
    
    const pageState = await page.evaluate(() => {
      const result = {
        localStorage: {},
        sessionStorage: {},
        cookies: document.cookie
      };
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        result.localStorage[key] = localStorage.getItem(key);
      }
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        result.sessionStorage[key] = sessionStorage.getItem(key);
      }
      
      return result;
    });
    
    console.log('LocalStorage:', JSON.stringify(pageState.localStorage, null, 2));
    console.log('SessionStorage:', JSON.stringify(pageState.sessionStorage, null, 2));
    console.log('Cookies:', pageState.cookies);
    
    // Check if there's any error message on the page
    console.log('\n=== PAGE CONTENT CHECK ===\n');
    const pageContent = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.substring(0, 1000);
    });
    console.log('Page text:', pageContent);
    
    // Look for any global variables that might have API info
    console.log('\n=== GLOBAL VARIABLES ===\n');
    const globals = await page.evaluate(() => {
      const interesting = {};
      const keys = ['API_URL', 'API_BASE', 'BASE_URL', 'apiUrl', 'baseUrl', 'config', 'CONFIG'];
      for (const key of keys) {
        if (window[key]) {
          interesting[key] = window[key];
        }
      }
      return interesting;
    });
    console.log('Globals:', JSON.stringify(globals, null, 2));
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
