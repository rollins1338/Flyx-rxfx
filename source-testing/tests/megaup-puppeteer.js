/**
 * Use Puppeteer to extract MegaUp stream URL
 * This will actually run the JavaScript and intercept the m3u8 URL
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const TEST_URL = 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ';

async function extractStreamUrl() {
  console.log('Launching browser with stealth...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
    ],
  });
  
  const page = await browser.newPage();
  
  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36');
  
  // Set referer
  await page.setExtraHTTPHeaders({
    'Referer': 'https://animekai.to/',
  });
  
  // Capture all network requests
  const capturedUrls = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('/media/') || url.includes('/stream/')) {
      console.log('📡 Request:', url);
      capturedUrls.push({ type: 'request', url });
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('/media/') || url.includes('/stream/')) {
      console.log('📥 Response:', url, response.status());
      capturedUrls.push({ type: 'response', url, status: response.status() });
    }
  });
  
  // Intercept console logs from the page
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('http') || text.includes('m3u8') || text.includes('file')) {
      console.log('🖥️ Console:', text);
    }
  });
  
  console.log('Navigating to:', TEST_URL);
  
  try {
    // First check the raw response
    const response = await page.goto(TEST_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    console.log('Response status:', response.status());
    console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers()), null, 2).substring(0, 500));
    
    // Get the raw HTML
    const rawHtml = await page.content();
    console.log('Raw HTML length:', rawHtml.length);
    console.log('HTML preview:', rawHtml.substring(0, 1000));
    
    // Check for Cloudflare
    if (rawHtml.includes('cf-browser-verification') || rawHtml.includes('challenge-platform')) {
      console.log('\n⚠️ CLOUDFLARE CHALLENGE DETECTED');
      // Wait for challenge to complete
      await new Promise(r => setTimeout(r, 10000));
    }
    
    // Wait for full load
    await page.waitForNetworkIdle({ timeout: 15000 }).catch(() => {});
    
    console.log('Page loaded, waiting for player...');
    
    // Wait longer for the player to initialize and decrypt
    await new Promise(r => setTimeout(r, 10000));
    
    // Take a screenshot to see what's happening
    await page.screenshot({ path: 'source-testing/results/megaup-screenshot.png' });
    console.log('Screenshot saved');
    
    // Get page HTML to see if there's an error
    const html = await page.content();
    if (html.includes('error') || html.includes('blocked')) {
      console.log('Page might have error/block');
    }
    
    // Check what's in the page
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        hasJwplayer: typeof jwplayer !== 'undefined',
        hasVideo: !!document.querySelector('video'),
        hasPlayer: !!document.querySelector('#player'),
        bodyText: document.body?.innerText?.substring(0, 500),
        scripts: Array.from(document.querySelectorAll('script')).map(s => s.src || 'inline').slice(0, 5),
      };
    });
    console.log('\nPage info:', JSON.stringify(pageInfo, null, 2));
    
    // Try to extract the stream URL from the page
    const streamUrl = await page.evaluate(() => {
      // Check if jwplayer is available
      if (typeof jwplayer !== 'undefined') {
        const player = jwplayer();
        if (player && player.getPlaylistItem) {
          const item = player.getPlaylistItem();
          if (item && item.file) {
            return item.file;
          }
          if (item && item.sources && item.sources[0]) {
            return item.sources[0].file;
          }
        }
      }
      
      // Check for video element
      const video = document.querySelector('video');
      if (video && video.src) {
        return video.src;
      }
      
      // Check for source element
      const source = document.querySelector('video source');
      if (source && source.src) {
        return source.src;
      }
      
      return null;
    });
    
    if (streamUrl) {
      console.log('\n✓✓✓ FOUND STREAM URL ✓✓✓');
      console.log(streamUrl);
    } else {
      console.log('\nNo stream URL found directly');
    }
    
    // Also try to get the decrypted config
    const config = await page.evaluate(() => {
      if (typeof jwplayer !== 'undefined') {
        const player = jwplayer();
        if (player && player.getConfig) {
          return player.getConfig();
        }
      }
      return null;
    });
    
    if (config) {
      console.log('\nJWPlayer config:', JSON.stringify(config, null, 2).substring(0, 1000));
    }
    
    console.log('\nCaptured URLs:', capturedUrls);
    
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  await browser.close();
  console.log('\nBrowser closed');
}

extractStreamUrl().catch(console.error);
