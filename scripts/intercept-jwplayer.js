/**
 * Use Puppeteer to intercept JWPlayer setup and get the actual m3u8 URL
 * This will help us understand what the decrypted data looks like
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function main() {
  console.log('=== Intercepting JWPlayer setup ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set up request interception
  await page.setRequestInterception(true);
  
  const requests = [];
  const m3u8Urls = [];
  
  page.on('request', request => {
    const url = request.url();
    requests.push({ url, type: request.resourceType() });
    
    if (url.includes('.m3u8') || url.includes('master.txt')) {
      console.log(`[M3U8] ${url}`);
      m3u8Urls.push(url);
    }
    
    request.continue();
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('.m3u8') || url.includes('master.txt')) {
      try {
        const text = await response.text();
        console.log(`[M3U8 Response] ${url.substring(0, 100)}...`);
        console.log(text.substring(0, 500));
      } catch (e) {}
    }
  });
  
  // Inject script to intercept JWPlayer setup
  await page.evaluateOnNewDocument(() => {
    // Store original jwplayer
    const originalJwplayer = window.jwplayer;
    
    // Override jwplayer
    window.jwplayer = function(...args) {
      console.log('[INTERCEPT] jwplayer called with:', args);
      
      const player = originalJwplayer ? originalJwplayer.apply(this, args) : null;
      
      if (player && player.setup) {
        const originalSetup = player.setup;
        player.setup = function(config) {
          console.log('[INTERCEPT] jwplayer.setup called with:', JSON.stringify(config, null, 2));
          
          // Send to page context
          window.__JWPLAYER_CONFIG__ = config;
          
          // Log sources
          if (config.sources) {
            config.sources.forEach(source => {
              console.log('[INTERCEPT] Source:', source.file);
            });
          }
          if (config.file) {
            console.log('[INTERCEPT] File:', config.file);
          }
          
          return originalSetup.call(this, config);
        };
      }
      
      return player;
    };
    
    // Also intercept XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      xhr.open = function(method, url, ...args) {
        this._url = url;
        if (url.includes('.m3u8') || url.includes('master')) {
          console.log('[XHR] Opening:', method, url);
        }
        return originalOpen.apply(this, [method, url, ...args]);
      };
      
      xhr.send = function(...args) {
        if (this._url && (this._url.includes('.m3u8') || this._url.includes('master'))) {
          console.log('[XHR] Sending to:', this._url);
        }
        return originalSend.apply(this, args);
      };
      
      return xhr;
    };
    
    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, ...args) {
      if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('master'))) {
        console.log('[FETCH]', url);
      }
      return originalFetch.apply(this, [url, ...args]);
    };
  });
  
  // Navigate to embed page
  const embedUrl = 'https://rapidshare.cc/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ';
  console.log(`Navigating to: ${embedUrl}\n`);
  
  try {
    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for player to initialize
    await page.waitForTimeout(5000);
    
    // Get the intercepted config
    const config = await page.evaluate(() => window.__JWPLAYER_CONFIG__);
    if (config) {
      console.log('\n=== JWPlayer Config ===');
      console.log(JSON.stringify(config, null, 2));
    }
    
    // Get console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[INTERCEPT]') || text.includes('[XHR]') || text.includes('[FETCH]')) {
        console.log(text);
      }
    });
    
    // Wait a bit more
    await page.waitForTimeout(5000);
    
    // Save results
    fs.writeFileSync('intercept-results.json', JSON.stringify({
      requests: requests.filter(r => r.url.includes('m3u8') || r.url.includes('master')),
      m3u8Urls,
      config
    }, null, 2));
    
    console.log('\n=== M3U8 URLs Found ===');
    m3u8Urls.forEach(url => console.log(url));
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  // Keep browser open for manual inspection
  console.log('\nBrowser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await browser.close();
}

main().catch(console.error);
