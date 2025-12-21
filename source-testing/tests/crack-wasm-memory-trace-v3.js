/**
 * Memory trace v3 - properly capture WASM memory and search for patterns
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function memoryTraceV3() {
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
    
    window.__memorySnapshots = [];
    
    // Hook WebAssembly.instantiate
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await origInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      const memory = instance.exports.memory;
      
      // Wrap get_img_key to capture memory snapshots
      if (instance.exports.get_img_key) {
        const origGetImgKey = instance.exports.get_img_key;
        instance.exports.get_img_key = function(...args) {
          // Snapshot before
          const beforeMem = new Uint8Array(memory.buffer.slice(0));
          
          const result = origGetImgKey.apply(this, args);
          
          // Snapshot after
          const afterMem = new Uint8Array(memory.buffer.slice(0));
          
          // Store snapshots for later analysis
          window.__beforeMem = beforeMem;
          window.__afterMem = afterMem;
          window.__memorySize = memory.buffer.byteLength;
          
          return result;
        };
      }
      
      return result;
    };
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key first
  const keyResult = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      canvasBase64First50: canvasBase64.slice(0, 50),
      memorySize: window.__memorySize,
      fingerprint: {
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  console.log('Key:', keyResult.key);
  console.log('Memory size:', keyResult.memorySize);
  
  // Calculate expected values
  const fp = keyResult.fingerprint;
  const [ts] = keyResult.sessionId.split('.');
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${keyResult.canvasBase64First50}`;
  const fpHash = crypto.createHash('sha256').update(fpString).digest();
  const keyBuf = Buffer.from(keyResult.key, 'hex');
  
  // Calculate XOR constant
  const xorConstant = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorConstant[i] = fpHash[i] ^ keyBuf[i];
  }
  
  console.log('\nFP Hash:', fpHash.toString('hex'));
  console.log('XOR Constant:', xorConstant.toString('hex'));
  
  // Now search memory for patterns
  const searchResult = await page.evaluate((keyHex, fpHashHex, xorHex) => {
    const afterMem = window.__afterMem;
    if (!afterMem) return { error: 'No memory snapshot' };
    
    const memSize = afterMem.length;
    
    // Convert hex strings to byte arrays
    function hexToBytes(hex) {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      return bytes;
    }
    
    const keyBytes = hexToBytes(keyHex);
    const fpHashBytes = hexToBytes(fpHashHex);
    const xorBytes = hexToBytes(xorHex);
    
    // Search for patterns
    function findPattern(pattern, name) {
      const locations = [];
      for (let i = 0; i < memSize - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
          if (afterMem[i + j] !== pattern[j]) {
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
    
    // Search for key as bytes
    const keyBytesLocations = findPattern(keyBytes, 'key bytes');
    
    // Search for key as hex string
    const keyHexBytes = new TextEncoder().encode(keyHex);
    const keyHexLocations = findPattern(Array.from(keyHexBytes), 'key hex');
    
    // Search for FP hash
    const fpHashLocations = findPattern(fpHashBytes, 'fp hash');
    
    // Search for XOR constant
    const xorLocations = findPattern(xorBytes, 'xor constant');
    
    // Search for first 8 bytes of each
    const keyFirst8 = findPattern(keyBytes.slice(0, 8), 'key first 8');
    const fpHashFirst8 = findPattern(fpHashBytes.slice(0, 8), 'fp hash first 8');
    const xorFirst8 = findPattern(xorBytes.slice(0, 8), 'xor first 8');
    
    // Get context around found locations
    const contexts = {};
    
    if (keyHexLocations.length > 0) {
      const loc = keyHexLocations[0];
      contexts.keyHex = {
        location: loc,
        before64: Array.from(afterMem.slice(Math.max(0, loc - 64), loc)),
        at64: Array.from(afterMem.slice(loc, loc + 64)),
      };
    }
    
    if (fpHashLocations.length > 0) {
      const loc = fpHashLocations[0];
      contexts.fpHash = {
        location: loc,
        before64: Array.from(afterMem.slice(Math.max(0, loc - 64), loc)),
        at64: Array.from(afterMem.slice(loc, loc + 64)),
        after64: Array.from(afterMem.slice(loc + 32, loc + 96)),
      };
    }
    
    if (xorLocations.length > 0) {
      const loc = xorLocations[0];
      contexts.xor = {
        location: loc,
        before64: Array.from(afterMem.slice(Math.max(0, loc - 64), loc)),
        at64: Array.from(afterMem.slice(loc, loc + 64)),
      };
    }
    
    return {
      memSize,
      keyBytesLocations: keyBytesLocations.slice(0, 10),
      keyHexLocations: keyHexLocations.slice(0, 10),
      fpHashLocations: fpHashLocations.slice(0, 10),
      xorLocations: xorLocations.slice(0, 10),
      keyFirst8: keyFirst8.slice(0, 10),
      fpHashFirst8: fpHashFirst8.slice(0, 10),
      xorFirst8: xorFirst8.slice(0, 10),
      contexts,
    };
  }, keyResult.key, fpHash.toString('hex'), xorConstant.toString('hex'));
  
  await browser.close();
  
  console.log('\n=== Memory Search Results ===');
  console.log('Memory size:', searchResult.memSize);
  console.log('\nKey (32 bytes) found at:', searchResult.keyBytesLocations.length > 0 ? searchResult.keyBytesLocations : 'NOT FOUND');
  console.log('Key (hex string) found at:', searchResult.keyHexLocations.length > 0 ? searchResult.keyHexLocations : 'NOT FOUND');
  console.log('FP Hash found at:', searchResult.fpHashLocations.length > 0 ? searchResult.fpHashLocations : 'NOT FOUND');
  console.log('XOR Constant found at:', searchResult.xorLocations.length > 0 ? searchResult.xorLocations : 'NOT FOUND');
  
  console.log('\nPartial matches (first 8 bytes):');
  console.log('Key first 8:', searchResult.keyFirst8.length > 0 ? searchResult.keyFirst8 : 'NOT FOUND');
  console.log('FP Hash first 8:', searchResult.fpHashFirst8.length > 0 ? searchResult.fpHashFirst8 : 'NOT FOUND');
  console.log('XOR first 8:', searchResult.xorFirst8.length > 0 ? searchResult.xorFirst8 : 'NOT FOUND');
  
  if (searchResult.contexts.keyHex) {
    console.log('\n=== Key Hex String Context ===');
    console.log('Location:', searchResult.contexts.keyHex.location);
    console.log('64 bytes before:');
    const before = searchResult.contexts.keyHex.before64;
    console.log(before.map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('As ASCII:', Buffer.from(before).toString('utf8').replace(/[^\x20-\x7E]/g, '.'));
  }
  
  if (searchResult.contexts.fpHash) {
    console.log('\n=== FP Hash Context ===');
    console.log('Location:', searchResult.contexts.fpHash.location);
    console.log('FP Hash bytes:');
    console.log(searchResult.contexts.fpHash.at64.slice(0, 32).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('32 bytes after FP Hash:');
    console.log(searchResult.contexts.fpHash.after64.slice(0, 32).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Check if the 32 bytes after FP hash are the key or XOR constant
    const after32 = Buffer.from(searchResult.contexts.fpHash.after64.slice(0, 32));
    if (after32.equals(keyBuf)) {
      console.log('*** KEY FOUND IMMEDIATELY AFTER FP HASH! ***');
    }
    if (after32.equals(xorConstant)) {
      console.log('*** XOR CONSTANT FOUND IMMEDIATELY AFTER FP HASH! ***');
    }
  }
  
  if (searchResult.contexts.xor) {
    console.log('\n=== XOR Constant Context ===');
    console.log('Location:', searchResult.contexts.xor.location);
    console.log('XOR constant bytes:');
    console.log(searchResult.contexts.xor.at64.slice(0, 32).map(b => b.toString(16).padStart(2, '0')).join(' '));
  }
}

memoryTraceV3().catch(console.error);
