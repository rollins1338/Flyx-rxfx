/**
 * Trace exactly what happens when the page successfully gets a URL
 */
const puppeteer = require('puppeteer');

async function traceSuccessfulRequest() {
  console.log('=== Tracing Successful Request Flow ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track all /images requests and their headers
  const imageRequests = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/images')) {
      const headers = request.headers();
      imageRequests.push({
        url,
        headers: {
          'x-api-key': headers['x-api-key']?.substring(0, 16) + '...',
          'x-request-timestamp': headers['x-request-timestamp'],
          'x-request-nonce': headers['x-request-nonce'],
          'x-client-fingerprint': headers['x-client-fingerprint'],
          'x-only-sources': headers['x-only-sources'],
          'x-server': headers['x-server'],
        }
      });
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/images')) {
      try {
        const text = await response.text();
        // Find the matching request
        const reqIndex = imageRequests.findIndex(r => r.url === url && !r.response);
        if (reqIndex >= 0) {
          imageRequests[reqIndex].response = text.substring(0, 100);
          imageRequests[reqIndex].status = response.status();
        }
      } catch (e) {}
    }
  });
  
  // Navigate to watch page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout, continuing...');
  }
  
  // Wait for all requests to complete
  await new Promise(r => setTimeout(r, 10000));
  
  // Print all image requests
  console.log('\n=== All /images Requests ===');
  for (let i = 0; i < imageRequests.length; i++) {
    const req = imageRequests[i];
    console.log(`\n--- Request ${i + 1} ---`);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Status:', req.status);
    console.log('Response:', req.response);
  }
  
  // Check if any request got a URL
  console.log('\n=== Checking for Successful URLs ===');
  const successfulRequests = imageRequests.filter(r => r.response && r.response.includes('workers.dev'));
  console.log('Requests with URLs:', successfulRequests.length);
  
  await browser.close();
  console.log('\nDone!');
}

traceSuccessfulRequest().catch(console.error);
