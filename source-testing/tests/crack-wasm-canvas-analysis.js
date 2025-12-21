/**
 * Canvas Analysis - Check if canvas fingerprint is consistent
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeCanvas() {
  console.log('=== Canvas Analysis ===\n');
  
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
    
    // Capture all canvas operations
    window.__canvasOps = [];
    window.__canvasData = null;
    
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const ctx = origGetContext.call(this, type, ...args);
      if (type === '2d' && this.width === 200 && this.height === 50) {
        // Wrap fillText
        const origFillText = ctx.fillText.bind(ctx);
        ctx.fillText = function(text, x, y, ...rest) {
          window.__canvasOps.push({ op: 'fillText', text, x, y, font: ctx.font });
          return origFillText(text, x, y, ...rest);
        };
      }
      return ctx;
    };
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
        window.__canvasOps.push({ op: 'toDataURL', length: result.length });
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
    const canvasData = window.__canvasData;
    const canvasBase64 = canvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      canvasOps: window.__canvasOps,
      canvasDataLength: canvasData?.length,
      canvasBase64: canvasBase64,
      canvasBase64First50: canvasBase64.slice(0, 50),
      canvasBase64First100: canvasBase64.slice(0, 100),
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
  console.log('\nCanvas operations:');
  for (const op of result.canvasOps) {
    console.log(' ', JSON.stringify(op));
  }
  
  console.log('\nCanvas data length:', result.canvasDataLength);
  console.log('Canvas base64 first 50:', result.canvasBase64First50);
  console.log('Canvas base64 first 100:', result.canvasBase64First100);
  
  // Calculate fingerprint hash
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64First50}`;
  
  console.log('\n=== Fingerprint ===');
  console.log('Fingerprint string:', fpString);
  console.log('Fingerprint string length:', fpString.length);
  
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log('Fingerprint hash:', fpHash);
  
  // Calculate XOR constant
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const keyBuf = Buffer.from(result.key, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  console.log('XOR constant:', xorBuf.toString('hex'));
  
  // Try different fingerprint formats
  console.log('\n=== Testing Different Fingerprint Formats ===');
  
  // Format 1: Original
  const format1 = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64First50}`;
  const hash1 = crypto.createHash('sha256').update(format1).digest('hex');
  console.log('Format 1 (original):', hash1);
  
  // Format 2: Full canvas
  const format2 = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64}`;
  const hash2 = crypto.createHash('sha256').update(format2).digest('hex');
  console.log('Format 2 (full canvas):', hash2);
  
  // Format 3: No canvas
  const format3 = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}`;
  const hash3 = crypto.createHash('sha256').update(format3).digest('hex');
  console.log('Format 3 (no canvas):', hash3);
  
  // Format 4: Different order
  const format4 = `${ts}:${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${result.canvasBase64First50}`;
  const hash4 = crypto.createHash('sha256').update(format4).digest('hex');
  console.log('Format 4 (ts first):', hash4);
  
  // Check if any hash XOR key gives a simple pattern
  console.log('\n=== XOR Analysis ===');
  for (const [name, hash] of [['Format 1', hash1], ['Format 2', hash2], ['Format 3', hash3], ['Format 4', hash4]]) {
    const hashBuf = Buffer.from(hash, 'hex');
    const xor = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xor[i] = hashBuf[i] ^ keyBuf[i];
    }
    console.log(`${name} XOR: ${xor.toString('hex')}`);
    
    // Check if XOR is a simple hash of timestamp
    const tsHash = crypto.createHash('sha256').update(String(ts)).digest('hex');
    if (xor.toString('hex') === tsHash) {
      console.log(`  *** MATCH: XOR = SHA256(ts) ***`);
    }
  }
  
  return result;
}

analyzeCanvas().catch(console.error);
