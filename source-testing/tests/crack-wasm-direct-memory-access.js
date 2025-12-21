/**
 * Direct memory access - access WASM memory through the wasmImgData object
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function directMemoryAccess() {
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
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // First, explore the wasmImgData object to find memory
  const exploration = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    
    // Get all properties
    const props = Object.keys(wasm);
    const protoProps = Object.getOwnPropertyNames(Object.getPrototypeOf(wasm) || {});
    
    // Look for memory-related properties
    let memoryInfo = null;
    
    // Check if there's a memory export
    if (wasm.memory) {
      memoryInfo = {
        type: 'direct',
        size: wasm.memory.buffer?.byteLength,
      };
    }
    
    // Check for __wbindgen_export properties
    for (const prop of props) {
      if (prop.includes('memory') || prop.includes('wbindgen')) {
        memoryInfo = memoryInfo || {};
        memoryInfo[prop] = typeof wasm[prop];
      }
    }
    
    return {
      props,
      protoProps,
      memoryInfo,
      hasReady: 'ready' in wasm,
      hasGetImgKey: typeof wasm.get_img_key === 'function',
    };
  });
  
  console.log('=== WASM Object Exploration ===');
  console.log('Properties:', exploration.props);
  console.log('Proto properties:', exploration.protoProps);
  console.log('Memory info:', exploration.memoryInfo);
  
  // Get the key and search for patterns
  const result = await page.evaluate((fpHashHex, xorHex) => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    // Try to access memory through various means
    let memoryBuffer = null;
    let memorySource = null;
    
    // Method 1: Direct memory property
    if (wasm.memory && wasm.memory.buffer) {
      memoryBuffer = wasm.memory.buffer;
      memorySource = 'wasm.memory';
    }
    
    // Method 2: Look for __wbindgen exports
    if (!memoryBuffer) {
      for (const prop of Object.keys(wasm)) {
        if (wasm[prop] && wasm[prop].buffer instanceof ArrayBuffer) {
          memoryBuffer = wasm[prop].buffer;
          memorySource = prop;
          break;
        }
      }
    }
    
    // Method 3: Check window for WASM memory
    if (!memoryBuffer && window.__wasmMemory) {
      memoryBuffer = window.__wasmMemory.buffer;
      memorySource = 'window.__wasmMemory';
    }
    
    let searchResults = null;
    
    if (memoryBuffer) {
      const mem = new Uint8Array(memoryBuffer);
      const memSize = mem.length;
      
      // Convert hex strings to byte arrays
      function hexToBytes(hex) {
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
          bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return bytes;
      }
      
      const keyBytes = hexToBytes(key);
      const fpHashBytes = hexToBytes(fpHashHex);
      const xorBytes = hexToBytes(xorHex);
      
      // Search for patterns
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
      
      // Search for key as hex string
      const keyHexBytes = new TextEncoder().encode(key);
      
      searchResults = {
        memorySize: memSize,
        memorySource,
        keyBytes: findPattern(keyBytes).slice(0, 5),
        keyHex: findPattern(Array.from(keyHexBytes)).slice(0, 5),
        fpHash: findPattern(fpHashBytes).slice(0, 5),
        xorConst: findPattern(xorBytes).slice(0, 5),
        keyFirst8: findPattern(keyBytes.slice(0, 8)).slice(0, 10),
        fpHashFirst8: findPattern(fpHashBytes.slice(0, 8)).slice(0, 10),
        xorFirst8: findPattern(xorBytes.slice(0, 8)).slice(0, 10),
      };
      
      // Get context around key hex location
      if (searchResults.keyHex.length > 0) {
        const loc = searchResults.keyHex[0];
        searchResults.keyHexContext = {
          location: loc,
          before: Array.from(mem.slice(Math.max(0, loc - 128), loc)),
          at: Array.from(mem.slice(loc, loc + 64)),
        };
      }
      
      // Get context around FP hash location
      if (searchResults.fpHash.length > 0) {
        const loc = searchResults.fpHash[0];
        searchResults.fpHashContext = {
          location: loc,
          before: Array.from(mem.slice(Math.max(0, loc - 64), loc)),
          at: Array.from(mem.slice(loc, loc + 32)),
          after: Array.from(mem.slice(loc + 32, loc + 96)),
        };
      }
    }
    
    return {
      key,
      sessionId,
      canvasBase64First50: canvasBase64.slice(0, 50),
      memoryFound: !!memoryBuffer,
      memorySource,
      searchResults,
      fingerprint: {
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  }, 
  // We need to calculate these first
  '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e',
  '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc'
  );
  
  await browser.close();
  
  console.log('\n=== Results ===');
  console.log('Key:', result.key);
  console.log('Memory found:', result.memoryFound);
  console.log('Memory source:', result.memorySource);
  
  if (result.searchResults) {
    const sr = result.searchResults;
    console.log('\n=== Memory Search Results ===');
    console.log('Memory size:', sr.memorySize);
    console.log('Key (bytes) at:', sr.keyBytes.length > 0 ? sr.keyBytes : 'NOT FOUND');
    console.log('Key (hex string) at:', sr.keyHex.length > 0 ? sr.keyHex : 'NOT FOUND');
    console.log('FP Hash at:', sr.fpHash.length > 0 ? sr.fpHash : 'NOT FOUND');
    console.log('XOR Constant at:', sr.xorConst.length > 0 ? sr.xorConst : 'NOT FOUND');
    
    console.log('\nPartial matches (first 8 bytes):');
    console.log('Key:', sr.keyFirst8.length > 0 ? sr.keyFirst8 : 'NOT FOUND');
    console.log('FP Hash:', sr.fpHashFirst8.length > 0 ? sr.fpHashFirst8 : 'NOT FOUND');
    console.log('XOR:', sr.xorFirst8.length > 0 ? sr.xorFirst8 : 'NOT FOUND');
    
    if (sr.keyHexContext) {
      console.log('\n=== Key Hex String Context ===');
      console.log('Location:', sr.keyHexContext.location);
      console.log('128 bytes before (as hex):');
      const before = sr.keyHexContext.before;
      for (let i = 0; i < before.length; i += 32) {
        console.log(before.slice(i, i + 32).map(b => b.toString(16).padStart(2, '0')).join(' '));
      }
      console.log('\nAs ASCII:');
      console.log(Buffer.from(before).toString('utf8').replace(/[^\x20-\x7E]/g, '.'));
    }
    
    if (sr.fpHashContext) {
      console.log('\n=== FP Hash Context ===');
      console.log('Location:', sr.fpHashContext.location);
      console.log('FP Hash (32 bytes):');
      console.log(sr.fpHashContext.at.map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('\n64 bytes after FP Hash:');
      console.log(sr.fpHashContext.after.map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Check what's after the FP hash
      const after32 = sr.fpHashContext.after.slice(0, 32);
      const keyBytes = [];
      for (let i = 0; i < result.key.length; i += 2) {
        keyBytes.push(parseInt(result.key.substr(i, 2), 16));
      }
      
      let isKey = true;
      for (let i = 0; i < 32; i++) {
        if (after32[i] !== keyBytes[i]) {
          isKey = false;
          break;
        }
      }
      if (isKey) {
        console.log('\n*** KEY FOUND IMMEDIATELY AFTER FP HASH! ***');
      }
      
      // Check if it's the XOR constant
      const xorBytes = [];
      const xorHex = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';
      for (let i = 0; i < xorHex.length; i += 2) {
        xorBytes.push(parseInt(xorHex.substr(i, 2), 16));
      }
      
      let isXor = true;
      for (let i = 0; i < 32; i++) {
        if (after32[i] !== xorBytes[i]) {
          isXor = false;
          break;
        }
      }
      if (isXor) {
        console.log('\n*** XOR CONSTANT FOUND IMMEDIATELY AFTER FP HASH! ***');
      }
    }
  } else {
    console.log('\nCould not access WASM memory');
  }
}

directMemoryAccess().catch(console.error);
