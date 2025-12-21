/**
 * Trace the exact XOR operation in the WASM
 * Use Chrome DevTools Protocol to set breakpoints on XOR instructions
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceXorOperation() {
  const browser = await puppeteer.launch({
    headless: false, // Need visible browser for debugging
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  // Set up controlled environment
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
    
    // Intercept WebAssembly instantiation
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[WASM] Intercepted instantiate');
      
      // Wrap the imports to trace calls
      if (importObject && importObject.wbg) {
        const originalWbg = importObject.wbg;
        const wrappedWbg = {};
        
        for (const [key, value] of Object.entries(originalWbg)) {
          if (typeof value === 'function') {
            wrappedWbg[key] = function(...args) {
              // Log specific functions we're interested in
              if (key.includes('random') || key.includes('crypto')) {
                console.log(`[WASM Import] ${key}(${args.map(a => typeof a === 'number' ? a : typeof a).join(', ')})`);
              }
              return value.apply(this, args);
            };
          } else {
            wrappedWbg[key] = value;
          }
        }
        
        importObject.wbg = wrappedWbg;
      }
      
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      
      // Store reference to WASM instance
      window.__wasmInstance = result.instance || result;
      
      return result;
    };
  }, timestamp);
  
  // Enable CDP for debugging
  const client = await page.target().createCDPSession();
  await client.send('Debugger.enable');
  
  // Listen for WASM script parsing
  client.on('Debugger.scriptParsed', (params) => {
    if (params.url && params.url.includes('wasm')) {
      console.log('[CDP] WASM script parsed:', params.scriptId, params.url);
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and analyze
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    // Try to access WASM memory
    let memoryDump = null;
    if (window.__wasmInstance && window.__wasmInstance.exports && window.__wasmInstance.exports.memory) {
      const memory = window.__wasmInstance.exports.memory;
      const buffer = new Uint8Array(memory.buffer);
      
      // Search for the key in memory
      const keyBytes = [];
      for (let i = 0; i < key.length; i += 2) {
        keyBytes.push(parseInt(key.slice(i, i + 2), 16));
      }
      
      // Find key location
      for (let i = 0; i < buffer.length - 32; i++) {
        let found = true;
        for (let j = 0; j < 32; j++) {
          if (buffer[i + j] !== keyBytes[j]) {
            found = false;
            break;
          }
        }
        if (found) {
          // Dump surrounding memory
          const start = Math.max(0, i - 128);
          const end = Math.min(buffer.length, i + 160);
          memoryDump = {
            keyOffset: i,
            before: Array.from(buffer.slice(start, i)).map(b => b.toString(16).padStart(2, '0')).join(''),
            key: Array.from(buffer.slice(i, i + 32)).map(b => b.toString(16).padStart(2, '0')).join(''),
            after: Array.from(buffer.slice(i + 32, end)).map(b => b.toString(16).padStart(2, '0')).join(''),
          };
          break;
        }
      }
    }
    
    return {
      key,
      sessionId,
      memoryDump,
    };
  });
  
  console.log('\n=== XOR Operation Trace Results ===\n');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  
  if (result.memoryDump) {
    console.log('\n--- Memory Around Key ---');
    console.log('Key offset:', result.memoryDump.keyOffset);
    console.log('128 bytes before:', result.memoryDump.before);
    console.log('Key (32 bytes):', result.memoryDump.key);
    console.log('128 bytes after:', result.memoryDump.after);
    
    // Analyze the bytes before the key - might contain fpHash or XOR constant
    const beforeBytes = Buffer.from(result.memoryDump.before, 'hex');
    const keyBytes = Buffer.from(result.memoryDump.key, 'hex');
    
    // Check if any 32-byte sequence before the key XORed with key gives fpHash
    const fpString = '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';
    const fpHash = crypto.createHash('sha256').update(fpString).digest();
    
    console.log('\n--- Searching for XOR relationship in memory ---');
    console.log('Expected fpHash:', fpHash.toString('hex'));
    
    for (let offset = 0; offset <= beforeBytes.length - 32; offset++) {
      const candidate = beforeBytes.slice(offset, offset + 32);
      const xored = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        xored[i] = candidate[i] ^ keyBytes[i];
      }
      
      if (xored.equals(fpHash)) {
        console.log(`FOUND! XOR constant at offset ${offset} in 'before' region`);
        console.log('XOR constant:', candidate.toString('hex'));
        break;
      }
    }
  }
  
  // Compute expected values
  const fpString = '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  const keyBytes = Buffer.from(result.key, 'hex');
  const fpHashBytes = Buffer.from(fpHash, 'hex');
  const xorBytes = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBytes[i] = fpHashBytes[i] ^ keyBytes[i];
  }
  
  console.log('\n--- Computed Values ---');
  console.log('fpHash:', fpHash);
  console.log('key:', result.key);
  console.log('xorConstant:', xorBytes.toString('hex'));
  
  // Wait a bit before closing
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
  
  return result;
}

traceXorOperation().catch(console.error);
