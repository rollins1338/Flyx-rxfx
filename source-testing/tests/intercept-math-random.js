/**
 * Intercept Math.random() to understand how the WASM uses it
 * 
 * Key insight: The WASM imports __wbg_random_3ad904d98382defe which is Math.random()
 * This means the counter blocks are generated using Math.random(), not derived from the key!
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptMathRandom() {
  console.log('=== Intercepting Math.random() ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Inject code to intercept Math.random BEFORE any scripts run
  await page.evaluateOnNewDocument(() => {
    window.__randomCalls = [];
    window.__randomIndex = 0;
    
    const originalRandom = Math.random;
    Math.random = function() {
      const value = originalRandom.call(Math);
      window.__randomCalls.push({
        index: window.__randomIndex++,
        value: value,
        stack: new Error().stack,
      });
      return value;
    };
    
    // Also track when WASM is loaded
    window.__wasmLoaded = false;
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(...args) {
      const result = await originalInstantiate.apply(this, args);
      window.__wasmLoaded = true;
      console.log('[WASM] Loaded, random calls so far:', window.__randomCalls.length);
      return result;
    };
  });
  
  // Navigate to Flixer
  console.log('Loading Flixer...');
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get random calls before decryption
  const randomCallsBefore = await page.evaluate(() => window.__randomCalls.length);
  console.log(`Random calls before decryption: ${randomCallsBefore}`);
  
  // Make a decryption request
  const testKey = crypto.randomBytes(32).toString('hex');
  
  const result = await page.evaluate(async (key) => {
    const randomBefore = window.__randomCalls.length;
    
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
    
    const randomAfterFetch = window.__randomCalls.length;
    
    // Now decrypt
    let decrypted = null;
    try {
      decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    } catch (e) {
      console.log('Decryption error:', e.message);
    }
    
    const randomAfterDecrypt = window.__randomCalls.length;
    
    // Get the random calls made during decryption
    const decryptionRandomCalls = window.__randomCalls.slice(randomAfterFetch, randomAfterDecrypt);
    
    return {
      key,
      encryptedData,
      decrypted: decrypted ? JSON.stringify(decrypted) : null,
      randomBefore,
      randomAfterFetch,
      randomAfterDecrypt,
      decryptionRandomCalls: decryptionRandomCalls.map(c => ({
        index: c.index,
        value: c.value,
      })),
    };
  }, testKey);
  
  console.log(`\nKey: ${result.key.substring(0, 32)}...`);
  console.log(`Encrypted: ${result.encryptedData.substring(0, 40)}...`);
  console.log(`Decrypted: ${result.decrypted ? 'SUCCESS' : 'FAILED'}`);
  console.log(`\nRandom calls during decryption: ${result.decryptionRandomCalls.length}`);
  
  if (result.decryptionRandomCalls.length > 0) {
    console.log('\nRandom values used during decryption:');
    result.decryptionRandomCalls.forEach((c, i) => {
      console.log(`  ${i}: ${c.value}`);
    });
  }
  
  // Now let's see if we can control the random values
  console.log('\n=== Testing with Controlled Random Values ===\n');
  
  // Reset random to return predictable values
  const controlledResult = await page.evaluate(async (key) => {
    // Override Math.random to return predictable values
    let randomIndex = 0;
    const predictableValues = [];
    for (let i = 0; i < 1000; i++) {
      predictableValues.push(i / 1000);
    }
    
    Math.random = function() {
      const value = predictableValues[randomIndex % predictableValues.length];
      randomIndex++;
      return value;
    };
    
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
    
    // Decrypt with controlled random
    let decrypted = null;
    try {
      decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    } catch (e) {
      return { error: e.message };
    }
    
    return {
      decrypted: decrypted ? JSON.stringify(decrypted) : null,
      randomCallsUsed: randomIndex,
    };
  }, testKey);
  
  console.log('Controlled random result:', controlledResult);
  
  await browser.close();
}

interceptMathRandom().catch(console.error);
