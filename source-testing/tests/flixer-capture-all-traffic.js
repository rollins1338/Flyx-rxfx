/**
 * Capture ALL network traffic from Flixer to understand the flow
 */
const puppeteer = require('puppeteer');

async function captureTraffic() {
  console.log('=== Capturing All Flixer Network Traffic ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture all requests and responses
  const traffic = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('flixer') || url.includes('m3u8') || url.includes('hls') || url.includes('.ts')) {
      traffic.push({
        type: 'request',
        url,
        method: request.method(),
        headers: request.headers()
      });
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('plsdontscrapemelove') || url.includes('m3u8') || url.includes('hls')) {
      let body = '';
      try {
        body = await response.text();
      } catch (e) {}
      
      traffic.push({
        type: 'response',
        url,
        status: response.status(),
        body: body.substring(0, 1000)
      });
      
      // Log m3u8 URLs immediately
      if (url.includes('m3u8') || body.includes('#EXTM3U')) {
        console.log('\n🎬 M3U8 FOUND:', url);
        console.log('Body preview:', body.substring(0, 300));
      }
    }
  });
  
  // Navigate to a TV show page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout, continuing...');
  }
  
  // Wait for video to load
  await new Promise(r => setTimeout(r, 10000));
  
  // Print summary
  console.log('\n=== Traffic Summary ===');
  console.log('Total requests/responses:', traffic.length);
  
  // Find API calls
  const apiCalls = traffic.filter(t => t.url.includes('/api/'));
  console.log('\nAPI Calls:');
  for (const call of apiCalls) {
    console.log(`  ${call.type}: ${call.url}`);
    if (call.type === 'response' && call.body) {
      // Try to see if it's decrypted JSON
      if (call.body.startsWith('{')) {
        console.log('    Body:', call.body.substring(0, 200));
      }
    }
  }
  
  // Find m3u8 URLs
  const m3u8Calls = traffic.filter(t => t.url.includes('m3u8') || (t.body && t.body.includes('#EXTM3U')));
  console.log('\nM3U8 Calls:', m3u8Calls.length);
  for (const call of m3u8Calls) {
    console.log(`  ${call.url}`);
  }
  
  // Check video element source
  const videoSrc = await page.evaluate(() => {
    const video = document.querySelector('video');
    return video ? video.src : null;
  });
  console.log('\nVideo element src:', videoSrc);
  
  // Check HLS.js state
  const hlsState = await page.evaluate(() => {
    if (window.Hls) {
      return 'HLS.js is loaded';
    }
    return 'HLS.js not found';
  });
  console.log('HLS.js:', hlsState);
  
  await browser.close();
  console.log('\nDone!');
}

captureTraffic().catch(console.error);
