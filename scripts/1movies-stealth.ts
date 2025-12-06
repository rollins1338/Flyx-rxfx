/**
 * 1movies.bz - Stealth browser approach
 * Use puppeteer-extra with stealth plugin to avoid detection
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const MOVIE_URL = 'https://1movies.bz/watch/movie-five-nights-at-freddys-2-xrbnrp';

async function stealthCapture() {
  console.log('=== 1movies.bz Stealth Capture ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set a realistic viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Capture network requests
  const capturedRequests: any[] = [];
  
  page.on('request', (req: any) => {
    const url = req.url();
    if (url.includes('ajax') || url.includes('embed') || url.includes('m3u8')) {
      capturedRequests.push({
        url,
        method: req.method(),
        headers: req.headers()
      });
      console.log(`[REQ] ${req.method()} ${url}`);
    }
  });
  
  page.on('response', async (res: any) => {
    const url = res.url();
    if (url.includes('ajax/links')) {
      console.log(`\n[RES] ${res.status()} ${url}`);
      try {
        const text = await res.text();
        console.log('Response:', text);
        
        // Save responses
        const filename = `1movies-ajax-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify({ url, response: text }, null, 2));
      } catch (e) {}
    }
  });

  try {
    console.log('Loading page with stealth...');
    await page.goto(MOVIE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for page to stabilize
    console.log('Waiting for page to stabilize...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Check if we got past Cloudflare
    const title = await page.title();
    console.log('Page title:', title);
    
    // Look for server buttons
    const servers = await page.evaluate(() => {
      const btns = document.querySelectorAll('[data-lid]');
      return Array.from(btns).map((b: any) => ({
        lid: b.getAttribute('data-lid'),
        sid: b.getAttribute('data-sid'),
        text: b.textContent?.trim()
      }));
    });
    console.log('\nServers found:', servers);
    
    if (servers.length > 0) {
      console.log('\nClicking first server...');
      await page.click(`[data-lid="${servers[0].lid}"]`);
      
      // Wait for response
      await new Promise(r => setTimeout(r, 5000));
      
      // Check for iframe
      const iframes = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map((f: any) => f.src);
      });
      console.log('\nIframes:', iframes);
      
      // Get player content
      const playerHTML = await page.evaluate(() => {
        return document.querySelector('#player')?.innerHTML || 'No player';
      });
      console.log('\nPlayer HTML:', playerHTML.substring(0, 500));
    }
    
    // Save all captured requests
    fs.writeFileSync('1movies-captured-requests.json', JSON.stringify(capturedRequests, null, 2));
    
    console.log('\nKeeping browser open for 20 seconds...');
    await new Promise(r => setTimeout(r, 20000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

stealthCapture().catch(console.error);
