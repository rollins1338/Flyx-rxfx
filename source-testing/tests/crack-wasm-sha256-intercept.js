/**
 * SHA256 Intercept - Capture the exact input to SHA256
 * 
 * Strategy: Hook the WASM memory operations during get_img_key()
 * to capture the exact bytes being hashed.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function interceptSHA256() {
  console.log('=== SHA256 Input Intercept ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[INTERCEPT]') || text.includes('[SHA256]')) {
      console.log(text);
    }
  });
  
  // Inject comprehensive WASM interception
  await page.evaluateOnNewDocument(() => {
    window.__sha256Inputs = [];
    window.__memorySnapshots = [];
    window.__stringWrites = [];
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      console.log('[INTERCEPT] Intercepting WASM instantiation');
      
      // First, get the original result
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      const memory = result.instance.exports.memory;
      const origGetImgKey = result.instance.exports.get_img_key;
      
      // Wrap get_img_key to capture memory state
      result.instance.exports.get_img_key = function(retptr) {
        console.log('[INTERCEPT] get_img_key called');
        
        // Take memory snapshot before
        const memBefore = new Uint8Array(memory.buffer.slice(0));
        
        // Call original
        const ret = origGetImgKey.apply(this, arguments);
        
        // Take memory snapshot after
        const memAfter = new Uint8Array(memory.buffer.slice(0));
        
        // Find all regions that changed
        const changes = [];
        let currentRegion = null;
        
        for (let i = 0; i < Math.min(memBefore.length, memAfter.length); i++) {
          if (memBefore[i] !== memAfter[i]) {
            if (!currentRegion || i > currentRegion.end + 100) {
              if (currentRegion) changes.push(currentRegion);
              currentRegion = { start: i, end: i, bytes: [] };
            }
            currentRegion.end = i;
            currentRegion.bytes.push({ offset: i, before: memBefore[i], after: memAfter[i] });
          }
        }
        if (currentRegion) changes.push(currentRegion);
        
        // Look for SHA256 hash values (32 bytes)
        // SHA256 initial values: 0x6a09e667, 0xbb67ae85, etc.
        const sha256InitH = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 
                            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        
        // Search for potential hash inputs (strings that look like fingerprint data)
        const potentialInputs = [];
        
        for (const region of changes) {
          if (region.bytes.length >= 32 && region.bytes.length <= 10000) {
            // Extract the "after" bytes
            const afterBytes = new Uint8Array(region.bytes.length);
            for (let i = 0; i < region.bytes.length; i++) {
              afterBytes[i] = region.bytes[i].after;
            }
            
            // Check if it looks like ASCII text
            let asciiCount = 0;
            for (const b of afterBytes) {
              if (b >= 32 && b < 127) asciiCount++;
            }
            
            if (asciiCount > afterBytes.length * 0.7) {
              // Mostly ASCII - could be the fingerprint string
              let str = '';
              for (const b of afterBytes) {
                str += String.fromCharCode(b);
              }
              potentialInputs.push({
                offset: region.start,
                length: afterBytes.length,
                preview: str.slice(0, 500),
                full: str,
              });
            }
          }
        }
        
        window.__memorySnapshots.push({
          changedRegions: changes.length,
          potentialInputs,
        });
        
        console.log(`[INTERCEPT] Found ${changes.length} changed regions`);
        console.log(`[INTERCEPT] Found ${potentialInputs.length} potential string inputs`);
        
        return ret;
      };
      
      return result;
    };
    
    // Also intercept string operations
    const origTextEncoder = TextEncoder.prototype.encode;
    TextEncoder.prototype.encode = function(str) {
      if (str && str.length > 50 && str.length < 10000) {
        window.__stringWrites.push({
          length: str.length,
          preview: str.slice(0, 200),
          full: str,
        });
        console.log(`[INTERCEPT] TextEncoder.encode: ${str.slice(0, 100)}...`);
      }
      return origTextEncoder.apply(this, arguments);
    };
    
    localStorage.clear();
  });
  
  console.log('Loading flixer.sh...\n');
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and all intercepted data
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    return {
      key,
      sessionId: localStorage.getItem('tmdb_session_id'),
      memorySnapshots: window.__memorySnapshots,
      stringWrites: window.__stringWrites,
      fingerprint: {
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await browser.close();
  
  console.log('\n=== Results ===\n');
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  console.log('\nFingerprint:');
  console.log(JSON.stringify(data.fingerprint, null, 2));
  
  console.log(`\nString writes intercepted: ${data.stringWrites.length}`);
  for (const sw of data.stringWrites) {
    console.log(`  [${sw.length}] ${sw.preview}...`);
  }
  
  console.log(`\nMemory snapshots: ${data.memorySnapshots.length}`);
  for (const snap of data.memorySnapshots) {
    console.log(`  Changed regions: ${snap.changedRegions}`);
    console.log(`  Potential inputs: ${snap.potentialInputs.length}`);
    
    for (const input of snap.potentialInputs) {
      console.log(`    [${input.offset}:${input.length}] ${input.preview.slice(0, 100)}...`);
      
      // Try to hash this and see if it matches the key
      const keyBuf = Buffer.from(data.key, 'hex');
      const hash = crypto.createHash('sha256').update(input.full).digest();
      
      if (hash.equals(keyBuf)) {
        console.log(`    *** SHA256 MATCH! ***`);
        console.log(`    Full input: ${input.full}`);
      }
    }
  }
  
  // Save data for analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/sha256-intercept.json',
    JSON.stringify(data, null, 2)
  );
  
  console.log('\nData saved to: source-testing/tests/wasm-analysis/sha256-intercept.json');
  
  // Now try a different approach - look at the exact memory layout
  console.log('\n=== Trying Memory Layout Analysis ===\n');
  
  await memoryLayoutAnalysis();
}

async function memoryLayoutAnalysis() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Inject to capture the exact fingerprint string being built
  await page.evaluateOnNewDocument(() => {
    window.__fpCapture = {
      canvasData: null,
      sessionId: null,
      allStrings: [],
    };
    
    // Intercept canvas toDataURL
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      window.__fpCapture.canvasData = result;
      console.log(`[FP] Canvas toDataURL: ${result.length} chars`);
      return result;
    };
    
    // Intercept localStorage
    const origGetItem = Storage.prototype.getItem;
    const origSetItem = Storage.prototype.setItem;
    
    Storage.prototype.getItem = function(key) {
      const result = origGetItem.call(this, key);
      if (key === 'tmdb_session_id') {
        window.__fpCapture.sessionId = result;
        console.log(`[FP] getItem(tmdb_session_id) = ${result}`);
      }
      return result;
    };
    
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tmdb_session_id') {
        window.__fpCapture.sessionId = value;
        console.log(`[FP] setItem(tmdb_session_id, ${value})`);
      }
      return origSetItem.call(this, key, value);
    };
    
    // Intercept WASM to capture all string operations
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      // Wrap string-related imports
      const wrappedImports = { wbg: {} };
      
      for (const [name, fn] of Object.entries(imports.wbg)) {
        if (typeof fn === 'function') {
          wrappedImports.wbg[name] = function(...args) {
            const result = fn.apply(this, args);
            
            // Log all function calls with their names
            if (name.includes('string') || name.includes('str') || 
                name.includes('get') || name.includes('set')) {
              // console.log(`[WASM] ${name}(${args.join(', ')}) = ${result}`);
            }
            
            return result;
          };
        } else {
          wrappedImports.wbg[name] = fn;
        }
      }
      
      const result = await origInstantiateStreaming.call(this, source, wrappedImports);
      
      // Store memory reference
      window.__wasmMem = result.instance.exports.memory;
      
      return result;
    };
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and captured data
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    // Read interesting memory regions
    const mem = new Uint8Array(window.__wasmMem.buffer);
    
    // Look for the session ID in memory
    const sessionId = window.__fpCapture.sessionId;
    const sessionBytes = new TextEncoder().encode(sessionId);
    
    // Find where session ID is stored
    let sessionOffset = -1;
    for (let i = 0; i < mem.length - sessionBytes.length; i++) {
      let match = true;
      for (let j = 0; j < sessionBytes.length; j++) {
        if (mem[i + j] !== sessionBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        sessionOffset = i;
        break;
      }
    }
    
    // Look for the canvas data in memory
    const canvasData = window.__fpCapture.canvasData;
    const canvasBase64 = canvasData?.split(',')[1] || '';
    
    // Find a unique part of canvas data
    const canvasSearch = canvasBase64.slice(0, 50);
    const canvasBytes = new TextEncoder().encode(canvasSearch);
    
    let canvasOffset = -1;
    for (let i = 0; i < mem.length - canvasBytes.length; i++) {
      let match = true;
      for (let j = 0; j < canvasBytes.length; j++) {
        if (mem[i + j] !== canvasBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        canvasOffset = i;
        break;
      }
    }
    
    // Read memory around these offsets
    const readRegion = (offset, before, after) => {
      if (offset < 0) return null;
      const start = Math.max(0, offset - before);
      const end = Math.min(mem.length, offset + after);
      const bytes = Array.from(mem.slice(start, end));
      const ascii = bytes.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
      return { start, end, ascii };
    };
    
    return {
      key,
      sessionId,
      canvasDataLength: canvasData?.length || 0,
      canvasBase64Length: canvasBase64.length,
      sessionOffset,
      canvasOffset,
      sessionRegion: readRegion(sessionOffset, 100, 200),
      canvasRegion: readRegion(canvasOffset, 50, 100),
      fingerprint: {
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await browser.close();
  
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  console.log(`Canvas base64 length: ${data.canvasBase64Length}`);
  
  console.log(`\nSession ID found at offset: ${data.sessionOffset}`);
  if (data.sessionRegion) {
    console.log(`  Region: ${data.sessionRegion.ascii}`);
  }
  
  console.log(`\nCanvas data found at offset: ${data.canvasOffset}`);
  if (data.canvasRegion) {
    console.log(`  Region: ${data.canvasRegion.ascii.slice(0, 100)}...`);
  }
  
  // Now let's try to find the format by looking at what's around the session ID
  console.log('\n=== Analyzing Memory Layout ===\n');
  
  // The key insight: the fingerprint string is built in memory before hashing
  // We need to find the complete string that gets hashed
  
  // Try various format combinations with the exact data
  const fp = data.fingerprint;
  const sid = data.sessionId;
  const keyBuf = Buffer.from(data.key, 'hex');
  
  // Based on the WAT analysis, the format uses 9 components
  // Let's try to figure out the exact order and separators
  
  console.log('Trying format combinations...\n');
  
  // The WASM likely uses Rust's format! macro
  // Common patterns: "{}.{}.{}" or "{}:{}:{}" or "{}|{}|{}"
  
  const separators = ['', ':', '|', '.', '-', '_', '\n', '\t', ',', ';'];
  const components = [
    fp.screenWidth.toString(),
    fp.screenHeight.toString(),
    fp.colorDepth.toString(),
    fp.userAgent,
    fp.platform,
    fp.language,
    fp.timezone.toString(),
    sid,
  ];
  
  // Try all permutations of 8 components with different separators
  // This is too many, so let's be smarter
  
  // Based on the trace, the order seems to be:
  // 1. Screen properties (width, height, colorDepth)
  // 2. Navigator properties (userAgent, platform, language)
  // 3. Timezone
  // 4. Session ID
  // 5. Canvas data (but we don't have the exact canvas data here)
  
  // Let's try the most likely formats
  const likelyFormats = [
    // Without canvas (maybe canvas is hashed separately)
    components.join(':'),
    components.join('|'),
    components.join('.'),
    components.join(''),
    
    // Different orders
    [sid, ...components.slice(0, -1)].join(':'),
    [fp.screenWidth, fp.screenHeight, fp.colorDepth, fp.timezone, sid].join(':'),
    
    // With just the key components
    `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}:${sid}`,
    `${sid}:${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}`,
  ];
  
  for (const format of likelyFormats) {
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH: ${format.slice(0, 100)}... ***`);
    }
  }
  
  console.log('\nNo direct match found. The canvas data is likely part of the hash input.');
  console.log('Need to capture the exact canvas data from the WASM context.');
}

interceptSHA256().catch(console.error);
