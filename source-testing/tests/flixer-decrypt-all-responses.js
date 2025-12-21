/**
 * Decrypt all API responses to see which ones contain URLs
 */
const puppeteer = require('puppeteer');

async function decryptAllResponses() {
  console.log('=== Decrypting All API Responses ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Inject interceptor for WASM decryption
  await page.evaluateOnNewDocument(() => {
    window.__decryptedResponses = [];
    
    const checkAndIntercept = () => {
      if (window.wasmImgData && window.wasmImgData.process_img_data) {
        const original = window.wasmImgData.process_img_data;
        window.wasmImgData.process_img_data = async function(encrypted, key) {
          const result = await original.call(this, encrypted, key);
          window.__decryptedResponses.push({
            timestamp: Date.now(),
            encrypted: encrypted.substring(0, 50),
            decrypted: result
          });
          return result;
        };
        console.log('[INTERCEPT] WASM intercepted');
      } else {
        setTimeout(checkAndIntercept, 100);
      }
    };
    setTimeout(checkAndIntercept, 500);
  });
  
  // Navigate to watch page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout, continuing...');
  }
  
  // Wait for all decryptions
  await new Promise(r => setTimeout(r, 10000));
  
  // Get all decrypted responses
  const responses = await page.evaluate(() => window.__decryptedResponses);
  
  console.log('\n=== All Decrypted Responses ===');
  console.log('Total responses:', responses.length);
  
  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    console.log(`\n--- Response ${i + 1} ---`);
    console.log('Encrypted (first 50):', resp.encrypted);
    
    try {
      const parsed = JSON.parse(resp.decrypted);
      const hasUrl = parsed.sources?.some(s => s.url && s.url.length > 0);
      console.log('Has URL:', hasUrl);
      
      if (hasUrl) {
        console.log('✅ FOUND URL!');
        const sourceWithUrl = parsed.sources.find(s => s.url && s.url.length > 0);
        console.log('Server:', sourceWithUrl.server);
        console.log('URL:', sourceWithUrl.url);
      } else {
        console.log('Sources:', parsed.sources?.map(s => `${s.server}: ${s.url ? 'HAS URL' : 'empty'}`).join(', '));
      }
    } catch (e) {
      console.log('Decrypted (raw):', resp.decrypted.substring(0, 200));
    }
  }
  
  await browser.close();
  console.log('\nDone!');
}

decryptAllResponses().catch(console.error);
