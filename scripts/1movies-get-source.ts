/**
 * 1movies.bz - Get actual video source from server selection
 * We know:
 * - Episode ID (eid): cYu_-KCi
 * - Server 1 link ID (lid): doO486al6Q (sid=3)
 * - Server 2 link ID (lid): doO486al6A (sid=2)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const MOVIE_URL = 'https://1movies.bz/watch/movie-five-nights-at-freddys-2-xrbnrp';

async function getSource() {
  console.log('=== 1movies.bz Get Video Source ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture ALL requests to find the embed/source endpoint
  page.on('request', (req: any) => {
    const url = req.url();
    // Log everything that might be video-related
    if (url.includes('ajax') || url.includes('embed') || 
        url.includes('source') || url.includes('link') ||
        url.includes('m3u8') || url.includes('player') ||
        url.includes('video') || url.includes('stream')) {
      console.log(`[REQ] ${req.method()} ${url}`);
    }
  });
  
  page.on('response', async (res: any) => {
    const url = res.url();
    if (url.includes('ajax') || url.includes('embed') || 
        url.includes('source') || url.includes('link') ||
        url.includes('m3u8')) {
      console.log(`[RES] ${res.status()} ${url}`);
      try {
        const text = await res.text();
        console.log('Response:', text.substring(0, 800));
        
        // Save any response that might contain embed info
        if (text.includes('embed') || text.includes('iframe') || 
            text.includes('m3u8') || text.includes('source')) {
          const filename = `1movies-source-${Date.now()}.txt`;
          fs.writeFileSync(filename, `URL: ${url}\n\n${text}`);
          console.log(`\n>>> Saved to ${filename}\n`);
        }
      } catch (e) {}
    }
  });

  try {
    console.log('Loading movie page...');
    await page.goto(MOVIE_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    
    // Wait for page to fully load
    await new Promise(r => setTimeout(r, 5000));
    
    // Check if servers are loaded
    const serverHTML = await page.evaluate(() => {
      const el = document.querySelector('#movie-server');
      return el ? el.innerHTML : 'No server div';
    });
    console.log('\nServer HTML:', serverHTML.substring(0, 500));
    
    // Find and click on a server button
    const serverBtn = await page.$('[data-lid]');
    if (serverBtn) {
      console.log('\n>>> Clicking server button...\n');
      await serverBtn.click();
      
      // Wait for the embed to load
      await new Promise(r => setTimeout(r, 8000));
      
      // Check for iframes
      const iframes = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map((f: any) => ({
          src: f.src,
          id: f.id,
          name: f.name
        }));
      });
      console.log('\nIframes after click:', JSON.stringify(iframes, null, 2));
      
      // Get player div content
      const playerHTML = await page.evaluate(() => {
        const el = document.querySelector('#player');
        return el ? el.innerHTML : 'No player';
      });
      console.log('\nPlayer HTML:', playerHTML.substring(0, 1000));
      
      // If there's an iframe, try to get its content
      if (iframes.length > 0 && iframes[0].src) {
        console.log('\n>>> Found iframe, navigating to:', iframes[0].src);
        
        // Create new page for iframe
        const iframePage = await browser.newPage();
        
        iframePage.on('request', (req: any) => {
          const url = req.url();
          if (url.includes('m3u8') || url.includes('video') || 
              url.includes('stream') || url.includes('source')) {
            console.log(`[IFRAME REQ] ${url}`);
          }
        });
        
        iframePage.on('response', async (res: any) => {
          const url = res.url();
          if (url.includes('m3u8')) {
            console.log(`\n🎯 M3U8 FOUND: ${url}`);
            try {
              const text = await res.text();
              console.log('M3U8 Content:', text.substring(0, 500));
              fs.writeFileSync('1movies-m3u8.txt', `URL: ${url}\n\n${text}`);
            } catch (e) {}
          }
        });
        
        await iframePage.goto(iframes[0].src, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 5000));
      }
    } else {
      console.log('No server button found');
    }
    
    console.log('\nKeeping browser open for 30 seconds...');
    await new Promise(r => setTimeout(r, 30000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

getSource().catch(console.error);
