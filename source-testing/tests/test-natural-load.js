/**
 * Test Natural Load - Let the page load naturally and see what sources appear
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testNaturalLoad() {
  console.log('=== Testing Natural Page Load ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('source') || text.includes('Source') || 
        text.includes('server') || text.includes('Server') ||
        text.includes('Error') || text.includes('error')) {
      console.log('PAGE LOG:', text);
    }
  });
  
  // Navigate to Flixer
  console.log('Navigating to Flixer Breaking Bad S01E01...');
  await page.goto('https://flixer.sh/watch/tv/1396/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for the page to fully load
  console.log('Waiting for page to load...');
  await new Promise(r => setTimeout(r, 15000));
  
  // Check what's on the page
  const pageState = await page.evaluate(() => {
    // Look for source buttons or server list
    const buttons = Array.from(document.querySelectorAll('button'));
    const serverButtons = buttons.filter(b => 
      b.textContent.toLowerCase().includes('alpha') ||
      b.textContent.toLowerCase().includes('bravo') ||
      b.textContent.toLowerCase().includes('charlie') ||
      b.textContent.toLowerCase().includes('server')
    );
    
    // Look for video elements
    const videos = document.querySelectorAll('video');
    const iframes = document.querySelectorAll('iframe');
    
    // Look for any error messages
    const errorElements = Array.from(document.querySelectorAll('*')).filter(el => 
      el.textContent.toLowerCase().includes('error') ||
      el.textContent.toLowerCase().includes('unavailable') ||
      el.textContent.toLowerCase().includes('not found')
    );
    
    // Check localStorage for session info
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    return {
      title: document.title,
      url: window.location.href,
      serverButtons: serverButtons.map(b => b.textContent.trim()).slice(0, 10),
      videoCount: videos.length,
      iframeCount: iframes.length,
      iframeSrcs: Array.from(iframes).map(i => i.src).slice(0, 5),
      sessionId,
      hasWasm: !!window.wasmImgData?.ready,
      wasmKey: window.wasmImgData?.key?.slice(0, 16),
    };
  });
  
  console.log('\n=== Page State ===\n');
  console.log(JSON.stringify(pageState, null, 2));
  
  // Try to click on a server button if available
  if (pageState.serverButtons.length > 0) {
    console.log('\nFound server buttons, trying to click one...');
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const serverButton = buttons.find(b => 
        b.textContent.toLowerCase().includes('alpha') ||
        b.textContent.toLowerCase().includes('bravo')
      );
      if (serverButton) {
        serverButton.click();
      }
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    // Check for video/iframe after clicking
    const afterClick = await page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      const iframes = document.querySelectorAll('iframe');
      return {
        videoCount: videos.length,
        iframeCount: iframes.length,
        iframeSrcs: Array.from(iframes).map(i => i.src).slice(0, 5),
      };
    });
    
    console.log('\n=== After Click ===\n');
    console.log(JSON.stringify(afterClick, null, 2));
  }
  
  await browser.close();
}

testNaturalLoad().catch(console.error);
