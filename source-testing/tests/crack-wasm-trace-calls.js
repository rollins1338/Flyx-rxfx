/**
 * Crack WASM - Trace Function Calls
 * 
 * Wrap the WASM imports to trace all calls made during decryption.
 * This will help us understand what the WASM is doing internally.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceCalls() {
  console.log('=== WASM Function Call Trace ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    if (msg.text().startsWith('[TRACE]')) {
      logs.push(msg.text());
    }
  });
  
  // Intercept WASM instantiation to wrap imports
  await page.evaluateOnNewDocument(() => {
    window.__wasmCalls = [];
    window.__traceEnabled = false;
    
    const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      // Wrap all import functions to trace calls
      const wrappedImports = {};
      
      for (const [namespace, imports] of Object.entries(importObject)) {
        wrappedImports[namespace] = {};
        
        for (const [name, fn] of Object.entries(imports)) {
          if (typeof fn === 'function') {
            wrappedImports[namespace][name] = function(...args) {
              if (window.__traceEnabled) {
                window.__wasmCalls.push({
                  namespace,
                  name,
                  args: args.map(a => typeof a === 'number' ? a : String(a).slice(0, 50)),
                });
              }
              return fn.apply(this, args);
            };
          } else {
            wrappedImports[namespace][name] = fn;
          }
        }
      }
      
      return originalInstantiateStreaming.call(this, source, wrappedImports);
    };
    
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      if (!importObject) {
        return originalInstantiate.call(this, bufferSource);
      }
      
      // Wrap all import functions to trace calls
      const wrappedImports = {};
      
      for (const [namespace, imports] of Object.entries(importObject)) {
        wrappedImports[namespace] = {};
        
        for (const [name, fn] of Object.entries(imports)) {
          if (typeof fn === 'function') {
            wrappedImports[namespace][name] = function(...args) {
              if (window.__traceEnabled) {
                window.__wasmCalls.push({
                  namespace,
                  name,
                  args: args.map(a => typeof a === 'number' ? a : String(a).slice(0, 50)),
                });
              }
              return fn.apply(this, args);
            };
          } else {
            wrappedImports[namespace][name] = fn;
          }
        }
      }
      
      return originalInstantiate.call(this, bufferSource, wrappedImports);
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`API key: ${testKey}\n`);
  
  const result = await page.evaluate(async (key) => {
    const crypto = window.crypto;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${key}:${timestamp}:${nonce}:${path}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': key,
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
    
    // Enable tracing
    window.__wasmCalls = [];
    window.__traceEnabled = true;
    
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    // Disable tracing
    window.__traceEnabled = false;
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      wasmCalls: window.__wasmCalls,
    };
  }, testKey);
  
  await browser.close();
  
  console.log(`WASM calls during decryption: ${result.wasmCalls.length}\n`);
  
  // Group calls by function name
  const callCounts = {};
  for (const call of result.wasmCalls) {
    const key = `${call.namespace}.${call.name}`;
    callCounts[key] = (callCounts[key] || 0) + 1;
  }
  
  console.log('Call counts:');
  for (const [name, count] of Object.entries(callCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }
  
  // Show first few calls
  console.log('\nFirst 30 calls:');
  for (const call of result.wasmCalls.slice(0, 30)) {
    console.log(`  ${call.namespace}.${call.name}(${call.args.join(', ')})`);
  }
  
  // Analyze the encrypted data
  const apiKeyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  const overhead = encrypted.length - decrypted.length;
  const prefix = encrypted.subarray(0, overhead);
  const ciphertext = encrypted.subarray(overhead);
  
  // Derive keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  console.log(`\n=== Data Analysis ===`);
  console.log(`Overhead: ${overhead} bytes`);
  console.log(`Keystream: ${keystream.length} bytes`);
  console.log(`Decrypted: ${result.decrypted}`);
}

traceCalls().catch(console.error);
