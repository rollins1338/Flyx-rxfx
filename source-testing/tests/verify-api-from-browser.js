/**
 * Verify API works from browser context
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== VERIFYING API FROM BROWSER ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture API responses
    const apiResponses = [];
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('api.smashystream')) {
        apiResponses.push({
          url,
          status: response.status(),
          body: await response.text().catch(() => 'N/A')
        });
      }
    });
    
    console.log('Loading player...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('\n=== API RESPONSES FROM BROWSER ===\n');
    for (const resp of apiResponses) {
      console.log('URL:', resp.url.substring(0, 100));
      console.log('Status:', resp.status);
      console.log('Body:', resp.body.substring(0, 200));
      console.log('---');
    }
    
    // Check if the player loaded successfully
    const playerStatus = await page.evaluate(() => {
      // Check for video element or player
      const video = document.querySelector('video');
      const player = document.querySelector('[class*="player"]');
      
      return {
        hasVideo: !!video,
        hasPlayer: !!player,
        title: document.title
      };
    });
    
    console.log('\n=== PLAYER STATUS ===\n');
    console.log('Has video:', playerStatus.hasVideo);
    console.log('Has player:', playerStatus.hasPlayer);
    console.log('Title:', playerStatus.title);
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
