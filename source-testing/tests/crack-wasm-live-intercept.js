/**
 * Live Intercept - Hook WASM imports to capture fingerprint data as it's collected
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function liveIntercept() {
  console.log('=== Live Intercept of Fingerprint Collection ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[WASM]') || text.includes('[FP]')) {
      console.log(text);
    }
  });
  
  await page.evaluateOnNewDocument(() => {
    window.__fpCollected = {
      order: [],
      values: {},
      canvasDataURL: null,
      sessionId: null,
    };
    
    // Intercept canvas operations
    const origFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
      console.log(`[FP] fillText("${text}", ${x}, ${y})`);
      return origFillText.apply(this, arguments);
    };
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__fpCollected.canvasDataURL = result;
        window.__fpCollected.order.push('canvas');
        window.__fpCollected.values.canvas = result.split(',')[1];
        console.log(`[FP] Canvas toDataURL captured (${result.length} chars)`);
      }
      return result;
    };
    
    // Intercept localStorage
    const origGetItem = Storage.prototype.getItem;
    const origSetItem = Storage.prototype.setItem;
    
    Storage.prototype.getItem = function(key) {
      const result = origGetItem.call(this, key);
      if (key === 'tmdb_session_id') {
        window.__fpCollected.sessionId = result;
        if (result) {
          window.__fpCollected.order.push('sessionId');
          window.__fpCollected.values.sessionId = result;
          console.log(`[FP] getItem(tmdb_session_id) = ${result}`);
        }
      }
      return result;
    };
    
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tmdb_session_id') {
        window.__fpCollected.sessionId = value;
        window.__fpCollected.order.push('sessionId_set');
        window.__fpCollected.values.sessionId = value;
        console.log(`[FP] setItem(tmdb_session_id, ${value})`);
      }
      return origSetItem.call(this, key, value);
    };
    
    // Intercept WASM instantiation to wrap imports
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      console.log('[WASM] Intercepting instantiation');
      
      // Log all import names
      const importNames = Object.keys(imports.wbg);
      console.log(`[WASM] ${importNames.length} imports`);
      
      // Wrap imports to track fingerprint collection
      const wrappedImports = { wbg: {} };
      
      for (const [name, fn] of Object.entries(imports.wbg)) {
        if (typeof fn === 'function') {
          wrappedImports.wbg[name] = function(...args) {
            const result = fn.apply(this, args);
            
            // Track specific fingerprint-related calls
            if (name.includes('width') && !name.includes('set') && typeof result === 'number') {
              if (!window.__fpCollected.values.screenWidth) {
                window.__fpCollected.order.push('screenWidth');
                window.__fpCollected.values.screenWidth = result;
                console.log(`[FP] screen.width = ${result}`);
              }
            }
            
            if (name.includes('height') && !name.includes('set') && typeof result === 'number') {
              if (!window.__fpCollected.values.screenHeight) {
                window.__fpCollected.order.push('screenHeight');
                window.__fpCollected.values.screenHeight = result;
                console.log(`[FP] screen.height = ${result}`);
              }
            }
            
            if (name.includes('colorDepth') && typeof result === 'number') {
              window.__fpCollected.order.push('colorDepth');
              window.__fpCollected.values.colorDepth = result;
              console.log(`[FP] colorDepth = ${result}`);
            }
            
            if (name.includes('Timezone') && typeof result === 'number') {
              window.__fpCollected.order.push('timezone');
              window.__fpCollected.values.timezone = result;
              console.log(`[FP] timezone = ${result}`);
            }
            
            if (name.includes('userAgent')) {
              window.__fpCollected.order.push('userAgent');
              console.log(`[FP] userAgent accessed`);
            }
            
            if (name.includes('platform') && !name.includes('set')) {
              window.__fpCollected.order.push('platform');
              console.log(`[FP] platform accessed`);
            }
            
            if (name.includes('language') && !name.includes('set')) {
              window.__fpCollected.order.push('language');
              console.log(`[FP] language accessed`);
            }
            
            return result;
          };
        } else {
          wrappedImports.wbg[name] = fn;
        }
      }
      
      const result = await origInstantiateStreaming.call(this, source, wrappedImports);
      
      // Store memory reference
      window.__wasmMemory = result.instance.exports.memory;
      
      return result;
    };
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    return {
      key,
      sessionId: localStorage.getItem('tmdb_session_id'),
      fpCollected: window.__fpCollected,
      fingerprint: {
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await browser.close();
  
  console.log('\n=== Results ===\n');
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  console.log('\nFingerprint collection order:');
  for (let i = 0; i < data.fpCollected.order.length; i++) {
    console.log(`  ${i + 1}. ${data.fpCollected.order[i]}`);
  }
  
  console.log('\nCollected values:');
  for (const [k, v] of Object.entries(data.fpCollected.values)) {
    if (k === 'canvas') {
      console.log(`  ${k}: ${v.slice(0, 50)}... (${v.length} chars)`);
    } else {
      console.log(`  ${k}: ${v}`);
    }
  }
  
  // Now try to derive the key using the collected order
  console.log('\n=== Trying Key Derivation ===\n');
  
  const fp = data.fingerprint;
  const sid = data.sessionId;
  const canvasBase64 = data.fpCollected.values.canvas;
  const keyBuf = Buffer.from(data.key, 'hex');
  const timestamp = sid.split('.')[0];
  
  // Based on the collection order, try different formats
  const formats = [];
  
  // Format 1: All values in collection order with colon separator
  const orderedValues = data.fpCollected.order.map(k => {
    if (k === 'sessionId' || k === 'sessionId_set') return sid;
    if (k === 'canvas') return canvasBase64;
    if (k === 'userAgent') return fp.userAgent;
    if (k === 'platform') return fp.platform;
    if (k === 'language') return fp.language;
    return data.fpCollected.values[k]?.toString() || '';
  }).filter(v => v);
  
  formats.push(orderedValues.join(':'));
  formats.push(orderedValues.join(''));
  formats.push(orderedValues.join('|'));
  
  // Format 2: Standard fingerprint format
  formats.push(`${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}:${sid}:${canvasBase64}`);
  formats.push(`${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`);
  
  // Format 3: Without userAgent
  formats.push(`${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.platform}:${fp.language}:${fp.timezone}:${sid}:${canvasBase64}`);
  formats.push(`${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`);
  
  // Format 4: Just the key components
  formats.push(`${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`);
  formats.push(`${fp.platform}:${fp.language}:${fp.timezone}:${sid}:${canvasBase64}`);
  
  // Format 5: With session ID parts
  const [ts, rand] = sid.split('.');
  formats.push(`${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${rand}:${canvasBase64}`);
  
  // Format 6: Canvas first
  formats.push(`${canvasBase64}:${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.platform}:${fp.language}:${fp.timezone}:${sid}`);
  formats.push(`${canvasBase64}:${fp.platform}:${fp.language}:${fp.timezone}:${sid}`);
  
  console.log(`Testing ${formats.length} format combinations...`);
  
  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(keyBuf)) {
      console.log(`\n*** MATCH FOUND at format ${i + 1}! ***`);
      console.log(`Format: ${format.slice(0, 200)}...`);
      
      fs.writeFileSync(
        'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
        format
      );
      return;
    }
  }
  
  console.log('\nNo match found with standard formats.');
  console.log('The WASM may be using a more complex derivation.');
  
  // Save data for further analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/live-intercept-data.json',
    JSON.stringify(data, null, 2)
  );
  console.log('\nData saved to: source-testing/tests/wasm-analysis/live-intercept-data.json');
}

liveIntercept().catch(console.error);
