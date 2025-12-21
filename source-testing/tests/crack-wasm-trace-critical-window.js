/**
 * Trace the critical window between toDataURL_1 and getItem_2
 * This is when the key is computed
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function traceCriticalWindow() {
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
    window.__inCriticalWindow = false;
    window.__pollInterval = null;
    
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
      if (importObject && importObject.wbg) {
        const wbg = importObject.wbg;
        
        // Track all import calls during critical window
        const importNames = Object.keys(wbg);
        for (const name of importNames) {
          const orig = wbg[name];
          if (typeof orig === 'function') {
            wbg[name] = function(...args) {
              if (window.__inCriticalWindow) {
                window.__events.push({
                  type: 'import_call',
                  name,
                  time: performance.now(),
                  args: args.slice(0, 5),
                });
                
                // Check for key after each call
                if (window.__wasmMemory) {
                  const mem = new Uint8Array(window.__wasmMemory.buffer);
                  const keyLoc = findKey(mem);
                  if (keyLoc >= 0) {
                    window.__events.push({
                      type: 'key_found',
                      name,
                      time: performance.now(),
                      loc: keyLoc,
                    });
                    window.__inCriticalWindow = false;
                  }
                }
              }
              return orig.apply(this, args);
            };
          }
        }
        
        // Track toDataURL to start critical window
        let toDataURLCount = 0;
        const origToDataURL = wbg.__wbg_toDataURL_eaec332e848fe935;
        wbg.__wbg_toDataURL_eaec332e848fe935 = function(...args) {
          toDataURLCount++;
          const ret = origToDataURL.apply(this, args);
          
          if (toDataURLCount === 1) {
            window.__events.push({ type: 'critical_window_start', time: performance.now() });
            window.__inCriticalWindow = true;
            
            // Start rapid polling
            window.__pollInterval = setInterval(() => {
              if (!window.__wasmMemory || !window.__inCriticalWindow) return;
              
              const mem = new Uint8Array(window.__wasmMemory.buffer);
              const keyLoc = findKey(mem);
              if (keyLoc >= 0) {
                window.__events.push({
                  type: 'key_found_poll',
                  time: performance.now(),
                  loc: keyLoc,
                });
                window.__inCriticalWindow = false;
                clearInterval(window.__pollInterval);
              }
            }, 0.1); // Poll as fast as possible
          }
          
          return ret;
        };
      }
      
      const result = await origInstantiateStreaming.call(this, source, importObject);
      window.__wasmMemory = result.instance.exports.memory;
      return result;
    };
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    if (window.__pollInterval) clearInterval(window.__pollInterval);
    
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    return {
      key,
      events: window.__events,
    };
  });
  
  await browser.close();
  
  console.log('=== Critical Window Trace ===');
  console.log('Key:', result.key);
  console.log('\nEvents in critical window:');
  
  // Filter to events in critical window
  const criticalStart = result.events.find(e => e.type === 'critical_window_start');
  const keyFound = result.events.find(e => e.type === 'key_found' || e.type === 'key_found_poll');
  
  if (criticalStart && keyFound) {
    console.log(`Critical window: ${criticalStart.time.toFixed(2)}ms to ${keyFound.time.toFixed(2)}ms`);
    console.log(`Duration: ${(keyFound.time - criticalStart.time).toFixed(2)}ms`);
    
    // Show all events in window
    const windowEvents = result.events.filter(e => 
      e.time >= criticalStart.time && e.time <= keyFound.time
    );
    
    console.log(`\nEvents in window (${windowEvents.length}):`);
    for (const event of windowEvents) {
      if (event.type === 'import_call') {
        const args = event.args?.length > 0 ? ` args=[${event.args.join(', ')}]` : '';
        console.log(`${(event.time - criticalStart.time).toFixed(2)}ms: ${event.name}${args}`);
      } else {
        console.log(`${(event.time - criticalStart.time).toFixed(2)}ms: ${event.type}${event.loc ? ' at ' + event.loc : ''}`);
      }
    }
  } else {
    console.log('Could not identify critical window');
    console.log('All events:', result.events.length);
    for (const event of result.events.slice(0, 50)) {
      console.log(`${event.time?.toFixed(2)}ms: ${event.type} ${event.name || ''}`);
    }
  }
}

traceCriticalWindow().catch(console.error);
