/**
 * Trace WASM Execution - Hook into WASM to trace the key derivation
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceExecution() {
  console.log('=== Tracing WASM Execution ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Control inputs
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'screen', {
      value: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1080,
        colorDepth: 24,
        pixelDepth: 24,
      },
      writable: false,
    });
    
    Date.prototype.getTimezoneOffset = function() {
      return 0;
    };
    
    Math.random = function() {
      return 0.5;
    };
    
    let baseTime = 1700000000000;
    Date.now = function() {
      return baseTime++;
    };
    
    window.__canvasData = null;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
      }
      return result;
    };
    
    localStorage.clear();
    
    // Track all strings passed to WASM
    window.__wasmStrings = [];
    
    // Intercept TextEncoder
    const origEncode = TextEncoder.prototype.encode;
    TextEncoder.prototype.encode = function(str) {
      if (str && str.length > 10 && str.length < 500) {
        window.__wasmStrings.push({
          str: str.slice(0, 200),
          length: str.length,
          time: Date.now(),
        });
      }
      return origEncode.call(this, str);
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the WASM memory and look for the key derivation
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    
    // Get the key
    const key = wasm.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    // Try to access WASM memory
    let memoryData = null;
    try {
      // The WASM module should have a memory export
      const memory = wasm.memory || wasm.__wbindgen_export_0;
      if (memory && memory.buffer) {
        const mem = new Uint8Array(memory.buffer);
        
        // Search for the key in memory
        const keyBytes = [];
        for (let i = 0; i < key.length; i += 2) {
          keyBytes.push(parseInt(key.substr(i, 2), 16));
        }
        
        const keyLocations = [];
        for (let i = 0; i < mem.length - 32; i++) {
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
        
        // If we found the key, dump memory around it
        if (keyLocations.length > 0) {
          const keyOffset = keyLocations[0];
          const start = Math.max(0, keyOffset - 512);
          const end = Math.min(mem.length, keyOffset + 32 + 512);
          
          const bytes = [];
          for (let i = start; i < end; i++) {
            bytes.push(mem[i]);
          }
          
          memoryData = {
            keyOffset,
            start,
            bytes,
            keyRelativeOffset: keyOffset - start,
          };
        }
        
        // Also search for the fingerprint string
        const fpStringLocations = [];
        const searchStr = '24:Mozilla';
        const searchBytes = [];
        for (let i = 0; i < searchStr.length; i++) {
          searchBytes.push(searchStr.charCodeAt(i));
        }
        
        for (let i = 0; i < mem.length - searchBytes.length; i++) {
          let match = true;
          for (let j = 0; j < searchBytes.length; j++) {
            if (mem[i + j] !== searchBytes[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            fpStringLocations.push(i);
          }
        }
        
        memoryData = memoryData || {};
        memoryData.fpStringLocations = fpStringLocations;
        
        // If we found the fingerprint string, dump it
        if (fpStringLocations.length > 0) {
          const fpOffset = fpStringLocations[0];
          const fpBytes = [];
          for (let i = fpOffset; i < Math.min(mem.length, fpOffset + 200); i++) {
            if (mem[i] === 0) break;
            fpBytes.push(mem[i]);
          }
          memoryData.fpString = String.fromCharCode(...fpBytes);
        }
      }
    } catch (e) {
      memoryData = { error: e.message };
    }
    
    return {
      key,
      sessionId,
      canvasBase64,
      wasmStrings: window.__wasmStrings,
      memoryData,
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
  
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  
  console.log('\n=== Strings passed to WASM ===\n');
  for (const s of result.wasmStrings) {
    console.log(`[${s.length}] ${s.str}`);
  }
  
  console.log('\n=== Memory Data ===\n');
  if (result.memoryData) {
    if (result.memoryData.error) {
      console.log('Error:', result.memoryData.error);
    } else {
      console.log('Key offset:', result.memoryData.keyOffset);
      console.log('FP string locations:', result.memoryData.fpStringLocations);
      console.log('FP string from memory:', result.memoryData.fpString);
      
      if (result.memoryData.bytes) {
        // Analyze memory around the key
        const bytes = Buffer.from(result.memoryData.bytes);
        const keyRelOffset = result.memoryData.keyRelativeOffset;
        
        console.log('\n=== Memory around key ===\n');
        
        // Look for 32-byte sequences
        for (let i = 0; i < bytes.length - 32; i += 32) {
          const seq = bytes.slice(i, i + 32);
          const offset = result.memoryData.start + i;
          const isKey = i === keyRelOffset;
          
          // Check if this looks like a hash (high entropy)
          const uniqueBytes = new Set(seq);
          if (uniqueBytes.size >= 16 || isKey) {
            console.log(`[${offset}] ${seq.toString('hex')}${isKey ? ' <-- KEY' : ''}`);
          }
        }
      }
    }
  }
  
  // Build expected fingerprint string
  const fp = result.fingerprint;
  const [timestamp] = result.sessionId.split('.');
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 50)}`;
  
  console.log('\n=== Expected FP String ===\n');
  console.log(fpString);
  console.log(`Length: ${fpString.length}`);
  
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log(`\nFP Hash: ${fpHash}`);
  console.log(`Actual Key: ${result.key}`);
  
  // Calculate XOR
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const keyBuf = Buffer.from(result.key, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  console.log(`XOR constant: ${xorBuf.toString('hex')}`);
  
  // Check if the FP string from memory matches
  if (result.memoryData?.fpString) {
    console.log('\n=== Comparing FP Strings ===\n');
    console.log(`Expected: ${fpString}`);
    console.log(`From mem: ${result.memoryData.fpString}`);
    console.log(`Match: ${fpString === result.memoryData.fpString}`);
    
    if (fpString !== result.memoryData.fpString) {
      // Find differences
      for (let i = 0; i < Math.max(fpString.length, result.memoryData.fpString.length); i++) {
        if (fpString[i] !== result.memoryData.fpString[i]) {
          console.log(`Diff at ${i}: expected '${fpString[i]}' got '${result.memoryData.fpString[i]}'`);
        }
      }
    }
  }
}

traceExecution().catch(console.error);
