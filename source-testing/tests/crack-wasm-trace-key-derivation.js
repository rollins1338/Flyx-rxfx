/**
 * Trace Key Derivation in WASM
 * 
 * Instrument the WASM to trace exactly how the key is derived.
 * We'll intercept all the fingerprint data and see what order
 * they're combined in.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceKeyDerivation() {
  console.log('=== Trace Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Track the order of fingerprint collection
  await page.evaluateOnNewDocument(() => {
    window.__fpOrder = [];
    window.__fpValues = {};
    
    // Canvas
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const result = origToDataURL.apply(this, args);
      window.__fpOrder.push('canvas');
      window.__fpValues.canvas = result;
      return result;
    };
    
    // User agent
    const origUA = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      get: function() {
        const val = origUA.get.call(this);
        if (!window.__fpValues.userAgent) {
          window.__fpOrder.push('userAgent');
          window.__fpValues.userAgent = val;
        }
        return val;
      }
    });
    
    // Platform
    const origPlatform = Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform');
    Object.defineProperty(Navigator.prototype, 'platform', {
      get: function() {
        const val = origPlatform.get.call(this);
        if (!window.__fpValues.platform) {
          window.__fpOrder.push('platform');
          window.__fpValues.platform = val;
        }
        return val;
      }
    });
    
    // Language
    const origLang = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');
    Object.defineProperty(Navigator.prototype, 'language', {
      get: function() {
        const val = origLang.get.call(this);
        if (!window.__fpValues.language) {
          window.__fpOrder.push('language');
          window.__fpValues.language = val;
        }
        return val;
      }
    });
    
    // Screen width
    const origWidth = Object.getOwnPropertyDescriptor(Screen.prototype, 'width');
    Object.defineProperty(Screen.prototype, 'width', {
      get: function() {
        const val = origWidth.get.call(this);
        if (!window.__fpValues.screenWidth) {
          window.__fpOrder.push('screenWidth');
          window.__fpValues.screenWidth = val;
        }
        return val;
      }
    });
    
    // Screen height
    const origHeight = Object.getOwnPropertyDescriptor(Screen.prototype, 'height');
    Object.defineProperty(Screen.prototype, 'height', {
      get: function() {
        const val = origHeight.get.call(this);
        if (!window.__fpValues.screenHeight) {
          window.__fpOrder.push('screenHeight');
          window.__fpValues.screenHeight = val;
        }
        return val;
      }
    });
    
    // Color depth
    const origColorDepth = Object.getOwnPropertyDescriptor(Screen.prototype, 'colorDepth');
    Object.defineProperty(Screen.prototype, 'colorDepth', {
      get: function() {
        const val = origColorDepth.get.call(this);
        if (!window.__fpValues.colorDepth) {
          window.__fpOrder.push('colorDepth');
          window.__fpValues.colorDepth = val;
        }
        return val;
      }
    });
    
    // Timezone
    const origGetTZ = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function() {
      const val = origGetTZ.call(this);
      if (!window.__fpValues.timezone) {
        window.__fpOrder.push('timezone');
        window.__fpValues.timezone = val;
      }
      return val;
    };
    
    // localStorage get
    const origGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      const val = origGetItem.call(this, key);
      if (key === 'tmdb_session_id' && !window.__fpValues.sessionId) {
        window.__fpOrder.push('sessionId');
        window.__fpValues.sessionId = val;
      }
      return val;
    };
    
    // localStorage set
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tmdb_session_id') {
        window.__fpOrder.push('sessionId_set');
        window.__fpValues.sessionId = value;
      }
      return origSetItem.call(this, key, value);
    };
  });
  
  // Clear localStorage
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and fingerprint data
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    return {
      embeddedKey: key,
      fpOrder: window.__fpOrder,
      fpValues: window.__fpValues,
    };
  });
  
  await browser.close();
  
  console.log(`Embedded key: ${result.embeddedKey}\n`);
  
  console.log('Fingerprint collection order:');
  for (let i = 0; i < result.fpOrder.length; i++) {
    console.log(`  ${i + 1}. ${result.fpOrder[i]}`);
  }
  
  console.log('\nFingerprint values:');
  for (const [key, value] of Object.entries(result.fpValues)) {
    if (key === 'canvas') {
      console.log(`  ${key}: ${value.slice(0, 80)}...`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }
  
  // Now try to derive the key using the collected order
  console.log('\n=== Key Derivation Attempts ===\n');
  
  const embeddedKeyBuf = Buffer.from(result.embeddedKey, 'hex');
  const fp = result.fpValues;
  
  // Build fingerprint string in the order collected
  // The WASM likely concatenates these values and hashes them
  
  const combinations = [
    // Based on collection order
    `${fp.screenWidth}x${fp.screenHeight}:${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}:${fp.canvas}`,
    `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}`,
    `${fp.canvas}:${fp.sessionId}`,
    `${fp.sessionId}:${fp.canvas}`,
    `${fp.userAgent}:${fp.platform}:${fp.language}:${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}`,
    // Just canvas
    fp.canvas,
    // Just session ID
    fp.sessionId,
    // Canvas hash + session
    `${crypto.createHash('sha256').update(fp.canvas || '').digest('hex')}:${fp.sessionId}`,
  ];
  
  for (const combo of combinations) {
    if (!combo) continue;
    
    // Try SHA256
    const hash = crypto.createHash('sha256').update(combo).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with SHA256! ***`);
      console.log(`Input: ${combo.slice(0, 100)}...`);
    }
    
    // Try with different encodings
    const hashHex = crypto.createHash('sha256').update(Buffer.from(combo, 'utf8')).digest();
    if (hashHex.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with SHA256 (UTF8)! ***`);
    }
  }
  
  // The canvas fingerprint is the most unique part
  // Let's analyze it more
  if (fp.canvas) {
    console.log('\n=== Canvas Analysis ===\n');
    
    // The canvas data URL format: data:image/png;base64,<base64_data>
    const base64Part = fp.canvas.split(',')[1];
    if (base64Part) {
      const canvasBytes = Buffer.from(base64Part, 'base64');
      console.log(`Canvas PNG size: ${canvasBytes.length} bytes`);
      
      // Hash just the base64 part
      const canvasHash = crypto.createHash('sha256').update(base64Part).digest();
      console.log(`SHA256(canvas_base64): ${canvasHash.toString('hex')}`);
      console.log(`Embedded key:          ${embeddedKeyBuf.toString('hex')}`);
      console.log(`Match: ${canvasHash.equals(embeddedKeyBuf)}`);
      
      // Hash the full data URL
      const fullHash = crypto.createHash('sha256').update(fp.canvas).digest();
      console.log(`SHA256(full_canvas): ${fullHash.toString('hex')}`);
      console.log(`Match: ${fullHash.equals(embeddedKeyBuf)}`);
      
      // Hash the PNG bytes
      const pngHash = crypto.createHash('sha256').update(canvasBytes).digest();
      console.log(`SHA256(png_bytes): ${pngHash.toString('hex')}`);
      console.log(`Match: ${pngHash.equals(embeddedKeyBuf)}`);
    }
  }
  
  console.log('\nThe key derivation algorithm is more complex than simple hashing.');
  console.log('It likely involves multiple rounds or a custom combination function.');
}

traceKeyDerivation().catch(console.error);
