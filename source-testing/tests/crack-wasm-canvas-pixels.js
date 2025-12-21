/**
 * Canvas Pixels Analysis - Maybe the key uses raw canvas pixel data
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function canvasPixelsAnalysis() {
  console.log('=== Canvas Pixels Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__canvasCapture = {
      dataURL: null,
      imageData: null,
      pixelHash: null,
    };
    
    // Intercept getImageData
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
      const result = origGetImageData.apply(this, arguments);
      if (this.canvas.width === 200 && this.canvas.height === 50) {
        window.__canvasCapture.imageData = Array.from(result.data);
        console.log(`[CANVAS] getImageData captured: ${result.data.length} bytes`);
      }
      return result;
    };
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasCapture.dataURL = result;
        
        // Also capture the raw pixel data
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          window.__canvasCapture.imageData = Array.from(imageData.data);
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
  
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    return {
      key,
      sessionId,
      canvasCapture: window.__canvasCapture,
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
  
  const keyBuf = Buffer.from(data.key, 'hex');
  const fp = data.fingerprint;
  const [timestamp, random] = data.sessionId.split('.');
  
  // Canvas data
  const canvasBase64 = data.canvasCapture.dataURL?.split(',')[1] || '';
  const pixelData = data.canvasCapture.imageData ? Buffer.from(data.canvasCapture.imageData) : null;
  
  console.log(`\nCanvas base64 length: ${canvasBase64.length}`);
  console.log(`Pixel data length: ${pixelData?.length || 0}`);
  
  if (pixelData) {
    // Hash the raw pixel data
    const pixelHash = crypto.createHash('sha256').update(pixelData).digest();
    console.log(`Pixel data SHA256: ${pixelHash.toString('hex')}`);
    
    // Try using pixel hash in the fingerprint
    console.log('\n=== Testing with Pixel Hash ===\n');
    
    const pixelHashHex = pixelHash.toString('hex');
    
    const formats = [
      // Replace canvas base64 with pixel hash
      `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${pixelHashHex.slice(0, 50)}`,
      `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${pixelHashHex}`,
      
      // Just pixel hash + session
      `${pixelHashHex}:${timestamp}`,
      `${timestamp}:${pixelHashHex}`,
      `${pixelHashHex}:${data.sessionId}`,
      
      // Pixel hash + fingerprint components
      `${fp.colorDepth}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${pixelHashHex}`,
    ];
    
    for (const format of formats) {
      const hash = crypto.createHash('sha256').update(format).digest();
      if (hash.equals(keyBuf)) {
        console.log(`*** MATCH: ${format.slice(0, 100)}... ***`);
      }
    }
    
    // Try HMAC with pixel hash
    console.log('\n=== Testing HMAC with Pixel Hash ===\n');
    
    const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
    
    const hmac1 = crypto.createHmac('sha256', pixelHash).update(fpString).digest();
    console.log(`HMAC(pixelHash, fpString): ${hmac1.toString('hex')}`);
    if (hmac1.equals(keyBuf)) console.log('*** MATCH! ***');
    
    const hmac2 = crypto.createHmac('sha256', fpString).update(pixelHash).digest();
    console.log(`HMAC(fpString, pixelHash): ${hmac2.toString('hex')}`);
    if (hmac2.equals(keyBuf)) console.log('*** MATCH! ***');
    
    // Try XOR
    console.log('\n=== Testing XOR with Pixel Hash ===\n');
    
    const fpHash = crypto.createHash('sha256').update(fpString).digest();
    
    const xor1 = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xor1[i] = fpHash[i] ^ pixelHash[i];
    }
    console.log(`fpHash XOR pixelHash: ${xor1.toString('hex')}`);
    if (xor1.equals(keyBuf)) console.log('*** MATCH! ***');
  }
  
  // Try with the canvas text content
  console.log('\n=== Testing with Canvas Text ===\n');
  
  const canvasText1 = 'TMDB Image Enhancement 🎬';
  const canvasText2 = 'Processing capabilities test';
  const canvasTextCombined = canvasText1 + canvasText2;
  
  const textFormats = [
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasTextCombined}`,
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasText1}`,
    `${canvasTextCombined}:${timestamp}`,
    `${timestamp}:${canvasTextCombined}`,
  ];
  
  for (const format of textFormats) {
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH: ${format.slice(0, 100)}... ***`);
    }
  }
  
  // Try with the full data URL
  console.log('\n=== Testing with Full Data URL ===\n');
  
  const fullDataURL = data.canvasCapture.dataURL;
  
  const urlFormats = [
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${fullDataURL?.slice(0, 50)}`,
    `${fullDataURL}:${timestamp}`,
    `${timestamp}:${fullDataURL}`,
  ];
  
  for (const format of urlFormats) {
    if (!format) continue;
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH: ${format.slice(0, 100)}... ***`);
    }
  }
  
  console.log(`\nExpected: ${data.key}`);
}

canvasPixelsAnalysis().catch(console.error);
