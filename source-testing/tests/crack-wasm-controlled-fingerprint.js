/**
 * Controlled Fingerprint - Set specific fingerprint values and see if we can predict the key
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function controlledFingerprint() {
  console.log('=== Controlled Fingerprint Test ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Set a specific viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Override fingerprint values
  await page.evaluateOnNewDocument(() => {
    // Override screen
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
    
    // Override timezone
    Date.prototype.getTimezoneOffset = function() {
      return 0; // UTC
    };
    
    // Control Math.random to return predictable values
    let randomIndex = 0;
    const randomValues = [];
    for (let i = 0; i < 1000; i++) {
      randomValues.push(0.5); // All 0.5
    }
    
    Math.random = function() {
      return randomValues[randomIndex++ % randomValues.length];
    };
    
    // Control Date.now
    let baseTime = 1700000000000; // Fixed timestamp
    Date.now = function() {
      return baseTime++;
    };
    
    window.__canvasData = null;
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
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
  
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      canvasBase64,
      fingerprint: {
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await browser.close();
  
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  console.log(`Canvas base64 length: ${data.canvasBase64.length}`);
  
  console.log('\nFingerprint:');
  console.log(JSON.stringify(data.fingerprint, null, 2));
  
  const keyBuf = Buffer.from(data.key, 'hex');
  const fp = data.fingerprint;
  const canvasBase64 = data.canvasBase64;
  const [timestamp, random] = data.sessionId.split('.');
  
  // Build the fingerprint string with controlled values
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  
  console.log(`\nFP String: ${fpString}`);
  console.log(`FP String length: ${fpString.length}`);
  
  const fpHash = crypto.createHash('sha256').update(fpString).digest();
  console.log(`FP Hash: ${fpHash.toString('hex')}`);
  console.log(`Expected: ${data.key}`);
  
  // Now run a second time with the same controlled values
  console.log('\n=== Running Second Test ===\n');
  
  const browser2 = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page2 = await browser2.newPage();
  await page2.setViewport({ width: 1920, height: 1080 });
  
  await page2.evaluateOnNewDocument(() => {
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
    
    let randomIndex = 0;
    Math.random = function() {
      return 0.5;
    };
    
    let baseTime = 1700000000000;
    Date.now = function() {
      return baseTime++;
    };
    
    window.__canvasData = null;
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
      }
      return result;
    };
    
    localStorage.clear();
  });
  
  await page2.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page2.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const data2 = await page2.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      canvasBase64,
    };
  });
  
  await browser2.close();
  
  console.log(`Key 2: ${data2.key}`);
  console.log(`Session ID 2: ${data2.sessionId}`);
  
  // Compare
  console.log(`\nKeys match: ${data.key === data2.key}`);
  console.log(`Session IDs match: ${data.sessionId === data2.sessionId}`);
  console.log(`Canvas match: ${data.canvasBase64 === data2.canvasBase64}`);
  
  if (data.key === data2.key) {
    console.log('\n*** Keys are deterministic with controlled inputs! ***');
    console.log('This means we can potentially reverse engineer the algorithm.');
  } else {
    console.log('\n*** Keys differ even with controlled inputs ***');
    console.log('There must be additional entropy source we haven\'t controlled.');
  }
}

controlledFingerprint().catch(console.error);
