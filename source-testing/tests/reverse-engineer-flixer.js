/**
 * Reverse Engineer Flixer.sh Decryption
 * 
 * Use Puppeteer to:
 * 1. Intercept the WASM decryption process
 * 2. Capture the inputs and outputs
 * 3. Understand the exact algorithm
 * 
 * This is for REVERSE ENGINEERING ONLY - not for production use.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function reverseEngineerDecryption() {
  console.log('=== Reverse Engineering Flixer Decryption ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,  // Show browser for debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  
  const page = await browser.newPage();
  
  // Set up console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[FLIXER]') || text.includes('decrypt') || text.includes('key') || text.includes('wasm')) {
      console.log('CONSOLE:', text);
    }
  });
  
  // Intercept network requests
  await page.setRequestInterception(true);
  
  const apiRequests = [];
  const apiResponses = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('plsdontscrapemelove')) {
      console.log(`\n[REQUEST] ${request.method()} ${url}`);
      console.log('Headers:', JSON.stringify(request.headers(), null, 2));
      apiRequests.push({
        url,
        method: request.method(),
        headers: request.headers(),
      });
    }
    request.continue();
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('plsdontscrapemelove')) {
      try {
        const text = await response.text();
        console.log(`\n[RESPONSE] ${url}`);
        console.log(`Status: ${response.status()}`);
        console.log(`Body (first 100): ${text.substring(0, 100)}`);
        apiResponses.push({
          url,
          status: response.status(),
          body: text,
        });
      } catch (e) {
        console.log(`[RESPONSE] ${url} - Could not read body`);
      }
    }
  });
  
  // Inject code to intercept WASM functions
  await page.evaluateOnNewDocument(() => {
    // Store original WebAssembly.instantiate
    const originalInstantiate = WebAssembly.instantiate;
    const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    // Intercept WebAssembly.instantiate
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[FLIXER] WebAssembly.instantiate called');
      
      // Log the imports
      if (importObject && importObject.wbg) {
        console.log('[FLIXER] WASM imports:', Object.keys(importObject.wbg));
      }
      
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      
      // Log the exports
      const exports = result.instance ? result.instance.exports : result.exports;
      console.log('[FLIXER] WASM exports:', Object.keys(exports));
      
      // Wrap the process_img_data function if it exists
      if (exports.process_img_data) {
        const originalProcess = exports.process_img_data;
        exports.process_img_data = function(...args) {
          console.log('[FLIXER] process_img_data called with args:', args);
          const result = originalProcess.apply(this, args);
          console.log('[FLIXER] process_img_data result:', result);
          return result;
        };
      }
      
      // Wrap get_img_key if it exists
      if (exports.get_img_key) {
        const originalGetKey = exports.get_img_key;
        exports.get_img_key = function(...args) {
          console.log('[FLIXER] get_img_key called');
          const result = originalGetKey.apply(this, args);
          console.log('[FLIXER] get_img_key result:', result);
          return result;
        };
      }
      
      return result;
    };
    
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      console.log('[FLIXER] WebAssembly.instantiateStreaming called');
      return originalInstantiateStreaming.call(this, source, importObject);
    };
    
    // Also intercept the module-level functions
    window.__flixerDebug = {
      capturedKeys: [],
      capturedDecryptions: [],
    };
  });
  
  // Navigate to Flixer
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM to initialize
  console.log('\nWaiting for WASM initialization...');
  await page.waitForFunction(() => {
    return window.wasmImgData && window.wasmImgData.ready;
  }, { timeout: 30000 }).catch(() => {
    console.log('WASM initialization timeout');
  });
  
  // Check WASM status
  const wasmStatus = await page.evaluate(() => {
    return {
      ready: window.wasmImgData?.ready,
      hasGetKey: typeof window.wasmImgData?.get_img_key === 'function',
      hasProcess: typeof window.wasmImgData?.process_img_data === 'function',
    };
  });
  
  console.log('\nWASM Status:', wasmStatus);
  
  // Get the API key
  const apiKey = await page.evaluate(async () => {
    try {
      const key = await window.wasmImgData.get_img_key();
      console.log('[FLIXER] Got API key:', key);
      return key;
    } catch (e) {
      console.log('[FLIXER] Error getting key:', e.message);
      return null;
    }
  });
  
  console.log('\nAPI Key:', apiKey);
  
  // Now let's manually call the API and decrypt
  if (apiKey) {
    console.log('\n=== Testing Decryption ===\n');
    
    // Make a test API call
    const testResult = await page.evaluate(async (key) => {
      try {
        // Import the poster utils module
        const module = await import('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-poster-utils.js');
        
        console.log('[FLIXER] Module loaded:', Object.keys(module));
        
        // Try to get sources
        const sources = await module.getTVSources('106379', '1', '1');
        console.log('[FLIXER] Sources:', JSON.stringify(sources));
        
        return {
          success: true,
          sources,
        };
      } catch (e) {
        console.log('[FLIXER] Error:', e.message);
        return {
          success: false,
          error: e.message,
        };
      }
    }, apiKey);
    
    console.log('\nTest Result:', JSON.stringify(testResult, null, 2));
    
    // Now let's intercept the actual decryption
    console.log('\n=== Intercepting Decryption Process ===\n');
    
    const decryptionDetails = await page.evaluate(async () => {
      // We need to intercept the process_img_data function
      // Let's manually call it with known data
      
      const crypto = window.crypto || window.msCrypto;
      
      // Generate a test key
      const testKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      console.log('[FLIXER] Test key:', testKey);
      
      // Make a direct API call
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
        .replace(/[/+=]/g, '')
        .substring(0, 22);
      
      // Generate signature
      const encoder = new TextEncoder();
      const keyData = encoder.encode(testKey);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      
      const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
      const message = `${testKey}:${timestamp}:${nonce}:${path}`;
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      
      console.log('[FLIXER] Signature:', signature);
      
      // Make the request
      const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
        headers: {
          'X-Api-Key': testKey,
          'X-Request-Timestamp': timestamp.toString(),
          'X-Request-Nonce': nonce,
          'X-Request-Signature': signature,
          'X-Client-Fingerprint': 'test',
          'bW90aGFmYWth': '1',
          'X-Only-Sources': '1',
          'X-Server': 'alpha',
        },
      });
      
      const encryptedData = await response.text();
      console.log('[FLIXER] Encrypted data:', encryptedData.substring(0, 50));
      
      // Now try to decrypt using the WASM
      try {
        const decrypted = await window.wasmImgData.process_img_data(encryptedData, testKey);
        console.log('[FLIXER] Decrypted:', JSON.stringify(decrypted));
        
        return {
          testKey,
          encryptedData,
          decrypted,
          success: true,
        };
      } catch (e) {
        console.log('[FLIXER] Decryption error:', e.message);
        return {
          testKey,
          encryptedData,
          error: e.message,
          success: false,
        };
      }
    });
    
    console.log('\nDecryption Details:', JSON.stringify(decryptionDetails, null, 2));
    
    // If we got decrypted data, analyze the relationship between key and decryption
    if (decryptionDetails.success && decryptionDetails.decrypted) {
      console.log('\n=== SUCCESS! Decryption Works ===');
      console.log('Key:', decryptionDetails.testKey);
      console.log('Encrypted:', decryptionDetails.encryptedData.substring(0, 100));
      console.log('Decrypted:', JSON.stringify(decryptionDetails.decrypted, null, 2));
    }
  }
  
  // Keep browser open for manual inspection
  console.log('\n\nBrowser will stay open for 60 seconds for manual inspection...');
  await new Promise(r => setTimeout(r, 60000));
  
  await browser.close();
}

reverseEngineerDecryption().catch(console.error);
