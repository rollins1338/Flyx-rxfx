/**
 * Test the embed.smashystream.com domain
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== TESTING EMBED DOMAIN ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture network
    const requests = [];
    
    await page.setRequestInterception(true);
    page.on('request', req => {
      requests.push({ url: req.url(), method: req.method() });
      req.continue();
    });
    
    page.on('response', async res => {
      const req = requests.find(r => r.url === res.url());
      if (req) {
        req.status = res.status();
        if (res.url().includes('dude') || res.url().includes('embed')) {
          try {
            req.body = await res.text();
          } catch (e) {}
        }
      }
    });
    
    // Try different embed URLs
    const embedUrls = [
      'https://embed.smashystream.com/dude.php?imdb=tt0468569',
      'https://embed.smashystream.com/playere.php?imdb=tt0468569',
      'https://embed.smashystream.com/player.php?imdb=tt0468569',
      'https://embed.smashystream.com/?imdb=tt0468569',
    ];
    
    for (const url of embedUrls) {
      console.log(`\nTesting: ${url}`);
      
      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        const content = await page.content();
        console.log('  Content length:', content.length);
        console.log('  Title:', await page.title());
        
        // Check for video element
        const hasVideo = await page.evaluate(() => !!document.querySelector('video'));
        console.log('  Has video:', hasVideo);
        
        // Check for iframe
        const iframes = await page.evaluate(() => 
          Array.from(document.querySelectorAll('iframe')).map(f => f.src)
        );
        console.log('  Iframes:', iframes);
        
      } catch (e) {
        console.log('  Error:', e.message);
      }
    }
    
    // Check what requests were made
    console.log('\n\n=== REQUESTS TO SMASHYSTREAM DOMAINS ===\n');
    
    const smashyRequests = requests.filter(r => r.url.includes('smashystream'));
    for (const req of smashyRequests) {
      console.log(`${req.status || 'pending'} ${req.method} ${req.url.substring(0, 100)}`);
      if (req.body) {
        console.log(`  Body: ${req.body.substring(0, 200)}`);
      }
    }
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
