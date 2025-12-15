/**
 * Capture ALL network activity to see what's happening
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== CAPTURING ALL NETWORK ACTIVITY ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable request interception to see everything
    await page.setRequestInterception(true);
    
    const allRequests = [];
    const allResponses = [];
    const failedRequests = [];
    
    page.on('request', request => {
      const url = request.url();
      allRequests.push({
        url: url.substring(0, 100),
        method: request.method(),
        resourceType: request.resourceType()
      });
      request.continue();
    });
    
    page.on('response', response => {
      const url = response.url();
      allResponses.push({
        url: url.substring(0, 100),
        status: response.status()
      });
    });
    
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText
      });
    });
    
    console.log('Loading player page...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('\n=== FAILED REQUESTS ===\n');
    for (const req of failedRequests) {
      console.log(`FAILED: ${req.url}`);
      console.log(`  Error: ${req.failure}`);
    }
    
    console.log('\n=== API REQUESTS ===\n');
    const apiRequests = allRequests.filter(r => r.url.includes('api.smashystream') || r.url.includes('smashystream.top'));
    for (const req of apiRequests) {
      console.log(`${req.method} ${req.url}`);
    }
    
    console.log('\n=== API RESPONSES ===\n');
    const apiResponses = allResponses.filter(r => r.url.includes('api.smashystream') || r.url.includes('smashystream.top'));
    for (const resp of apiResponses) {
      console.log(`${resp.status} ${resp.url}`);
    }
    
    // Check console errors
    console.log('\n=== CONSOLE ERRORS ===\n');
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    // Try to manually trigger an API call
    console.log('\n=== MANUAL API TEST ===\n');
    
    const manualTest = await page.evaluate(async () => {
      // Wait for Module to be ready
      if (typeof Module === 'undefined' || !Module.cwrap) {
        return { error: 'Module not ready' };
      }
      
      const tokenFunc = Module.cwrap('gewe_town', 'string', ['string']);
      const token = tokenFunc('https://player.smashystream.comTAxcjBGffNfvY');
      
      // Get user_id
      const userData = localStorage.getItem('userIdData');
      const userId = userData ? JSON.parse(userData).userId : 'test_user';
      
      const url = `https://api.smashystream.top/api/v1/data?tmdb=155&token=${token}&user_id=${userId}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        return {
          url,
          token,
          userId,
          status: response.status,
          statusText: response.statusText,
          body: await response.text()
        };
      } catch (e) {
        return {
          url,
          token,
          userId,
          error: e.message,
          errorName: e.name
        };
      }
    });
    
    console.log('Manual test result:', JSON.stringify(manualTest, null, 2));
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
