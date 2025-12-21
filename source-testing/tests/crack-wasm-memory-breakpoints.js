/**
 * Use memory breakpoints to trace exactly where and how the key is computed
 * We'll wrap WASM memory with a Proxy to intercept all writes
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceMemoryWrites() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  // Calculate expected values
  const expectedFpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
  const expectedKey = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
  const expectedXor = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';
  
  await page.evaluateOnNewDocument((ts, fpHash, key, xorConst) => {
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    Math.random = function() { return 0.5; };
    let time = ts * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
    
    // Convert hex strings to byte arrays for comparison
    function hexToBytes(hex) {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      return bytes;
    }
    
    const fpHashBytes = hexToBytes(fpHash);
    const keyBytes = hexToBytes(key);
    const xorBytes = hexToBytes(xorConst);
    
    window.__memoryWrites = [];
    window.__keyWriteLocations = [];
    window.__xorWriteLocations = [];
    window.__fpHashWriteLocations = [];
    window.__xorOperations = [];
    
    // Hook WebAssembly.instantiate
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await origInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      const memory = instance.exports.memory;
      
      window.__wasmMemory = memory;
      
      // Create a wrapper around the memory buffer to track writes
      const originalBuffer = memory.buffer;
      let memView = new Uint8Array(originalBuffer);
      
      // Track when specific byte patterns are written
      function checkForPatterns(offset, value) {
        // Check if this write is part of the key
        for (let i = 0; i < keyBytes.length; i++) {
          if (value === keyBytes[i]) {
            // Check if surrounding bytes match
            let matchCount = 0;
            for (let j = Math.max(0, i - 3); j < Math.min(keyBytes.length, i + 4); j++) {
              const memOffset = offset - i + j;
              if (memOffset >= 0 && memOffset < memView.length) {
                if (memView[memOffset] === keyBytes[j] || (j === i && value === keyBytes[j])) {
                  matchCount++;
                }
              }
            }
            if (matchCount >= 4) {
              window.__keyWriteLocations.push({
                offset,
                byteIndex: i,
                value,
                timestamp: performance.now(),
              });
            }
          }
        }
        
        // Check if this write is part of the XOR constant
        for (let i = 0; i < xorBytes.length; i++) {
          if (value === xorBytes[i]) {
            let matchCount = 0;
            for (let j = Math.max(0, i - 3); j < Math.min(xorBytes.length, i + 4); j++) {
              const memOffset = offset - i + j;
              if (memOffset >= 0 && memOffset < memView.length) {
                if (memView[memOffset] === xorBytes[j] || (j === i && value === xorBytes[j])) {
                  matchCount++;
                }
              }
            }
            if (matchCount >= 4) {
              window.__xorWriteLocations.push({
                offset,
                byteIndex: i,
                value,
                timestamp: performance.now(),
              });
            }
          }
        }
        
        // Check if this write is part of the FP hash
        for (let i = 0; i < fpHashBytes.length; i++) {
          if (value === fpHashBytes[i]) {
            let matchCount = 0;
            for (let j = Math.max(0, i - 3); j < Math.min(fpHashBytes.length, i + 4); j++) {
              const memOffset = offset - i + j;
              if (memOffset >= 0 && memOffset < memView.length) {
                if (memView[memOffset] === fpHashBytes[j] || (j === i && value === fpHashBytes[j])) {
                  matchCount++;
                }
              }
            }
            if (matchCount >= 4) {
              window.__fpHashWriteLocations.push({
                offset,
                byteIndex: i,
                value,
                timestamp: performance.now(),
              });
            }
          }
        }
      }
      
      // Wrap get_img_key to monitor memory during execution
      if (instance.exports.get_img_key) {
        const origGetImgKey = instance.exports.get_img_key;
        instance.exports.get_img_key = function(...args) {
          console.log('[WASM] get_img_key called');
          
          // Take snapshot before
          const beforeSnapshot = new Uint8Array(memory.buffer.slice(0, 100000));
          
          const result = origGetImgKey.apply(this, args);
          
          // Take snapshot after
          const afterSnapshot = new Uint8Array(memory.buffer.slice(0, 100000));
          
          // Find all changes
          const changes = [];
          for (let i = 0; i < beforeSnapshot.length; i++) {
            if (beforeSnapshot[i] !== afterSnapshot[i]) {
              changes.push({
                offset: i,
                before: beforeSnapshot[i],
                after: afterSnapshot[i],
              });
              checkForPatterns(i, afterSnapshot[i]);
            }
          }
          
          console.log(`[WASM] ${changes.length} memory locations changed`);
          
          // Look for the key bytes in memory after execution
          const keyHex = result;
          if (keyHex && keyHex.length === 64) {
            const keyBytesResult = [];
            for (let i = 0; i < 64; i += 2) {
              keyBytesResult.push(parseInt(keyHex.substr(i, 2), 16));
            }
            
            // Search for key in memory
            for (let i = 0; i < afterSnapshot.length - 32; i++) {
              let match = true;
              for (let j = 0; j < 32; j++) {
                if (afterSnapshot[i + j] !== keyBytesResult[j]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                console.log('[WASM] Found key bytes at offset:', i);
                window.__keyFoundAt = i;
                
                // Look at what's around the key
                const context = Array.from(afterSnapshot.slice(Math.max(0, i - 64), i + 96));
                window.__keyContext = context;
                break;
              }
            }
            
            // Search for XOR constant in memory
            for (let i = 0; i < afterSnapshot.length - 32; i++) {
              let match = true;
              for (let j = 0; j < 32; j++) {
                if (afterSnapshot[i + j] !== xorBytes[j]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                console.log('[WASM] Found XOR constant at offset:', i);
                window.__xorFoundAt = i;
                break;
              }
            }
            
            // Search for FP hash in memory
            for (let i = 0; i < afterSnapshot.length - 32; i++) {
              let match = true;
              for (let j = 0; j < 32; j++) {
                if (afterSnapshot[i + j] !== fpHashBytes[j]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                console.log('[WASM] Found FP hash at offset:', i);
                window.__fpHashFoundAt = i;
                break;
              }
            }
          }
          
          window.__memoryChanges = changes;
          
          return result;
        };
      }
      
      return result;
    };
  }, timestamp, expectedFpHash, expectedKey, expectedXor);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    return {
      key,
      keyFoundAt: window.__keyFoundAt,
      xorFoundAt: window.__xorFoundAt,
      fpHashFoundAt: window.__fpHashFoundAt,
      keyContext: window.__keyContext,
      keyWriteLocations: window.__keyWriteLocations?.slice(0, 50),
      xorWriteLocations: window.__xorWriteLocations?.slice(0, 50),
      fpHashWriteLocations: window.__fpHashWriteLocations?.slice(0, 50),
      memoryChangesCount: window.__memoryChanges?.length,
    };
  });
  
  await browser.close();
  
  console.log('=== Memory Breakpoint Results ===\n');
  console.log('Key:', result.key);
  console.log('Key found at offset:', result.keyFoundAt);
  console.log('XOR constant found at offset:', result.xorFoundAt);
  console.log('FP hash found at offset:', result.fpHashFoundAt);
  console.log('Total memory changes:', result.memoryChangesCount);
  
  if (result.keyContext) {
    console.log('\n=== Memory Context Around Key ===');
    const ctx = result.keyContext;
    console.log('64 bytes before key:');
    console.log(ctx.slice(0, 64).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('\nKey (32 bytes):');
    console.log(ctx.slice(64, 96).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('\n32 bytes after key:');
    console.log(ctx.slice(96, 128).map(b => b.toString(16).padStart(2, '0')).join(' '));
  }
  
  if (result.keyWriteLocations?.length > 0) {
    console.log('\n=== Key Write Locations ===');
    console.log('First 10 writes:');
    for (const loc of result.keyWriteLocations.slice(0, 10)) {
      console.log(`  Offset ${loc.offset}: byte[${loc.byteIndex}] = 0x${loc.value.toString(16).padStart(2, '0')} at t=${loc.timestamp.toFixed(2)}`);
    }
  }
  
  if (result.xorWriteLocations?.length > 0) {
    console.log('\n=== XOR Constant Write Locations ===');
    console.log('First 10 writes:');
    for (const loc of result.xorWriteLocations.slice(0, 10)) {
      console.log(`  Offset ${loc.offset}: byte[${loc.byteIndex}] = 0x${loc.value.toString(16).padStart(2, '0')} at t=${loc.timestamp.toFixed(2)}`);
    }
  }
  
  if (result.fpHashWriteLocations?.length > 0) {
    console.log('\n=== FP Hash Write Locations ===');
    console.log('First 10 writes:');
    for (const loc of result.fpHashWriteLocations.slice(0, 10)) {
      console.log(`  Offset ${loc.offset}: byte[${loc.byteIndex}] = 0x${loc.value.toString(16).padStart(2, '0')} at t=${loc.timestamp.toFixed(2)}`);
    }
  }
  
  // Analyze the relationship between found locations
  if (result.keyFoundAt && result.fpHashFoundAt) {
    console.log('\n=== Location Analysis ===');
    console.log('Distance between FP hash and key:', result.keyFoundAt - result.fpHashFoundAt);
  }
  
  if (result.keyFoundAt && result.xorFoundAt) {
    console.log('Distance between XOR constant and key:', result.keyFoundAt - result.xorFoundAt);
  }
}

traceMemoryWrites().catch(console.error);
