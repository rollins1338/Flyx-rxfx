#!/usr/bin/env node
/**
 * Test DLHD key fetch using Puppeteer on RPI
 * This uses a real Chromium browser engine to bypass TLS fingerprinting
 * 
 * Install on RPI:
 *   sudo apt install chromium-browser
 *   npm install puppeteer-core
 */

const puppeteer = require('puppeteer-core');

const CHROMIUM_PATH = '/usr/bin/chromium-browser';

async function testKeyFetch() {
  console.log('Testing DLHD key fetch with Puppeteer...\n');
  
  // First get fresh key URL from M3U8
  const https = require('https');
  const m3u8 = await new Promise((resolve, reject) => {
    https.get('https://zekonew.kiko2.ru/zeko/premium51/mono.css', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Referer': 'https://epicplayplay.cfd/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
  
  const keyMatch = m3u8.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
  if (!keyMatch) {
    console.log('ERROR: No key URL found in M3U8');
    return;
  }
  
  const keyUrl = keyMatch[1];
  console.log('Key URL:', keyUrl);
  
  let browser;
  try {
    console.log('\nLaunching Chromium...');
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // First navigate to the player domain to establish context
    console.log('Navigating to player domain...');
    await page.goto('https://epicplayplay.cfd/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Now fetch the key from within the browser context
    console.log('Fetching key from browser context...');
    const result = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, { mode: 'cors' });
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const text = new TextDecoder().decode(buffer);
        return {
          status: response.status,
          length: buffer.byteLength,
          hex,
          text: text.substring(0, 50),
          isError: text.includes('error'),
        };
      } catch (e) {
        return { error: e.message };
      }
    }, keyUrl);
    
    console.log('\nResult:', JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.log('\n❌ Fetch error:', result.error);
    } else if (result.length === 16 && !result.isError) {
      console.log('\n✓ SUCCESS! Got valid 16-byte key');
      console.log('Key (hex):', result.hex);
    } else if (result.isError) {
      console.log('\n❌ Server returned error:', result.text);
    } else {
      console.log('\n❌ Unexpected response');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
}

testKeyFetch();
