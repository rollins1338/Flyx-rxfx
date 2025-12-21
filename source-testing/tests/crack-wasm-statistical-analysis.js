/**
 * Statistical Analysis - Collect many samples to find patterns
 * 
 * We know:
 * - key = fpHash XOR xorConstant
 * - xorConstant changes with timestamp
 * - xorConstant does NOT change with random part of sessionId
 * 
 * Let's collect samples with different timestamps and analyze the pattern
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function runTest(browser, timestamp) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.evaluateOnNewDocument((ts) => {
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
    
    let time = ts * 1000;
    Date.now = function() {
      return time++;
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
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      canvasBase64,
      fingerprint: {
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await page.close();
  return result;
}

async function statisticalAnalysis() {
  console.log('=== Statistical Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const samples = [];
  
  // Collect samples with different timestamps
  const timestamps = [
    1700000000,
    1700000001,
    1700000002,
    1700000010,
    1700000100,
    1700001000,
  ];
  
  for (const ts of timestamps) {
    console.log(`Testing timestamp: ${ts}`);
    const result = await runTest(browser, ts);
    
    const fp = result.fingerprint;
    const [timestamp] = result.sessionId.split('.');
    const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 50)}`;
    
    const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
    
    const fpHashBuf = Buffer.from(fpHash, 'hex');
    const keyBuf = Buffer.from(result.key, 'hex');
    const xorBuf = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
    }
    
    samples.push({
      timestamp: parseInt(timestamp),
      sessionId: result.sessionId,
      key: result.key,
      fpHash,
      xor: xorBuf.toString('hex'),
      canvasBase64First50: result.canvasBase64.slice(0, 50),
    });
    
    console.log(`  Key: ${result.key}`);
    console.log(`  XOR: ${xorBuf.toString('hex')}`);
  }
  
  await browser.close();
  
  // Analyze the samples
  console.log('\n=== Analysis ===\n');
  
  // Check if XOR is related to timestamp
  console.log('Checking XOR relationship to timestamp:\n');
  
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const xorBuf = Buffer.from(s.xor, 'hex');
    
    // Try: XOR = SHA256(timestamp as string)
    const tsHash = crypto.createHash('sha256').update(String(s.timestamp)).digest();
    if (tsHash.equals(xorBuf)) {
      console.log(`Sample ${i}: XOR = SHA256(timestamp)`);
    }
    
    // Try: XOR = SHA256(timestamp as bytes)
    const tsBuf = Buffer.alloc(4);
    tsBuf.writeUInt32LE(s.timestamp);
    const tsBytesHash = crypto.createHash('sha256').update(tsBuf).digest();
    if (tsBytesHash.equals(xorBuf)) {
      console.log(`Sample ${i}: XOR = SHA256(timestamp bytes LE)`);
    }
    
    tsBuf.writeUInt32BE(s.timestamp);
    const tsBytesBEHash = crypto.createHash('sha256').update(tsBuf).digest();
    if (tsBytesBEHash.equals(xorBuf)) {
      console.log(`Sample ${i}: XOR = SHA256(timestamp bytes BE)`);
    }
    
    // Try: XOR = HMAC(canvas, timestamp)
    const hmac1 = crypto.createHmac('sha256', s.canvasBase64First50).update(String(s.timestamp)).digest();
    if (hmac1.equals(xorBuf)) {
      console.log(`Sample ${i}: XOR = HMAC(canvas50, timestamp)`);
    }
    
    // Try: XOR = HMAC(timestamp, canvas)
    const hmac2 = crypto.createHmac('sha256', String(s.timestamp)).update(s.canvasBase64First50).digest();
    if (hmac2.equals(xorBuf)) {
      console.log(`Sample ${i}: XOR = HMAC(timestamp, canvas50)`);
    }
    
    // Try: XOR = SHA256(fpHash + timestamp)
    const fpHashBuf = Buffer.from(s.fpHash, 'hex');
    const concat1 = crypto.createHash('sha256').update(Buffer.concat([fpHashBuf, Buffer.from(String(s.timestamp))])).digest();
    if (concat1.equals(xorBuf)) {
      console.log(`Sample ${i}: XOR = SHA256(fpHash + timestamp)`);
    }
    
    // Try: XOR = HMAC(fpHash, timestamp)
    const hmac3 = crypto.createHmac('sha256', fpHashBuf).update(String(s.timestamp)).digest();
    if (hmac3.equals(xorBuf)) {
      console.log(`Sample ${i}: XOR = HMAC(fpHash, timestamp)`);
    }
  }
  
  // Check if there's a linear relationship between timestamps and XOR
  console.log('\n=== XOR Difference Analysis ===\n');
  
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    
    const prevXor = Buffer.from(prev.xor, 'hex');
    const currXor = Buffer.from(curr.xor, 'hex');
    
    const xorDiff = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      xorDiff[j] = prevXor[j] ^ currXor[j];
    }
    
    const tsDiff = curr.timestamp - prev.timestamp;
    
    console.log(`Timestamps ${prev.timestamp} -> ${curr.timestamp} (diff: ${tsDiff})`);
    console.log(`  XOR diff: ${xorDiff.toString('hex')}`);
    
    // Check if XOR diff is related to timestamp diff
    const tsDiffHash = crypto.createHash('sha256').update(String(tsDiff)).digest();
    if (tsDiffHash.equals(xorDiff)) {
      console.log(`  *** XOR diff = SHA256(timestamp diff) ***`);
    }
  }
  
  // Output raw data
  console.log('\n=== Raw Data ===\n');
  console.log(JSON.stringify(samples, null, 2));
}

statisticalAnalysis().catch(console.error);
