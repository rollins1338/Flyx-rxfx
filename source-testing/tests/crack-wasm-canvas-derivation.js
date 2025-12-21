/**
 * Test Canvas-based Key Derivation
 * 
 * Maybe the XOR constant is derived from the full canvas data
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function testCanvasDerivation() {
  console.log('=== Testing Canvas-based Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Control the environment
  const controlledTimestamp = 1700000000;
  
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
    
    // Capture full canvas data
    window.__fullCanvasData = null;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__fullCanvasData = result;
      }
      return result;
    };
  }, controlledTimestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const fullCanvas = window.__fullCanvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      fullCanvas,
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
  
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Full canvas length:', result.fullCanvas.length);
  console.log('Full canvas (first 100):', result.fullCanvas.slice(0, 100));
  
  const [timestamp] = result.sessionId.split('.');
  const fp = result.fingerprint;
  
  // Build fingerprint string with full canvas
  const fpStringFull = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.fullCanvas}`;
  const fpStringShort = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.fullCanvas.slice(0, 50)}`;
  
  console.log('\nFP string (short) length:', fpStringShort.length);
  console.log('FP string (full) length:', fpStringFull.length);
  
  const fpHashShort = crypto.createHash('sha256').update(fpStringShort).digest('hex');
  const fpHashFull = crypto.createHash('sha256').update(fpStringFull).digest('hex');
  
  console.log('\nFP Hash (short):', fpHashShort);
  console.log('FP Hash (full):', fpHashFull);
  
  // Calculate XOR constants
  const keyBuf = Buffer.from(result.key, 'hex');
  
  const xorShort = Buffer.alloc(32);
  const fpHashShortBuf = Buffer.from(fpHashShort, 'hex');
  for (let i = 0; i < 32; i++) xorShort[i] = fpHashShortBuf[i] ^ keyBuf[i];
  
  const xorFull = Buffer.alloc(32);
  const fpHashFullBuf = Buffer.from(fpHashFull, 'hex');
  for (let i = 0; i < 32; i++) xorFull[i] = fpHashFullBuf[i] ^ keyBuf[i];
  
  console.log('\nXOR (short canvas):', xorShort.toString('hex'));
  console.log('XOR (full canvas):', xorFull.toString('hex'));
  
  // Now test various derivations with full canvas
  console.log('\n=== Testing derivations with full canvas ===\n');
  
  const fullCanvasBuf = Buffer.from(result.fullCanvas, 'base64');
  console.log('Canvas binary length:', fullCanvasBuf.length);
  
  // SHA256 of full canvas
  const canvasHash = crypto.createHash('sha256').update(result.fullCanvas).digest();
  console.log('SHA256(fullCanvas):', canvasHash.toString('hex'));
  
  // SHA256 of canvas binary
  const canvasBinHash = crypto.createHash('sha256').update(fullCanvasBuf).digest();
  console.log('SHA256(canvasBinary):', canvasBinHash.toString('hex'));
  
  // Test if XOR = SHA256(canvas) or similar
  if (canvasHash.equals(xorShort)) {
    console.log('*** MATCH: XOR = SHA256(fullCanvas) ***');
  }
  if (canvasBinHash.equals(xorShort)) {
    console.log('*** MATCH: XOR = SHA256(canvasBinary) ***');
  }
  
  // Test HMAC with canvas
  const hmac1 = crypto.createHmac('sha256', result.fullCanvas).update(timestamp).digest();
  if (hmac1.equals(xorShort)) {
    console.log('*** MATCH: XOR = HMAC(fullCanvas, timestamp) ***');
  }
  
  const hmac2 = crypto.createHmac('sha256', timestamp).update(result.fullCanvas).digest();
  if (hmac2.equals(xorShort)) {
    console.log('*** MATCH: XOR = HMAC(timestamp, fullCanvas) ***');
  }
  
  // Test XOR of canvas hash and timestamp hash
  const tsHash = crypto.createHash('sha256').update(timestamp).digest();
  const xorCanvasTs = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xorCanvasTs[i] = canvasHash[i] ^ tsHash[i];
  if (xorCanvasTs.equals(xorShort)) {
    console.log('*** MATCH: XOR = SHA256(canvas) XOR SHA256(timestamp) ***');
  }
  
  // Test with fpHash
  const xorCanvasFp = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xorCanvasFp[i] = canvasHash[i] ^ fpHashShortBuf[i];
  if (xorCanvasFp.equals(xorShort)) {
    console.log('*** MATCH: XOR = SHA256(canvas) XOR fpHash ***');
  }
  
  console.log('\n=== Summary ===');
  console.log('The XOR constant is:', xorShort.toString('hex'));
  console.log('This matches our previous findings.');
}

testCanvasDerivation().catch(console.error);
