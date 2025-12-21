/**
 * Verify the fingerprint string format by capturing all the components
 * and computing SHA256 to see if we get the expected fpHash
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function verifyFingerprint() {
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
    
    window.__captured = {};
    
    // Capture all fingerprint components
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      if (importObject && importObject.wbg) {
        const wbg = importObject.wbg;
        
        // Capture colorDepth
        const origColorDepth = wbg.__wbg_colorDepth_59677c81c61d599a;
        wbg.__wbg_colorDepth_59677c81c61d599a = function(...args) {
          const ret = origColorDepth.apply(this, args);
          window.__captured.colorDepth = ret;
          return ret;
        };
        
        // Capture userAgent
        const origUserAgent = wbg.__wbg_userAgent_12e9d8e62297563f;
        wbg.__wbg_userAgent_12e9d8e62297563f = function(ptr, obj) {
          origUserAgent.call(this, ptr, obj);
          // Read the string from memory after the call
          setTimeout(() => {
            if (window.__wasmMemory) {
              const mem = new Uint8Array(window.__wasmMemory.buffer);
              // The ptr points to where the string info is stored
              const strPtr = mem[ptr] | (mem[ptr+1] << 8) | (mem[ptr+2] << 16) | (mem[ptr+3] << 24);
              const strLen = mem[ptr+4] | (mem[ptr+5] << 8) | (mem[ptr+6] << 16) | (mem[ptr+7] << 24);
              if (strPtr > 0 && strLen > 0 && strLen < 1000) {
                const bytes = mem.slice(strPtr, strPtr + strLen);
                window.__captured.userAgent = new TextDecoder().decode(bytes);
              }
            }
          }, 0);
        };
        
        // Capture platform
        const origPlatform = wbg.__wbg_platform_faf02c487289f206;
        wbg.__wbg_platform_faf02c487289f206 = function(ptr, obj) {
          origPlatform.call(this, ptr, obj);
        };
        
        // Capture language
        const origLanguage = wbg.__wbg_language_d871ec78ee8eec62;
        wbg.__wbg_language_d871ec78ee8eec62 = function(ptr, obj) {
          origLanguage.call(this, ptr, obj);
        };
        
        // Capture timezone
        const origTimezone = wbg.__wbg_getTimezoneOffset_6b5752021c499c47;
        wbg.__wbg_getTimezoneOffset_6b5752021c499c47 = function(...args) {
          const ret = origTimezone.apply(this, args);
          window.__captured.timezone = ret;
          return ret;
        };
        
        // Capture canvas toDataURL
        const origToDataURL = wbg.__wbg_toDataURL_eaec332e848fe935;
        let toDataURLCount = 0;
        wbg.__wbg_toDataURL_eaec332e848fe935 = function(ptr, canvas) {
          toDataURLCount++;
          origToDataURL.call(this, ptr, canvas);
          
          // Read the result from memory
          setTimeout(() => {
            if (window.__wasmMemory && toDataURLCount === 1) {
              const mem = new Uint8Array(window.__wasmMemory.buffer);
              const strPtr = mem[ptr] | (mem[ptr+1] << 8) | (mem[ptr+2] << 16) | (mem[ptr+3] << 24);
              const strLen = mem[ptr+4] | (mem[ptr+5] << 8) | (mem[ptr+6] << 16) | (mem[ptr+7] << 24);
              if (strPtr > 0 && strLen > 0 && strLen < 10000) {
                const bytes = mem.slice(strPtr, strPtr + strLen);
                window.__captured.canvasDataURL = new TextDecoder().decode(bytes);
              }
            }
          }, 0);
        };
        
        // Capture session ID from getItem
        const origGetItem = wbg.__wbg_getItem_17f98dee3b43fa7e;
        wbg.__wbg_getItem_17f98dee3b43fa7e = function(ptr, storage, keyPtr, keyLen) {
          origGetItem.call(this, ptr, storage, keyPtr, keyLen);
        };
        
        // Capture session ID from setItem
        const origSetItem = wbg.__wbg_setItem_212ecc915942ab0a;
        wbg.__wbg_setItem_212ecc915942ab0a = function(storage, keyPtr, keyLen, valPtr, valLen) {
          // Read the value being set
          if (window.__wasmMemory) {
            const mem = new Uint8Array(window.__wasmMemory.buffer);
            const keyBytes = mem.slice(keyPtr, keyPtr + keyLen);
            const valBytes = mem.slice(valPtr, valPtr + valLen);
            const key = new TextDecoder().decode(keyBytes);
            const val = new TextDecoder().decode(valBytes);
            if (key === 'tmdb_session_id') {
              window.__captured.sessionId = val;
            }
          }
          origSetItem.call(this, storage, keyPtr, keyLen, valPtr, valLen);
        };
      }
      
      const result = await origInstantiateStreaming.call(this, source, importObject);
      window.__wasmMemory = result.instance.exports.memory;
      return result;
    };
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Wait a bit for all captures
  await new Promise(r => setTimeout(r, 1000));
  
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    return {
      key,
      captured: window.__captured,
      navigator: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
      screen: {
        colorDepth: screen.colorDepth,
        width: screen.width,
        height: screen.height,
      },
    };
  });
  
  await browser.close();
  
  console.log('=== Captured Fingerprint Components ===');
  console.log('Key:', result.key);
  console.log('\nCaptured:');
  console.log('  colorDepth:', result.captured.colorDepth);
  console.log('  timezone:', result.captured.timezone);
  console.log('  sessionId:', result.captured.sessionId);
  console.log('  userAgent:', result.captured.userAgent?.slice(0, 60) + '...');
  console.log('  canvasDataURL length:', result.captured.canvasDataURL?.length);
  
  console.log('\nNavigator:');
  console.log('  userAgent:', result.navigator.userAgent.slice(0, 60) + '...');
  console.log('  platform:', result.navigator.platform);
  console.log('  language:', result.navigator.language);
  
  console.log('\nScreen:');
  console.log('  colorDepth:', result.screen.colorDepth);
  
  // Try to construct the fingerprint string
  const colorDepth = result.captured.colorDepth || result.screen.colorDepth;
  const userAgent = result.navigator.userAgent.slice(0, 50);
  const platform = result.navigator.platform;
  const language = result.navigator.language;
  const timezone = result.captured.timezone || 0;
  const sessionId = result.captured.sessionId || `${timestamp}.5000000`;
  const timestampPart = sessionId.split('.')[0];
  
  // Get canvas base64 (skip the data:image/png;base64, prefix)
  let canvasBase64 = '';
  if (result.captured.canvasDataURL) {
    const prefix = 'data:image/png;base64,';
    if (result.captured.canvasDataURL.startsWith(prefix)) {
      canvasBase64 = result.captured.canvasDataURL.slice(prefix.length, prefix.length + 50);
    }
  }
  
  console.log('\n=== Fingerprint String Construction ===');
  console.log('colorDepth:', colorDepth);
  console.log('userAgent (50):', userAgent);
  console.log('platform:', platform);
  console.log('language:', language);
  console.log('timezone:', timezone);
  console.log('timestamp:', timestampPart);
  console.log('canvasBase64 (50):', canvasBase64);
  
  // Try different fingerprint formats
  const formats = [
    `${colorDepth}:${userAgent}:${platform}:${language}:${timezone}:${timestampPart}:${canvasBase64}`,
    `${colorDepth}:${userAgent}:${platform}:${language}:${Math.floor(timezone)}:${timestampPart}:${canvasBase64}`,
    `${colorDepth}:${userAgent}:${platform}:${language}:${-timezone}:${timestampPart}:${canvasBase64}`,
  ];
  
  console.log('\n=== SHA256 Tests ===');
  const expectedFpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
  const expectedKey = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
  
  for (const fp of formats) {
    const hash = crypto.createHash('sha256').update(fp).digest('hex');
    console.log(`\nFingerprint: ${fp.slice(0, 80)}...`);
    console.log(`SHA256: ${hash}`);
    console.log(`Match fpHash: ${hash === expectedFpHash}`);
    
    if (hash === expectedFpHash) {
      console.log('*** FINGERPRINT FORMAT CONFIRMED! ***');
    }
  }
  
  // Also try with the actual key
  console.log('\n=== Key Analysis ===');
  console.log('Expected key:', expectedKey);
  console.log('Actual key:', result.key);
  console.log('Match:', result.key === expectedKey);
}

verifyFingerprint().catch(console.error);
