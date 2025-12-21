/**
 * Analyze the memory context around the key to understand the derivation
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeMemoryContext() {
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
    
    // Intercept WASM
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      const result = await origInstantiateStreaming.call(this, source, importObject);
      window.__wasmMemory = result.instance.exports.memory;
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
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get detailed memory analysis
  const analysis = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    const memory = window.__wasmMemory;
    
    if (!memory) return { error: 'No memory' };
    
    const mem = new Uint8Array(memory.buffer);
    const memSize = mem.length;
    
    // Convert key to bytes
    const keyBytes = [];
    for (let i = 0; i < key.length; i += 2) {
      keyBytes.push(parseInt(key.substr(i, 2), 16));
    }
    
    // Find key bytes location
    let keyBytesLoc = -1;
    for (let i = 0; i < memSize - 32; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (mem[i + j] !== keyBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        keyBytesLoc = i;
        break;
      }
    }
    
    // Get extended context around key bytes
    let keyContext = null;
    if (keyBytesLoc >= 0) {
      const start = Math.max(0, keyBytesLoc - 256);
      const end = Math.min(memSize, keyBytesLoc + 256);
      keyContext = {
        location: keyBytesLoc,
        before256: Array.from(mem.slice(start, keyBytesLoc)),
        keyBytes: Array.from(mem.slice(keyBytesLoc, keyBytesLoc + 32)),
        after224: Array.from(mem.slice(keyBytesLoc + 32, end)),
      };
    }
    
    // Find key hex string location
    const keyHexBytes = new TextEncoder().encode(key);
    let keyHexLoc = -1;
    for (let i = 0; i < memSize - keyHexBytes.length; i++) {
      let match = true;
      for (let j = 0; j < keyHexBytes.length; j++) {
        if (mem[i + j] !== keyHexBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        keyHexLoc = i;
        break;
      }
    }
    
    // Get context around key hex string
    let keyHexContext = null;
    if (keyHexLoc >= 0) {
      const start = Math.max(0, keyHexLoc - 256);
      const end = Math.min(memSize, keyHexLoc + 256);
      keyHexContext = {
        location: keyHexLoc,
        before256: Array.from(mem.slice(start, keyHexLoc)),
        keyHex: Array.from(mem.slice(keyHexLoc, keyHexLoc + 64)),
        after192: Array.from(mem.slice(keyHexLoc + 64, end)),
      };
    }
    
    // Search for FP hash bytes
    const fpHashBytes = [0x54, 0xc5, 0x2b, 0x1a, 0x96, 0x97, 0x5f, 0x71, 0xb9, 0xbe, 0x36, 0xe4, 0xa4, 0x65, 0x26, 0x6a, 0x09, 0xea, 0xef, 0xee, 0xdc, 0xf6, 0x8b, 0x9c, 0x3a, 0xc8, 0x89, 0x06, 0x1e, 0xcb, 0xd2, 0x2e];
    let fpHashLoc = -1;
    for (let i = 0; i < memSize - 32; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (mem[i + j] !== fpHashBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        fpHashLoc = i;
        break;
      }
    }
    
    // Search for XOR constant bytes
    const xorBytes = [0x1c, 0x11, 0xd0, 0x4d, 0xa6, 0x59, 0xf2, 0x4b, 0x1c, 0x9e, 0xd0, 0x2e, 0x83, 0x1c, 0xa7, 0x8d, 0x42, 0xc8, 0xee, 0xd0, 0x53, 0x49, 0xc9, 0x18, 0xb1, 0xbb, 0xc1, 0x47, 0x64, 0x68, 0x95, 0xdc];
    let xorLoc = -1;
    for (let i = 0; i < memSize - 32; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (mem[i + j] !== xorBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        xorLoc = i;
        break;
      }
    }
    
    // Search for first 8 bytes of each
    let fpHashFirst8Locs = [];
    for (let i = 0; i < memSize - 8; i++) {
      let match = true;
      for (let j = 0; j < 8; j++) {
        if (mem[i + j] !== fpHashBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        fpHashFirst8Locs.push(i);
        if (fpHashFirst8Locs.length >= 10) break;
      }
    }
    
    let xorFirst8Locs = [];
    for (let i = 0; i < memSize - 8; i++) {
      let match = true;
      for (let j = 0; j < 8; j++) {
        if (mem[i + j] !== xorBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        xorFirst8Locs.push(i);
        if (xorFirst8Locs.length >= 10) break;
      }
    }
    
    return {
      key,
      memSize,
      keyBytesLoc,
      keyHexLoc,
      fpHashLoc,
      xorLoc,
      fpHashFirst8Locs,
      xorFirst8Locs,
      keyContext,
      keyHexContext,
    };
  });
  
  await browser.close();
  
  console.log('=== Memory Analysis ===');
  console.log('Key:', analysis.key);
  console.log('Memory size:', analysis.memSize);
  console.log('\nKey bytes at:', analysis.keyBytesLoc);
  console.log('Key hex at:', analysis.keyHexLoc);
  console.log('FP Hash at:', analysis.fpHashLoc >= 0 ? analysis.fpHashLoc : 'NOT FOUND');
  console.log('XOR Constant at:', analysis.xorLoc >= 0 ? analysis.xorLoc : 'NOT FOUND');
  console.log('\nFP Hash first 8 bytes at:', analysis.fpHashFirst8Locs.length > 0 ? analysis.fpHashFirst8Locs : 'NOT FOUND');
  console.log('XOR first 8 bytes at:', analysis.xorFirst8Locs.length > 0 ? analysis.xorFirst8Locs : 'NOT FOUND');
  
  if (analysis.keyContext) {
    console.log('\n=== Key Bytes Context (256 bytes before) ===');
    const before = analysis.keyContext.before256;
    
    // Print in rows of 32 bytes
    for (let i = 0; i < before.length; i += 32) {
      const offset = analysis.keyContext.location - before.length + i;
      const chunk = before.slice(i, i + 32);
      console.log(`${offset.toString().padStart(7)}: ${chunk.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
    
    console.log('\n=== Key Bytes (32 bytes) ===');
    console.log(`${analysis.keyContext.location.toString().padStart(7)}: ${analysis.keyContext.keyBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    
    console.log('\n=== After Key (first 64 bytes) ===');
    const after = analysis.keyContext.after224.slice(0, 64);
    for (let i = 0; i < after.length; i += 32) {
      const offset = analysis.keyContext.location + 32 + i;
      const chunk = after.slice(i, i + 32);
      console.log(`${offset.toString().padStart(7)}: ${chunk.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
    
    // Look for patterns in the bytes before the key
    console.log('\n=== Pattern Analysis ===');
    
    // Check if any 32-byte sequence before the key is the FP hash
    const fpHashBytes = [0x54, 0xc5, 0x2b, 0x1a, 0x96, 0x97, 0x5f, 0x71, 0xb9, 0xbe, 0x36, 0xe4, 0xa4, 0x65, 0x26, 0x6a, 0x09, 0xea, 0xef, 0xee, 0xdc, 0xf6, 0x8b, 0x9c, 0x3a, 0xc8, 0x89, 0x06, 0x1e, 0xcb, 0xd2, 0x2e];
    
    for (let i = 0; i <= before.length - 32; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (before[i + j] !== fpHashBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        console.log(`FP Hash found at offset ${analysis.keyContext.location - before.length + i} (${before.length - i} bytes before key)`);
      }
    }
    
    // Check if any 32-byte sequence XORed with FP hash gives the key
    const keyBytes = analysis.keyContext.keyBytes;
    for (let i = 0; i <= before.length - 32; i++) {
      const xored = [];
      for (let j = 0; j < 32; j++) {
        xored.push(before[i + j] ^ fpHashBytes[j]);
      }
      
      let isKey = true;
      for (let j = 0; j < 32; j++) {
        if (xored[j] !== keyBytes[j]) {
          isKey = false;
          break;
        }
      }
      
      if (isKey) {
        console.log(`\n*** FOUND XOR SOURCE at offset ${analysis.keyContext.location - before.length + i} ***`);
        console.log(`Bytes at that location XOR FP_HASH = KEY!`);
        console.log(`XOR source bytes: ${before.slice(i, i + 32).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      }
    }
  }
}

analyzeMemoryContext().catch(console.error);
