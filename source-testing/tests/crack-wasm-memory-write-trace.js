/**
 * Trace memory writes during key generation using Proxy on WASM memory
 * This will help us understand when and how the key is computed
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function traceMemoryWrites() {
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
    
    // Track memory writes
    window.__memoryWrites = [];
    window.__keyWriteTraces = [];
    
    // Key bytes we're looking for (first 8 bytes of expected key)
    const keyPrefix = [0x48, 0xd4, 0xfb, 0x57, 0x30, 0xce, 0xad, 0x3a];
    
    // Intercept WASM instantiation
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      const result = await origInstantiateStreaming.call(this, source, importObject);
      
      const memory = result.instance.exports.memory;
      window.__wasmMemory = memory;
      
      // Create a monitoring interval to detect when key appears
      let lastKeyFound = false;
      const monitor = setInterval(() => {
        const mem = new Uint8Array(memory.buffer);
        
        // Search for key bytes
        for (let i = 0; i < mem.length - 8; i++) {
          let match = true;
          for (let j = 0; j < 8; j++) {
            if (mem[i + j] !== keyPrefix[j]) {
              match = false;
              break;
            }
          }
          if (match && !lastKeyFound) {
            lastKeyFound = true;
            console.log('[TRACE] Key bytes appeared at offset:', i);
            
            // Capture context
            const context = {
              offset: i,
              before64: Array.from(mem.slice(Math.max(0, i - 64), i)),
              keyBytes: Array.from(mem.slice(i, i + 32)),
              after64: Array.from(mem.slice(i + 32, i + 96)),
              timestamp: Date.now(),
            };
            window.__keyWriteTraces.push(context);
          }
        }
      }, 10);
      
      // Stop monitoring after 30 seconds
      setTimeout(() => clearInterval(monitor), 30000);
      
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
    if (msg.text().includes('[TRACE]')) {
      console.log('Browser:', msg.text());
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and analyze memory state
  const analysis = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    const memory = window.__wasmMemory;
    
    if (!memory) return { error: 'No memory' };
    
    const mem = new Uint8Array(memory.buffer);
    
    // Find all 32-byte sequences that could be hashes (high entropy)
    const hashCandidates = [];
    
    // Look for the key bytes
    const keyBytes = [];
    for (let i = 0; i < key.length; i += 2) {
      keyBytes.push(parseInt(key.substr(i, 2), 16));
    }
    
    // Find key location
    let keyLoc = -1;
    for (let i = 0; i < mem.length - 32; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (mem[i + j] !== keyBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        keyLoc = i;
        break;
      }
    }
    
    // Get extended context around key (512 bytes before and after)
    let extendedContext = null;
    if (keyLoc >= 0) {
      const start = Math.max(0, keyLoc - 512);
      const end = Math.min(mem.length, keyLoc + 512);
      extendedContext = {
        keyLoc,
        before512: Array.from(mem.slice(start, keyLoc)),
        keyBytes: Array.from(mem.slice(keyLoc, keyLoc + 32)),
        after480: Array.from(mem.slice(keyLoc + 32, end)),
      };
    }
    
    // Search for any 32-byte sequence that when XORed with key gives a pattern
    // The FP hash is: 54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e
    const fpHashBytes = [0x54, 0xc5, 0x2b, 0x1a, 0x96, 0x97, 0x5f, 0x71, 0xb9, 0xbe, 0x36, 0xe4, 0xa4, 0x65, 0x26, 0x6a, 0x09, 0xea, 0xef, 0xee, 0xdc, 0xf6, 0x8b, 0x9c, 0x3a, 0xc8, 0x89, 0x06, 0x1e, 0xcb, 0xd2, 0x2e];
    
    // XOR constant should be: 1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc
    const expectedXor = [0x1c, 0x11, 0xd0, 0x4d, 0xa6, 0x59, 0xf2, 0x4b, 0x1c, 0x9e, 0xd0, 0x2e, 0x83, 0x1c, 0xa7, 0x8d, 0x42, 0xc8, 0xee, 0xd0, 0x53, 0x49, 0xc9, 0x18, 0xb1, 0xbb, 0xc1, 0x47, 0x64, 0x68, 0x95, 0xdc];
    
    // Search for sequences that XOR with fpHash to give key
    let xorSourceFound = [];
    if (extendedContext) {
      const searchArea = [...extendedContext.before512, ...extendedContext.keyBytes, ...extendedContext.after480];
      const searchStart = keyLoc - extendedContext.before512.length;
      
      for (let i = 0; i <= searchArea.length - 32; i++) {
        const candidate = searchArea.slice(i, i + 32);
        const xored = candidate.map((b, j) => b ^ fpHashBytes[j]);
        
        // Check if XOR result equals key
        let isKey = true;
        for (let j = 0; j < 32; j++) {
          if (xored[j] !== keyBytes[j]) {
            isKey = false;
            break;
          }
        }
        
        if (isKey) {
          xorSourceFound.push({
            offset: searchStart + i,
            bytes: candidate,
            relation: 'XOR with FP_HASH = KEY',
          });
        }
      }
    }
    
    // Also search for the expected XOR constant directly
    let xorConstantLocs = [];
    for (let i = 0; i < mem.length - 32; i++) {
      let match = true;
      for (let j = 0; j < 8; j++) { // Just check first 8 bytes
        if (mem[i + j] !== expectedXor[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        xorConstantLocs.push(i);
        if (xorConstantLocs.length >= 5) break;
      }
    }
    
    return {
      key,
      keyLoc,
      keyWriteTraces: window.__keyWriteTraces,
      xorSourceFound,
      xorConstantLocs,
      extendedContext,
    };
  });
  
  await browser.close();
  
  console.log('\n=== Memory Write Trace Analysis ===');
  console.log('Key:', analysis.key);
  console.log('Key location:', analysis.keyLoc);
  console.log('Key write traces:', analysis.keyWriteTraces?.length || 0);
  console.log('XOR source found:', analysis.xorSourceFound?.length || 0);
  console.log('XOR constant (first 8 bytes) at:', analysis.xorConstantLocs?.length > 0 ? analysis.xorConstantLocs : 'NOT FOUND');
  
  if (analysis.xorSourceFound?.length > 0) {
    console.log('\n*** XOR SOURCE FOUND! ***');
    for (const src of analysis.xorSourceFound) {
      console.log('Offset:', src.offset);
      console.log('Bytes:', src.bytes.map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('Relation:', src.relation);
    }
  }
  
  if (analysis.extendedContext) {
    console.log('\n=== Extended Memory Context ===');
    console.log('Key at offset:', analysis.extendedContext.keyLoc);
    
    // Print 512 bytes before key in 32-byte rows
    console.log('\n--- 512 bytes BEFORE key ---');
    const before = analysis.extendedContext.before512;
    for (let i = 0; i < before.length; i += 32) {
      const offset = analysis.extendedContext.keyLoc - before.length + i;
      const chunk = before.slice(i, i + 32);
      const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = chunk.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
      console.log(`${offset.toString().padStart(7)}: ${hex}  |${ascii}|`);
    }
    
    console.log('\n--- KEY (32 bytes) ---');
    const keyBytes = analysis.extendedContext.keyBytes;
    console.log(`${analysis.extendedContext.keyLoc.toString().padStart(7)}: ${keyBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    
    console.log('\n--- 64 bytes AFTER key ---');
    const after = analysis.extendedContext.after480.slice(0, 64);
    for (let i = 0; i < after.length; i += 32) {
      const offset = analysis.extendedContext.keyLoc + 32 + i;
      const chunk = after.slice(i, i + 32);
      const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`${offset.toString().padStart(7)}: ${hex}`);
    }
  }
}

traceMemoryWrites().catch(console.error);
