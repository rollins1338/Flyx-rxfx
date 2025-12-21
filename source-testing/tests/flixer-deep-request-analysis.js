/**
 * Deep analysis of what makes the page's requests succeed
 * while our manual requests fail
 */
const puppeteer = require('puppeteer');

async function deepAnalysis() {
  console.log('=== Deep Request Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Enable CDP to capture detailed request info
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  
  const requestDetails = new Map();
  
  client.on('Network.requestWillBeSent', event => {
    if (event.request.url.includes('/images')) {
      requestDetails.set(event.requestId, {
        url: event.request.url,
        method: event.request.method,
        headers: event.request.headers,
        initiator: event.initiator,
        timestamp: event.timestamp
      });
    }
  });
  
  client.on('Network.responseReceived', event => {
    if (requestDetails.has(event.requestId)) {
      const req = requestDetails.get(event.requestId);
      req.responseStatus = event.response.status;
      req.responseHeaders = event.response.headers;
    }
  });
  
  // Intercept WASM decryption to see which requests get URLs
  await page.evaluateOnNewDocument(() => {
    window.__requestResults = [];
    
    const checkIntercept = () => {
      if (window.wasmImgData && window.wasmImgData.process_img_data) {
        const original = window.wasmImgData.process_img_data;
        window.wasmImgData.process_img_data = async function(encrypted, key) {
          const result = await original.call(this, encrypted, key);
          try {
            const parsed = JSON.parse(result);
            const hasUrl = parsed.sources?.some(s => s.url && s.url.length > 0);
            window.__requestResults.push({
              time: Date.now(),
              hasUrl,
              sources: parsed.sources?.map(s => ({ server: s.server, hasUrl: !!s.url }))
            });
          } catch (e) {}
          return result;
        };
      } else {
        setTimeout(checkIntercept, 100);
      }
    };
    setTimeout(checkIntercept, 500);
  });
  
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
    waitUntil: 'networkidle2', 
    timeout: 60000 
  });
  
  await new Promise(r => setTimeout(r, 8000));
  
  // Get decryption results
  const results = await page.evaluate(() => window.__requestResults);
  
  console.log('\n=== Request Details ===');
  let reqNum = 0;
  for (const [id, req] of requestDetails) {
    if (!req.url.includes('/images')) continue;
    reqNum++;
    
    console.log(`\n--- Request ${reqNum} ---`);
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Initiator type:', req.initiator?.type);
    console.log('Initiator stack:', req.initiator?.stack?.callFrames?.slice(0, 3).map(f => f.functionName).join(' -> '));
    
    // Check if this request got a URL
    const matchingResult = results[reqNum - 1];
    if (matchingResult) {
      console.log('Got URL:', matchingResult.hasUrl);
    }
    
    // Print key headers
    console.log('Headers:');
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase().startsWith('x-') || 
          key.toLowerCase() === 'accept' ||
          key.toLowerCase() === 'origin' ||
          key.toLowerCase() === 'referer') {
        console.log(`  ${key}: ${value.substring(0, 50)}`);
      }
    }
  }
  
  console.log('\n=== Decryption Results ===');
  for (let i = 0; i < results.length; i++) {
    console.log(`Result ${i + 1}: hasUrl=${results[i].hasUrl}`);
  }
  
  await browser.close();
}

deepAnalysis().catch(console.error);
