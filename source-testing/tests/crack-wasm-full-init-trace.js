/**
 * Trace memory from WASM initialization to key generation
 * Take snapshots at multiple points to find when key/hash/xor are written
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function fullInitTrace() {
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
    
    window.__snapshots = [];
    window.__keyBytes = [0x48, 0xd4, 0xfb, 0x57, 0x30, 0xce, 0xad, 0x3a, 0xa5, 0x20, 0xe6, 0xca, 0x27, 0x79, 0x81, 0xe7, 0x4b, 0x22, 0x01, 0x3e, 0x8f, 0xbf, 0x42, 0x84, 0x8b, 0x73, 0x48, 0x41, 0x7a, 0xa3, 0x47, 0xf2];
    window.__fpHashBytes = [0x54, 0xc5, 0x2b, 0x1a, 0x96, 0x97, 0x5f, 0x71, 0xb9, 0xbe, 0x36, 0xe4, 0xa4, 0x65, 0x26, 0x6a, 0x09, 0xea, 0xef, 0xee, 0xdc, 0xf6, 0x8b, 0x9c, 0x3a, 0xc8, 0x89, 0x06, 0x1e, 0xcb, 0xd2, 0x2e];
    window.__xorBytes = [0x1c, 0x11, 0xd0, 0x4d, 0xa6, 0x59, 0xf2, 0x4b, 0x1c, 0x9e, 0xd0, 0x2e, 0x83, 0x1c, 0xa7, 0x8d, 0x42, 0xc8, 0xee, 0xd0, 0x53, 0x49, 0xc9, 0x18, 0xb1, 0xbb, 0xc1, 0x47, 0x64, 0x68, 0x95, 0xdc];
    
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
    
    function takeSnapshot(label) {
      if (!window.__wasmMemory) return;
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      
      const keyLoc = findPattern(mem, window.__keyBytes);
      const fpHashLoc = findPattern(mem, window.__fpHashBytes);
      const xorLoc = findPattern(mem, window.__xorBytes);
      
      window.__snapshots.push({
        label,
        time: Date.now(),
        keyLoc,
        fpHashLoc,
        xorLoc,
      });
      
      console.log(`[SNAPSHOT] ${label}: key=${keyLoc}, fpHash=${fpHashLoc}, xor=${xorLoc}`);
    }
    
    // Intercept WASM instantiation
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      console.log('[WASM] instantiateStreaming called');
      
      const result = await origInstantiateStreaming.call(this, source, importObject);
      window.__wasmMemory = result.instance.exports.memory;
      window.__wasmInstance = result.instance;
      
      takeSnapshot('after_instantiate');
      
      // Wrap all exported functions to trace calls
      const exports = result.instance.exports;
      const origFuncs = {};
      
      for (const [name, func] of Object.entries(exports)) {
        if (typeof func === 'function' && name !== 'memory') {
          origFuncs[name] = func;
          exports[name] = function(...args) {
            console.log(`[WASM] ${name} called`);
            const ret = origFuncs[name].apply(this, args);
            takeSnapshot(`after_${name}`);
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
    if (text.includes('[WASM]') || text.includes('[SNAPSHOT]')) {
      console.log('Browser:', text);
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get all snapshots
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    return {
      key,
      snapshots: window.__snapshots,
    };
  });
  
  await browser.close();
  
  console.log('\n=== Snapshot Timeline ===');
  console.log('Key:', result.key);
  console.log('\nSnapshots:');
  for (const snap of result.snapshots) {
    console.log(`${snap.label}:`);
    console.log(`  Key at: ${snap.keyLoc >= 0 ? snap.keyLoc : 'NOT FOUND'}`);
    console.log(`  FP Hash at: ${snap.fpHashLoc >= 0 ? snap.fpHashLoc : 'NOT FOUND'}`);
    console.log(`  XOR at: ${snap.xorLoc >= 0 ? snap.xorLoc : 'NOT FOUND'}`);
  }
}

fullInitTrace().catch(console.error);
