/**
 * Intercept SHA256 inputs/outputs by hooking the WASM memory
 * This will show us exactly what data is being hashed
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptSHA256() {
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true,
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  await page.evaluateOnNewDocument((ts) => {
    // Control environment
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    Math.random = function() { return 0.5; };
    let time = ts * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
    
    // Track all strings that look like they could be hash inputs
    window.__hashInputs = [];
    window.__hashOutputs = [];
    
    // Hook TextEncoder to capture string encoding
    const origEncode = TextEncoder.prototype.encode;
    TextEncoder.prototype.encode = function(str) {
      if (str && str.length > 50 && str.length < 500) {
        window.__hashInputs.push({
          type: 'TextEncoder',
          value: str,
          length: str.length,
          time: Date.now(),
        });
      }
      return origEncode.call(this, str);
    };
    
    // Hook canvas toDataURL
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
        console.log('[CANVAS] toDataURL called, length:', result.length);
      }
      return result;
    };
    
    // Hook localStorage
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tmdb_session_id') {
        console.log('[STORAGE] Setting tmdb_session_id:', value);
        window.__sessionId = value;
      }
      return origSetItem.call(this, key, value);
    };
    
  }, timestamp);
  
  // Intercept WASM instantiation
  await page.evaluateOnNewDocument(() => {
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[WASM] Instantiating...');
      
      // Wrap the imports to log calls
      if (importObject && importObject.wbg) {
        const origImports = { ...importObject.wbg };
        
        // Log all import calls
        for (const [name, fn] of Object.entries(origImports)) {
          if (typeof fn === 'function') {
            importObject.wbg[name] = function(...args) {
              // Log interesting calls
              if (name.includes('string') || name.includes('memory')) {
                // console.log(`[WASM IMPORT] ${name}`, args.slice(0, 3));
              }
              return fn.apply(this, args);
            };
          }
        }
      }
      
      const result = await origInstantiate.call(this, bufferSource, importObject);
      
      // Get the memory
      const memory = result.instance.exports.memory;
      window.__wasmMemory = memory;
      
      // Wrap get_img_key to capture before/after memory state
      const origGetImgKey = result.instance.exports.get_img_key;
      result.instance.exports.get_img_key = function(...args) {
        console.log('[WASM] get_img_key called');
        
        // Dump memory before
        const memBefore = new Uint8Array(memory.buffer.slice(0, 0x10000));
        
        const ret = origGetImgKey.apply(this, args);
        
        // Dump memory after
        const memAfter = new Uint8Array(memory.buffer.slice(0, 0x10000));
        
        // Find differences
        const diffs = [];
        for (let i = 0; i < memBefore.length; i++) {
          if (memBefore[i] !== memAfter[i]) {
            diffs.push({ offset: i, before: memBefore[i], after: memAfter[i] });
          }
        }
        
        // Look for 32-byte sequences that could be hashes
        console.log('[WASM] Memory diffs:', diffs.length);
        
        // Find potential hash outputs (32 consecutive changed bytes)
        for (let i = 0; i < diffs.length - 31; i++) {
          if (diffs[i + 31] && diffs[i + 31].offset - diffs[i].offset === 31) {
            const hashBytes = [];
            for (let j = 0; j < 32; j++) {
              hashBytes.push(memAfter[diffs[i].offset + j]);
            }
            const hashHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            console.log('[WASM] Potential hash at offset', diffs[i].offset.toString(16), ':', hashHex);
            window.__hashOutputs.push({
              offset: diffs[i].offset,
              hex: hashHex,
            });
          }
        }
        
        return ret;
      };
      
      return result;
    };
  });
  
  console.log('Navigating to flixer.sh...');
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM to be ready
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  console.log('Getting key...');
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    return {
      key,
      sessionId: window.__sessionId || localStorage.getItem('tmdb_session_id'),
      canvasData: window.__canvasData,
      hashInputs: window.__hashInputs,
      hashOutputs: window.__hashOutputs,
      fingerprint: {
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  console.log('\n=== Results ===');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Canvas length:', result.canvasData?.length);
  console.log('\nHash inputs captured:', result.hashInputs?.length || 0);
  
  if (result.hashInputs) {
    for (const input of result.hashInputs) {
      console.log(`  [${input.type}] len=${input.length}: ${input.value.slice(0, 100)}...`);
      
      // Try to hash it and see if it matches
      const hash = crypto.createHash('sha256').update(input.value).digest('hex');
      console.log(`    SHA256: ${hash}`);
    }
  }
  
  console.log('\nHash outputs captured:', result.hashOutputs?.length || 0);
  if (result.hashOutputs) {
    for (const output of result.hashOutputs) {
      console.log(`  offset 0x${output.offset.toString(16)}: ${output.hex}`);
    }
  }
  
  // Build the fingerprint string we think is correct
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  const canvasBase64 = result.canvasData?.split(',')[1] || '';
  
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${canvasBase64.slice(0, 50)}`;
  console.log('\nOur fingerprint string:', fpString);
  console.log('Length:', fpString.length);
  
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log('SHA256 of fingerprint:', fpHash);
  
  // Calculate XOR
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const keyBuf = Buffer.from(result.key, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  console.log('XOR constant:', xorBuf.toString('hex'));
  
  // Keep browser open for manual inspection
  console.log('\nBrowser kept open for inspection. Press Ctrl+C to exit.');
  await new Promise(() => {}); // Keep running
}

interceptSHA256().catch(console.error);
