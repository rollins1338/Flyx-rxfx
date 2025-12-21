/**
 * Deep Trace Key Derivation with Puppeteer
 * 
 * Intercept EVERY piece of data that goes into the key derivation
 * by wrapping all WASM imports and tracking memory operations.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function deepTrace() {
  console.log('=== Deep Trace Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Enable console logging from page
  page.on('console', msg => {
    if (msg.text().includes('[TRACE]')) {
      console.log(msg.text());
    }
  });
  
  // Inject comprehensive tracing
  await page.evaluateOnNewDocument(() => {
    window.__trace = {
      imports: [],
      strings: [],
      canvasOps: [],
      storageOps: [],
      randomValues: [],
      memoryWrites: [],
      fingerprintData: {},
    };
    
    // Intercept WebAssembly.instantiateStreaming
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      console.log('[TRACE] Intercepting WASM instantiation');
      
      // Wrap ALL imports to trace them
      const wrappedImports = { wbg: {} };
      
      for (const [name, fn] of Object.entries(imports.wbg)) {
        if (typeof fn === 'function') {
          wrappedImports.wbg[name] = function(...args) {
            const result = fn.apply(this, args);
            
            // Track specific imports
            if (name.includes('random')) {
              window.__trace.randomValues.push(result);
              console.log(`[TRACE] Math.random() = ${result}`);
            }
            
            if (name.includes('colorDepth')) {
              window.__trace.fingerprintData.colorDepth = result;
              console.log(`[TRACE] colorDepth = ${result}`);
            }
            
            if (name.includes('width') && !name.includes('set')) {
              window.__trace.fingerprintData.screenWidth = result;
              console.log(`[TRACE] screen.width = ${result}`);
            }
            
            if (name.includes('height') && !name.includes('set')) {
              window.__trace.fingerprintData.screenHeight = result;
              console.log(`[TRACE] screen.height = ${result}`);
            }
            
            if (name.includes('Timezone')) {
              window.__trace.fingerprintData.timezone = result;
              console.log(`[TRACE] timezone = ${result}`);
            }
            
            if (name.includes('userAgent')) {
              console.log(`[TRACE] userAgent accessed`);
            }
            
            if (name.includes('platform')) {
              console.log(`[TRACE] platform accessed`);
            }
            
            if (name.includes('language')) {
              console.log(`[TRACE] language accessed`);
            }
            
            if (name.includes('getItem')) {
              console.log(`[TRACE] localStorage.getItem called`);
            }
            
            if (name.includes('setItem')) {
              console.log(`[TRACE] localStorage.setItem called`);
            }
            
            if (name.includes('fillText')) {
              console.log(`[TRACE] canvas.fillText called`);
            }
            
            if (name.includes('toDataURL')) {
              console.log(`[TRACE] canvas.toDataURL called`);
            }
            
            if (name.includes('string_new')) {
              // This is called when WASM creates a new string
              // The args are (ptr, len) pointing to memory
              window.__trace.strings.push({ ptr: args[0], len: args[1] });
            }
            
            return result;
          };
        } else {
          wrappedImports.wbg[name] = fn;
        }
      }
      
      const result = await origInstantiateStreaming.call(this, source, wrappedImports);
      
      // Store memory reference
      window.__wasmMemory = result.instance.exports.memory;
      window.__wasmExports = result.instance.exports;
      
      console.log('[TRACE] WASM instantiated, memory size:', window.__wasmMemory.buffer.byteLength);
      
      return result;
    };
    
    // Intercept canvas operations
    const origFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
      window.__trace.canvasOps.push({ type: 'fillText', text, x, y, font: this.font });
      console.log(`[TRACE] fillText("${text}", ${x}, ${y}) font="${this.font}"`);
      return origFillText.apply(this, arguments);
    };
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      window.__trace.canvasOps.push({ type: 'toDataURL', result });
      window.__trace.fingerprintData.canvasData = result;
      console.log(`[TRACE] toDataURL() length=${result.length}`);
      return result;
    };
    
    // Intercept localStorage
    const origGetItem = Storage.prototype.getItem;
    const origSetItem = Storage.prototype.setItem;
    
    Storage.prototype.getItem = function(key) {
      const result = origGetItem.call(this, key);
      if (key === 'tmdb_session_id') {
        window.__trace.storageOps.push({ type: 'get', key, value: result });
        window.__trace.fingerprintData.sessionId = result;
        console.log(`[TRACE] getItem("${key}") = ${result}`);
      }
      return result;
    };
    
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tmdb_session_id') {
        window.__trace.storageOps.push({ type: 'set', key, value });
        window.__trace.fingerprintData.sessionId = value;
        console.log(`[TRACE] setItem("${key}", "${value}")`);
      }
      return origSetItem.call(this, key, value);
    };
    
    // Clear localStorage to force new session
    localStorage.clear();
  });
  
  console.log('Loading flixer.sh...\n');
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  console.log('\n=== Collecting Fingerprint Data ===\n');
  
  // Get all the trace data
  const traceData = await page.evaluate(() => {
    // Read strings from WASM memory
    const readStrings = [];
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      for (const s of window.__trace.strings) {
        let str = '';
        for (let i = 0; i < Math.min(s.len, 500); i++) {
          const byte = mem[s.ptr + i];
          if (byte >= 32 && byte < 127) {
            str += String.fromCharCode(byte);
          } else if (byte === 0) {
            break;
          } else {
            str += '.';
          }
        }
        if (str.length > 5) {
          readStrings.push({ ptr: s.ptr, len: s.len, str: str.slice(0, 200) });
        }
      }
    }
    
    return {
      embeddedKey: window.wasmImgData.get_img_key(),
      trace: window.__trace,
      readStrings,
      navigator: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
    };
  });
  
  console.log(`Embedded key: ${traceData.embeddedKey}`);
  console.log(`Session ID: ${traceData.trace.fingerprintData.sessionId}`);
  
  console.log('\nFingerprint data collected:');
  console.log(JSON.stringify(traceData.trace.fingerprintData, null, 2));
  
  console.log('\nCanvas operations:');
  for (const op of traceData.trace.canvasOps) {
    if (op.type === 'fillText') {
      console.log(`  fillText("${op.text}", ${op.x}, ${op.y}) font="${op.font}"`);
    } else {
      console.log(`  ${op.type}: length=${op.result?.length || 0}`);
    }
  }
  
  console.log(`\nRandom values: ${traceData.trace.randomValues.length}`);
  if (traceData.trace.randomValues.length > 0) {
    console.log(`  Last: ${traceData.trace.randomValues[traceData.trace.randomValues.length - 1]}`);
  }
  
  console.log(`\nStrings created in WASM: ${traceData.readStrings.length}`);
  for (const s of traceData.readStrings.slice(0, 20)) {
    console.log(`  [${s.ptr}:${s.len}] ${s.str}`);
  }
  
  // Now try to derive the key using the collected data
  console.log('\n=== Key Derivation Analysis ===\n');
  
  const fp = traceData.trace.fingerprintData;
  const nav = traceData.navigator;
  const embeddedKeyBuf = Buffer.from(traceData.embeddedKey, 'hex');
  
  // The fingerprint string format based on the trace
  // Canvas draws: "TMDB Image Enhancement 🎬" and "Processing capabilities test"
  // Then gets toDataURL()
  
  // Build the fingerprint string in the order observed
  const canvasData = fp.canvasData;
  const canvasBase64 = canvasData?.split(',')[1] || '';
  const sessionId = fp.sessionId;
  
  // The format string likely combines these in a specific way
  // Based on the WAT analysis, it uses format specifiers
  
  // Try the exact format from the WASM analysis
  // The WASM builds a string with 9 components (from the WAT: i32.const 9 multiple times)
  
  const components = [
    fp.screenWidth?.toString() || '800',
    fp.screenHeight?.toString() || '600',
    fp.colorDepth?.toString() || '24',
    nav.userAgent,
    nav.platform,
    nav.language,
    fp.timezone?.toString() || '0',
    sessionId,
    canvasBase64,
  ];
  
  console.log('Fingerprint components:');
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    console.log(`  ${i}: ${comp?.slice(0, 50)}${comp?.length > 50 ? '...' : ''}`);
  }
  
  // Try various format combinations
  const formatAttempts = [
    // Simple concatenation
    components.join(''),
    components.join(':'),
    components.join('|'),
    components.join('.'),
    components.join('\n'),
    
    // Different orders
    [canvasBase64, sessionId, ...components.slice(0, 7)].join(''),
    [sessionId, canvasBase64, ...components.slice(0, 7)].join(''),
    
    // Just canvas + session
    `${canvasBase64}${sessionId}`,
    `${sessionId}${canvasBase64}`,
    `${canvasData}${sessionId}`,
    `${sessionId}${canvasData}`,
    
    // With specific separators
    `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}:${sessionId}:${canvasBase64}`,
    `${canvasBase64}:${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}:${sessionId}`,
  ];
  
  console.log('\nTrying SHA256 with various formats...');
  
  for (const format of formatAttempts) {
    if (!format) continue;
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`\n*** MATCH FOUND! ***`);
      console.log(`Format: ${format.slice(0, 100)}...`);
      break;
    }
  }
  
  // Try with the exact canvas text
  const canvasText1 = 'TMDB Image Enhancement 🎬';
  const canvasText2 = 'Processing capabilities test';
  
  const textAttempts = [
    `${canvasText1}${canvasText2}${sessionId}`,
    `${sessionId}${canvasText1}${canvasText2}`,
    `${canvasText1}:${canvasText2}:${sessionId}`,
  ];
  
  console.log('\nTrying with canvas text...');
  for (const format of textAttempts) {
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: ${format} ***`);
    }
  }
  
  await browser.close();
  
  // Save trace data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/deep-trace.json',
    JSON.stringify(traceData, null, 2)
  );
  
  console.log('\nTrace data saved to: source-testing/tests/wasm-analysis/deep-trace.json');
  
  // Now let's try a different approach - capture the exact bytes being hashed
  console.log('\n=== Attempting Memory-Level Analysis ===\n');
  
  await memoryLevelAnalysis();
}

async function memoryLevelAnalysis() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Inject memory tracing
  await page.evaluateOnNewDocument(() => {
    window.__memTrace = {
      beforeKey: null,
      afterKey: null,
      keyRegions: [],
    };
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      window.__wasmMemory = result.instance.exports.memory;
      
      // Wrap get_img_key to capture memory state
      const origGetImgKey = result.instance.exports.get_img_key;
      result.instance.exports.get_img_key = function(retptr) {
        // Snapshot memory before
        const memBefore = new Uint8Array(window.__wasmMemory.buffer.slice(0, 200000));
        window.__memTrace.beforeKey = memBefore;
        
        // Call original
        const ret = origGetImgKey.apply(this, arguments);
        
        // Snapshot memory after
        const memAfter = new Uint8Array(window.__wasmMemory.buffer.slice(0, 200000));
        window.__memTrace.afterKey = memAfter;
        
        // Find regions that changed and look like hash inputs/outputs
        const changes = [];
        for (let i = 0; i < memBefore.length; i++) {
          if (memBefore[i] !== memAfter[i]) {
            changes.push(i);
          }
        }
        
        // Group consecutive changes
        const groups = [];
        let start = changes[0];
        let end = changes[0];
        
        for (let i = 1; i < changes.length; i++) {
          if (changes[i] === end + 1) {
            end = changes[i];
          } else {
            if (end - start >= 31) { // At least 32 bytes
              groups.push({ start, end: end + 1, length: end - start + 1 });
            }
            start = changes[i];
            end = changes[i];
          }
        }
        if (end - start >= 31) {
          groups.push({ start, end: end + 1, length: end - start + 1 });
        }
        
        window.__memTrace.keyRegions = groups;
        
        return ret;
      };
      
      return result;
    };
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const memData = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    // Extract data from key regions
    const regions = [];
    const memAfter = window.__memTrace.afterKey;
    
    for (const region of window.__memTrace.keyRegions) {
      const bytes = Array.from(memAfter.slice(region.start, region.end));
      const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      const ascii = bytes.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
      
      regions.push({
        start: region.start,
        length: region.length,
        hex: hex.slice(0, 128),
        ascii: ascii.slice(0, 64),
        isKey: hex.slice(0, 64) === key,
      });
    }
    
    return {
      key,
      sessionId: localStorage.getItem('tmdb_session_id'),
      regionsCount: window.__memTrace.keyRegions.length,
      regions: regions.slice(0, 30),
    };
  });
  
  await browser.close();
  
  console.log(`Key: ${memData.key}`);
  console.log(`Session ID: ${memData.sessionId}`);
  console.log(`Memory regions changed: ${memData.regionsCount}`);
  
  console.log('\nLarge memory regions (potential hash inputs/outputs):');
  for (const region of memData.regions) {
    const marker = region.isKey ? ' *** KEY ***' : '';
    console.log(`  ${region.start}: ${region.length} bytes${marker}`);
    console.log(`    Hex: ${region.hex}...`);
    console.log(`    ASCII: ${region.ascii}`);
  }
  
  // Look for the key in the regions
  const keyRegion = memData.regions.find(r => r.isKey);
  if (keyRegion) {
    console.log(`\nKey found at memory offset: ${keyRegion.start}`);
  }
}

deepTrace().catch(console.error);
