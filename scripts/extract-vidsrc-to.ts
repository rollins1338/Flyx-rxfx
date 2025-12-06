/**
 * Extract m3u8 from vidsrc.to
 * URL: https://vidsrc.to/embed/movie/1228246
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const EMBED_URL = 'https://vidsrc.to/embed/movie/1228246';

async function extractM3u8() {
  console.log('=== VidSrc.to M3U8 Extraction ===\n');
  console.log('Target:', EMBED_URL);
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const m3u8Urls: string[] = [];
  
  page.on('request', (req: any) => {
    const url = req.url();
    if (url.includes('m3u8') || url.includes('.ts') || url.includes('stream')) {
      console.log(`[REQ] ${url}`);
    }
  });
  
  page.on('response', async (res: any) => {
    const url = res.url();
    if (url.includes('m3u8')) {
      console.log(`\n🎯 M3U8 FOUND: ${url}`);
      m3u8Urls.push(url);
      try {
        const text = await res.text();
        console.log('Content preview:', text.substring(0, 500));
        fs.writeFileSync(`vidsrc-m3u8-${Date.now()}.txt`, `URL: ${url}\n\n${text}`);
      } catch (e) {}
    }
  });

  try {
    console.log('\nLoading embed page...');
    await page.goto(EMBED_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for video to potentially load
    console.log('Waiting for video sources...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Check for iframes
    const iframes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).map((f: any) => f.src);
    });
    console.log('\nIframes found:', iframes);
    
    // If there are iframes, navigate to them
    for (const iframeSrc of iframes) {
      if (iframeSrc && !iframeSrc.includes('about:blank')) {
        console.log(`\nNavigating to iframe: ${iframeSrc}`);
        const iframePage = await browser.newPage();
        
        iframePage.on('response', async (res: any) => {
          const url = res.url();
          if (url.includes('m3u8')) {
            console.log(`\n🎯 M3U8 IN IFRAME: ${url}`);
            m3u8Urls.push(url);
          }
        });
        
        await iframePage.goto(iframeSrc, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 5000));
      }
    }
    
    console.log('\n=== Results ===');
    console.log('M3U8 URLs found:', m3u8Urls);
    
    if (m3u8Urls.length > 0) {
      fs.writeFileSync('vidsrc-results.json', JSON.stringify({ m3u8Urls }, null, 2));
      console.log('Saved to vidsrc-results.json');
    }
    
    console.log('\nKeeping browser open for 20 seconds...');
    await new Promise(r => setTimeout(r, 20000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

extractM3u8().catch(console.error);
