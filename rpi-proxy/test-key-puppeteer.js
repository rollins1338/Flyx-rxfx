#!/usr/bin/env node
/**
 * Test key fetching with Puppeteer (real browser)
 * Install: npm install puppeteer-core
 * Requires chromium: sudo apt install chromium-browser
 */

const puppeteer = require('puppeteer-core');

const KEY_URL = 'https://chevy.kiko2.ru/key/premium51/5885920';

async function testPuppeteer() {
  console.log('Testing key fetch with Puppeteer...');
  console.log('Key URL:', KEY_URL);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    
    const page = await browser.newPage();
    
    // Set up request interception to capture the key response
    let keyData = null;
    
    page.on('response', async (response) => {
      if (response.url().includes('/key/premium')) {
        console.log('Key response status:', response.status());
        try {
          const buffer = await response.buffer();
          keyData = buffer;
          console.log('Key data length:', buffer.length);
          if (buffer.length === 16) {
            const text = buffer.toString('utf8');
            if (text.includes('error')) {
              console.log('✗ Got error:', text);
            } else {
              console.log('✓ Valid key! Hex:', buffer.toString('hex'));
            }
          }
        } catch (e) {
          console.log('Error reading response:', e.message);
        }
      }
    });
    
    // Navigate to the key URL directly
    console.log('Fetching key...');
    const response = await page.goto(KEY_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    
    console.log('Page status:', response.status());
    
    // Try to get content
    const content = await page.content();
    console.log('Page content preview:', content.substring(0, 200));
    
  } catch (error) {
    console.error('Puppeteer error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

// Alternative: Use page.evaluate to fetch
async function testPuppeteerFetch() {
  console.log('\n=== Test 2: Puppeteer with fetch() ===');
  
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    
    // First navigate to the player domain to set origin
    await page.goto('https://epicplayplay.cfd/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Now fetch the key from within the page context
    const result = await page.evaluate(async (keyUrl) => {
      try {
        const response = await fetch(keyUrl, {
          method: 'GET',
          mode: 'cors',
        });
        
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const text = new TextDecoder().decode(buffer);
        
        return {
          status: response.status,
          length: buffer.byteLength,
          hex: hex,
          text: text.substring(0, 100),
          isError: text.includes('error'),
        };
      } catch (e) {
        return { error: e.message };
      }
    }, KEY_URL);
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.length === 16 && !result.isError) {
      console.log('✓ Valid key!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  await testPuppeteer();
  await testPuppeteerFetch();
  console.log('\n=== Done ===');
}

main();
