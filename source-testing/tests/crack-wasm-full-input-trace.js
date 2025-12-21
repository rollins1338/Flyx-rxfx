/**
 * Full Input Trace - Capture ALL data that flows into WASM
 * and try to find the exact key derivation formula
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function fullInputTrace() {
  console.log('=== Full Input Trace ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Capture ALL WASM inputs
  await page.evaluateOnNewDocument(() => {
    window.__wasmInputs = {
      dateNow: [],
      mathRandom: [],
      performanceNow: [],
      screen: null,
      navigator: null,
      timezone: null,
      localStorage: {},
      canvas: null,
    };
    
    // Intercept Date.now
    const origDateNow = Date.now;
    Date.now = function() {
      const result = origDateNow.call(this);
      window.__wasmInputs.dateNow.push(result);
      return result;
    };
    
    // Intercept Math.random
    const origMathRandom = Math.random;
    Math.random = function() {
      const result = origMathRandom.call(this);
      window.__wasmInputs.mathRandom.push(result);
      return result;
    };
    
    // Intercept performance.now
    const origPerfNow = performance.now;
    performance.now = function() {
      const result = origPerfNow.call(this);
      window.__wasmInputs.performanceNow.push(result);
      return result;
    };
    
    // Intercept canvas toDataURL
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__wasmInputs.canvas = {
          width: this.width,
          height: this.height,
          dataUrl: result,
          base64: result.split(',')[1],
        };
      }
      return result;
    };
    
    // Intercept localStorage
    const origGetItem = localStorage.getItem;
    const origSetItem = localStorage.setItem;
    
    localStorage.getItem = function(key) {
      const result = origGetItem.call(this, key);
      window.__wasmInputs.localStorage[key] = { get: result };
      return result;
    };
    
    localStorage.setItem = function(key, value) {
      window.__wasmInputs.localStorage[key] = { set: value };
      return origSetItem.call(this, key, value);
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and all inputs
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    // Capture screen info
    window.__wasmInputs.screen = {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
    };
    
    // Capture navigator info
    window.__wasmInputs.navigator = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: navigator.languages,
    };
    
    // Capture timezone
    window.__wasmInputs.timezone = new Date().getTimezoneOffset();
    
    return {
      key,
      inputs: window.__wasmInputs,
    };
  });
  
  await browser.close();
  
  console.log('Key:', result.key);
  
  console.log('\n=== Screen ===');
  console.log(JSON.stringify(result.inputs.screen, null, 2));
  
  console.log('\n=== Navigator ===');
  console.log(`userAgent: ${result.inputs.navigator.userAgent}`);
  console.log(`platform: ${result.inputs.navigator.platform}`);
  console.log(`language: ${result.inputs.navigator.language}`);
  
  console.log('\n=== Timezone ===');
  console.log(`offset: ${result.inputs.timezone}`);
  
  console.log('\n=== Canvas ===');
  if (result.inputs.canvas) {
    console.log(`size: ${result.inputs.canvas.width}x${result.inputs.canvas.height}`);
    console.log(`base64 length: ${result.inputs.canvas.base64.length}`);
    console.log(`base64 first 50: ${result.inputs.canvas.base64.slice(0, 50)}`);
  }
  
  console.log('\n=== LocalStorage ===');
  console.log(JSON.stringify(result.inputs.localStorage, null, 2));
  
  console.log('\n=== Date.now calls (first 10) ===');
  console.log(result.inputs.dateNow.slice(0, 10));
  
  console.log('\n=== Math.random calls (first 10) ===');
  console.log(result.inputs.mathRandom.slice(0, 10));
  
  // Now let's try to derive the key
  console.log('\n=== Key Derivation Attempts ===\n');
  
  const screen = result.inputs.screen;
  const nav = result.inputs.navigator;
  const tz = result.inputs.timezone;
  const canvas = result.inputs.canvas;
  const sessionId = result.inputs.localStorage.tmdb_session_id?.set || result.inputs.localStorage.tmdb_session_id?.get;
  
  console.log(`Session ID: ${sessionId}`);
  
  const [timestamp, random] = sessionId.split('.');
  
  // Build fingerprint string (our known format)
  const fpString = `${screen.colorDepth}:${nav.userAgent.slice(0, 50)}:${nav.platform}:${nav.language}:${tz}:${timestamp}:${canvas.base64.slice(0, 50)}`;
  
  console.log(`\nFP String: ${fpString}`);
  console.log(`FP String length: ${fpString.length}`);
  
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log(`FP Hash: ${fpHash}`);
  console.log(`Actual Key: ${result.key}`);
  
  // Calculate XOR
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const keyBuf = Buffer.from(result.key, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  console.log(`XOR constant: ${xorBuf.toString('hex')}`);
  
  // Try different derivations for the XOR constant
  console.log('\n=== Testing XOR Derivations ===\n');
  
  // Test 1: XOR = SHA256(sessionId)
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest();
  console.log(`SHA256(sessionId): ${sessionHash.toString('hex')}`);
  if (sessionHash.equals(xorBuf)) console.log('*** MATCH: XOR = SHA256(sessionId) ***');
  
  // Test 2: XOR = SHA256(random part)
  const randomHash = crypto.createHash('sha256').update(random).digest();
  console.log(`SHA256(random): ${randomHash.toString('hex')}`);
  if (randomHash.equals(xorBuf)) console.log('*** MATCH: XOR = SHA256(random) ***');
  
  // Test 3: XOR = SHA256(full canvas base64)
  const fullCanvasHash = crypto.createHash('sha256').update(canvas.base64).digest();
  console.log(`SHA256(fullCanvas): ${fullCanvasHash.toString('hex')}`);
  if (fullCanvasHash.equals(xorBuf)) console.log('*** MATCH: XOR = SHA256(fullCanvas) ***');
  
  // Test 4: XOR = SHA256(canvas base64 first 50)
  const canvas50Hash = crypto.createHash('sha256').update(canvas.base64.slice(0, 50)).digest();
  console.log(`SHA256(canvas50): ${canvas50Hash.toString('hex')}`);
  if (canvas50Hash.equals(xorBuf)) console.log('*** MATCH: XOR = SHA256(canvas50) ***');
  
  // Test 5: XOR = HMAC(sessionId, fpString)
  const hmac1 = crypto.createHmac('sha256', sessionId).update(fpString).digest();
  console.log(`HMAC(sessionId, fpString): ${hmac1.toString('hex')}`);
  if (hmac1.equals(xorBuf)) console.log('*** MATCH: XOR = HMAC(sessionId, fpString) ***');
  
  // Test 6: XOR = HMAC(fpString, sessionId)
  const hmac2 = crypto.createHmac('sha256', fpString).update(sessionId).digest();
  console.log(`HMAC(fpString, sessionId): ${hmac2.toString('hex')}`);
  if (hmac2.equals(xorBuf)) console.log('*** MATCH: XOR = HMAC(fpString, sessionId) ***');
  
  // Test 7: XOR = HMAC(canvas, sessionId)
  const hmac3 = crypto.createHmac('sha256', canvas.base64).update(sessionId).digest();
  console.log(`HMAC(canvas, sessionId): ${hmac3.toString('hex')}`);
  if (hmac3.equals(xorBuf)) console.log('*** MATCH: XOR = HMAC(canvas, sessionId) ***');
  
  // Test 8: XOR = HMAC(sessionId, canvas)
  const hmac4 = crypto.createHmac('sha256', sessionId).update(canvas.base64).digest();
  console.log(`HMAC(sessionId, canvas): ${hmac4.toString('hex')}`);
  if (hmac4.equals(xorBuf)) console.log('*** MATCH: XOR = HMAC(sessionId, canvas) ***');
  
  // Test 9: key = HMAC(fpHash, sessionId)
  const hmac5 = crypto.createHmac('sha256', fpHashBuf).update(sessionId).digest();
  console.log(`HMAC(fpHash, sessionId): ${hmac5.toString('hex')}`);
  if (hmac5.equals(keyBuf)) console.log('*** MATCH: key = HMAC(fpHash, sessionId) ***');
  
  // Test 10: key = HMAC(sessionId, fpHash)
  const hmac6 = crypto.createHmac('sha256', sessionId).update(fpHashBuf).digest();
  console.log(`HMAC(sessionId, fpHash): ${hmac6.toString('hex')}`);
  if (hmac6.equals(keyBuf)) console.log('*** MATCH: key = HMAC(sessionId, fpHash) ***');
  
  // Test 11: key = SHA256(fpHash + sessionId)
  const concat1 = crypto.createHash('sha256').update(Buffer.concat([fpHashBuf, Buffer.from(sessionId)])).digest();
  console.log(`SHA256(fpHash + sessionId): ${concat1.toString('hex')}`);
  if (concat1.equals(keyBuf)) console.log('*** MATCH: key = SHA256(fpHash + sessionId) ***');
  
  // Test 12: key = SHA256(sessionId + fpHash)
  const concat2 = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(sessionId), fpHashBuf])).digest();
  console.log(`SHA256(sessionId + fpHash): ${concat2.toString('hex')}`);
  if (concat2.equals(keyBuf)) console.log('*** MATCH: key = SHA256(sessionId + fpHash) ***');
  
  // Test 13: key = SHA256(fpString + sessionId)
  const concat3 = crypto.createHash('sha256').update(fpString + sessionId).digest();
  console.log(`SHA256(fpString + sessionId): ${concat3.toString('hex')}`);
  if (concat3.equals(keyBuf)) console.log('*** MATCH: key = SHA256(fpString + sessionId) ***');
  
  // Test 14: key = SHA256(sessionId + fpString)
  const concat4 = crypto.createHash('sha256').update(sessionId + fpString).digest();
  console.log(`SHA256(sessionId + fpString): ${concat4.toString('hex')}`);
  if (concat4.equals(keyBuf)) console.log('*** MATCH: key = SHA256(sessionId + fpString) ***');
  
  // Test 15: Try with full session ID in fingerprint
  const fpStringFull = `${screen.colorDepth}:${nav.userAgent.slice(0, 50)}:${nav.platform}:${nav.language}:${tz}:${sessionId}:${canvas.base64.slice(0, 50)}`;
  const fpHashFull = crypto.createHash('sha256').update(fpStringFull).digest();
  console.log(`\nSHA256(fpString with full sessionId): ${fpHashFull.toString('hex')}`);
  if (fpHashFull.equals(keyBuf)) console.log('*** MATCH: key = SHA256(fpString with full sessionId) ***');
  
  // Test 16: Try with random part in fingerprint
  const fpStringRandom = `${screen.colorDepth}:${nav.userAgent.slice(0, 50)}:${nav.platform}:${nav.language}:${tz}:${random}:${canvas.base64.slice(0, 50)}`;
  const fpHashRandom = crypto.createHash('sha256').update(fpStringRandom).digest();
  console.log(`SHA256(fpString with random): ${fpHashRandom.toString('hex')}`);
  if (fpHashRandom.equals(keyBuf)) console.log('*** MATCH: key = SHA256(fpString with random) ***');
  
  // Test 17: Try HKDF
  try {
    const hkdf1 = crypto.hkdfSync('sha256', fpString, sessionId, '', 32);
    console.log(`HKDF(fpString, sessionId, '', 32): ${Buffer.from(hkdf1).toString('hex')}`);
    if (Buffer.from(hkdf1).equals(keyBuf)) console.log('*** MATCH: key = HKDF(fpString, sessionId, "", 32) ***');
  } catch (e) {}
  
  // Test 18: Try HKDF with canvas as salt
  try {
    const hkdf2 = crypto.hkdfSync('sha256', fpString, canvas.base64.slice(0, 50), '', 32);
    console.log(`HKDF(fpString, canvas50, '', 32): ${Buffer.from(hkdf2).toString('hex')}`);
    if (Buffer.from(hkdf2).equals(keyBuf)) console.log('*** MATCH: key = HKDF(fpString, canvas50, "", 32) ***');
  } catch (e) {}
  
  // Test 19: XOR fpHash with canvas hash
  const canvasHashBuf = crypto.createHash('sha256').update(canvas.base64).digest();
  const xorCanvas = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorCanvas[i] = fpHashBuf[i] ^ canvasHashBuf[i];
  }
  console.log(`fpHash XOR canvasHash: ${xorCanvas.toString('hex')}`);
  if (xorCanvas.equals(keyBuf)) console.log('*** MATCH: key = fpHash XOR canvasHash ***');
  
  // Test 20: XOR fpHash with session hash
  const sessionHashBuf = crypto.createHash('sha256').update(sessionId).digest();
  const xorSession = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorSession[i] = fpHashBuf[i] ^ sessionHashBuf[i];
  }
  console.log(`fpHash XOR sessionHash: ${xorSession.toString('hex')}`);
  if (xorSession.equals(keyBuf)) console.log('*** MATCH: key = fpHash XOR sessionHash ***');
}

fullInputTrace().catch(console.error);
