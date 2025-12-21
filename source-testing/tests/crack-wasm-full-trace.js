/**
 * Full WASM Trace - Instrument every import to understand key derivation
 * 
 * This script intercepts ALL WASM imports to trace exactly how the key is derived
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function fullWasmTrace() {
  console.log('=== Full WASM Trace ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM instantiation to wrap all imports
  await page.evaluateOnNewDocument(() => {
    window.__wasmTrace = {
      calls: [],
      fingerprint: {},
      randomValues: [],
      canvasData: null,
      sessionId: null,
    };
    
    // Store original WebAssembly.instantiate
    const origInstantiate = WebAssembly.instantiate;
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    function wrapImports(imports) {
      if (!imports || !imports.wbg) return imports;
      
      const wrapped = { ...imports };
      wrapped.wbg = {};
      
      for (const [name, fn] of Object.entries(imports.wbg)) {
        if (typeof fn === 'function') {
          wrapped.wbg[name] = function(...args) {
            const result = fn.apply(this, args);
            
            // Log interesting calls
            const entry = { name, args: args.slice(0, 3), result };
            
            // Track specific fingerprint-related calls
            if (name.includes('random')) {
              window.__wasmTrace.randomValues.push(result);
              entry.type = 'random';
            }
            if (name.includes('colorDepth')) {
              window.__wasmTrace.fingerprint.colorDepth = result;
              entry.type = 'fingerprint';
            }
            if (name.includes('width') && !name.includes('set')) {
              window.__wasmTrace.fingerprint.screenWidth = result;
              entry.type = 'fingerprint';
            }
            if (name.includes('height') && !name.includes('set')) {
              window.__wasmTrace.fingerprint.screenHeight = result;
              entry.type = 'fingerprint';
            }
            if (name.includes('Timezone')) {
              window.__wasmTrace.fingerprint.timezone = result;
              entry.type = 'fingerprint';
            }
            if (name.includes('toDataURL')) {
              entry.type = 'canvas';
            }
            if (name.includes('getItem') || name.includes('setItem')) {
              entry.type = 'storage';
            }
            if (name.includes('userAgent')) {
              entry.type = 'fingerprint';
            }
            if (name.includes('platform')) {
              entry.type = 'fingerprint';
            }
            if (name.includes('language')) {
              entry.type = 'fingerprint';
            }
            if (name.includes('fillText')) {
              entry.type = 'canvas';
            }
            if (name.includes('setfont')) {
              entry.type = 'canvas';
            }
            
            window.__wasmTrace.calls.push(entry);
            return result;
          };
        } else {
          wrapped.wbg[name] = fn;
        }
      }
      
      return wrapped;
    }
    
    WebAssembly.instantiate = async function(module, imports) {
      console.log('[WASM Trace] Intercepting WebAssembly.instantiate');
      const wrappedImports = wrapImports(imports);
      return origInstantiate.call(this, module, wrappedImports);
    };
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      console.log('[WASM Trace] Intercepting WebAssembly.instantiateStreaming');
      const wrappedImports = wrapImports(imports);
      return origInstantiateStreaming.call(this, source, wrappedImports);
    };
    
    // Also intercept canvas toDataURL
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const result = origToDataURL.apply(this, args);
      window.__wasmTrace.canvasData = result;
      console.log('[Canvas] toDataURL called, length:', result.length);
      return result;
    };
    
    // Intercept localStorage
    const origGetItem = Storage.prototype.getItem;
    const origSetItem = Storage.prototype.setItem;
    
    Storage.prototype.getItem = function(key) {
      const result = origGetItem.call(this, key);
      if (key === 'tmdb_session_id') {
        window.__wasmTrace.sessionId = result;
        console.log('[Storage] getItem tmdb_session_id:', result);
      }
      return result;
    };
    
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tmdb_session_id') {
        window.__wasmTrace.sessionId = value;
        console.log('[Storage] setItem tmdb_session_id:', value);
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
  
  // Wait for WASM to be ready
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and trace data
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    // Filter trace to interesting calls
    const interestingCalls = window.__wasmTrace.calls.filter(c => 
      c.type || c.name.includes('string') || c.name.includes('call')
    );
    
    return {
      embeddedKey: key,
      trace: window.__wasmTrace,
      interestingCalls: interestingCalls.slice(0, 100),
      totalCalls: window.__wasmTrace.calls.length,
    };
  });
  
  await browser.close();
  
  console.log(`Embedded key: ${result.embeddedKey}\n`);
  console.log(`Total WASM calls: ${result.totalCalls}\n`);
  
  console.log('=== Fingerprint Data ===\n');
  console.log(JSON.stringify(result.trace.fingerprint, null, 2));
  
  console.log('\n=== Session ID ===\n');
  console.log(result.trace.sessionId);
  
  console.log('\n=== Canvas Data ===\n');
  if (result.trace.canvasData) {
    console.log(`Length: ${result.trace.canvasData.length}`);
    console.log(`First 100 chars: ${result.trace.canvasData.slice(0, 100)}`);
  }
  
  console.log('\n=== Random Values ===\n');
  console.log(`Count: ${result.trace.randomValues.length}`);
  console.log(`First 10: ${result.trace.randomValues.slice(0, 10).join(', ')}`);
  
  console.log('\n=== Interesting Calls (first 50) ===\n');
  for (const call of result.interestingCalls.slice(0, 50)) {
    const argsStr = call.args ? call.args.map(a => typeof a === 'number' ? a : '...').join(', ') : '';
    console.log(`  ${call.name}(${argsStr}) ${call.type ? `[${call.type}]` : ''}`);
  }
  
  // Now try to derive the key
  console.log('\n=== Key Derivation Attempts ===\n');
  
  const fp = result.trace.fingerprint;
  const sessionId = result.trace.sessionId;
  const canvasData = result.trace.canvasData;
  const embeddedKeyBuf = Buffer.from(result.embeddedKey, 'hex');
  
  // The WASM collects:
  // 1. Screen dimensions (width, height, colorDepth)
  // 2. Navigator (userAgent, platform, language)
  // 3. Timezone offset
  // 4. Canvas fingerprint (draws "TMDB Image Enhancement" text)
  // 5. Session ID from localStorage (or generates new one)
  // 6. Math.random() values
  
  // Try various combinations
  const attempts = [];
  
  // Attempt 1: Simple concatenation
  if (canvasData && sessionId) {
    const combo1 = `${canvasData}:${sessionId}`;
    const hash1 = crypto.createHash('sha256').update(combo1).digest();
    attempts.push({ name: 'canvas:sessionId', match: hash1.equals(embeddedKeyBuf) });
    
    const combo2 = `${sessionId}:${canvasData}`;
    const hash2 = crypto.createHash('sha256').update(combo2).digest();
    attempts.push({ name: 'sessionId:canvas', match: hash2.equals(embeddedKeyBuf) });
  }
  
  // Attempt 2: Just canvas
  if (canvasData) {
    const hash = crypto.createHash('sha256').update(canvasData).digest();
    attempts.push({ name: 'SHA256(canvas)', match: hash.equals(embeddedKeyBuf) });
    
    // Just the base64 part
    const base64Part = canvasData.split(',')[1];
    if (base64Part) {
      const hash2 = crypto.createHash('sha256').update(base64Part).digest();
      attempts.push({ name: 'SHA256(canvas_base64)', match: hash2.equals(embeddedKeyBuf) });
    }
  }
  
  // Attempt 3: Just session ID
  if (sessionId) {
    const hash = crypto.createHash('sha256').update(sessionId).digest();
    attempts.push({ name: 'SHA256(sessionId)', match: hash.equals(embeddedKeyBuf) });
  }
  
  // Attempt 4: Fingerprint string
  const fpString = `${fp.screenWidth}x${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}`;
  const fpHash = crypto.createHash('sha256').update(fpString).digest();
  attempts.push({ name: 'SHA256(fpString)', match: fpHash.equals(embeddedKeyBuf) });
  
  // Attempt 5: Canvas + fingerprint
  if (canvasData) {
    const combo = `${canvasData}:${fpString}`;
    const hash = crypto.createHash('sha256').update(combo).digest();
    attempts.push({ name: 'SHA256(canvas:fp)', match: hash.equals(embeddedKeyBuf) });
  }
  
  // Attempt 6: Session + fingerprint
  if (sessionId) {
    const combo = `${sessionId}:${fpString}`;
    const hash = crypto.createHash('sha256').update(combo).digest();
    attempts.push({ name: 'SHA256(session:fp)', match: hash.equals(embeddedKeyBuf) });
  }
  
  // Attempt 7: All combined
  if (canvasData && sessionId) {
    const combo = `${canvasData}:${sessionId}:${fpString}`;
    const hash = crypto.createHash('sha256').update(combo).digest();
    attempts.push({ name: 'SHA256(canvas:session:fp)', match: hash.equals(embeddedKeyBuf) });
  }
  
  for (const attempt of attempts) {
    console.log(`  ${attempt.name}: ${attempt.match ? '*** MATCH! ***' : 'no match'}`);
  }
  
  // Save full trace for analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/full-trace.json',
    JSON.stringify(result, null, 2)
  );
  console.log('\nFull trace saved to: source-testing/tests/wasm-analysis/full-trace.json');
}

fullWasmTrace().catch(console.error);
