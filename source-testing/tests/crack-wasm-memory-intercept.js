/**
 * Memory Intercept - Trace WASM Memory During Key Generation
 * 
 * This script intercepts WASM memory operations to understand
 * how the XOR constant is derived.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceKeyGeneration() {
  console.log('=== WASM Memory Intercept ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set up controlled environment
  const testTimestamp = 1700000000;
  
  await page.evaluateOnNewDocument((timestamp) => {
    // Control all random sources
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    Math.random = function() { return 0.5; };
    let time = timestamp * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
    
    // Track canvas operations
    window.__canvasData = null;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
      }
      return result;
    };
    
    // Intercept WebAssembly instantiation
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[WASM] Intercepting instantiation');
      
      // Wrap the imports to trace calls
      const wrappedImports = {};
      for (const [moduleName, moduleImports] of Object.entries(importObject || {})) {
        wrappedImports[moduleName] = {};
        for (const [funcName, func] of Object.entries(moduleImports)) {
          if (typeof func === 'function') {
            wrappedImports[moduleName][funcName] = function(...args) {
              // Log certain function calls
              if (funcName.includes('random') || funcName.includes('crypto')) {
                console.log(`[WASM] ${moduleName}.${funcName}(${args.join(', ')})`);
              }
              return func.apply(this, args);
            };
          } else {
            wrappedImports[moduleName][funcName] = func;
          }
        }
      }
      
      const result = await origInstantiate.call(this, bufferSource, wrappedImports);
      
      // Store reference to memory
      if (result.instance && result.instance.exports && result.instance.exports.memory) {
        window.__wasmMemory = result.instance.exports.memory;
        console.log('[WASM] Memory captured');
      }
      
      return result;
    };
    
    // Track memory snapshots
    window.__memorySnapshots = [];
    window.__takeMemorySnapshot = function(label) {
      if (window.__wasmMemory) {
        const mem = new Uint8Array(window.__wasmMemory.buffer);
        // Only capture relevant regions (around where we found the fingerprint string)
        const snapshot = {
          label,
          timestamp: Date.now(),
          region1119360: Array.from(mem.slice(1119360, 1119360 + 256)),
          region1048576: Array.from(mem.slice(1048576, 1048576 + 256)),
        };
        window.__memorySnapshots.push(snapshot);
      }
    };
  }, testTimestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Take memory snapshot before key generation
  await page.evaluate(() => {
    window.__takeMemorySnapshot('before_key_gen');
  });
  
  // Get the key and related data
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    // Take memory snapshot after key generation
    window.__takeMemorySnapshot('after_key_gen');
    
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    // Search memory for the key
    let keyLocations = [];
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      const keyBytes = [];
      for (let i = 0; i < key.length; i += 2) {
        keyBytes.push(parseInt(key.substr(i, 2), 16));
      }
      
      // Search for key in memory
      for (let i = 0; i < mem.length - 32; i++) {
        let match = true;
        for (let j = 0; j < 32; j++) {
          if (mem[i + j] !== keyBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          keyLocations.push(i);
        }
      }
    }
    
    return {
      key,
      sessionId,
      canvasBase64First50: canvasBase64.slice(0, 50),
      keyLocations,
      memorySnapshots: window.__memorySnapshots,
      fingerprint: {
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await browser.close();
  
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Key locations in memory:', result.keyLocations);
  console.log('Memory snapshots:', result.memorySnapshots.length);
  
  // Calculate fingerprint hash
  const fp = result.fingerprint;
  const [timestamp] = result.sessionId.split('.');
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64First50}`;
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  
  console.log('\nFingerprint string:', fpString);
  console.log('Fingerprint hash:', fpHash);
  
  // Calculate XOR constant
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const keyBuf = Buffer.from(result.key, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  console.log('XOR constant:', xorBuf.toString('hex'));
  
  // Analyze memory snapshots
  if (result.memorySnapshots.length >= 2) {
    console.log('\n=== Memory Diff Analysis ===\n');
    
    const before = result.memorySnapshots[0];
    const after = result.memorySnapshots[1];
    
    // Compare region 1119360
    console.log('Region 1119360 changes:');
    for (let i = 0; i < 256; i++) {
      if (before.region1119360[i] !== after.region1119360[i]) {
        console.log(`  Offset ${i}: ${before.region1119360[i].toString(16)} -> ${after.region1119360[i].toString(16)}`);
      }
    }
  }
  
  return result;
}

traceKeyGeneration().catch(console.error);
