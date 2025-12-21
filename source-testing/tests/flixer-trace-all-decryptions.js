/**
 * Trace ALL decryptions to see which ones have URLs
 */
const puppeteer = require('puppeteer');

async function traceAllDecryptions() {
  console.log('=== Tracing All Decryptions ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Intercept ALL WASM decryptions
  await page.evaluateOnNewDocument(() => {
    window.__allDecryptions = [];
    
    const checkIntercept = () => {
      if (window.wasmImgData && window.wasmImgData.process_img_data) {
        const original = window.wasmImgData.process_img_data;
        window.wasmImgData.process_img_data = async function(encrypted, key) {
          const result = await original.call(this, encrypted, key);
          
          let hasUrl = false;
          let url = null;
          try {
            const parsed = JSON.parse(result);
            const sourceWithUrl = parsed.sources?.find(s => s.url && s.url.length > 0);
            if (sourceWithUrl) {
              hasUrl = true;
              url = sourceWithUrl.url.substring(0, 80);
            }
          } catch (e) {}
          
          window.__allDecryptions.push({
            index: window.__allDecryptions.length + 1,
            time: Date.now(),
            hasUrl,
            url,
            resultPreview: result.substring(0, 150)
          });
          
          console.log(`[DECRYPT ${window.__allDecryptions.length}] hasUrl=${hasUrl}`);
          
          return result;
        };
        console.log('[INTERCEPT] WASM intercepted');
      } else {
        setTimeout(checkIntercept, 100);
      }
    };
    setTimeout(checkIntercept, 500);
  });
  
  // Capture console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DECRYPT') || text.includes('[INTERCEPT]')) {
      console.log('PAGE:', text);
    }
  });
  
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
    waitUntil: 'networkidle2', 
    timeout: 60000 
  });
  
  await new Promise(r => setTimeout(r, 10000));
  
  const allDecryptions = await page.evaluate(() => window.__allDecryptions);
  
  console.log('\n=== All Decryptions ===');
  console.log('Total:', allDecryptions.length);
  
  for (const dec of allDecryptions) {
    console.log(`\n--- Decryption ${dec.index} ---`);
    console.log('Has URL:', dec.hasUrl);
    if (dec.hasUrl) {
      console.log('URL:', dec.url);
    }
    console.log('Preview:', dec.resultPreview);
  }
  
  // Count how many have URLs
  const withUrls = allDecryptions.filter(d => d.hasUrl);
  console.log(`\n=== Summary ===`);
  console.log(`Decryptions with URLs: ${withUrls.length}/${allDecryptions.length}`);
  
  await browser.close();
}

traceAllDecryptions().catch(console.error);
