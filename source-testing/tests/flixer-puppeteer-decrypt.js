/**
 * Test if Flixer actually returns URLs in a real browser - with decryption
 */
const puppeteer = require('puppeteer');

async function testRealBrowser() {
  console.log('=== Testing Flixer in Real Browser with Decryption ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Navigate to a TV show page
  console.log('Navigating to Flixer watch page...');
  try {
    await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
  } catch (e) {
    console.log('Navigation timeout (expected), continuing...');
  }
  
  // Wait for WASM to be ready
  await new Promise(r => setTimeout(r, 3000));
  
  // Check WASM state and make a test request
  console.log('\n=== Making Test API Request from Browser ===');
  const result = await page.evaluate(async () => {
    try {
      // Check if WASM is ready
      if (!window.wasmImgData || !window.wasmImgData.ready) {
        return { error: 'WASM not ready' };
      }
      
      const apiKey = window.wasmImgData.key;
      console.log('API Key:', apiKey);
      
      // Generate headers like the client does
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
      
      // Make request
      const baseUrl = window.TMDB_API_BASE_URL || 'https://plsdontscrapemelove.flixer.sh';
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          'X-Api-Key': apiKey,
          'X-Request-Timestamp': timestamp.toString(),
          'X-Request-Nonce': nonce,
          'X-Request-Signature': signature,
          'X-Client-Fingerprint': fingerprint,
          'bW90aGFmYWth': '1',
          'Accept': 'text/plain'
        }
      });
      
      const encrypted = await response.text();
      
      // Decrypt
      const decrypted = await window.wasmImgData.process_img_data(encrypted, apiKey);
      
      return {
        apiKey: apiKey.substring(0, 16) + '...',
        fingerprint,
        timestamp,
        encrypted: encrypted.substring(0, 100) + '...',
        decrypted: decrypted
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });
  
  console.log('\nResult:', JSON.stringify(result, null, 2));
  
  // Now try with X-Server header
  console.log('\n=== Making Request with X-Server Header ===');
  const serverResult = await page.evaluate(async () => {
    try {
      const apiKey = window.wasmImgData.key;
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
      
      const baseUrl = window.TMDB_API_BASE_URL || 'https://plsdontscrapemelove.flixer.sh';
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
        server: 'alpha',
        decrypted: decrypted
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log('\nServer Result:', JSON.stringify(serverResult, null, 2));
  
  await browser.close();
  console.log('\nDone!');
}

testRealBrowser().catch(console.error);
