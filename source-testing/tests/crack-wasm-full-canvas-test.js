/**
 * Full Canvas Test - Check if the key derivation uses full canvas data
 * or some other variation we haven't tried
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function fullCanvasTest() {
  console.log('=== Full Canvas Test ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Control inputs
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'screen', {
      value: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1080,
        colorDepth: 24,
        pixelDepth: 24,
      },
      writable: false,
    });
    
    Date.prototype.getTimezoneOffset = function() {
      return 0;
    };
    
    Math.random = function() {
      return 0.5;
    };
    
    let baseTime = 1700000000000;
    Date.now = function() {
      return baseTime++;
    };
    
    window.__canvasData = null;
    window.__canvasPixels = null;
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
        
        // Also capture pixel data
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          window.__canvasPixels = Array.from(imageData.data);
        }
      }
      return result;
    };
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasDataUrl = window.__canvasData || '';
    const canvasBase64 = canvasDataUrl.split(',')[1] || '';
    const canvasPixels = window.__canvasPixels || [];
    
    return {
      key,
      sessionId,
      canvasDataUrl,
      canvasBase64,
      canvasPixelsLength: canvasPixels.length,
      canvasPixelsFirst100: canvasPixels.slice(0, 100),
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
  console.log('Canvas base64 length:', result.canvasBase64.length);
  console.log('Canvas pixels length:', result.canvasPixelsLength);
  
  const fp = result.fingerprint;
  const [timestamp] = result.sessionId.split('.');
  const keyBuf = Buffer.from(result.key, 'hex');
  
  // Try various fingerprint string formats
  console.log('\n=== Testing Different FP String Formats ===\n');
  
  const formats = [
    // Original format with 50 chars
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 50)}`,
    
    // Full canvas
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64}`,
    
    // No canvas
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}`,
    
    // Different truncation lengths
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 100)}`,
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 64)}`,
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 32)}`,
    
    // With full userAgent
    `${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 50)}`,
    
    // Different order
    `${timestamp}:${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${result.canvasBase64.slice(0, 50)}`,
    
    // With screen dimensions
    `${fp.colorDepth}:1920:1080:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 50)}`,
    
    // Without timezone
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${timestamp}:${result.canvasBase64.slice(0, 50)}`,
    
    // With session ID instead of timestamp
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${result.sessionId}:${result.canvasBase64.slice(0, 50)}`,
  ];
  
  for (let i = 0; i < formats.length; i++) {
    const fpString = formats[i];
    const fpHash = crypto.createHash('sha256').update(fpString).digest();
    
    if (fpHash.equals(keyBuf)) {
      console.log(`*** MATCH: Format ${i} ***`);
      console.log(`  ${fpString.slice(0, 100)}...`);
    }
    
    // Also try double hash
    const doubleHash = crypto.createHash('sha256').update(fpHash).digest();
    if (doubleHash.equals(keyBuf)) {
      console.log(`*** MATCH: Double hash of format ${i} ***`);
    }
  }
  
  // Try with canvas pixel data
  console.log('\n=== Testing Canvas Pixel Data ===\n');
  
  const pixelBuf = Buffer.from(result.canvasPixelsFirst100);
  const pixelHash = crypto.createHash('sha256').update(pixelBuf).digest();
  console.log(`SHA256(first 100 pixels): ${pixelHash.toString('hex')}`);
  
  // Try combining fpHash with pixel hash
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 50)}`;
  const fpHash = crypto.createHash('sha256').update(fpString).digest();
  
  const xorPixel = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorPixel[i] = fpHash[i] ^ pixelHash[i];
  }
  console.log(`fpHash XOR pixelHash: ${xorPixel.toString('hex')}`);
  if (xorPixel.equals(keyBuf)) {
    console.log('*** MATCH: key = fpHash XOR pixelHash ***');
  }
  
  // Calculate the XOR constant
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHash[i] ^ keyBuf[i];
  }
  console.log(`\nXOR constant: ${xorBuf.toString('hex')}`);
  
  // Check if XOR constant is related to canvas data
  const fullCanvasHash = crypto.createHash('sha256').update(result.canvasBase64).digest();
  console.log(`SHA256(fullCanvas): ${fullCanvasHash.toString('hex')}`);
  if (fullCanvasHash.equals(xorBuf)) {
    console.log('*** XOR = SHA256(fullCanvas) ***');
  }
  
  // Check if XOR is HMAC of something
  const hmacTests = [
    { name: 'HMAC(canvas, fpString)', hash: crypto.createHmac('sha256', result.canvasBase64).update(fpString).digest() },
    { name: 'HMAC(fpString, canvas)', hash: crypto.createHmac('sha256', fpString).update(result.canvasBase64).digest() },
    { name: 'HMAC(canvas, timestamp)', hash: crypto.createHmac('sha256', result.canvasBase64).update(timestamp).digest() },
    { name: 'HMAC(timestamp, canvas)', hash: crypto.createHmac('sha256', timestamp).update(result.canvasBase64).digest() },
    { name: 'HMAC(fpHash, canvas)', hash: crypto.createHmac('sha256', fpHash).update(result.canvasBase64).digest() },
    { name: 'HMAC(canvas, fpHash)', hash: crypto.createHmac('sha256', result.canvasBase64).update(fpHash).digest() },
  ];
  
  console.log('\n=== Testing HMAC for XOR ===\n');
  for (const test of hmacTests) {
    console.log(`${test.name}: ${test.hash.toString('hex')}`);
    if (test.hash.equals(xorBuf)) {
      console.log(`*** MATCH: XOR = ${test.name} ***`);
    }
  }
  
  // Try HKDF variations
  console.log('\n=== Testing HKDF for Key ===\n');
  
  const hkdfTests = [
    { name: 'HKDF(fpString, canvas, "", 32)', salt: result.canvasBase64, info: '' },
    { name: 'HKDF(fpString, "", canvas, 32)', salt: '', info: result.canvasBase64 },
    { name: 'HKDF(canvas, fpString, "", 32)', ikm: result.canvasBase64, salt: fpString, info: '' },
    { name: 'HKDF(fpHash, canvas, "", 32)', ikm: fpHash, salt: result.canvasBase64, info: '' },
  ];
  
  for (const test of hkdfTests) {
    try {
      const ikm = test.ikm || fpString;
      const derived = crypto.hkdfSync('sha256', ikm, test.salt, test.info, 32);
      console.log(`${test.name}: ${Buffer.from(derived).toString('hex')}`);
      if (Buffer.from(derived).equals(keyBuf)) {
        console.log(`*** MATCH: key = ${test.name} ***`);
      }
    } catch (e) {
      console.log(`${test.name}: Error - ${e.message}`);
    }
  }
}

fullCanvasTest().catch(console.error);
