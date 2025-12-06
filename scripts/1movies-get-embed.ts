/**
 * 1movies.bz - Get embed URL from server selection
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const MOVIE_URL = 'https://1movies.bz/watch/movie-five-nights-at-freddys-2-xrbnrp';

async function getEmbed() {
  console.log('=== 1movies.bz Get Embed URL ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture all ajax requests
  page.on('request', (req: any) => {
    const url = req.url();
    if (url.includes('ajax') || url.includes('embed')) {
      console.log(`[REQ] ${req.method()} ${url}`);
    }
  });
  
  page.on('response', async (res: any) => {
    const url = res.url();
    if (url.includes('ajax') || url.includes('embed')) {
      console.log(`[RES] ${res.status()} ${url}`);
      try {
        const text = await res.text();
        console.log('Response:', text.substring(0, 500));
        
        // Save responses with embed info
        if (url.includes('embed') || url.includes('source') || url.includes('link')) {
          const filename = `1movies-response-${Date.now()}.txt`;
          fs.writeFileSync(filename, `URL: ${url}\n\n${text}`);
          console.log(`Saved to ${filename}`);
        }
      } catch (e) {}
    }
  });

  try {
    console.log('Loading movie page...');
    await page.goto(MOVIE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for servers to load
    await new Promise(r => setTimeout(r, 3000));
    
    // Look for server buttons
    console.log('\nLooking for server buttons...');
    
    // Wait for server div to have content
    await page.waitForFunction(() => {
      const serverDiv = document.querySelector('#movie-server');
      return serverDiv && serverDiv.innerHTML.includes('server');
    }, { timeout: 15000 }).catch(() => console.log('Server div timeout'));
    
    // Get server buttons
    const servers = await page.evaluate(() => {
      const btns = document.querySelectorAll('[data-lid]');
      return Array.from(btns).map((b: any) => ({
        lid: b.getAttribute('data-lid'),
        sid: b.getAttribute('data-sid'),
        text: b.textContent?.trim()
      }));
    });
    console.log('Servers found:', servers);
    
    // Click on first server
    if (servers.length > 0) {
      console.log('\nClicking on server:', servers[0]);
      await page.click(`[data-lid="${servers[0].lid}"]`);
      
      // Wait for embed to load
      console.log('Waiting for embed...');
      await new Promise(r => setTimeout(r, 8000));
      
      // Check for iframes
      const iframes = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map((f: any) => ({
          src: f.src,
          id: f.id
        }));
      });
      console.log('\nIframes found:', iframes);
      
      // Get player content
      const playerContent = await page.evaluate(() => {
        const player = document.querySelector('#player');
        return player ? player.innerHTML : 'No player';
      });
      console.log('\nPlayer content:', playerContent.substring(0, 1000));
    }
    
    console.log('\nKeeping browser open for 30 seconds...');
    await new Promise(r => setTimeout(r, 30000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

getEmbed().catch(console.error);
