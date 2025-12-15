/**
 * Test DLHD by watching the actual player to see what key URLs it uses
 * This will show us the EXACT URLs and headers the real player uses
 */

const puppeteer = require('puppeteer');

const CHANNEL = 51;

async function watchActualPlayer() {
  console.log('Watching actual DLHD player to capture key requests...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture ALL network requests
    const keyRequests = [];
    const m3u8Requests = [];
    
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const url = request.url();
      
      // Log key-related requests
      if (url.includes('/key/') || url.includes('wmsxx') || url.includes('.key')) {
        console.log('\n[KEY REQUEST]', url);
        console.log('  Method:', request.method());
        console.log('  Headers:', JSON.stringify(request.headers(), null, 2));
        keyRequests.push({ url, headers: request.headers() });
      }
      
      // Log m3u8 requests
      if (url.includes('.m3u8') || url.includes('mono.css')) {
        console.log('\n[M3U8 REQUEST]', url);
        m3u8Requests.push(url);
      }
      
      // Log server_lookup requests
      if (url.includes('server_lookup')) {
        console.log('\n[SERVER LOOKUP]', url);
      }
      
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      
      // Log key responses
      if (url.includes('/key/') || url.includes('wmsxx') || url.includes('.key')) {
        console.log('\n[KEY RESPONSE]', response.status(), url);
        try {
          const buffer = await response.buffer();
          console.log('  Length:', buffer.length);
          if (buffer.length === 16) {
            const text = buffer.toString('utf8');
            if (text.includes('error')) {
              console.log('  ERROR:', text);
            } else {
              console.log('  VALID KEY:', buffer.toString('hex'));
            }
          } else {
            console.log('  Data:', buffer.toString('utf8').substring(0, 100));
          }
        } catch (e) {
          console.log('  Could not read body');
        }
      }
      
      // Log server_lookup responses
      if (url.includes('server_lookup')) {
        console.log('\n[SERVER LOOKUP RESPONSE]', response.status());
        try {
          const text = await response.text();
          console.log('  Response:', text.substring(0, 200));
        } catch (e) {}
      }
    });
    
    // Go to the actual DLHD embed page
    const embedUrl = `https://dlhd.so/embed/stream-${CHANNEL}.php`;
    console.log('Navigating to:', embedUrl);
    
    await page.goto(embedUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    
    console.log('\n\nPage loaded. Watching for 60 seconds...');
    console.log('The player should start and we should see key requests.\n');
    
    // Wait and watch
    await new Promise(r => setTimeout(r, 60000));
    
    console.log('\n\n=== SUMMARY ===');
    console.log('Key requests captured:', keyRequests.length);
    console.log('M3U8 requests captured:', m3u8Requests.length);
    
    if (keyRequests.length > 0) {
      console.log('\nKey URLs:');
      keyRequests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.url}`);
      });
    }
    
  } finally {
    await browser.close();
  }
}

watchActualPlayer().catch(console.error);
