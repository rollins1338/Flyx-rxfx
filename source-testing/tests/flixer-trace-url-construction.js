/**
 * Trace how Flixer constructs the m3u8 URL
 */
const puppeteer = require('puppeteer');

async function traceUrlConstruction() {
  console.log('=== Tracing M3U8 URL Construction ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Inject code to intercept fetch and XMLHttpRequest
  await page.evaluateOnNewDocument(() => {
    // Store original fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      const url = args[0];
      
      // Clone response to read body
      const clone = response.clone();
      try {
        const text = await clone.text();
        if (text.includes('workers.dev') || text.includes('m3u8') || 
            (url.includes('/images') && text.length > 0)) {
          console.log('[FETCH INTERCEPT]', url);
          console.log('[FETCH BODY]', text.substring(0, 500));
        }
      } catch (e) {}
      
      return response;
    };
  });
  
  // Navigate to a TV show page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout, continuing...');
  }
  
  // Wait for video to load
  await new Promise(r => setTimeout(r, 5000));
  
  // Try to find where the URL is stored
  console.log('\n=== Searching for URL in Page State ===');
  const urlSearch = await page.evaluate(() => {
    const results = [];
    
    // Search through all window properties
    const searchObject = (obj, path, depth = 0) => {
      if (depth > 5) return;
      if (!obj || typeof obj !== 'object') return;
      
      try {
        for (const key of Object.keys(obj)) {
          const value = obj[key];
          if (typeof value === 'string' && (value.includes('workers.dev') || value.includes('.m3u8'))) {
            results.push({ path: `${path}.${key}`, value: value.substring(0, 200) });
          } else if (typeof value === 'object' && value !== null) {
            searchObject(value, `${path}.${key}`, depth + 1);
          }
        }
      } catch (e) {}
    };
    
    // Check React state
    const reactRoot = document.getElementById('__next');
    if (reactRoot && reactRoot._reactRootContainer) {
      results.push({ path: 'React root found', value: 'yes' });
    }
    
    // Check for any video source
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      if (video.src) results.push({ path: 'video.src', value: video.src });
      const sources = video.querySelectorAll('source');
      for (const source of sources) {
        if (source.src) results.push({ path: 'video>source.src', value: source.src });
      }
    }
    
    return results;
  });
  
  console.log('URL Search Results:', JSON.stringify(urlSearch, null, 2));
  
  // Check console logs
  console.log('\n=== Console Logs ===');
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('FETCH') || text.includes('m3u8') || text.includes('workers')) {
      console.log('PAGE LOG:', text);
    }
  });
  
  // Reload to capture fresh logs
  console.log('\nReloading page to capture logs...');
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
  console.log('\nDone!');
}

traceUrlConstruction().catch(console.error);
