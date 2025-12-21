/**
 * Multi-timestamp Analysis
 * 
 * Collect XOR constants for multiple timestamps and look for patterns
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function collectSamples() {
  console.log('=== Collecting Multi-timestamp Samples ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const samples = [];
  const timestamps = [
    1700000000,
    1700000001,
    1700000002,
    1700000003,
    1700000010,
    1700000100,
    1700001000,
  ];
  
  for (const ts of timestamps) {
    console.log(`Testing timestamp: ${ts}`);
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.evaluateOnNewDocument((timestamp) => {
      Object.defineProperty(window, 'screen', {
        value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
        writable: false,
      });
      Date.prototype.getTimezoneOffset = function() { return 0; };
      Math.random = function() { return 0.5; };
      let time = timestamp * 1000;
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
    }, ts);
    
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
        canvasBase64First50: canvasBase64.slice(0, 50),
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
    
    const [timestamp] = result.sessionId.split('.');
    const fp = result.fingerprint;
    const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64First50}`;
    const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
    
    const fpHashBuf = Buffer.from(fpHash, 'hex');
    const keyBuf = Buffer.from(result.key, 'hex');
    const xorBuf = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
    }
    
    samples.push({
      timestamp: ts,
      key: result.key,
      fpHash,
      xor: xorBuf.toString('hex'),
    });
    
    console.log(`  Key: ${result.key}`);
    console.log(`  XOR: ${xorBuf.toString('hex')}`);
    console.log('');
  }
  
  await browser.close();
  
  // Analyze the samples
  console.log('\n=== Analyzing XOR Constant Patterns ===\n');
  
  // Look for patterns in XOR constants
  for (let i = 0; i < samples.length - 1; i++) {
    const s1 = samples[i];
    const s2 = samples[i + 1];
    
    const xor1 = Buffer.from(s1.xor, 'hex');
    const xor2 = Buffer.from(s2.xor, 'hex');
    
    // XOR the two XOR constants
    const diff = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      diff[j] = xor1[j] ^ xor2[j];
    }
    
    console.log(`ts ${s1.timestamp} -> ${s2.timestamp} (diff: ${s2.timestamp - s1.timestamp}):`);
    console.log(`  XOR diff: ${diff.toString('hex')}`);
    
    // Check if diff is related to timestamp difference
    const tsDiff = s2.timestamp - s1.timestamp;
    const tsDiffHash = crypto.createHash('sha256').update(String(tsDiff)).digest();
    if (tsDiffHash.equals(diff)) {
      console.log('  *** MATCH: diff = SHA256(tsDiff) ***');
    }
  }
  
  // Check if XOR constants follow a pattern
  console.log('\n=== Checking for PRNG-like patterns ===\n');
  
  // Check if consecutive XOR constants are related by a simple operation
  for (let i = 0; i < samples.length - 1; i++) {
    const xor1 = Buffer.from(samples[i].xor, 'hex');
    const xor2 = Buffer.from(samples[i + 1].xor, 'hex');
    
    // Check if xor2 = SHA256(xor1)
    const hash = crypto.createHash('sha256').update(xor1).digest();
    if (hash.equals(xor2)) {
      console.log(`*** MATCH: XOR[${i+1}] = SHA256(XOR[${i}]) ***`);
    }
    
    // Check if xor2 = HMAC(xor1, timestamp)
    const hmac = crypto.createHmac('sha256', xor1).update(String(samples[i + 1].timestamp)).digest();
    if (hmac.equals(xor2)) {
      console.log(`*** MATCH: XOR[${i+1}] = HMAC(XOR[${i}], ts[${i+1}]) ***`);
    }
  }
  
  // Output raw data for further analysis
  console.log('\n=== Raw Data ===\n');
  console.log(JSON.stringify(samples, null, 2));
}

collectSamples().catch(console.error);
