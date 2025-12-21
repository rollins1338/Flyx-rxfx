/**
 * Intercept WASM Imports - Hook into WASM imports to trace what data flows in
 * 
 * The WASM module imports functions from JS that provide:
 * - Random numbers
 * - Current time
 * - Canvas data
 * - Navigator info
 * 
 * By intercepting these, we can see exactly what the WASM receives
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptWasmImports() {
  console.log('=== Intercepting WASM Imports ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Intercept WebAssembly.instantiate to hook into imports
  await page.evaluateOnNewDocument(() => {
    window.__wasmImportCalls = [];
    window.__wasmExportCalls = [];
    
    const origInstantiate = WebAssembly.instantiate;
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    function wrapImports(imports) {
      if (!imports) return imports;
      
      const wrapped = {};
      for (const moduleName of Object.keys(imports)) {
        wrapped[moduleName] = {};
        for (const funcName of Object.keys(imports[moduleName])) {
          const origFunc = imports[moduleName][funcName];
          if (typeof origFunc === 'function') {
            wrapped[moduleName][funcName] = function(...args) {
              const result = origFunc.apply(this, args);
              window.__wasmImportCalls.push({
                module: moduleName,
                func: funcName,
                args: args.map(a => {
                  if (typeof a === 'number') return a;
                  if (typeof a === 'string') return a.slice(0, 100);
                  if (a instanceof ArrayBuffer) return `ArrayBuffer(${a.byteLength})`;
                  return String(a).slice(0, 100);
                }),
                result: typeof result === 'number' ? result : String(result).slice(0, 100),
                time: Date.now(),
              });
              return result;
            };
          } else {
            wrapped[moduleName][funcName] = origFunc;
          }
        }
      }
      return wrapped;
    }
    
    WebAssembly.instantiate = async function(source, imports) {
      console.log('[WASM] instantiate called');
      const wrappedImports = wrapImports(imports);
      const result = await origInstantiate.call(this, source, wrappedImports);
      
      // Wrap exports too
      if (result.instance && result.instance.exports) {
        const exports = result.instance.exports;
        for (const name of Object.keys(exports)) {
          if (typeof exports[name] === 'function') {
            const origExport = exports[name];
            exports[name] = function(...args) {
              const callResult = origExport.apply(this, args);
              window.__wasmExportCalls.push({
                func: name,
                args: args.slice(0, 5),
                result: typeof callResult === 'number' ? callResult : String(callResult).slice(0, 100),
                time: Date.now(),
              });
              return callResult;
            };
          }
        }
      }
      
      return result;
    };
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      console.log('[WASM] instantiateStreaming called');
      const wrappedImports = wrapImports(imports);
      const result = await origInstantiateStreaming.call(this, source, wrappedImports);
      
      // Wrap exports
      if (result.instance && result.instance.exports) {
        const exports = result.instance.exports;
        for (const name of Object.keys(exports)) {
          if (typeof exports[name] === 'function') {
            const origExport = exports[name];
            exports[name] = function(...args) {
              const callResult = origExport.apply(this, args);
              window.__wasmExportCalls.push({
                func: name,
                args: args.slice(0, 5),
                result: typeof callResult === 'number' ? callResult : String(callResult).slice(0, 100),
                time: Date.now(),
              });
              return callResult;
            };
          }
        }
      }
      
      return result;
    };
    
    // Also intercept canvas operations
    window.__canvasOperations = [];
    
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const ctx = origGetContext.call(this, type, ...args);
      if (type === '2d' && ctx) {
        const origFillText = ctx.fillText;
        ctx.fillText = function(text, x, y, ...rest) {
          window.__canvasOperations.push({
            op: 'fillText',
            text,
            x,
            y,
            canvas: { width: this.canvas.width, height: this.canvas.height },
            time: Date.now(),
          });
          return origFillText.call(this, text, x, y, ...rest);
        };
      }
      return ctx;
    };
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const result = origToDataURL.apply(this, args);
      window.__canvasOperations.push({
        op: 'toDataURL',
        canvas: { width: this.width, height: this.height },
        resultLength: result.length,
        resultFirst100: result.slice(0, 100),
        time: Date.now(),
      });
      return result;
    };
    
    // Track localStorage
    window.__localStorageOps = [];
    const origSetItem = localStorage.setItem;
    const origGetItem = localStorage.getItem;
    
    localStorage.setItem = function(key, value) {
      window.__localStorageOps.push({ op: 'set', key, value: String(value).slice(0, 100), time: Date.now() });
      return origSetItem.call(this, key, value);
    };
    
    localStorage.getItem = function(key) {
      const result = origGetItem.call(this, key);
      window.__localStorageOps.push({ op: 'get', key, result: result ? String(result).slice(0, 100) : null, time: Date.now() });
      return result;
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and all traced data
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    return {
      key,
      sessionId,
      importCalls: window.__wasmImportCalls,
      exportCalls: window.__wasmExportCalls,
      canvasOps: window.__canvasOperations,
      localStorageOps: window.__localStorageOps,
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
  console.log('\nFingerprint:', result.fingerprint);
  
  console.log('\n=== WASM Import Calls ===\n');
  for (const call of result.importCalls.slice(0, 50)) {
    console.log(`${call.module}.${call.func}(${call.args.join(', ')}) => ${call.result}`);
  }
  
  console.log('\n=== WASM Export Calls ===\n');
  for (const call of result.exportCalls) {
    console.log(`${call.func}(${call.args.join(', ')}) => ${call.result}`);
  }
  
  console.log('\n=== Canvas Operations ===\n');
  for (const op of result.canvasOps) {
    if (op.op === 'fillText') {
      console.log(`fillText("${op.text}", ${op.x}, ${op.y}) on ${op.canvas.width}x${op.canvas.height}`);
    } else {
      console.log(`toDataURL() on ${op.canvas.width}x${op.canvas.height} => ${op.resultLength} chars`);
    }
  }
  
  console.log('\n=== LocalStorage Operations ===\n');
  for (const op of result.localStorageOps) {
    if (op.op === 'set') {
      console.log(`set("${op.key}", "${op.value}")`);
    } else {
      console.log(`get("${op.key}") => "${op.result}"`);
    }
  }
  
  // Now let's analyze what we found
  console.log('\n=== Analysis ===\n');
  
  // Find the canvas that was used for fingerprinting
  const fpCanvas = result.canvasOps.find(op => 
    op.op === 'toDataURL' && op.canvas.width === 200 && op.canvas.height === 50
  );
  
  if (fpCanvas) {
    console.log('Fingerprint canvas found!');
    console.log(`Size: ${fpCanvas.canvas.width}x${fpCanvas.canvas.height}`);
    console.log(`Data URL length: ${fpCanvas.resultLength}`);
  }
  
  // Build the fingerprint string
  const fp = result.fingerprint;
  const [timestamp] = result.sessionId.split('.');
  
  // Find the canvas base64
  const canvasDataUrl = result.canvasOps.find(op => 
    op.op === 'toDataURL' && op.canvas.width === 200 && op.canvas.height === 50
  );
  
  if (canvasDataUrl) {
    // The base64 starts after "data:image/png;base64,"
    const base64Start = canvasDataUrl.resultFirst100.indexOf(',') + 1;
    const canvasBase64 = canvasDataUrl.resultFirst100.slice(base64Start);
    
    console.log(`\nCanvas base64 (first 50): ${canvasBase64.slice(0, 50)}`);
    
    // Build fingerprint string
    const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
    
    console.log(`\nFP String: ${fpString}`);
    console.log(`FP String length: ${fpString.length}`);
    
    const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
    console.log(`FP Hash: ${fpHash}`);
    console.log(`Actual Key: ${result.key}`);
    
    // Calculate XOR
    const fpHashBuf = Buffer.from(fpHash, 'hex');
    const keyBuf = Buffer.from(result.key, 'hex');
    const xorBuf = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
    }
    console.log(`XOR constant: ${xorBuf.toString('hex')}`);
  }
}

interceptWasmImports().catch(console.error);
