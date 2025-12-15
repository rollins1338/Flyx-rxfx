/**
 * Test if Cloudflare is blocking and try to bypass
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== TESTING CLOUDFLARE BYPASS ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Try to access the API directly in the browser
    console.log('Testing direct API access in browser...\n');
    
    // First, let's see what happens when we navigate directly to the API
    await page.goto('https://api.smashystream.top/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    }).catch(e => console.log('Navigation error:', e.message));
    
    const apiContent = await page.content();
    console.log('API page content:', apiContent.substring(0, 500));
    
    // Check if there's a Cloudflare challenge
    const hasChallenge = apiContent.includes('challenge') || 
                         apiContent.includes('cf-') ||
                         apiContent.includes('Cloudflare');
    console.log('\nHas Cloudflare challenge:', hasChallenge);
    
    // Now try from the player page context
    console.log('\n\n=== TESTING FROM PLAYER CONTEXT ===\n');
    
    const page2 = await browser.newPage();
    await page2.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Load player page first
    console.log('Loading player page...');
    await page2.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Wait for WASM
    await page2.waitForFunction(() => typeof Module !== 'undefined' && Module.cwrap, { timeout: 30000 });
    
    // Get cookies
    const cookies = await page2.cookies();
    console.log('\nCookies:', cookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`).join('\n'));
    
    // Try to make API request with XMLHttpRequest instead of fetch
    console.log('\n\nTrying XMLHttpRequest...');
    
    const xhrResult = await page2.evaluate(() => {
      return new Promise((resolve) => {
        const tokenFunc = Module.cwrap('gewe_town', 'string', ['string']);
        const token = tokenFunc('https://player.smashystream.comTAxcjBGffNfvY');
        const userData = localStorage.getItem('userIdData');
        const userId = userData ? JSON.parse(userData).userId : 'test';
        
        const url = `https://api.smashystream.top/api/v1/data?tmdb=155&token=${token}&user_id=${userId}`;
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 15000;
        
        xhr.onload = function() {
          resolve({
            status: xhr.status,
            response: xhr.responseText.substring(0, 500),
            headers: xhr.getAllResponseHeaders()
          });
        };
        
        xhr.onerror = function() {
          resolve({ error: 'XHR error' });
        };
        
        xhr.ontimeout = function() {
          resolve({ error: 'XHR timeout' });
        };
        
        xhr.send();
      });
    });
    
    console.log('XHR result:', JSON.stringify(xhrResult, null, 2));
    
    // Try with a proxy approach - make request from Node.js with browser cookies
    console.log('\n\n=== TRYING WITH BROWSER COOKIES ===\n');
    
    const allCookies = await page2.cookies('https://api.smashystream.top');
    console.log('API domain cookies:', allCookies);
    
    // Check if there are any cf_ cookies
    const cfCookies = cookies.filter(c => c.name.startsWith('cf_') || c.name.startsWith('__cf'));
    console.log('\nCloudflare cookies:', cfCookies);
    
    // Try to see what the actual error is
    console.log('\n\n=== CHECKING CONSOLE ERRORS ===\n');
    
    page2.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    // Trigger another API call
    await page2.evaluate(() => {
      const tokenFunc = Module.cwrap('gewe_town', 'string', ['string']);
      const token = tokenFunc('https://player.smashystream.comTAxcjBGffNfvY');
      const userData = localStorage.getItem('userIdData');
      const userId = userData ? JSON.parse(userData).userId : 'test';
      
      fetch(`https://api.smashystream.top/api/v1/data?tmdb=155&token=${token}&user_id=${userId}`)
        .then(r => console.log('Fetch status:', r.status))
        .catch(e => console.log('Fetch error:', e.message));
    });
    
    await new Promise(r => setTimeout(r, 10000));
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
