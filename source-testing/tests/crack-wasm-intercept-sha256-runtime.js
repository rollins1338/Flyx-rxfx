/**
 * Intercept SHA256 inputs at runtime by hooking the WASM memory
 * We'll trace what data is being hashed
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptSHA256() {
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
    
    // Store all hash inputs we find
    window.__hashInputs = [];
    window.__memorySnapshots = [];
    
    // Hook WebAssembly.instantiate to intercept the module
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[WASM] Intercepting instantiate');
      
      const result = await origInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      const memory = instance.exports.memory;
      
      // Store reference to memory
      window.__wasmMemory = memory;
      
      // Wrap get_img_key to capture memory before and after
      if (instance.exports.get_img_key) {
        const origGetImgKey = instance.exports.get_img_key;
        instance.exports.get_img_key = function(...args) {
          console.log('[WASM] get_img_key called');
          
          // Take memory snapshot before
          const memBefore = new Uint8Array(memory.buffer.slice(0, 65536));
          
          const result = origGetImgKey.apply(this, args);
          
          // Take memory snapshot after
          const memAfter = new Uint8Array(memory.buffer.slice(0, 65536));
          
          // Find differences
          const diffs = [];
          for (let i = 0; i < memBefore.length; i++) {
            if (memBefore[i] !== memAfter[i]) {
              diffs.push({ offset: i, before: memBefore[i], after: memAfter[i] });
            }
          }
          
          // Look for SHA256 initial values in memory (H0-H7)
          // H0 = 0x6a09e667
          const h0Pattern = [0x67, 0xe6, 0x09, 0x6a]; // little-endian
          for (let i = 0; i < memAfter.length - 4; i++) {
            if (memAfter[i] === h0Pattern[0] && 
                memAfter[i+1] === h0Pattern[1] && 
                memAfter[i+2] === h0Pattern[2] && 
                memAfter[i+3] === h0Pattern[3]) {
              console.log('[WASM] Found SHA256 H0 at offset:', i);
            }
          }
          
          // Store some memory regions that might contain hash inputs
          window.__memorySnapshots.push({
            // Stack area (typically at high addresses in WASM)
            stack: Array.from(memAfter.slice(1048000, 1048576)),
            // Data section area
            data: Array.from(memAfter.slice(1050000, 1052000)),
          });
          
          console.log('[WASM] Memory diffs:', diffs.length);
          
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
  
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    // Try to read memory around where hash inputs might be
    let memoryData = null;
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      
      // Look for the fingerprint string in memory
      const fpStart = '24:Mozilla';
      const fpBytes = new TextEncoder().encode(fpStart);
      
      for (let i = 0; i < mem.length - fpBytes.length; i++) {
        let match = true;
        for (let j = 0; j < fpBytes.length; j++) {
          if (mem[i + j] !== fpBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          console.log('Found fingerprint at offset:', i);
          // Read 200 bytes from this location
          const fpData = Array.from(mem.slice(i, i + 200));
          memoryData = { fpOffset: i, fpData };
          break;
        }
      }
    }
    
    return {
      key,
      sessionId,
      memoryData,
      snapshots: window.__memorySnapshots,
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
  
  console.log('=== Results ===');
  console.log('WASM Key:', result.key);
  console.log('Session ID:', result.sessionId);
  
  if (result.memoryData) {
    console.log('\nFingerprint found at offset:', result.memoryData.fpOffset);
    const fpString = Buffer.from(result.memoryData.fpData).toString('utf8');
    console.log('Fingerprint data:', fpString.slice(0, 150));
  }
  
  // Build expected fingerprint
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  
  // We need to get the canvas data - let's compute what we expect
  console.log('\n=== Expected Fingerprint ===');
  console.log('colorDepth:', fp.colorDepth);
  console.log('userAgent (50):', fp.userAgent.slice(0, 50));
  console.log('platform:', fp.platform);
  console.log('language:', fp.language);
  console.log('timezone:', fp.timezone);
  console.log('timestamp:', ts);
  
  // Calculate hash
  // We need the canvas data to complete this
}

interceptSHA256().catch(console.error);
