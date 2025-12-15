/**
 * Check if browser actually gets API responses
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== CHECKING BROWSER API RESPONSES ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser to see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture responses with their bodies
    const responses = [];
    
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('api.smashystream')) {
        const entry = {
          url,
          status: response.status(),
          statusText: response.statusText()
        };
        
        try {
          entry.body = await response.text();
        } catch (e) {
          entry.bodyError = e.message;
        }
        
        responses.push(entry);
        console.log(`[RESPONSE] ${response.status()} ${url.substring(0, 80)}`);
      }
    });
    
    console.log('Loading player page...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    
    console.log('Waiting for API responses...');
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('\n=== ALL API RESPONSES ===\n');
    
    for (const resp of responses) {
      console.log('URL:', resp.url);
      console.log('Status:', resp.status, resp.statusText);
      if (resp.body) {
        console.log('Body:', resp.body.substring(0, 300));
      }
      if (resp.bodyError) {
        console.log('Body Error:', resp.bodyError);
      }
      console.log('---');
    }
    
    // Check if the player loaded content
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        hasVideo: !!document.querySelector('video'),
        bodyText: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log('\n=== PAGE STATE ===\n');
    console.log('Title:', pageContent.title);
    console.log('Has video:', pageContent.hasVideo);
    console.log('Body text:', pageContent.bodyText);
    
    // Keep browser open for inspection
    console.log('\nBrowser will close in 15 seconds...');
    await new Promise(r => setTimeout(r, 15000));
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
