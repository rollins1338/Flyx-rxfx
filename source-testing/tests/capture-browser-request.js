/**
 * Capture the exact browser request to the API
 */

const puppeteer = require('puppeteer');

async function captureRequest() {
  console.log('=== CAPTURING BROWSER API REQUEST ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    page.on('request', req => {
      const url = req.url();
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        console.log('=== API REQUEST ===');
        console.log('URL:', url);
        console.log('Method:', req.method());
        console.log('Headers:', JSON.stringify(req.headers(), null, 2));
        console.log('Post Data:', req.postData() || 'none');
      }
    });
    
    page.on('response', async res => {
      const url = res.url();
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        console.log('\n=== API RESPONSE ===');
        console.log('Status:', res.status());
        console.log('Headers:', JSON.stringify(res.headers(), null, 2));
        try {
          const text = await res.text();
          console.log('Body:', text.substring(0, 500));
        } catch (e) {}
      }
    });
    
    await page.goto('https://111movies.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
  } finally {
    await browser.close();
  }
}

captureRequest().catch(console.error);
