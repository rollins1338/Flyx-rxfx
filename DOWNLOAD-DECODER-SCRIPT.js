const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  let decoderScript = null;
  
  // Intercept the decoder script
  await page.setRequestInterception(true);
  page.on('request', request => request.continue());
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('.js') && (url.includes('/s') || url.match(/\/[a-f0-9]{32}\.js/))) {
      try {
        const content = await response.text();
        if (content.length > 100 && content.length < 50000) {
          console.log(`📥 Captured: ${url}`);
          console.log(`   Size: ${content.length} bytes`);
          fs.writeFileSync(`decoder-${Date.now()}.js`, content);
          decoderScript = content;
        }
      } catch (e) {}
    }
  });
  
  console.log('📡 Loading page...');
  await page.goto('https://vidsrc.xyz/embed/movie/550', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  if (decoderScript) {
    console.log('\n✅ Decoder script captured!');
    console.log('Preview:');
    console.log(decoderScript.substring(0, 500));
  } else {
    console.log('\n❌ No decoder script found');
  }
  
  await browser.close();
})();
