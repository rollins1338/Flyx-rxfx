/**
 * Compare page data between fetch and Puppeteer
 */

const puppeteer = require('puppeteer');

async function comparePageData() {
  console.log('=== COMPARING PAGE DATA ===\n');
  
  // Fetch page data via HTTP
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await pageRes.text();
  
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const fetchPageData = nextData.props?.pageProps?.data;
  
  console.log('Fetch page data:', fetchPageData);
  console.log('Fetch page data length:', fetchPageData.length);
  
  // Get page data via Puppeteer
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    let browserEncoded = null;
    
    page.on('request', req => {
      const url = req.url();
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        const parts = url.split('/');
        const fcdIdx = parts.findIndex(p => p.startsWith('fcd552c4'));
        browserEncoded = parts[fcdIdx + 1];
      }
    });
    
    await page.goto('https://111movies.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    const puppeteerPageData = await page.evaluate(() => {
      const script = document.getElementById('__NEXT_DATA__');
      return script ? JSON.parse(script.textContent).props?.pageProps?.data : null;
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('\nPuppeteer page data:', puppeteerPageData);
    console.log('Puppeteer page data length:', puppeteerPageData.length);
    
    console.log('\n=== COMPARISON ===');
    console.log('Same data:', fetchPageData === puppeteerPageData);
    
    if (fetchPageData !== puppeteerPageData) {
      console.log('\nFetch first 50:', fetchPageData.substring(0, 50));
      console.log('Puppeteer first 50:', puppeteerPageData.substring(0, 50));
    }
    
    console.log('\nBrowser encoded length:', browserEncoded?.length);
    console.log('Browser encoded:', browserEncoded?.substring(0, 100) + '...');
    
    // The page data changes on each request!
    // This means the encoding is correct, but we're encoding different data
    
  } finally {
    await browser.close();
  }
}

comparePageData().catch(console.error);
