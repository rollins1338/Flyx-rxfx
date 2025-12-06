/**
 * 1movies.bz - Capture network requests when playing video
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const MOVIE_URL = 'https://1movies.bz/watch/movie-five-nights-at-freddys-2-xrbnrp';

async function captureNetworkRequests() {
  console.log('=== 1movies.bz Network Capture ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  
  // Collect all requests
  const allRequests: any[] = [];
  
  page.on('request', (req: any) => {
    const url = req.url();
    allRequests.push({
      url,
      method: req.method(),
      type: req.resourceType(),
    });
    
    // Log interesting requests
    if (url.includes('ajax') || url.includes('embed') || 
        url.includes('m3u8') || url.includes('player') ||
        url.includes('source') || url.includes('server') ||
        url.includes('episode')) {
      console.log(`[REQ] ${req.method()} ${url}`);
    }
  });
  
  page.on('response', async (res: any) => {
    const url = res.url();
    
    // Capture interesting responses
    if (url.includes('ajax') || url.includes('m3u8') || 
        url.includes('embed') || url.includes('source')) {
      console.log(`[RES] ${res.status()} ${url}`);
      try {
        const contentType = res.headers()['content-type'] || '';
        if (contentType.includes('json') || contentType.includes('text')) {
          const text = await res.text();
          console.log('Response preview:', text.substring(0, 500));
        }
      } catch (e) {}
    }
  });

  try {
    console.log('Loading movie page...');
    await page.goto(MOVIE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('\nPage loaded. Looking for play button...');
    
    // Wait for the player area
    await page.waitForSelector('#player', { timeout: 10000 });
    
    // Try to click the play button
    const playBtn = await page.$('.player-btn');
    if (playBtn) {
      console.log('Found play button, clicking...');
      await playBtn.click();
      
      // Wait for network activity
      console.log('Waiting for video sources to load...');
      await new Promise(r => setTimeout(r, 10000));
    }
    
    // Check for iframes that might have been loaded
    const iframes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).map((f: any) => ({
        src: f.src,
        id: f.id
      }));
    });
    console.log('\nIframes after click:', iframes);
    
    // Check the player div content
    const playerContent = await page.evaluate(() => {
      const player = document.querySelector('#player');
      return player ? player.innerHTML.substring(0, 1000) : 'No player found';
    });
    console.log('\nPlayer content:', playerContent);
    
    // Check movie-server div
    const serverContent = await page.evaluate(() => {
      const server = document.querySelector('#movie-server');
      return server ? server.innerHTML : 'No server div';
    });
    console.log('\nServer content:', serverContent);
    
    // Save all requests for analysis
    fs.writeFileSync('1movies-requests.json', JSON.stringify(allRequests, null, 2));
    console.log('\nSaved all requests to 1movies-requests.json');
    
    // Keep browser open for manual inspection
    console.log('\nBrowser will stay open for 30 seconds for inspection...');
    await new Promise(r => setTimeout(r, 30000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

captureNetworkRequests().catch(console.error);
