/**
 * Crack WASM - Fingerprint-Based Key Derivation
 * 
 * The WASM imports many browser APIs for fingerprinting:
 * - navigator.userAgent
 * - navigator.platform
 * - navigator.language
 * - screen.width/height
 * - screen.colorDepth
 * - Date.getTimezoneOffset
 * - localStorage
 * - canvas fingerprinting
 * 
 * The key might be derived from a combination of:
 * - API key
 * - Browser fingerprint
 * - Embedded key
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const EMBEDDED_KEY = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';

async function testFingerprint() {
  console.log('=== Fingerprint-Based Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept all browser API calls
  await page.evaluateOnNewDocument(() => {
    window.__apiCalls = [];
    
    // Intercept navigator properties
    const originalUserAgent = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      get: function() {
        const value = originalUserAgent.get.call(this);
        window.__apiCalls.push({ api: 'navigator.userAgent', value });
        return value;
      }
    });
    
    const originalPlatform = Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform');
    Object.defineProperty(Navigator.prototype, 'platform', {
      get: function() {
        const value = originalPlatform.get.call(this);
        window.__apiCalls.push({ api: 'navigator.platform', value });
        return value;
      }
    });
    
    const originalLanguage = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');
    Object.defineProperty(Navigator.prototype, 'language', {
      get: function() {
        const value = originalLanguage.get.call(this);
        window.__apiCalls.push({ api: 'navigator.language', value });
        return value;
      }
    });
    
    // Intercept screen properties
    const originalWidth = Object.getOwnPropertyDescriptor(Screen.prototype, 'width');
    Object.defineProperty(Screen.prototype, 'width', {
      get: function() {
        const value = originalWidth.get.call(this);
        window.__apiCalls.push({ api: 'screen.width', value });
        return value;
      }
    });
    
    const originalHeight = Object.getOwnPropertyDescriptor(Screen.prototype, 'height');
    Object.defineProperty(Screen.prototype, 'height', {
      get: function() {
        const value = originalHeight.get.call(this);
        window.__apiCalls.push({ api: 'screen.height', value });
        return value;
      }
    });
    
    const originalColorDepth = Object.getOwnPropertyDescriptor(Screen.prototype, 'colorDepth');
    Object.defineProperty(Screen.prototype, 'colorDepth', {
      get: function() {
        const value = originalColorDepth.get.call(this);
        window.__apiCalls.push({ api: 'screen.colorDepth', value });
        return value;
      }
    });
    
    // Intercept Date.getTimezoneOffset
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function() {
      const value = originalGetTimezoneOffset.call(this);
      window.__apiCalls.push({ api: 'Date.getTimezoneOffset', value });
      return value;
    };
    
    // Intercept localStorage
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      const value = originalGetItem.call(this, key);
      window.__apiCalls.push({ api: 'localStorage.getItem', key, value });
      return value;
    };
    
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      window.__apiCalls.push({ api: 'localStorage.setItem', key, value });
      return originalSetItem.call(this, key, value);
    };
    
    // Intercept canvas
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const value = originalToDataURL.call(this);
      window.__apiCalls.push({ api: 'canvas.toDataURL', length: value.length });
      return value;
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Clear API calls before our test
  await page.evaluate(() => {
    window.__apiCalls = [];
  });
  
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
    
    // Clear API calls right before WASM call
    window.__apiCalls = [];
    
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
    
    // Clear again right before decryption
    window.__apiCalls = [];
    
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      apiCalls: window.__apiCalls,
    };
  }, testKey);
  
  await browser.close();
  
  console.log('=== Browser API Calls During Decryption ===\n');
  console.log(`Total API calls: ${result.apiCalls.length}`);
  
  // Group by API
  const grouped = {};
  for (const call of result.apiCalls) {
    if (!grouped[call.api]) grouped[call.api] = [];
    grouped[call.api].push(call);
  }
  
  for (const [api, calls] of Object.entries(grouped)) {
    console.log(`\n${api}: ${calls.length} calls`);
    for (const call of calls.slice(0, 3)) {
      if (call.value !== undefined) {
        console.log(`  Value: ${JSON.stringify(call.value).slice(0, 100)}`);
      }
      if (call.key !== undefined) {
        console.log(`  Key: ${call.key}, Value: ${JSON.stringify(call.value).slice(0, 50)}`);
      }
    }
  }
  
  // Analyze the data
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
  
  // Try fingerprint-based key derivation
  console.log('\n=== Fingerprint-Based Key Derivation ===\n');
  
  // Build fingerprint string from API calls
  const fingerprintParts = [];
  for (const call of result.apiCalls) {
    if (call.value !== undefined && typeof call.value !== 'object') {
      fingerprintParts.push(String(call.value));
    }
  }
  
  const fingerprintStr = fingerprintParts.join(':');
  console.log(`Fingerprint string: ${fingerprintStr.slice(0, 100)}...`);
  
  const fingerprintHash = crypto.createHash('sha256').update(fingerprintStr).digest();
  console.log(`Fingerprint hash: ${fingerprintHash.toString('hex')}`);
  
  // Try various combinations
  const embeddedKeyBuf = Buffer.from(EMBEDDED_KEY, 'hex');
  
  const keysToTry = [
    { name: 'fingerprint_hash', key: fingerprintHash },
    { name: 'hmac(embedded,fingerprint)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(fingerprintStr).digest() },
    { name: 'hmac(api_key,fingerprint)', key: crypto.createHmac('sha256', apiKeyBuf).update(fingerprintStr).digest() },
    { name: 'sha256(api_key+fingerprint)', key: crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, Buffer.from(fingerprintStr)])).digest() },
    { name: 'sha256(fingerprint+api_key)', key: crypto.createHash('sha256').update(Buffer.concat([Buffer.from(fingerprintStr), apiKeyBuf])).digest() },
  ];
  
  for (const { name, key } of keysToTry) {
    // Try with different IV positions
    for (let ivStart = 0; ivStart <= overhead - 16; ivStart += 16) {
      const iv = prefix.subarray(ivStart, ivStart + 16);
      
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        const zeros = Buffer.alloc(keystream.length);
        const testKeystream = cipher.update(zeros);
        
        if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
          console.log(`*** MATCH! ${name} with IV at prefix[${ivStart}] ***`);
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  console.log('\nNo fingerprint-based matches found.');
}

testFingerprint().catch(console.error);
