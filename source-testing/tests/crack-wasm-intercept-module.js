/**
 * Intercept WASM module loading to get access to memory exports
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptModule() {
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
    
    window.__canvasData = null;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
      }
      return result;
    };
    
    // Intercept WebAssembly.instantiateStreaming and WebAssembly.instantiate
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    const origInstantiate = WebAssembly.instantiate;
    
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      console.log('[WASM] instantiateStreaming called');
      const result = await origInstantiateStreaming.call(this, source, importObject);
      
      // Store the instance and its exports
      window.__wasmInstance = result.instance;
      window.__wasmModule = result.module;
      window.__wasmExports = result.instance.exports;
      
      console.log('[WASM] Exports:', Object.keys(result.instance.exports));
      
      // Check for memory export
      if (result.instance.exports.memory) {
        window.__wasmMemory = result.instance.exports.memory;
        console.log('[WASM] Memory found, size:', result.instance.exports.memory.buffer.byteLength);
      }
      
      return result;
    };
    
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[WASM] instantiate called');
      const result = await origInstantiate.call(this, bufferSource, importObject);
      
      const instance = result.instance || result;
      
      // Store the instance and its exports
      window.__wasmInstance = instance;
      window.__wasmExports = instance.exports;
      
      console.log('[WASM] Exports:', Object.keys(instance.exports));
      
      // Check for memory export
      if (instance.exports.memory) {
        window.__wasmMemory = instance.exports.memory;
        console.log('[WASM] Memory found, size:', instance.exports.memory.buffer.byteLength);
      }
      
      return result;
    };
  }, timestamp);
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.text().includes('[WASM]')) {
      console.log('Browser:', msg.text());
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Check what we captured
  const captureResult = await page.evaluate(() => {
    return {
      hasWasmInstance: !!window.__wasmInstance,
      hasWasmMemory: !!window.__wasmMemory,
      hasWasmExports: !!window.__wasmExports,
      exports: window.__wasmExports ? Object.keys(window.__wasmExports) : [],
      memorySize: window.__wasmMemory?.buffer?.byteLength,
    };
  });
  
  console.log('\n=== Captured WASM Info ===');
  console.log('Has instance:', captureResult.hasWasmInstance);
  console.log('Has memory:', captureResult.hasWasmMemory);
  console.log('Exports:', captureResult.exports);
  console.log('Memory size:', captureResult.memorySize);
  
  if (captureResult.hasWasmMemory) {
    // Now search memory for patterns
    const searchResult = await page.evaluate(() => {
      const wasm = window.wasmImgData;
      const key = wasm.get_img_key();
      const sessionId = localStorage.getItem('tmdb_session_id');
      
      const memory = window.__wasmMemory;
      const mem = new Uint8Array(memory.buffer);
      const memSize = mem.length;
      
      // Convert key to bytes
      const keyBytes = [];
      for (let i = 0; i < key.length; i += 2) {
        keyBytes.push(parseInt(key.substr(i, 2), 16));
      }
      
      // Search for key as hex string
      const keyHexBytes = new TextEncoder().encode(key);
      
      function findPattern(pattern) {
        const locations = [];
        for (let i = 0; i < memSize - pattern.length; i++) {
          let match = true;
          for (let j = 0; j < pattern.length; j++) {
            if (mem[i + j] !== pattern[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            locations.push(i);
          }
        }
        return locations;
      }
      
      const keyBytesLocs = findPattern(keyBytes);
      const keyHexLocs = findPattern(Array.from(keyHexBytes));
      
      // Get context around key hex location
      let keyHexContext = null;
      if (keyHexLocs.length > 0) {
        const loc = keyHexLocs[0];
        keyHexContext = {
          location: loc,
          before128: Array.from(mem.slice(Math.max(0, loc - 128), loc)),
          at64: Array.from(mem.slice(loc, loc + 64)),
        };
      }
      
      // Search for FP hash (we know it's 54c52b1a96975f71...)
      const fpHashBytes = [0x54, 0xc5, 0x2b, 0x1a, 0x96, 0x97, 0x5f, 0x71, 0xb9, 0xbe, 0x36, 0xe4, 0xa4, 0x65, 0x26, 0x6a, 0x09, 0xea, 0xef, 0xee, 0xdc, 0xf6, 0x8b, 0x9c, 0x3a, 0xc8, 0x89, 0x06, 0x1e, 0xcb, 0xd2, 0x2e];
      const fpHashLocs = findPattern(fpHashBytes);
      
      // Search for XOR constant (1c11d04da659f24b...)
      const xorBytes = [0x1c, 0x11, 0xd0, 0x4d, 0xa6, 0x59, 0xf2, 0x4b, 0x1c, 0x9e, 0xd0, 0x2e, 0x83, 0x1c, 0xa7, 0x8d, 0x42, 0xc8, 0xee, 0xd0, 0x53, 0x49, 0xc9, 0x18, 0xb1, 0xbb, 0xc1, 0x47, 0x64, 0x68, 0x95, 0xdc];
      const xorLocs = findPattern(xorBytes);
      
      // Get context around FP hash
      let fpHashContext = null;
      if (fpHashLocs.length > 0) {
        const loc = fpHashLocs[0];
        fpHashContext = {
          location: loc,
          before64: Array.from(mem.slice(Math.max(0, loc - 64), loc)),
          at32: Array.from(mem.slice(loc, loc + 32)),
          after64: Array.from(mem.slice(loc + 32, loc + 96)),
        };
      }
      
      return {
        key,
        sessionId,
        memSize,
        keyBytesLocs: keyBytesLocs.slice(0, 5),
        keyHexLocs: keyHexLocs.slice(0, 5),
        fpHashLocs: fpHashLocs.slice(0, 5),
        xorLocs: xorLocs.slice(0, 5),
        keyHexContext,
        fpHashContext,
      };
    });
    
    console.log('\n=== Memory Search Results ===');
    console.log('Key:', searchResult.key);
    console.log('Memory size:', searchResult.memSize);
    console.log('Key (bytes) at:', searchResult.keyBytesLocs.length > 0 ? searchResult.keyBytesLocs : 'NOT FOUND');
    console.log('Key (hex string) at:', searchResult.keyHexLocs.length > 0 ? searchResult.keyHexLocs : 'NOT FOUND');
    console.log('FP Hash at:', searchResult.fpHashLocs.length > 0 ? searchResult.fpHashLocs : 'NOT FOUND');
    console.log('XOR Constant at:', searchResult.xorLocs.length > 0 ? searchResult.xorLocs : 'NOT FOUND');
    
    if (searchResult.keyHexContext) {
      console.log('\n=== Key Hex String Context ===');
      console.log('Location:', searchResult.keyHexContext.location);
      console.log('128 bytes before:');
      const before = searchResult.keyHexContext.before128;
      for (let i = 0; i < before.length; i += 32) {
        const chunk = before.slice(i, i + 32);
        console.log(chunk.map(b => b.toString(16).padStart(2, '0')).join(' '));
      }
      console.log('\nAs ASCII:');
      console.log(Buffer.from(before).toString('utf8').replace(/[^\x20-\x7E]/g, '.'));
    }
    
    if (searchResult.fpHashContext) {
      console.log('\n=== FP Hash Context ===');
      console.log('Location:', searchResult.fpHashContext.location);
      console.log('FP Hash (32 bytes):');
      console.log(searchResult.fpHashContext.at32.map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('\n64 bytes after FP Hash:');
      console.log(searchResult.fpHashContext.after64.map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Analyze what's after the FP hash
      const after32 = searchResult.fpHashContext.after64.slice(0, 32);
      const keyBytes = [];
      for (let i = 0; i < searchResult.key.length; i += 2) {
        keyBytes.push(parseInt(searchResult.key.substr(i, 2), 16));
      }
      
      // Check if it's the key
      let isKey = after32.length >= 32;
      for (let i = 0; i < 32 && isKey; i++) {
        if (after32[i] !== keyBytes[i]) isKey = false;
      }
      if (isKey) console.log('\n*** KEY FOUND AFTER FP HASH! ***');
      
      // Check if it's the XOR constant
      const xorBytes = [0x1c, 0x11, 0xd0, 0x4d, 0xa6, 0x59, 0xf2, 0x4b, 0x1c, 0x9e, 0xd0, 0x2e, 0x83, 0x1c, 0xa7, 0x8d, 0x42, 0xc8, 0xee, 0xd0, 0x53, 0x49, 0xc9, 0x18, 0xb1, 0xbb, 0xc1, 0x47, 0x64, 0x68, 0x95, 0xdc];
      let isXor = after32.length >= 32;
      for (let i = 0; i < 32 && isXor; i++) {
        if (after32[i] !== xorBytes[i]) isXor = false;
      }
      if (isXor) console.log('\n*** XOR CONSTANT FOUND AFTER FP HASH! ***');
      
      // XOR the FP hash with what's after it to see if we get the key
      const xored = [];
      const fpHash = searchResult.fpHashContext.at32;
      for (let i = 0; i < 32; i++) {
        xored.push(fpHash[i] ^ after32[i]);
      }
      console.log('\nFP Hash XOR (bytes after):');
      console.log(xored.map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Check if this equals the key
      let xorEqualsKey = true;
      for (let i = 0; i < 32; i++) {
        if (xored[i] !== keyBytes[i]) {
          xorEqualsKey = false;
          break;
        }
      }
      if (xorEqualsKey) {
        console.log('\n*** FP_HASH XOR (BYTES_AFTER) = KEY! ***');
        console.log('The bytes after FP hash are the XOR constant!');
      }
    }
  }
  
  await browser.close();
}

interceptModule().catch(console.error);
