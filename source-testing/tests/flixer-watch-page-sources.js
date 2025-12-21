/**
 * Check what sources the Flixer page actually displays
 */
const puppeteer = require('puppeteer');

async function checkPageSources() {
  console.log('=== Checking Flixer Page Sources ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => {
    if (msg.text().includes('Enhancer') || msg.text().includes('source') || msg.text().includes('Source')) {
      console.log('PAGE:', msg.text());
    }
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
  
  // Wait for page to fully load
  await new Promise(r => setTimeout(r, 10000));
  
  // Check what's displayed on the page
  console.log('\n=== Checking Page Content ===');
  
  const pageInfo = await page.evaluate(() => {
    // Look for video player or source info
    const videoElements = document.querySelectorAll('video');
    const iframes = document.querySelectorAll('iframe');
    const sourceButtons = document.querySelectorAll('[class*="source"], [class*="server"]');
    
    // Check for any error messages
    const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
    
    // Check localStorage for any cached data
    const cachedData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.includes('source') || key.includes('server') || key.includes('tmdb')) {
        cachedData[key] = localStorage.getItem(key);
      }
    }
    
    return {
      videoCount: videoElements.length,
      iframeCount: iframes.length,
      iframeSrcs: Array.from(iframes).map(f => f.src),
      sourceButtonCount: sourceButtons.length,
      sourceButtonTexts: Array.from(sourceButtons).slice(0, 5).map(b => b.textContent?.trim()),
      errorTexts: Array.from(errorElements).map(e => e.textContent?.trim()).filter(Boolean),
      cachedData,
      pageTitle: document.title,
      bodyText: document.body?.innerText?.substring(0, 500)
    };
  });
  
  console.log('Page Info:', JSON.stringify(pageInfo, null, 2));
  
  // Try to find and click on a server button
  console.log('\n=== Looking for Server Buttons ===');
  const buttons = await page.$$('button');
  for (const button of buttons.slice(0, 20)) {
    const text = await button.evaluate(el => el.textContent);
    if (text && (text.toLowerCase().includes('alpha') || text.toLowerCase().includes('bravo') || 
        text.toLowerCase().includes('server') || text.toLowerCase().includes('source'))) {
      console.log('Found button:', text.trim());
    }
  }
  
  // Keep browser open for manual inspection
  console.log('\n\nBrowser is open for manual inspection. Press Ctrl+C to close.');
  await new Promise(r => setTimeout(r, 60000));
  
  await browser.close();
}

checkPageSources().catch(console.error);
