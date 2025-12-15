/**
 * Capture actual 111movies API call using Puppeteer
 * to compare with our encoding
 */

const puppeteer = require('puppeteer');

async function captureApiCall() {
  console.log('=== CAPTURING 111MOVIES API CALL ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    let pageData = null;
    let apiUrl = null;
    let apiResponse = null;
    
    // Capture page data
    page.on('response', async res => {
      const url = res.url();
      
      // Capture the sources API call
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        apiUrl = url;
        console.log('\n=== API URL CAPTURED ===');
        console.log('Full URL:', url);
        console.log('URL length:', url.length);
        
        // Extract the encoded part
        const parts = url.split('/');
        const fcdIdx = parts.findIndex(p => p.startsWith('fcd552c4'));
        if (fcdIdx >= 0) {
          const encoded = parts[fcdIdx + 1];
          console.log('\nEncoded part:', encoded);
          console.log('Encoded length:', encoded.length);
          
          // Analyze the encoded part
          const chars = [...new Set(encoded)].sort();
          console.log('Unique chars:', chars.join(''));
          console.log('Char count:', chars.length);
        }
        
        try {
          apiResponse = await res.json();
          console.log('\nAPI Response:', JSON.stringify(apiResponse, null, 2).substring(0, 500));
        } catch (e) {}
      }
    });
    
    // Load page
    console.log('Loading page...');
    await page.goto('https://111movies.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Get page data
    pageData = await page.evaluate(() => {
      const script = document.getElementById('__NEXT_DATA__');
      return script ? JSON.parse(script.textContent).props?.pageProps?.data : null;
    });
    
    console.log('\n=== PAGE DATA ===');
    console.log('Data:', pageData);
    console.log('Length:', pageData?.length);
    
    // Wait for API call
    await new Promise(r => setTimeout(r, 5000));
    
    if (apiUrl && pageData) {
      console.log('\n=== COMPARISON ===');
      
      // Extract encoded from URL
      const parts = apiUrl.split('/');
      const fcdIdx = parts.findIndex(p => p.startsWith('fcd552c4'));
      const browserEncoded = parts[fcdIdx + 1];
      
      console.log('Page data length:', pageData.length);
      console.log('Browser encoded length:', browserEncoded.length);
      console.log('Ratio:', (browserEncoded.length / pageData.length).toFixed(2));
      
      // Check if there's a hash in the URL
      const fcdPart = parts[fcdIdx];
      console.log('\nfcd part:', fcdPart);
      console.log('Has hash after fcd552c4:', fcdPart.length > 8);
      if (fcdPart.length > 8) {
        console.log('Hash:', fcdPart.substring(8));
      }
    }
    
  } finally {
    await browser.close();
  }
}

captureApiCall().catch(console.error);
