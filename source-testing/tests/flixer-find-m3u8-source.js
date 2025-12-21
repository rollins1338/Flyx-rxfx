/**
 * Find where the m3u8 URL comes from in Flixer
 */
const puppeteer = require('puppeteer');

async function findM3u8Source() {
  console.log('=== Finding M3U8 URL Source ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Intercept and log ALL responses that might contain m3u8 URLs
  page.on('response', async response => {
    const url = response.url();
    try {
      const text = await response.text();
      
      // Check if response contains m3u8 or workers.dev
      if (text.includes('m3u8') || text.includes('workers.dev') || text.includes('.m3u8')) {
        console.log('\n📦 Found m3u8 reference in:', url);
        console.log('Content preview:', text.substring(0, 500));
        
        // Try to parse as JSON
        try {
          const json = JSON.parse(text);
          console.log('Parsed JSON:', JSON.stringify(json, null, 2).substring(0, 1000));
        } catch (e) {}
      }
    } catch (e) {}
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
  
  // Check what's stored in the page's state
  console.log('\n=== Checking Page State ===');
  const pageState = await page.evaluate(() => {
    // Look for any global variables that might contain the URL
    const results = {};
    
    // Check common patterns
    if (window.__NEXT_DATA__) {
      results.nextData = JSON.stringify(window.__NEXT_DATA__).substring(0, 500);
    }
    
    // Check for any source-related data
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || '';
      if (content.includes('m3u8') || content.includes('workers.dev')) {
        results.scriptWithM3u8 = content.substring(0, 500);
        break;
      }
    }
    
    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (value && (value.includes('m3u8') || value.includes('workers.dev'))) {
        results[`localStorage_${key}`] = value.substring(0, 500);
      }
    }
    
    return results;
  });
  
  console.log('Page state:', JSON.stringify(pageState, null, 2));
  
  await browser.close();
  console.log('\nDone!');
}

findM3u8Source().catch(console.error);
