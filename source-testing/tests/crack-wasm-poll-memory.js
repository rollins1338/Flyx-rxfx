/**
 * Poll memory continuously to catch when key/hash/xor first appear
 * This will help us understand the order of operations
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function pollMemory() {
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
    window.__keyFound = false;
    window.__fpHashFound = false;
    window.__xorFound = false;
    
    const keyBytes = [0x48, 0xd4, 0xfb, 0x57, 0x30, 0xce, 0xad, 0x3a];
    const fpHashBytes = [0x54, 0xc5, 0x2b, 0x1a, 0x96, 0x97, 0x5f, 0x71];
    const xorBytes = [0x1c, 0x11, 0xd0, 0x4d, 0xa6, 0x59, 0xf2, 0x4b];
    
    function findPattern(mem, pattern) {
      for (let i = 0; i < mem.length - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
          if (mem[i + j] !== pattern[j]) {
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
      const result = await origInstantiateStreaming.call(this, source, importObject);
      window.__wasmMemory = result.instance.exports.memory;
      
      window.__events.push({ type: 'wasm_instantiated', time: performance.now() });
      
      // Start polling
      const pollInterval = setInterval(() => {
        if (!window.__wasmMemory) return;
        
        const mem = new Uint8Array(window.__wasmMemory.buffer);
        
        if (!window.__keyFound) {
          const loc = findPattern(mem, keyBytes);
          if (loc >= 0) {
            window.__keyFound = true;
            window.__keyLoc = loc;
            window.__events.push({ type: 'key_found', time: performance.now(), loc });
            console.log('[POLL] Key found at', loc);
            
            // Get context around key
            const start = Math.max(0, loc - 128);
            const end = Math.min(mem.length, loc + 128);
            window.__keyContext = Array.from(mem.slice(start, end));
            window.__keyContextStart = start;
          }
        }
        
        if (!window.__fpHashFound) {
          const loc = findPattern(mem, fpHashBytes);
          if (loc >= 0) {
            window.__fpHashFound = true;
            window.__fpHashLoc = loc;
            window.__events.push({ type: 'fpHash_found', time: performance.now(), loc });
            console.log('[POLL] FP Hash found at', loc);
          }
        }
        
        if (!window.__xorFound) {
          const loc = findPattern(mem, xorBytes);
          if (loc >= 0) {
            window.__xorFound = true;
            window.__xorLoc = loc;
            window.__events.push({ type: 'xor_found', time: performance.now(), loc });
            console.log('[POLL] XOR constant found at', loc);
          }
        }
        
        // Stop polling after all found or 30 seconds
        if ((window.__keyFound && window.__fpHashFound && window.__xorFound) || 
            performance.now() > 30000) {
          clearInterval(pollInterval);
        }
      }, 1); // Poll every 1ms
      
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
    if (text.includes('[POLL]')) {
      console.log('Browser:', text);
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Wait a bit more for polling to complete
  await new Promise(r => setTimeout(r, 2000));
  
  // Get results
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    return {
      key,
      events: window.__events,
      keyFound: window.__keyFound,
      fpHashFound: window.__fpHashFound,
      xorFound: window.__xorFound,
      keyLoc: window.__keyLoc,
      fpHashLoc: window.__fpHashLoc,
      xorLoc: window.__xorLoc,
      keyContext: window.__keyContext,
      keyContextStart: window.__keyContextStart,
    };
  });
  
  await browser.close();
  
  console.log('\n=== Memory Polling Results ===');
  console.log('Key:', result.key);
  console.log('\nEvents (chronological):');
  for (const event of result.events) {
    console.log(`  ${event.time.toFixed(2)}ms: ${event.type}${event.loc !== undefined ? ' at ' + event.loc : ''}`);
  }
  
  console.log('\nLocations:');
  console.log('  Key:', result.keyFound ? result.keyLoc : 'NOT FOUND');
  console.log('  FP Hash:', result.fpHashFound ? result.fpHashLoc : 'NOT FOUND');
  console.log('  XOR:', result.xorFound ? result.xorLoc : 'NOT FOUND');
  
  if (result.keyContext) {
    console.log('\n=== Key Context (256 bytes around key) ===');
    const ctx = result.keyContext;
    const keyOffset = result.keyLoc - result.keyContextStart;
    
    for (let i = 0; i < ctx.length; i += 32) {
      const offset = result.keyContextStart + i;
      const chunk = ctx.slice(i, i + 32);
      const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
      
      let marker = '';
      if (i <= keyOffset && keyOffset < i + 32) {
        marker = ' <-- KEY STARTS HERE';
      }
      
      console.log(`${offset.toString().padStart(7)}: ${hex}${marker}`);
    }
  }
}

pollMemory().catch(console.error);
