/**
 * Analyze fingerprint components to find what affects the XOR constant
 * The XOR changes with timestamp but NOT with the random part of sessionId
 * This suggests the XOR is derived from timestamp + some static component
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeComponents() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  // Capture all fingerprint components
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
    
    window.__components = {};
    
    // Capture canvas
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const result = origToDataURL.apply(this, args);
      if (this.width === 200 && this.height === 50) {
        window.__components.canvasDataURL = result;
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
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    return {
      key,
      sessionId,
      canvasDataURL: window.__components.canvasDataURL,
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
  
  console.log('=== Fingerprint Components ===');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Canvas length:', result.canvasDataURL?.length);
  
  // Extract components
  const colorDepth = result.screen.colorDepth;
  const userAgent = result.navigator.userAgent.slice(0, 50);
  const platform = result.navigator.platform;
  const language = result.navigator.language;
  const timezone = 0;
  const ts = result.sessionId.split('.')[0];
  
  // Get canvas base64
  const canvasPrefix = 'data:image/png;base64,';
  const canvasBase64 = result.canvasDataURL.startsWith(canvasPrefix) 
    ? result.canvasDataURL.slice(canvasPrefix.length) 
    : result.canvasDataURL;
  const canvasSlice = canvasBase64.slice(0, 50);
  
  console.log('\n=== Component Values ===');
  console.log('colorDepth:', colorDepth);
  console.log('userAgent (50):', userAgent);
  console.log('platform:', platform);
  console.log('language:', language);
  console.log('timezone:', timezone);
  console.log('timestamp:', ts);
  console.log('canvas (50):', canvasSlice);
  
  // Build fingerprint
  const fingerprint = `${colorDepth}:${userAgent}:${platform}:${language}:${timezone}:${ts}:${canvasSlice}`;
  console.log('\n=== Fingerprint ===');
  console.log('Full:', fingerprint);
  console.log('Length:', fingerprint.length);
  
  // Compute fpHash
  const fpHash = crypto.createHash('sha256').update(fingerprint).digest('hex');
  console.log('\n=== Hashes ===');
  console.log('fpHash:', fpHash);
  
  // Compute XOR constant
  const fpHashBytes = Buffer.from(fpHash, 'hex');
  const keyBytes = Buffer.from(result.key, 'hex');
  const xorBytes = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBytes[i] = fpHashBytes[i] ^ keyBytes[i];
  }
  const xorConstant = xorBytes.toString('hex');
  console.log('xorConstant:', xorConstant);
  
  // Now try to derive the XOR constant from components
  console.log('\n=== XOR Derivation Attempts ===');
  
  // Try SHA256 of various component combinations
  const derivations = [
    { name: 'SHA256(timestamp)', value: crypto.createHash('sha256').update(ts).digest('hex') },
    { name: 'SHA256(canvas)', value: crypto.createHash('sha256').update(canvasSlice).digest('hex') },
    { name: 'SHA256(canvasFull)', value: crypto.createHash('sha256').update(canvasBase64).digest('hex') },
    { name: 'SHA256(ts + canvas)', value: crypto.createHash('sha256').update(ts + canvasSlice).digest('hex') },
    { name: 'SHA256(canvas + ts)', value: crypto.createHash('sha256').update(canvasSlice + ts).digest('hex') },
    { name: 'SHA256(userAgent)', value: crypto.createHash('sha256').update(userAgent).digest('hex') },
    { name: 'SHA256(platform)', value: crypto.createHash('sha256').update(platform).digest('hex') },
    { name: 'SHA256(ts + userAgent)', value: crypto.createHash('sha256').update(ts + userAgent).digest('hex') },
    { name: 'SHA256(fpHash)', value: crypto.createHash('sha256').update(fpHash).digest('hex') },
    { name: 'SHA256(fpHash bytes)', value: crypto.createHash('sha256').update(fpHashBytes).digest('hex') },
  ];
  
  for (const d of derivations) {
    const match = d.value === xorConstant;
    console.log(`${d.name}: ${match ? '*** MATCH ***' : d.value.slice(0, 32) + '...'}`);
  }
  
  // Try XOR combinations
  console.log('\n=== XOR Combinations ===');
  
  const sha256Ts = crypto.createHash('sha256').update(ts).digest();
  const sha256Canvas = crypto.createHash('sha256').update(canvasSlice).digest();
  const sha256FpHash = crypto.createHash('sha256').update(fpHash).digest();
  
  // fpHash XOR SHA256(timestamp)
  const xor1 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor1[i] = fpHashBytes[i] ^ sha256Ts[i];
  console.log('fpHash XOR SHA256(ts):', xor1.toString('hex') === xorConstant ? '*** MATCH ***' : xor1.toString('hex').slice(0, 32) + '...');
  
  // fpHash XOR SHA256(canvas)
  const xor2 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor2[i] = fpHashBytes[i] ^ sha256Canvas[i];
  console.log('fpHash XOR SHA256(canvas):', xor2.toString('hex') === xorConstant ? '*** MATCH ***' : xor2.toString('hex').slice(0, 32) + '...');
  
  // SHA256(fpHash) XOR fpHash
  const xor3 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor3[i] = sha256FpHash[i] ^ fpHashBytes[i];
  console.log('SHA256(fpHash) XOR fpHash:', xor3.toString('hex') === xorConstant ? '*** MATCH ***' : xor3.toString('hex').slice(0, 32) + '...');
  
  // Try HMAC with canvas as key
  const hmac1 = crypto.createHmac('sha256', canvasSlice).update(ts).digest('hex');
  console.log('HMAC(canvas, ts):', hmac1 === xorConstant ? '*** MATCH ***' : hmac1.slice(0, 32) + '...');
  
  const hmac2 = crypto.createHmac('sha256', ts).update(canvasSlice).digest('hex');
  console.log('HMAC(ts, canvas):', hmac2 === xorConstant ? '*** MATCH ***' : hmac2.slice(0, 32) + '...');
  
  // Try with full canvas
  const hmac3 = crypto.createHmac('sha256', canvasBase64.slice(0, 100)).update(ts).digest('hex');
  console.log('HMAC(canvas100, ts):', hmac3 === xorConstant ? '*** MATCH ***' : hmac3.slice(0, 32) + '...');
  
  // Try double HMAC
  const hmac4 = crypto.createHmac('sha256', fpHash).update(ts).digest('hex');
  console.log('HMAC(fpHash, ts):', hmac4 === xorConstant ? '*** MATCH ***' : hmac4.slice(0, 32) + '...');
  
  const hmac5 = crypto.createHmac('sha256', ts).update(fpHash).digest('hex');
  console.log('HMAC(ts, fpHash):', hmac5 === xorConstant ? '*** MATCH ***' : hmac5.slice(0, 32) + '...');
}

analyzeComponents().catch(console.error);
