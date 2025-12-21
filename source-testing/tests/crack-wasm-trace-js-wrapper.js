/**
 * Trace the JavaScript wrapper that calls the WASM
 * The wasmImgData object has methods that call into WASM
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function traceJsWrapper() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  await page.evaluateOnNewDocument((ts) => {
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    Math.random = function() { return 0.5; };
    let time = ts * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
    
    window.__wasmCalls = [];
    
    // Intercept WASM instantiation
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      console.log('[TRACE] WASM instantiateStreaming called');
      console.log('[TRACE] Import object keys:', importObject ? Object.keys(importObject) : 'none');
      
      // Log import functions
      if (importObject) {
        for (const [ns, funcs] of Object.entries(importObject)) {
          console.log(`[TRACE] Namespace ${ns}:`, Object.keys(funcs));
          
          // Wrap import functions to trace calls
          for (const [name, func] of Object.entries(funcs)) {
            if (typeof func === 'function') {
              const origFunc = func;
              importObject[ns][name] = function(...args) {
                // Only log interesting calls (not memory operations)
                if (!name.includes('memory') && !name.includes('table')) {
                  window.__wasmCalls.push({
                    type: 'import',
                    ns,
                    name,
                    args: args.slice(0, 5), // Limit args
                    time: performance.now(),
                  });
                }
                return origFunc.apply(this, args);
              };
            }
          }
        }
      }
      
      const result = await origInstantiateStreaming.call(this, source, importObject);
      
      window.__wasmMemory = result.instance.exports.memory;
      window.__wasmExports = result.instance.exports;
      
      console.log('[TRACE] WASM exports:', Object.keys(result.instance.exports));
      
      // Wrap exported functions
      const exports = result.instance.exports;
      for (const [name, func] of Object.entries(exports)) {
        if (typeof func === 'function') {
          const origFunc = func;
          exports[name] = function(...args) {
            const callInfo = {
              type: 'export',
              name,
              args: args.slice(0, 10),
              time: performance.now(),
            };
            window.__wasmCalls.push(callInfo);
            
            // Take memory snapshot before for get_img_key
            let memBefore = null;
            if (name === 'get_img_key') {
              memBefore = new Uint8Array(window.__wasmMemory.buffer.slice(0));
            }
            
            const ret = origFunc.apply(this, args);
            
            // Compare memory after for get_img_key
            if (name === 'get_img_key' && memBefore) {
              const memAfter = new Uint8Array(window.__wasmMemory.buffer);
              let changes = 0;
              for (let i = 0; i < memBefore.length; i++) {
                if (memBefore[i] !== memAfter[i]) changes++;
              }
              callInfo.memoryChanges = changes;
            }
            
            callInfo.returnValue = ret;
            return ret;
          };
        }
      }
      
      return result;
    };
    
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await origInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      if (instance.exports.memory) {
        window.__wasmMemory = instance.exports.memory;
      }
      return result;
    };
  }, timestamp);
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[TRACE]')) {
      console.log('Browser:', text);
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and all traced calls
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    // Filter to interesting calls
    const calls = window.__wasmCalls.filter(c => 
      c.type === 'export' || 
      (c.type === 'import' && !c.name.includes('abort'))
    );
    
    return {
      key,
      totalCalls: window.__wasmCalls.length,
      filteredCalls: calls.length,
      calls: calls.slice(-100), // Last 100 calls
      exports: Object.keys(window.__wasmExports || {}),
    };
  });
  
  await browser.close();
  
  console.log('\n=== WASM Call Trace ===');
  console.log('Key:', result.key);
  console.log('Total calls:', result.totalCalls);
  console.log('Filtered calls:', result.filteredCalls);
  console.log('Exports:', result.exports);
  
  console.log('\n=== Call Sequence (last 100) ===');
  for (const call of result.calls) {
    const args = call.args?.length > 0 ? ` args=[${call.args.join(', ')}]` : '';
    const ret = call.returnValue !== undefined ? ` -> ${call.returnValue}` : '';
    const mem = call.memoryChanges !== undefined ? ` (${call.memoryChanges} mem changes)` : '';
    console.log(`${call.time.toFixed(2)}ms: ${call.type}.${call.name}${args}${ret}${mem}`);
  }
}

traceJsWrapper().catch(console.error);
