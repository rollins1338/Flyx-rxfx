/**
 * Check if SmashyStream uses WebSocket or other non-HTTP methods
 */

const puppeteer = require('puppeteer');

async function main() {
  console.log('=== CHECKING FOR WEBSOCKET/ALTERNATIVE API ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable CDP to capture WebSocket frames
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    
    const wsMessages = [];
    
    client.on('Network.webSocketCreated', (params) => {
      console.log('WebSocket created:', params.url);
    });
    
    client.on('Network.webSocketFrameReceived', (params) => {
      wsMessages.push({ type: 'received', data: params.response.payloadData });
    });
    
    client.on('Network.webSocketFrameSent', (params) => {
      wsMessages.push({ type: 'sent', data: params.response.payloadData });
    });
    
    // Also capture all requests
    const allRequests = [];
    
    client.on('Network.requestWillBeSent', (params) => {
      allRequests.push({
        url: params.request.url,
        method: params.request.method,
        type: params.type
      });
    });
    
    client.on('Network.responseReceived', (params) => {
      const req = allRequests.find(r => r.url === params.response.url);
      if (req) {
        req.status = params.response.status;
      }
    });
    
    console.log('Loading player page...');
    await page.goto('https://player.smashystream.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });
    
    // Wait for any delayed requests
    await new Promise(r => setTimeout(r, 15000));
    
    console.log('\n=== WEBSOCKET MESSAGES ===\n');
    console.log('Total WS messages:', wsMessages.length);
    for (const msg of wsMessages.slice(0, 10)) {
      console.log(`${msg.type}: ${msg.data?.substring(0, 200)}`);
    }
    
    console.log('\n=== ALL REQUEST TYPES ===\n');
    const types = {};
    for (const req of allRequests) {
      types[req.type] = (types[req.type] || 0) + 1;
    }
    console.log('Request types:', types);
    
    console.log('\n=== FAILED/PENDING REQUESTS ===\n');
    const failed = allRequests.filter(r => !r.status || r.status >= 400);
    for (const req of failed.filter(r => r.url.includes('smashystream'))) {
      console.log(`${req.status || 'pending'} ${req.method} ${req.url.substring(0, 100)}`);
    }
    
    // Check if there's any data in the page state
    console.log('\n=== PAGE STATE ===\n');
    
    const pageState = await page.evaluate(() => {
      const result = {
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        hasVideo: !!document.querySelector('video'),
        videoSrc: document.querySelector('video')?.src || 'none',
        iframes: Array.from(document.querySelectorAll('iframe')).map(f => f.src)
      };
      
      // Check for any React state
      const root = document.getElementById('root');
      if (root && root._reactRootContainer) {
        result.hasReact = true;
      }
      
      return result;
    });
    
    console.log('Page state:', JSON.stringify(pageState, null, 2));
    
    // Check if there's a service worker
    console.log('\n=== SERVICE WORKERS ===\n');
    
    const swStatus = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.map(r => r.scope);
      }
      return [];
    });
    
    console.log('Service workers:', swStatus);
    
    // Try to find any cached data
    console.log('\n=== CACHE STORAGE ===\n');
    
    const cacheData = await page.evaluate(async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        return cacheNames;
      }
      return [];
    });
    
    console.log('Cache names:', cacheData);
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
