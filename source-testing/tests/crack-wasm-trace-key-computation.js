/**
 * Trace the exact moment when the key is computed
 * Poll memory rapidly during the critical window
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function traceKeyComputation() {
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
    window.__keyBytes = [0x48, 0xd4, 0xfb, 0x57, 0x30, 0xce, 0xad, 0x3a];
    window.__fpHashBytes = [0x54, 0xc5, 0x2b, 0x1a, 0x96, 0x97, 0x5f, 0x71];
    window.__xorBytes = [0x1c, 0x11, 0xd0, 0x4d, 0xa6, 0x59, 0xf2, 0x4b];
    
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
      
      // Get memory around key location (if found) or around expected location
      const targetLoc = keyLoc >= 0 ? keyLoc : 1047872;
      const context = Array.from(mem.slice(Math.max(0, targetLoc - 64), targetLoc + 64));
      
      window.__snapshots.push({
        label,
        time: performance.now(),
        keyLoc,
        fpHashLoc,
        xorLoc,
        context,
        contextStart: Math.max(0, targetLoc - 64),
      });
    }
    
    // Intercept WASM
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      if (importObject && importObject.wbg) {
        const wbg = importObject.wbg;
        
        // Track getItem calls
        let getItemCount = 0;
        const origGetItem = wbg.__wbg_getItem_17f98dee3b43fa7e;
        if (origGetItem) {
          wbg.__wbg_getItem_17f98dee3b43fa7e = function(...args) {
            getItemCount++;
            takeSnapshot(`before_getItem_${getItemCount}`);
            const ret = origGetItem.apply(this, args);
            takeSnapshot(`after_getItem_${getItemCount}`);
            return ret;
          };
        }
        
        // Track setItem calls
        let setItemCount = 0;
        const origSetItem = wbg.__wbg_setItem_212ecc915942ab0a;
        if (origSetItem) {
          wbg.__wbg_setItem_212ecc915942ab0a = function(...args) {
            setItemCount++;
            takeSnapshot(`before_setItem_${setItemCount}`);
            const ret = origSetItem.apply(this, args);
            takeSnapshot(`after_setItem_${setItemCount}`);
            return ret;
          };
        }
        
        // Track toDataURL calls
        let toDataURLCount = 0;
        const origToDataURL = wbg.__wbg_toDataURL_eaec332e848fe935;
        if (origToDataURL) {
          wbg.__wbg_toDataURL_eaec332e848fe935 = function(...args) {
            toDataURLCount++;
            takeSnapshot(`before_toDataURL_${toDataURLCount}`);
            const ret = origToDataURL.apply(this, args);
            takeSnapshot(`after_toDataURL_${toDataURLCount}`);
            return ret;
          };
        }
        
        // Track fillText calls (canvas drawing)
        let fillTextCount = 0;
        const origFillText = wbg.__wbg_fillText_2a0055d8531355d1;
        if (origFillText) {
          wbg.__wbg_fillText_2a0055d8531355d1 = function(...args) {
            fillTextCount++;
            takeSnapshot(`before_fillText_${fillTextCount}`);
            const ret = origFillText.apply(this, args);
            takeSnapshot(`after_fillText_${fillTextCount}`);
            return ret;
          };
        }
      }
      
      const result = await origInstantiateStreaming.call(this, source, importObject);
      
      window.__wasmMemory = result.instance.exports.memory;
      takeSnapshot('after_instantiate');
      
      return result;
    };
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    return {
      key,
      snapshots: window.__snapshots,
    };
  });
  
  await browser.close();
  
  console.log('=== Key Computation Trace ===');
  console.log('Key:', result.key);
  console.log('\nSnapshots:');
  
  let prevKeyLoc = -1;
  for (const snap of result.snapshots) {
    const keyStatus = snap.keyLoc >= 0 ? `KEY@${snap.keyLoc}` : 'no key';
    const fpStatus = snap.fpHashLoc >= 0 ? `FP@${snap.fpHashLoc}` : 'no fp';
    const xorStatus = snap.xorLoc >= 0 ? `XOR@${snap.xorLoc}` : 'no xor';
    
    let marker = '';
    if (snap.keyLoc >= 0 && prevKeyLoc < 0) {
      marker = ' *** KEY FIRST APPEARS ***';
    }
    prevKeyLoc = snap.keyLoc;
    
    console.log(`${snap.time.toFixed(2)}ms: ${snap.label} - ${keyStatus}, ${fpStatus}, ${xorStatus}${marker}`);
    
    // If key just appeared, show context
    if (marker) {
      console.log('\n  Memory context around key:');
      const ctx = snap.context;
      for (let i = 0; i < ctx.length; i += 32) {
        const offset = snap.contextStart + i;
        const chunk = ctx.slice(i, i + 32);
        const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`  ${offset.toString().padStart(7)}: ${hex}`);
      }
      console.log('');
    }
  }
}

traceKeyComputation().catch(console.error);
