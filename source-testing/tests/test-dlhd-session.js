/**
 * Test if DLHD requires a session/cookie from the player page
 * Maybe we need to visit the player page first to get a session
 */

const puppeteer = require('puppeteer');

async function testWithSession() {
  console.log('Testing DLHD with session from player page...\n');
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // First, visit the player domain to establish a session
    console.log('1. Visiting player domain to get session...');
    await page.goto('https://epicplayplay.cfd/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Get cookies
    const cookies = await page.cookies();
    console.log('   Cookies:', cookies.length > 0 ? cookies.map(c => c.name).join(', ') : 'none');
    
    // Now try to fetch the key from within the page context
    console.log('\n2. Fetching key from page context...');
    
    // Get fresh key URL first
    const m3u8 = await page.evaluate(async () => {
      const res = await fetch('https://zekonew.kiko2.ru/zeko/premium51/mono.css');
      return res.text();
    });
    
    const keyMatch = m3u8.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
    if (!keyMatch) {
      console.log('   No key URL found in M3U8');
      return;
    }
    
    const keyUrl = keyMatch[1];
    console.log('   Key URL:', keyUrl);
    
    // Fetch the key
    const result = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const text = new TextDecoder().decode(buffer);
        return { status: res.status, length: buffer.byteLength, hex, text };
      } catch (e) {
        return { error: e.message };
      }
    }, keyUrl);
    
    console.log('   Result:', result);
    
    if (result.length === 16 && !result.text.includes('error')) {
      console.log('\n✓ KEY FETCH SUCCEEDED with session!');
    } else {
      console.log('\n❌ Key fetch failed even with session');
    }
    
  } finally {
    await browser.close();
  }
}

testWithSession().catch(console.error);
