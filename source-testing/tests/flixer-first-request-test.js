/**
 * Test what the first request (without X-Server) returns
 */
const puppeteer = require('puppeteer');

async function testFirstRequest() {
  console.log('=== Testing First Request Response ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Intercept WASM to see what the first request returns
  await page.evaluateOnNewDocument(() => {
    window.__firstResponse = null;
    
    const checkIntercept = () => {
      if (window.wasmImgData && window.wasmImgData.process_img_data) {
        const original = window.wasmImgData.process_img_data;
        let callCount = 0;
        window.wasmImgData.process_img_data = async function(encrypted, key) {
          const result = await original.call(this, encrypted, key);
          callCount++;
          if (callCount === 1) {
            window.__firstResponse = result;
            console.log('[FIRST RESPONSE]', result);
          }
          return result;
        };
      } else {
        setTimeout(checkIntercept, 100);
      }
    };
    setTimeout(checkIntercept, 500);
  });
  
  // Capture console
  page.on('console', msg => {
    if (msg.text().includes('[FIRST RESPONSE]')) {
      console.log('PAGE:', msg.text());
    }
  });
  
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
    waitUntil: 'networkidle2', 
    timeout: 60000 
  });
  
  await new Promise(r => setTimeout(r, 5000));
  
  const firstResponse = await page.evaluate(() => window.__firstResponse);
  
  console.log('\n=== First Response (without X-Server) ===');
  if (firstResponse) {
    try {
      const parsed = JSON.parse(firstResponse);
      console.log('Parsed:', JSON.stringify(parsed, null, 2));
      
      // Check if any source has a URL
      const hasUrl = parsed.sources?.some(s => s.url && s.url.length > 0);
      console.log('\nHas URL:', hasUrl);
      
      if (hasUrl) {
        const sourceWithUrl = parsed.sources.find(s => s.url);
        console.log('Source with URL:', sourceWithUrl);
      }
    } catch (e) {
      console.log('Raw:', firstResponse);
    }
  } else {
    console.log('No first response captured');
  }
  
  await browser.close();
}

testFirstRequest().catch(console.error);
