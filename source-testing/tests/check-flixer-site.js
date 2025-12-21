/**
 * Check Flixer Site - See what the actual site shows
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function checkSite() {
  console.log('=== Checking Flixer Site ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept network requests
  const apiResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/tmdb/')) {
      try {
        const text = await response.text();
        apiResponses.push({
          url,
          status: response.status(),
          bodyLength: text.length,
          bodyPreview: text.slice(0, 200),
        });
      } catch (e) {}
    }
  });
  
  // Navigate to Flixer
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/1396/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait a bit for sources to load
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('\n=== API Responses ===\n');
  for (const resp of apiResponses) {
    console.log(`URL: ${resp.url}`);
    console.log(`Status: ${resp.status}`);
    console.log(`Body length: ${resp.bodyLength}`);
    console.log(`Preview: ${resp.bodyPreview}`);
    console.log('---');
  }
  
  // Check what's on the page
  const pageInfo = await page.evaluate(() => {
    // Look for video player or source info
    const videos = document.querySelectorAll('video');
    const iframes = document.querySelectorAll('iframe');
    const sources = document.querySelectorAll('source');
    
    return {
      videoCount: videos.length,
      iframeCount: iframes.length,
      sourceCount: sources.length,
      iframeSrcs: Array.from(iframes).map(i => i.src).slice(0, 5),
      title: document.title,
    };
  });
  
  console.log('\n=== Page Info ===\n');
  console.log(pageInfo);
  
  // Keep browser open for manual inspection
  console.log('\nBrowser will stay open for 30 seconds for manual inspection...');
  await new Promise(r => setTimeout(r, 30000));
  
  await browser.close();
}

checkSite().catch(console.error);
