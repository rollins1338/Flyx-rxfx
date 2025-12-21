/**
 * Explore the 'key' property on wasmImgData
 * This might give us insight into how the key is derived
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function exploreKeyProperty() {
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
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Explore the wasmImgData object in detail
  const exploration = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    
    // Get all properties with their values
    const propDetails = {};
    for (const prop of Object.keys(wasm)) {
      const val = wasm[prop];
      propDetails[prop] = {
        type: typeof val,
        isFunction: typeof val === 'function',
        value: typeof val === 'function' ? '[function]' : 
               typeof val === 'object' ? JSON.stringify(val) : 
               String(val).slice(0, 100),
      };
    }
    
    // Check the 'key' property specifically
    let keyPropInfo = null;
    if ('key' in wasm) {
      const keyVal = wasm.key;
      keyPropInfo = {
        type: typeof keyVal,
        value: keyVal,
        isGetter: Object.getOwnPropertyDescriptor(wasm, 'key')?.get !== undefined,
      };
      
      // If it's a getter, call it multiple times to see if it changes
      if (typeof keyVal === 'string' || typeof keyVal === 'function') {
        keyPropInfo.multipleReads = [];
        for (let i = 0; i < 3; i++) {
          keyPropInfo.multipleReads.push(typeof wasm.key === 'function' ? wasm.key() : wasm.key);
        }
      }
    }
    
    // Get the key using get_img_key
    const keyFromMethod = wasm.get_img_key();
    
    // Check if key property equals get_img_key result
    const keyPropValue = wasm.key;
    
    return {
      propDetails,
      keyPropInfo,
      keyFromMethod,
      keyPropValue,
      keyPropEqualsMethod: keyPropValue === keyFromMethod,
      sessionId: localStorage.getItem('tmdb_session_id'),
    };
  });
  
  console.log('=== wasmImgData Properties ===');
  for (const [prop, details] of Object.entries(exploration.propDetails)) {
    console.log(`${prop}: ${details.type} = ${details.value}`);
  }
  
  console.log('\n=== Key Property Analysis ===');
  console.log('Key property info:', exploration.keyPropInfo);
  console.log('Key from get_img_key():', exploration.keyFromMethod);
  console.log('Key property value:', exploration.keyPropValue);
  console.log('Key prop equals method result:', exploration.keyPropEqualsMethod);
  
  // Now let's trace what happens when we call get_img_key multiple times
  const multiCallResult = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    
    const results = [];
    for (let i = 0; i < 5; i++) {
      const key = wasm.get_img_key();
      const keyProp = wasm.key;
      results.push({
        iteration: i,
        keyFromMethod: key,
        keyProp: keyProp,
        match: key === keyProp,
      });
    }
    
    return results;
  });
  
  console.log('\n=== Multiple get_img_key() Calls ===');
  for (const r of multiCallResult) {
    console.log(`Call ${r.iteration}: method=${r.keyFromMethod?.slice(0, 16)}... prop=${r.keyProp?.slice(0, 16)}... match=${r.match}`);
  }
  
  // Check if the key changes when we modify the session
  const sessionTest = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    
    // Get current key
    const key1 = wasm.get_img_key();
    
    // Modify session ID
    const oldSession = localStorage.getItem('tmdb_session_id');
    localStorage.setItem('tmdb_session_id', '1700000001.5000000');
    
    // Get new key
    const key2 = wasm.get_img_key();
    
    // Restore session
    localStorage.setItem('tmdb_session_id', oldSession);
    
    // Get key again
    const key3 = wasm.get_img_key();
    
    return {
      key1,
      key2,
      key3,
      key1EqualsKey3: key1 === key3,
      key1EqualsKey2: key1 === key2,
    };
  });
  
  console.log('\n=== Session Modification Test ===');
  console.log('Key with original session:', sessionTest.key1);
  console.log('Key with modified session:', sessionTest.key2);
  console.log('Key after restoring session:', sessionTest.key3);
  console.log('Original equals restored:', sessionTest.key1EqualsKey3);
  console.log('Original equals modified:', sessionTest.key1EqualsKey2);
  
  await browser.close();
  
  // Calculate expected values
  console.log('\n=== Expected Values ===');
  const fpString = `24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk`;
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log('FP Hash:', fpHash);
  
  const keyBuf = Buffer.from(exploration.keyFromMethod, 'hex');
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = keyBuf[i] ^ fpHashBuf[i];
  }
  console.log('XOR Constant:', xorBuf.toString('hex'));
}

exploreKeyProperty().catch(console.error);
