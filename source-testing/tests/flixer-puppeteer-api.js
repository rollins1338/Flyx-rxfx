/**
 * Use Puppeteer to make API requests through the browser's network stack
 * This should bypass any TLS fingerprinting or other network-level bot detection
 */
const puppeteer = require('puppeteer');
const { FlixerWasmLoader } = require('./flixer-wasm-node.js');
const crypto = require('crypto');

async function testPuppeteerApi() {
  console.log('=== Testing Flixer API via Puppeteer ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Navigate to flixer watch page to trigger WASM loading
  console.log('Navigating to Flixer watch page...');
  await page.goto('https://flixer.sh/watch/tv/94605/1/1', { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait for WASM to be ready
  await new Promise(r => setTimeout(r, 3000));
  
  // Get the API key from the browser's WASM
  const browserKey = await page.evaluate(() => {
    return window.wasmImgData?.key || null;
  });
  
  console.log('Browser WASM key:', browserKey ? browserKey.substring(0, 16) + '...' : 'NOT READY');
  
  if (!browserKey) {
    console.log('WASM not ready, waiting...');
    await new Promise(r => setTimeout(r, 5000));
  }
  
  // Make API request through the browser
  console.log('\n--- Making API Request via Browser ---');
  const result = await page.evaluate(async () => {
    const apiKey = window.wasmImgData?.key;
    if (!apiKey) return { error: 'WASM not ready' };
    
    // Generate headers
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const path = '/api/tmdb/tv/94605/season/1/episode/1/images';
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    
    // Generate signature
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(apiKey);
    const messageBytes = encoder.encode(message);
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
    
    // Generate fingerprint
    const screen = window.screen;
    const nav = navigator;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.fillText('FP', 2, 2);
    const canvasData = canvas.toDataURL().substring(22, 50);
    const fpString = `${screen.width}x${screen.height}:${screen.colorDepth}:${nav.userAgent.substring(0, 50)}:${nav.platform}:${nav.language}:${new Date().getTimezoneOffset()}:${canvasData}`;
    let hash = 0;
    for (let i = 0; i < fpString.length; i++) {
      hash = (hash << 5) - hash + fpString.charCodeAt(i);
      hash &= hash;
    }
    const fingerprint = Math.abs(hash).toString(36);
    
    // Make request with X-Server header
    const baseUrl = 'https://plsdontscrapemelove.flixer.sh';
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        'X-Client-Fingerprint': fingerprint,
        'X-Only-Sources': '1',
        'X-Server': 'alpha',
        'bW90aGFmYWth': '1',
        'Accept': 'text/plain'
      }
    });
    
    const encrypted = await response.text();
    const decrypted = await window.wasmImgData.process_img_data(encrypted, apiKey);
    
    return {
      fingerprint,
      timestamp,
      decrypted
    };
  });
  
  console.log('Result:', JSON.stringify(result, null, 2));
  
  // Try multiple times
  console.log('\n--- Trying Multiple Requests ---');
  for (let i = 0; i < 5; i++) {
    const retryResult = await page.evaluate(async (attempt) => {
      const apiKey = window.wasmImgData?.key;
      if (!apiKey) return { error: 'WASM not ready' };
      
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
        .replace(/[/+=]/g, '').substring(0, 22);
      
      const path = '/api/tmdb/tv/94605/season/1/episode/1/images';
      const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
      
      const encoder = new TextEncoder();
      const keyBytes = encoder.encode(apiKey);
      const messageBytes = encoder.encode(message);
      const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
      
      const screen = window.screen;
      const nav = navigator;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.fillText('FP', 2, 2);
      const canvasData = canvas.toDataURL().substring(22, 50);
      const fpString = `${screen.width}x${screen.height}:${screen.colorDepth}:${nav.userAgent.substring(0, 50)}:${nav.platform}:${nav.language}:${new Date().getTimezoneOffset()}:${canvasData}`;
      let hash = 0;
      for (let i = 0; i < fpString.length; i++) {
        hash = (hash << 5) - hash + fpString.charCodeAt(i);
        hash &= hash;
      }
      const fingerprint = Math.abs(hash).toString(36);
      
      const baseUrl = 'https://plsdontscrapemelove.flixer.sh';
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          'X-Api-Key': apiKey,
          'X-Request-Timestamp': timestamp.toString(),
          'X-Request-Nonce': nonce,
          'X-Request-Signature': signature,
          'X-Client-Fingerprint': fingerprint,
          'X-Only-Sources': '1',
          'X-Server': 'alpha',
          'bW90aGFmYWth': '1',
          'Accept': 'text/plain'
        }
      });
      
      const encrypted = await response.text();
      const decrypted = await window.wasmImgData.process_img_data(encrypted, apiKey);
      const parsed = JSON.parse(decrypted);
      
      // Check if we got a URL
      const alphaSource = parsed.sources?.find(s => s.server === 'alpha');
      return {
        attempt,
        hasUrl: !!(alphaSource?.url),
        url: alphaSource?.url?.substring(0, 80) || ''
      };
    }, i);
    
    console.log(`Attempt ${i + 1}:`, retryResult);
    
    if (retryResult.hasUrl) {
      console.log('\n✅ SUCCESS! Got URL:', retryResult.url);
      break;
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  await browser.close();
  console.log('\nDone!');
}

testPuppeteerApi().catch(console.error);
