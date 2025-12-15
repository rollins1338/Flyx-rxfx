/**
 * Find how the player actually gets data - must be bypassing CORS somehow
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== FINDING WORKING ENDPOINT ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security', // Disable CORS for testing
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture all responses
    const responses = [];
    
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('smashystream') && !url.includes('.js') && !url.includes('.css')) {
        const entry = {
          url,
          status: response.status()
        };
        
        try {
          const text = await response.text();
          entry.body = text.substring(0, 500);
        } catch (e) {}
        
        responses.push(entry);
      }
    });
    
    console.log('Loading player with CORS disabled...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('\n=== RESPONSES ===\n');
    for (const resp of responses) {
      console.log(`${resp.status} ${resp.url}`);
      if (resp.body) {
        console.log(`  Body: ${resp.body}`);
      }
      console.log('---');
    }
    
    // Check page state
    const state = await page.evaluate(() => {
      return {
        title: document.title,
        hasVideo: !!document.querySelector('video'),
        videoSrc: document.querySelector('video')?.src || 'none',
        bodyText: document.body.innerText.substring(0, 300)
      };
    });
    
    console.log('\n=== PAGE STATE ===\n');
    console.log(JSON.stringify(state, null, 2));
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
