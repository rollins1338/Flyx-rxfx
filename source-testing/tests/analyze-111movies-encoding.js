/**
 * Analyze 111movies encoding to reverse engineer the API
 * 
 * Goal: Extract the encoding algorithm so we can generate API URLs
 * without needing Puppeteer/browser execution
 */

const puppeteer = require('puppeteer');

async function analyzeEncoding() {
  console.log('=== ANALYZING 111MOVIES ENCODING ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture all network requests
    const apiCalls = [];
    
    page.on('request', req => {
      const url = req.url();
      if (url.includes('fcd552c4') || url.includes('111movies.com/fcd')) {
        console.log('\n[REQUEST]', url);
        apiCalls.push({
          type: 'request',
          url,
          method: req.method(),
          headers: req.headers()
        });
      }
    });
    
    page.on('response', async res => {
      const url = res.url();
      if (url.includes('fcd552c4') || url.includes('111movies.com/fcd')) {
        try {
          const data = await res.json();
          console.log('\n[RESPONSE]', url);
          console.log('Data:', JSON.stringify(data, null, 2).substring(0, 500));
          apiCalls.push({
            type: 'response',
            url,
            status: res.status(),
            data
          });
        } catch (e) {
          console.log('[RESPONSE] Non-JSON:', url);
        }
      }
    });
    
    // Load the page
    const pageUrl = 'https://111movies.com/movie/155'; // The Dark Knight
    console.log('Loading:', pageUrl);
    
    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Extract __NEXT_DATA__ which contains the initial data
    const nextData = await page.evaluate(() => {
      const script = document.getElementById('__NEXT_DATA__');
      return script ? JSON.parse(script.textContent) : null;
    });
    
    if (nextData) {
      console.log('\n=== __NEXT_DATA__ ===');
      console.log('Page props keys:', Object.keys(nextData.props?.pageProps || {}));
      
      // Look for encoded data
      const pageProps = nextData.props?.pageProps || {};
      for (const [key, value] of Object.entries(pageProps)) {
        if (typeof value === 'string' && value.length > 50) {
          console.log(`\n${key} (${value.length} chars):`);
          console.log('  First 100:', value.substring(0, 100));
          console.log('  Last 100:', value.substring(value.length - 100));
        }
      }
    }
    
    // Wait for network activity
    console.log('\nWaiting for API calls...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Try to extract the encoding function from the page
    console.log('\n=== SEARCHING FOR ENCODING FUNCTION ===');
    
    const scripts = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.map(s => ({
        src: s.src,
        content: s.textContent?.substring(0, 500)
      }));
    });
    
    console.log(`Found ${scripts.length} scripts`);
    
    // Look for encoding-related code
    for (const script of scripts) {
      if (script.content && (
        script.content.includes('encode') ||
        script.content.includes('fcd552c4') ||
        script.content.includes('btoa') ||
        script.content.includes('charCodeAt')
      )) {
        console.log('\nPotential encoding script:');
        console.log('  src:', script.src || 'inline');
        console.log('  preview:', script.content);
      }
    }
    
    // Summary
    console.log('\n=== API CALLS CAPTURED ===');
    for (const call of apiCalls) {
      console.log(`\n${call.type.toUpperCase()}: ${call.url}`);
      if (call.data) {
        console.log('  Data keys:', Object.keys(call.data));
      }
    }
    
    // Keep browser open for manual inspection
    console.log('\n\nBrowser kept open for inspection. Press Ctrl+C to exit.');
    await new Promise(() => {}); // Keep running
    
  } catch (error) {
    console.error('Error:', error);
    await browser.close();
  }
}

// Alternative: Try to fetch the page and analyze the HTML/JS
async function analyzePageSource() {
  console.log('=== ANALYZING PAGE SOURCE ===\n');
  
  const response = await fetch('https://111movies.com/movie/155', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const html = await response.text();
  
  // Extract __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (nextDataMatch) {
    const nextData = JSON.parse(nextDataMatch[1]);
    console.log('__NEXT_DATA__ found!');
    console.log('Build ID:', nextData.buildId);
    console.log('Page:', nextData.page);
    console.log('Props keys:', Object.keys(nextData.props?.pageProps || {}));
    
    // Look for the encoded data
    const pageProps = nextData.props?.pageProps || {};
    
    // The 'e' property often contains encoded data
    if (pageProps.e) {
      console.log('\nEncoded data (e):');
      console.log('  Length:', pageProps.e.length);
      console.log('  First 200:', pageProps.e.substring(0, 200));
      
      // Try to decode it
      console.log('\n  Attempting decode...');
      
      // Try base64
      try {
        const decoded = Buffer.from(pageProps.e, 'base64').toString();
        console.log('  Base64 decode:', decoded.substring(0, 100));
      } catch (e) {
        console.log('  Base64 failed');
      }
      
      // Try URL decode
      try {
        const decoded = decodeURIComponent(pageProps.e);
        console.log('  URL decode:', decoded.substring(0, 100));
      } catch (e) {
        console.log('  URL decode failed');
      }
    }
    
    // Check for hash/key
    if (pageProps.h) {
      console.log('\nHash (h):', pageProps.h);
    }
    
    // Print all string props
    console.log('\nAll string props:');
    for (const [key, value] of Object.entries(pageProps)) {
      if (typeof value === 'string') {
        console.log(`  ${key}: ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}`);
      }
    }
  }
  
  // Look for script chunks that might contain the encoding logic
  const scriptMatches = html.match(/\/_next\/static\/chunks\/[^"]+\.js/g);
  if (scriptMatches) {
    console.log('\nScript chunks found:', scriptMatches.length);
    for (const script of scriptMatches.slice(0, 5)) {
      console.log('  ', script);
    }
  }
}

// Run analysis
const args = process.argv.slice(2);
if (args.includes('--browser')) {
  analyzeEncoding().catch(console.error);
} else {
  analyzePageSource().catch(console.error);
}
