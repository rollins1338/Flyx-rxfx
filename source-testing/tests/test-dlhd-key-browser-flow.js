/**
 * Test DLHD key fetching with full browser flow
 * This mimics exactly what happens when watching a stream in the browser
 */

const puppeteer = require('puppeteer');

const CHANNEL = 51;
const KEY_URL = 'https://chevy.kiko2.ru/key/premium51/5885921';
const PLAYER_URL = 'https://epicplayplay.cfd/';

async function testFullBrowserFlow() {
  console.log('Testing DLHD key fetch with full browser flow...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Use visible browser to see what happens
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up request interception to log all requests
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('kiko2.ru') || url.includes('giokko.ru')) {
        console.log('[Request]', request.method(), url);
        console.log('  Headers:', JSON.stringify(request.headers(), null, 2));
      }
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/key/')) {
        console.log('[Response]', response.status(), url);
        try {
          const buffer = await response.buffer();
          console.log('  Length:', buffer.length);
          console.log('  Data:', buffer.toString('hex'));
          if (buffer.length === 16) {
            const text = buffer.toString('utf8');
            if (text.includes('error')) {
              console.log('  ERROR:', text);
            } else {
              console.log('  VALID KEY!');
            }
          }
        } catch (e) {
          console.log('  Could not read body:', e.message);
        }
      }
    });
    
    // First, go to the player page
    console.log('1. Navigating to player page:', PLAYER_URL);
    await page.goto(PLAYER_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('   Page loaded\n');
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));
    
    // Now try to fetch the key from within the page context
    console.log('2. Fetching key from page context...');
    const result = await page.evaluate(async (keyUrl) => {
      try {
        const response = await fetch(keyUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
        });
        
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const text = new TextDecoder().decode(buffer);
        
        return {
          status: response.status,
          length: buffer.byteLength,
          hex,
          text: text.substring(0, 100),
          headers: Object.fromEntries(response.headers.entries()),
        };
      } catch (e) {
        return { error: e.message };
      }
    }, KEY_URL);
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // Keep browser open for inspection
    console.log('\nBrowser will stay open for 30 seconds for inspection...');
    await new Promise(r => setTimeout(r, 30000));
    
  } finally {
    await browser.close();
  }
}

// Also test what the actual DLHD player does
async function testActualPlayer() {
  console.log('\n\n=== Testing actual DLHD player ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Log key requests
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/key/')) {
        console.log('[KEY Response]', response.status(), url);
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
          }
        } catch (e) {}
      }
    });
    
    // Go to the actual DLHD embed page
    const embedUrl = `https://dlhd.so/embed/stream-${CHANNEL}.php`;
    console.log('Navigating to:', embedUrl);
    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('\nWatching for key requests for 60 seconds...');
    await new Promise(r => setTimeout(r, 60000));
    
  } finally {
    await browser.close();
  }
}

async function main() {
  // Test 1: Direct key fetch from player context
  await testFullBrowserFlow();
  
  // Test 2: Watch actual player
  // await testActualPlayer();
}

main().catch(console.error);
