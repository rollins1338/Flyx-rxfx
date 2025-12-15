/**
 * Analyze how the API is called in the JavaScript bundles
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== ANALYZING API CALL PATTERNS ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Intercept and log the metadata service
    let metadataServiceCode = '';
    
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = request.url();
      if (url.includes('metadataService')) {
        console.log('Found metadataService:', url);
      }
      request.continue();
    });
    
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('metadataService')) {
        try {
          metadataServiceCode = await response.text();
        } catch (e) {}
      }
    });
    
    console.log('Loading player page...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Search for API URL patterns in the code
    console.log('\n=== SEARCHING FOR API PATTERNS ===\n');
    
    if (metadataServiceCode) {
      // Look for API URLs
      const apiPatterns = metadataServiceCode.match(/https?:\/\/[^"'\s]+smashystream[^"'\s]*/g);
      console.log('API URLs found:', apiPatterns);
      
      // Look for fetch calls
      const fetchPatterns = metadataServiceCode.match(/fetch\([^)]+\)/g);
      console.log('\nFetch patterns:', fetchPatterns?.slice(0, 5));
      
      // Look for the data endpoint construction
      const dataEndpoint = metadataServiceCode.match(/\/api\/v1\/data[^"'\s]*/g);
      console.log('\nData endpoint patterns:', dataEndpoint);
      
      // Look for any proxy or alternative endpoints
      const proxyPatterns = metadataServiceCode.match(/proxy|cors|gateway/gi);
      console.log('\nProxy patterns:', proxyPatterns);
    }
    
    // Check what functions are available
    console.log('\n=== CHECKING AVAILABLE FUNCTIONS ===\n');
    
    const funcs = await page.evaluate(() => {
      const result = {};
      
      // Check for SmashyStream specific functions
      if (typeof window.fetchSmashyStreamMetadata === 'function') {
        result.fetchSmashyStreamMetadata = 'exists';
      }
      
      // Check Module
      if (typeof Module !== 'undefined') {
        result.Module = Object.keys(Module).filter(k => typeof Module[k] === 'function').slice(0, 20);
      }
      
      // Look for any API-related globals
      for (const key of Object.keys(window)) {
        if (key.toLowerCase().includes('api') || key.toLowerCase().includes('smashy')) {
          result[key] = typeof window[key];
        }
      }
      
      return result;
    });
    
    console.log('Functions:', JSON.stringify(funcs, null, 2));
    
    // Try to find the actual fetch implementation
    console.log('\n=== HOOKING FETCH ===\n');
    
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        console.log('FETCH CALLED:', args[0]);
        return originalFetch.apply(this, args);
      };
    });
    
    // Wait and see what gets fetched
    await new Promise(r => setTimeout(r, 5000));
    
    // Check if there's a different way to get data
    console.log('\n=== CHECKING FOR ALTERNATIVE DATA SOURCES ===\n');
    
    const altSources = await page.evaluate(() => {
      const result = {};
      
      // Check for any cached data
      if (window.__INITIAL_DATA__) result.__INITIAL_DATA__ = window.__INITIAL_DATA__;
      if (window.__PRELOADED_STATE__) result.__PRELOADED_STATE__ = window.__PRELOADED_STATE__;
      if (window.movieData) result.movieData = window.movieData;
      if (window.streamData) result.streamData = window.streamData;
      
      // Check React state if available
      const reactRoot = document.getElementById('root');
      if (reactRoot && reactRoot._reactRootContainer) {
        result.hasReactRoot = true;
      }
      
      return result;
    });
    
    console.log('Alternative sources:', JSON.stringify(altSources, null, 2));
    
    // Try to manually call the API with different approaches
    console.log('\n=== TESTING DIFFERENT API APPROACHES ===\n');
    
    const apiTests = await page.evaluate(async () => {
      const results = {};
      
      // Get token
      const tokenFunc = Module.cwrap('gewe_town', 'string', ['string']);
      const token = tokenFunc('https://player.smashystream.comTAxcjBGffNfvY');
      const userData = localStorage.getItem('userIdData');
      const userId = userData ? JSON.parse(userData).userId : 'test';
      
      results.token = token;
      results.userId = userId;
      
      // Test 1: Direct fetch
      try {
        const url1 = `https://api.smashystream.top/api/v1/data?tmdb=155&token=${token}&user_id=${userId}`;
        const controller1 = new AbortController();
        setTimeout(() => controller1.abort(), 5000);
        const resp1 = await fetch(url1, { signal: controller1.signal });
        results.directFetch = { status: resp1.status, ok: resp1.ok };
      } catch (e) {
        results.directFetch = { error: e.message };
      }
      
      // Test 2: With mode: 'cors'
      try {
        const url2 = `https://api.smashystream.top/api/v1/data?tmdb=155&token=${token}&user_id=${userId}`;
        const controller2 = new AbortController();
        setTimeout(() => controller2.abort(), 5000);
        const resp2 = await fetch(url2, { mode: 'cors', signal: controller2.signal });
        results.corsFetch = { status: resp2.status, ok: resp2.ok };
      } catch (e) {
        results.corsFetch = { error: e.message };
      }
      
      // Test 3: With mode: 'no-cors'
      try {
        const url3 = `https://api.smashystream.top/api/v1/data?tmdb=155&token=${token}&user_id=${userId}`;
        const controller3 = new AbortController();
        setTimeout(() => controller3.abort(), 5000);
        const resp3 = await fetch(url3, { mode: 'no-cors', signal: controller3.signal });
        results.noCors = { status: resp3.status, type: resp3.type };
      } catch (e) {
        results.noCors = { error: e.message };
      }
      
      return results;
    });
    
    console.log('API tests:', JSON.stringify(apiTests, null, 2));
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
