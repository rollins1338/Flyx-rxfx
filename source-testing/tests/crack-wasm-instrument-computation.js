/**
 * Instrument the WASM to trace the XOR computation
 * Intercept memory writes to find when and how the XOR constant is computed
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function instrumentComputation() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  // Known values
  const expectedFpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
  const expectedKey = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
  const expectedXor = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';
  
  await page.evaluateOnNewDocument((ts, fpHash, expectedKey, expectedXor) => {
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    Math.random = function() { return 0.5; };
    let time = ts * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
    
    window.__traces = [];
    window.__fpHashBytes = [];
    window.__keyBytes = [];
    window.__xorBytes = [];
    
    // Convert hex to bytes
    for (let i = 0; i < fpHash.length; i += 2) {
      window.__fpHashBytes.push(parseInt(fpHash.substr(i, 2), 16));
    }
    for (let i = 0; i < expectedKey.length; i += 2) {
      window.__keyBytes.push(parseInt(expectedKey.substr(i, 2), 16));
    }
    for (let i = 0; i < expectedXor.length; i += 2) {
      window.__xorBytes.push(parseInt(expectedXor.substr(i, 2), 16));
    }
    
    // Intercept WASM instantiation
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      const result = await origInstantiateStreaming.call(this, source, importObject);
      
      window.__wasmMemory = result.instance.exports.memory;
      window.__wasmExports = result.instance.exports;
      
      // Set up memory monitoring
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      
      // Take periodic snapshots to find when values appear
      let snapshotCount = 0;
      const snapshotInterval = setInterval(() => {
        snapshotCount++;
        const currentMem = new Uint8Array(window.__wasmMemory.buffer);
        
        // Search for fpHash
        let fpHashLoc = -1;
        for (let i = 0; i < currentMem.length - 8; i++) {
          let match = true;
          for (let j = 0; j < 8; j++) {
            if (currentMem[i + j] !== window.__fpHashBytes[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            fpHashLoc = i;
            break;
          }
        }
        
        // Search for key
        let keyLoc = -1;
        for (let i = 0; i < currentMem.length - 8; i++) {
          let match = true;
          for (let j = 0; j < 8; j++) {
            if (currentMem[i + j] !== window.__keyBytes[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            keyLoc = i;
            break;
          }
        }
        
        // Search for XOR constant
        let xorLoc = -1;
        for (let i = 0; i < currentMem.length - 8; i++) {
          let match = true;
          for (let j = 0; j < 8; j++) {
            if (currentMem[i + j] !== window.__xorBytes[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            xorLoc = i;
            break;
          }
        }
        
        if (fpHashLoc >= 0 || keyLoc >= 0 || xorLoc >= 0) {
          window.__traces.push({
            snapshot: snapshotCount,
            time: performance.now(),
            fpHashLoc,
            keyLoc,
            xorLoc,
          });
        }
        
        // Stop after 1000 snapshots or if all found
        if (snapshotCount > 1000 || (fpHashLoc >= 0 && keyLoc >= 0 && xorLoc >= 0)) {
          clearInterval(snapshotInterval);
        }
      }, 1);
      
      return result;
    };
  }, timestamp, expectedFpHash, expectedKey, expectedXor);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Wait for snapshots
  await new Promise(r => setTimeout(r, 2000));
  
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    // Do a final memory scan
    const mem = new Uint8Array(window.__wasmMemory.buffer);
    
    // Find all locations of fpHash, key, and xor
    const fpHashLocs = [];
    const keyLocs = [];
    const xorLocs = [];
    
    for (let i = 0; i < mem.length - 32; i++) {
      // Check fpHash (full 32 bytes)
      let fpMatch = true;
      for (let j = 0; j < 32; j++) {
        if (mem[i + j] !== window.__fpHashBytes[j]) {
          fpMatch = false;
          break;
        }
      }
      if (fpMatch) fpHashLocs.push(i);
      
      // Check key (full 32 bytes)
      let keyMatch = true;
      for (let j = 0; j < 32; j++) {
        if (mem[i + j] !== window.__keyBytes[j]) {
          keyMatch = false;
          break;
        }
      }
      if (keyMatch) keyLocs.push(i);
      
      // Check xor (full 32 bytes)
      let xorMatch = true;
      for (let j = 0; j < 32; j++) {
        if (mem[i + j] !== window.__xorBytes[j]) {
          xorMatch = false;
          break;
        }
      }
      if (xorMatch) xorLocs.push(i);
    }
    
    // Get memory around key location
    let keyContext = null;
    if (keyLocs.length > 0) {
      const loc = keyLocs[0];
      keyContext = {
        loc,
        before256: Array.from(mem.slice(Math.max(0, loc - 256), loc)),
        key: Array.from(mem.slice(loc, loc + 32)),
        after256: Array.from(mem.slice(loc + 32, loc + 288)),
      };
    }
    
    return {
      key,
      traces: window.__traces,
      fpHashLocs,
      keyLocs,
      xorLocs,
      keyContext,
    };
  });
  
  await browser.close();
  
  console.log('=== Instrumentation Results ===');
  console.log('Key:', result.key);
  console.log('\nTraces:', result.traces.length);
  
  // Show when each value first appeared
  const firstFpHash = result.traces.find(t => t.fpHashLoc >= 0);
  const firstKey = result.traces.find(t => t.keyLoc >= 0);
  const firstXor = result.traces.find(t => t.xorLoc >= 0);
  
  console.log('\nFirst appearances:');
  console.log('  fpHash:', firstFpHash ? `snapshot ${firstFpHash.snapshot} at ${firstFpHash.time.toFixed(2)}ms, loc=${firstFpHash.fpHashLoc}` : 'NOT FOUND');
  console.log('  key:', firstKey ? `snapshot ${firstKey.snapshot} at ${firstKey.time.toFixed(2)}ms, loc=${firstKey.keyLoc}` : 'NOT FOUND');
  console.log('  xor:', firstXor ? `snapshot ${firstXor.snapshot} at ${firstXor.time.toFixed(2)}ms, loc=${firstXor.xorLoc}` : 'NOT FOUND');
  
  console.log('\nFinal locations:');
  console.log('  fpHash:', result.fpHashLocs.length > 0 ? result.fpHashLocs : 'NOT FOUND');
  console.log('  key:', result.keyLocs.length > 0 ? result.keyLocs : 'NOT FOUND');
  console.log('  xor:', result.xorLocs.length > 0 ? result.xorLocs : 'NOT FOUND');
  
  if (result.keyContext) {
    console.log('\n=== Memory around key ===');
    console.log('Key at:', result.keyContext.loc);
    
    // Look for patterns in the 256 bytes before the key
    const before = result.keyContext.before256;
    console.log('\n256 bytes before key:');
    for (let i = 0; i < before.length; i += 32) {
      const chunk = before.slice(i, i + 32);
      const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`  ${(result.keyContext.loc - before.length + i).toString().padStart(7)}: ${hex}`);
    }
    
    // Check if any 32-byte sequence before the key XORed with fpHash gives the key
    console.log('\nSearching for XOR source in memory before key...');
    const fpHashBytes = Buffer.from(expectedFpHash, 'hex');
    const keyBytes = Buffer.from(expectedKey, 'hex');
    
    for (let i = 0; i <= before.length - 32; i++) {
      const candidate = before.slice(i, i + 32);
      const xored = candidate.map((b, j) => b ^ fpHashBytes[j]);
      
      let isKey = true;
      for (let j = 0; j < 32; j++) {
        if (xored[j] !== keyBytes[j]) {
          isKey = false;
          break;
        }
      }
      
      if (isKey) {
        console.log(`*** FOUND XOR SOURCE at offset ${result.keyContext.loc - before.length + i} ***`);
        console.log(`  Bytes: ${candidate.map(b => b.toString(16).padStart(2, '0')).join('')}`);
      }
    }
  }
}

instrumentComputation().catch(console.error);
