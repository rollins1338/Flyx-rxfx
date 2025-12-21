/**
 * Trace the complete initialization and key generation
 * Focus on when the key first appears in memory
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function traceInitComplete() {
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
    
    window.__events = [];
    window.__keyBytes = [0x48, 0xd4, 0xfb, 0x57, 0x30, 0xce, 0xad, 0x3a];
    
    function findKey(mem) {
      for (let i = 0; i < mem.length - 8; i++) {
        let match = true;
        for (let j = 0; j < 8; j++) {
          if (mem[i + j] !== window.__keyBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) return i;
      }
      return -1;
    }
    
    // Intercept WASM
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      window.__events.push({ type: 'wasm_start', time: performance.now() });
      
      // Wrap key import functions
      if (importObject && importObject.wbg) {
        const wbg = importObject.wbg;
        
        // Wrap toDataURL - this is when canvas fingerprint is captured
        const origToDataURL = wbg.__wbg_toDataURL_eaec332e848fe935;
        if (origToDataURL) {
          wbg.__wbg_toDataURL_eaec332e848fe935 = function(...args) {
            window.__events.push({ type: 'toDataURL_called', time: performance.now() });
            const ret = origToDataURL.apply(this, args);
            
            // Check if key appeared
            if (window.__wasmMemory) {
              const mem = new Uint8Array(window.__wasmMemory.buffer);
              const keyLoc = findKey(mem);
              if (keyLoc >= 0) {
                window.__events.push({ type: 'key_found_after_toDataURL', time: performance.now(), loc: keyLoc });
              }
            }
            
            return ret;
          };
        }
        
        // Wrap getItem - this is when session ID is retrieved
        const origGetItem = wbg.__wbg_getItem_17f98dee3b43fa7e;
        if (origGetItem) {
          wbg.__wbg_getItem_17f98dee3b43fa7e = function(...args) {
            window.__events.push({ type: 'getItem_called', time: performance.now(), args: args.slice(0, 4) });
            const ret = origGetItem.apply(this, args);
            
            // Check if key appeared
            if (window.__wasmMemory) {
              const mem = new Uint8Array(window.__wasmMemory.buffer);
              const keyLoc = findKey(mem);
              if (keyLoc >= 0) {
                window.__events.push({ type: 'key_found_after_getItem', time: performance.now(), loc: keyLoc });
              }
            }
            
            return ret;
          };
        }
        
        // Wrap setItem - this is when session ID is stored
        const origSetItem = wbg.__wbg_setItem_212ecc915942ab0a;
        if (origSetItem) {
          wbg.__wbg_setItem_212ecc915942ab0a = function(...args) {
            window.__events.push({ type: 'setItem_called', time: performance.now(), args: args.slice(0, 4) });
            const ret = origSetItem.apply(this, args);
            
            // Check if key appeared
            if (window.__wasmMemory) {
              const mem = new Uint8Array(window.__wasmMemory.buffer);
              const keyLoc = findKey(mem);
              if (keyLoc >= 0) {
                window.__events.push({ type: 'key_found_after_setItem', time: performance.now(), loc: keyLoc });
              }
            }
            
            return ret;
          };
        }
        
        // Wrap random - might be used in key derivation
        const origRandom = wbg.__wbg_random_3ad904d98382defe;
        if (origRandom) {
          wbg.__wbg_random_3ad904d98382defe = function(...args) {
            window.__events.push({ type: 'random_called', time: performance.now() });
            return origRandom.apply(this, args);
          };
        }
        
        // Wrap now - timestamp
        const origNow = wbg.__wbg_now_807e54c39636c349;
        if (origNow) {
          let nowCount = 0;
          wbg.__wbg_now_807e54c39636c349 = function(...args) {
            nowCount++;
            if (nowCount <= 10) { // Only log first 10
              window.__events.push({ type: 'now_called', time: performance.now(), count: nowCount });
            }
            return origNow.apply(this, args);
          };
        }
      }
      
      const result = await origInstantiateStreaming.call(this, source, importObject);
      
      window.__wasmMemory = result.instance.exports.memory;
      window.__wasmExports = result.instance.exports;
      
      window.__events.push({ type: 'wasm_instantiated', time: performance.now() });
      
      // Check if key is already in memory
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      const keyLoc = findKey(mem);
      if (keyLoc >= 0) {
        window.__events.push({ type: 'key_found_after_instantiate', time: performance.now(), loc: keyLoc });
      }
      
      // Wrap get_img_key
      const origGetImgKey = result.instance.exports.get_img_key;
      result.instance.exports.get_img_key = function(...args) {
        window.__events.push({ type: 'get_img_key_called', time: performance.now() });
        
        // Check key before
        const memBefore = new Uint8Array(window.__wasmMemory.buffer);
        const keyLocBefore = findKey(memBefore);
        
        const ret = origGetImgKey.apply(this, args);
        
        // Check key after
        const memAfter = new Uint8Array(window.__wasmMemory.buffer);
        const keyLocAfter = findKey(memAfter);
        
        window.__events.push({ 
          type: 'get_img_key_returned', 
          time: performance.now(),
          keyLocBefore,
          keyLocAfter,
          returnValue: ret,
        });
        
        return ret;
      };
      
      return result;
    };
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Call get_img_key explicitly
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    return {
      key,
      events: window.__events,
      sessionId: localStorage.getItem('tmdb_session_id'),
    };
  });
  
  await browser.close();
  
  console.log('=== Initialization Trace ===');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('\nEvents (chronological):');
  
  for (const event of result.events) {
    let extra = '';
    if (event.loc !== undefined) extra += ` loc=${event.loc}`;
    if (event.args) extra += ` args=[${event.args.join(', ')}]`;
    if (event.count !== undefined) extra += ` count=${event.count}`;
    if (event.keyLocBefore !== undefined) extra += ` keyBefore=${event.keyLocBefore}`;
    if (event.keyLocAfter !== undefined) extra += ` keyAfter=${event.keyLocAfter}`;
    if (event.returnValue !== undefined) extra += ` ret=${event.returnValue}`;
    
    console.log(`${event.time.toFixed(2)}ms: ${event.type}${extra}`);
  }
}

traceInitComplete().catch(console.error);
