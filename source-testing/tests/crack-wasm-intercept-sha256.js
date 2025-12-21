/**
 * Intercept SHA256 - Hook into the WASM to capture what's being hashed
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptSha256() {
  console.log('=== Intercepting SHA256 ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Control inputs and intercept crypto
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
    window.__cryptoDigests = [];
    window.__subtleDigests = [];
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
      }
      return result;
    };
    
    // Intercept SubtleCrypto.digest
    const origDigest = crypto.subtle.digest;
    crypto.subtle.digest = async function(algorithm, data) {
      const result = await origDigest.call(this, algorithm, data);
      
      // Convert data to string for logging
      let dataStr = '';
      if (data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(data);
        if (bytes.length < 500) {
          dataStr = String.fromCharCode(...bytes);
        } else {
          dataStr = `[${bytes.length} bytes]`;
        }
      } else if (data instanceof Uint8Array) {
        if (data.length < 500) {
          dataStr = String.fromCharCode(...data);
        } else {
          dataStr = `[${data.length} bytes]`;
        }
      }
      
      const resultBytes = new Uint8Array(result);
      const resultHex = Array.from(resultBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      window.__subtleDigests.push({
        algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
        dataLength: data.byteLength || data.length,
        dataPreview: dataStr.slice(0, 200),
        resultHex,
        time: Date.now(),
      });
      
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
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      canvasBase64,
      subtleDigests: window.__subtleDigests,
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
  
  console.log('\n=== SubtleCrypto Digests ===\n');
  for (const digest of result.subtleDigests) {
    console.log(`Algorithm: ${digest.algorithm}`);
    console.log(`Data length: ${digest.dataLength}`);
    console.log(`Data preview: ${digest.dataPreview.replace(/[^\x20-\x7E]/g, '.')}`);
    console.log(`Result: ${digest.resultHex}`);
    console.log('---');
  }
  
  // Build expected fingerprint
  const fp = result.fingerprint;
  const [timestamp] = result.sessionId.split('.');
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64.slice(0, 50)}`;
  
  console.log('\n=== Expected FP String ===\n');
  console.log(fpString);
  console.log(`Length: ${fpString.length}`);
  
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log(`\nExpected FP Hash: ${fpHash}`);
  console.log(`Actual Key: ${result.key}`);
  
  // Check if any of the digests match our expected hash
  console.log('\n=== Matching Digests ===\n');
  for (const digest of result.subtleDigests) {
    if (digest.resultHex === fpHash) {
      console.log('*** Found matching digest! ***');
      console.log(`Data: ${digest.dataPreview}`);
    }
    if (digest.resultHex === result.key) {
      console.log('*** Found digest matching key! ***');
      console.log(`Data: ${digest.dataPreview}`);
    }
  }
  
  // Look for digests with similar length to our fingerprint
  console.log('\n=== Digests with similar data length ===\n');
  for (const digest of result.subtleDigests) {
    if (digest.dataLength >= 120 && digest.dataLength <= 140) {
      console.log(`Length ${digest.dataLength}: ${digest.dataPreview}`);
      console.log(`Result: ${digest.resultHex}`);
    }
  }
}

interceptSha256().catch(console.error);
