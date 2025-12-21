/**
 * Intercept the decrypted data in the browser to see what URLs are returned
 */
const puppeteer = require('puppeteer');

async function interceptDecrypted() {
  console.log('=== Intercepting Decrypted Data ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Inject code to intercept the WASM process_img_data function
  await page.evaluateOnNewDocument(() => {
    // Wait for WASM to be ready and intercept
    const checkAndIntercept = () => {
      if (window.wasmImgData && window.wasmImgData.process_img_data) {
        const original = window.wasmImgData.process_img_data;
        window.wasmImgData.process_img_data = async function(encrypted, key) {
          const result = await original.call(this, encrypted, key);
          console.log('[WASM DECRYPT]', result);
          
          // Try to parse and log
          try {
            const parsed = JSON.parse(result);
            if (parsed.sources) {
              console.log('[WASM SOURCES]', JSON.stringify(parsed.sources, null, 2));
            }
          } catch (e) {}
          
          return result;
        };
        console.log('[INTERCEPT] WASM process_img_data intercepted');
      } else {
        setTimeout(checkAndIntercept, 100);
      }
    };
    
    // Also intercept enhanceTmdbImageData if it exists
    const checkEnhancer = () => {
      if (window.enhanceTmdbImageData) {
        const original = window.enhanceTmdbImageData;
        window.enhanceTmdbImageData = async function(...args) {
          console.log('[ENHANCER CALL]', args);
          const result = await original.apply(this, args);
          console.log('[ENHANCER RESULT]', JSON.stringify(result, null, 2));
          return result;
        };
        console.log('[INTERCEPT] enhanceTmdbImageData intercepted');
      }
    };
    
    setTimeout(checkAndIntercept, 500);
    setTimeout(checkEnhancer, 1000);
  });
  
  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[WASM') || text.includes('[ENHANCER') || text.includes('[INTERCEPT')) {
      console.log('PAGE:', text);
    }
  });
  
  // Navigate to a TV show page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout, continuing...');
  }
  
  // Wait for video to load
  await new Promise(r => setTimeout(r, 10000));
  
  // Check what sources were found
  console.log('\n=== Final Check ===');
  const finalState = await page.evaluate(() => {
    // Try to find the video source
    const video = document.querySelector('video');
    const results = {
      videoSrc: video?.src || null,
      wasmReady: window.wasmImgData?.ready || false,
      wasmKey: window.wasmImgData?.key?.substring(0, 16) || null
    };
    
    return results;
  });
  
  console.log('Final state:', finalState);
  
  await browser.close();
  console.log('\nDone!');
}

interceptDecrypted().catch(console.error);
