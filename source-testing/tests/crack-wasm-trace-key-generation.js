/**
 * Trace WASM Key Generation
 * 
 * Use Puppeteer to intercept the WASM memory during key generation
 * and find the exact XOR constant being used.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceKeyGeneration() {
  console.log('=== Tracing WASM Key Generation ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Use headed mode to see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true,
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Control the environment
  const controlledTimestamp = 1700000000;
  const controlledRandom = 0.5;
  
  await page.evaluateOnNewDocument((ts, rand) => {
    // Control screen
    Object.defineProperty(window, 'screen', {
      value: {
        width: 1920, height: 1080, availWidth: 1920, availHeight: 1080,
        colorDepth: 24, pixelDepth: 24,
      },
      writable: false,
    });
    
    // Control timezone
    Date.prototype.getTimezoneOffset = function() { return 0; };
    
    // Control Math.random
    Math.random = function() { return rand; };
    
    // Control Date.now
    let time = ts * 1000;
    Date.now = function() { return time++; };
    
    // Clear localStorage
    localStorage.clear();
    
    // Intercept WASM instantiation
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[WASM] Intercepting instantiate');
      
      // Wrap the imports to trace calls
      if (importObject && importObject.wbg) {
        const origWbg = importObject.wbg;
        const wrappedWbg = {};
        
        for (const [key, value] of Object.entries(origWbg)) {
          if (typeof value === 'function') {
            wrappedWbg[key] = function(...args) {
              // Log interesting calls
              if (key.includes('crypto') || key.includes('random') || key.includes('hash')) {
                console.log(`[WASM] ${key}(${args.map(a => typeof a === 'number' ? a : typeof a).join(', ')})`);
              }
              return value.apply(this, args);
            };
          } else {
            wrappedWbg[key] = value;
          }
        }
        
        importObject.wbg = wrappedWbg;
      }
      
      const result = await origInstantiate.call(this, bufferSource, importObject);
      
      // Store reference to WASM memory
      if (result.instance && result.instance.exports && result.instance.exports.memory) {
        window.__wasmMemory = result.instance.exports.memory;
        console.log('[WASM] Memory captured');
      }
      
      return result;
    };
    
    // Capture canvas data
    window.__canvasData = null;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
        console.log('[Canvas] Fingerprint captured');
      }
      return result;
    };
  }, controlledTimestamp, controlledRandom);
  
  console.log('Navigating to flixer.sh...');
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  console.log('Waiting for WASM to be ready...');
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and analyze memory
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    // Dump WASM memory around key generation
    let memoryDump = null;
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      
      // Search for the key in memory
      const keyBytes = [];
      for (let i = 0; i < key.length; i += 2) {
        keyBytes.push(parseInt(key.substr(i, 2), 16));
      }
      
      // Find the key in memory
      let keyOffset = -1;
      for (let i = 0; i < mem.length - 32; i++) {
        let match = true;
        for (let j = 0; j < 32; j++) {
          if (mem[i + j] !== keyBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          keyOffset = i;
          break;
        }
      }
      
      if (keyOffset !== -1) {
        // Dump memory around the key
        const start = Math.max(0, keyOffset - 256);
        const end = Math.min(mem.length, keyOffset + 256);
        memoryDump = {
          keyOffset,
          before: Array.from(mem.slice(start, keyOffset)).map(b => b.toString(16).padStart(2, '0')).join(''),
          key: Array.from(mem.slice(keyOffset, keyOffset + 32)).map(b => b.toString(16).padStart(2, '0')).join(''),
          after: Array.from(mem.slice(keyOffset + 32, end)).map(b => b.toString(16).padStart(2, '0')).join(''),
        };
      }
    }
    
    return {
      key,
      sessionId,
      canvasBase64First50: canvasBase64.slice(0, 50),
      memoryDump,
      fingerprint: {
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  console.log('\n=== Results ===\n');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Canvas (first 50):', result.canvasBase64First50);
  console.log('Fingerprint:', result.fingerprint);
  
  // Build the fingerprint string
  const [timestamp] = result.sessionId.split('.');
  const fp = result.fingerprint;
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64First50}`;
  
  console.log('\nFingerprint string:', fpString);
  
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log('FP Hash:', fpHash);
  
  // Calculate XOR constant
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const keyBuf = Buffer.from(result.key, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  console.log('XOR constant:', xorBuf.toString('hex'));
  
  if (result.memoryDump) {
    console.log('\n=== Memory Dump ===');
    console.log('Key found at offset:', result.memoryDump.keyOffset);
    console.log('Before key:', result.memoryDump.before.slice(-128));
    console.log('Key:', result.memoryDump.key);
    console.log('After key:', result.memoryDump.after.slice(0, 128));
    
    // Check if XOR constant is in memory near the key
    const xorHex = xorBuf.toString('hex');
    if (result.memoryDump.before.includes(xorHex)) {
      console.log('*** XOR constant found BEFORE key in memory! ***');
    }
    if (result.memoryDump.after.includes(xorHex)) {
      console.log('*** XOR constant found AFTER key in memory! ***');
    }
  }
  
  // Keep browser open for manual inspection
  console.log('\nBrowser kept open for inspection. Press Ctrl+C to exit.');
  await new Promise(() => {}); // Keep running
}

traceKeyGeneration().catch(console.error);
