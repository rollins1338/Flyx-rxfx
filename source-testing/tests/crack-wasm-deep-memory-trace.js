/**
 * Deep memory trace - search entire WASM memory for key patterns
 * and trace all XOR operations
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function deepMemoryTrace() {
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
    
    // Hook WebAssembly.instantiate
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await origInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      const memory = instance.exports.memory;
      
      window.__wasmMemory = memory;
      window.__wasmInstance = instance;
      
      return result;
    };
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    // Search entire memory for key
    const memory = window.__wasmMemory;
    const memSize = memory.buffer.byteLength;
    const mem = new Uint8Array(memory.buffer);
    
    // Convert key to bytes
    const keyBytes = [];
    for (let i = 0; i < key.length; i += 2) {
      keyBytes.push(parseInt(key.substr(i, 2), 16));
    }
    
    // Search for key bytes
    let keyLocations = [];
    for (let i = 0; i < memSize - 32; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (mem[i + j] !== keyBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        keyLocations.push(i);
      }
    }
    
    // Search for first 8 bytes of key (more likely to find partial matches)
    let partialKeyLocations = [];
    for (let i = 0; i < memSize - 8; i++) {
      let match = true;
      for (let j = 0; j < 8; j++) {
        if (mem[i + j] !== keyBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        partialKeyLocations.push(i);
      }
    }
    
    // Search for key as hex string
    const keyHexBytes = new TextEncoder().encode(key);
    let keyHexLocations = [];
    for (let i = 0; i < memSize - keyHexBytes.length; i++) {
      let match = true;
      for (let j = 0; j < keyHexBytes.length; j++) {
        if (mem[i + j] !== keyHexBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        keyHexLocations.push(i);
      }
    }
    
    // Get memory context around found locations
    let contexts = [];
    for (const loc of [...keyLocations, ...keyHexLocations].slice(0, 5)) {
      const start = Math.max(0, loc - 64);
      const end = Math.min(memSize, loc + 128);
      contexts.push({
        location: loc,
        before: Array.from(mem.slice(start, loc)),
        at: Array.from(mem.slice(loc, loc + 64)),
        after: Array.from(mem.slice(loc + 64, end)),
      });
    }
    
    return {
      key,
      sessionId,
      canvasBase64First50: canvasBase64.slice(0, 50),
      memorySize: memSize,
      keyLocations,
      partialKeyLocations: partialKeyLocations.slice(0, 20),
      keyHexLocations,
      contexts,
      fingerprint: {
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await browser.close();
  
  console.log('=== Deep Memory Trace Results ===\n');
  console.log('Key:', result.key);
  console.log('Memory size:', result.memorySize, 'bytes');
  console.log('\nKey (32 bytes) found at:', result.keyLocations.length > 0 ? result.keyLocations : 'NOT FOUND');
  console.log('Key (first 8 bytes) found at:', result.partialKeyLocations.length > 0 ? result.partialKeyLocations : 'NOT FOUND');
  console.log('Key (hex string) found at:', result.keyHexLocations.length > 0 ? result.keyHexLocations : 'NOT FOUND');
  
  // Calculate expected values
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64First50}`;
  const fpHash = crypto.createHash('sha256').update(fpString).digest();
  const keyBuf = Buffer.from(result.key, 'hex');
  
  // Calculate XOR constant
  const xorConstant = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorConstant[i] = fpHash[i] ^ keyBuf[i];
  }
  
  console.log('\n=== Calculated Values ===');
  console.log('FP Hash:', fpHash.toString('hex'));
  console.log('XOR Constant:', xorConstant.toString('hex'));
  
  if (result.contexts.length > 0) {
    console.log('\n=== Memory Context ===');
    for (const ctx of result.contexts) {
      console.log(`\nLocation ${ctx.location}:`);
      console.log('Before (64 bytes):');
      console.log(ctx.before.map(b => b.toString(16).padStart(2, '0')).join(' '));
      console.log('\nAt location (64 bytes):');
      console.log(ctx.at.map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Check if the bytes before are the XOR constant
      if (ctx.before.length >= 32) {
        const last32 = ctx.before.slice(-32);
        let isXor = true;
        for (let i = 0; i < 32; i++) {
          if (last32[i] !== xorConstant[i]) {
            isXor = false;
            break;
          }
        }
        if (isXor) {
          console.log('*** XOR CONSTANT FOUND IMMEDIATELY BEFORE KEY! ***');
        }
        
        // Check if it's the FP hash
        let isFpHash = true;
        for (let i = 0; i < 32; i++) {
          if (last32[i] !== fpHash[i]) {
            isFpHash = false;
            break;
          }
        }
        if (isFpHash) {
          console.log('*** FP HASH FOUND IMMEDIATELY BEFORE KEY! ***');
        }
      }
    }
  }
  
  // If key hex string was found, analyze the surrounding memory
  if (result.keyHexLocations.length > 0) {
    console.log('\n=== Key Hex String Analysis ===');
    console.log('Key is stored as hex string at offset:', result.keyHexLocations[0]);
    console.log('This suggests the key is formatted to hex before being returned');
  }
}

deepMemoryTrace().catch(console.error);
