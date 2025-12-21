/**
 * Capture the exact canvas data being used in the fingerprint
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function captureCanvas() {
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
    
    window.__canvasCaptures = [];
    
    // Intercept canvas toDataURL
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const result = origToDataURL.apply(this, args);
      window.__canvasCaptures.push({
        width: this.width,
        height: this.height,
        dataURL: result,
        time: performance.now(),
      });
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
      canvasCaptures: window.__canvasCaptures,
      navigator: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      },
    };
  });
  
  await browser.close();
  
  console.log('=== Canvas Captures ===');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Canvas captures:', result.canvasCaptures.length);
  
  for (let i = 0; i < result.canvasCaptures.length; i++) {
    const cap = result.canvasCaptures[i];
    console.log(`\nCapture ${i + 1}:`);
    console.log('  Size:', cap.width, 'x', cap.height);
    console.log('  DataURL length:', cap.dataURL.length);
    console.log('  Time:', cap.time.toFixed(2), 'ms');
    
    // Extract base64 part
    const prefix = 'data:image/png;base64,';
    if (cap.dataURL.startsWith(prefix)) {
      const base64 = cap.dataURL.slice(prefix.length);
      console.log('  Base64 length:', base64.length);
      console.log('  Base64 first 50:', base64.slice(0, 50));
      console.log('  Base64 chars 22-72:', base64.slice(22, 72));
    }
  }
  
  // Now try to construct the fingerprint
  if (result.canvasCaptures.length > 0) {
    const cap = result.canvasCaptures[0]; // First canvas capture (200x50)
    const prefix = 'data:image/png;base64,';
    const base64 = cap.dataURL.startsWith(prefix) ? cap.dataURL.slice(prefix.length) : cap.dataURL;
    
    const colorDepth = 24;
    const userAgent = result.navigator.userAgent.slice(0, 50);
    const platform = result.navigator.platform;
    const language = result.navigator.language;
    const timezone = 0;
    const timestampPart = result.sessionId.split('.')[0];
    const canvasBase64 = base64.slice(0, 50);
    
    // Try different fingerprint formats
    const formats = [
      // Format 1: Standard format
      `${colorDepth}:${userAgent}:${platform}:${language}:${timezone}:${timestampPart}:${canvasBase64}`,
      // Format 2: With canvas starting at position 22 (skip PNG header)
      `${colorDepth}:${userAgent}:${platform}:${language}:${timezone}:${timestampPart}:${base64.slice(22, 72)}`,
      // Format 3: Full canvas base64
      `${colorDepth}:${userAgent}:${platform}:${language}:${timezone}:${timestampPart}:${base64}`,
      // Format 4: Without canvas
      `${colorDepth}:${userAgent}:${platform}:${language}:${timezone}:${timestampPart}`,
    ];
    
    console.log('\n=== Fingerprint Tests ===');
    const expectedFpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
    
    for (let i = 0; i < formats.length; i++) {
      const fp = formats[i];
      const hash = crypto.createHash('sha256').update(fp).digest('hex');
      console.log(`\nFormat ${i + 1}:`);
      console.log(`  Length: ${fp.length}`);
      console.log(`  First 100: ${fp.slice(0, 100)}`);
      console.log(`  SHA256: ${hash}`);
      console.log(`  Match: ${hash === expectedFpHash}`);
    }
    
    // Try with different canvas slice positions
    console.log('\n=== Canvas Slice Tests ===');
    for (let start = 0; start <= 30; start += 5) {
      const canvasSlice = base64.slice(start, start + 50);
      const fp = `${colorDepth}:${userAgent}:${platform}:${language}:${timezone}:${timestampPart}:${canvasSlice}`;
      const hash = crypto.createHash('sha256').update(fp).digest('hex');
      if (hash === expectedFpHash) {
        console.log(`*** MATCH at canvas slice [${start}:${start + 50}] ***`);
        console.log(`Canvas slice: ${canvasSlice}`);
      }
    }
    
    // Try with full dataURL
    console.log('\n=== Full DataURL Test ===');
    const fpWithFullDataURL = `${colorDepth}:${userAgent}:${platform}:${language}:${timezone}:${timestampPart}:${cap.dataURL.slice(0, 50)}`;
    const hashFull = crypto.createHash('sha256').update(fpWithFullDataURL).digest('hex');
    console.log(`With dataURL prefix: ${hashFull === expectedFpHash ? 'MATCH' : 'no match'}`);
  }
}

captureCanvas().catch(console.error);
