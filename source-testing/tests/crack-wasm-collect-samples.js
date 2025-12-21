/**
 * Collect Fresh Samples - Get XOR constants for multiple timestamps
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function getKeyForTimestamp(timestamp) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
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
    
    window.__canvasData = null;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
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
  
  await browser.close();
  
  return result;
}

async function collectSamples() {
  console.log('=== Collecting Fresh Samples ===\n');
  
  const timestamps = [
    1700000000,
    1700000001,
    1700000002,
    1700000003,
    1700000004,
    1700000005,
    1700000010,
    1700000100,
    1700001000,
    1700010000,
  ];
  
  const samples = [];
  
  for (const ts of timestamps) {
    console.log(`Testing timestamp: ${ts}`);
    const result = await getKeyForTimestamp(ts);
    
    // Calculate fingerprint hash
    const fp = result.fingerprint;
    const [timestamp] = result.sessionId.split('.');
    const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64First50}`;
    const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
    
    // Calculate XOR constant
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
  
  // Analyze the samples
  console.log('\n=== Analysis ===\n');
  
  // Check if XOR constants follow a pattern
  console.log('XOR constants (first 8 bytes):');
  for (const s of samples) {
    const xorBuf = Buffer.from(s.xor, 'hex');
    const first8 = xorBuf.slice(0, 8);
    console.log(`ts=${s.timestamp}: ${first8.toString('hex')}`);
  }
  
  // Check consecutive differences
  console.log('\nConsecutive XOR differences:');
  for (let i = 0; i < samples.length - 1; i++) {
    const s1 = samples[i];
    const s2 = samples[i + 1];
    
    const xor1 = Buffer.from(s1.xor, 'hex');
    const xor2 = Buffer.from(s2.xor, 'hex');
    
    const diff = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      diff[j] = xor1[j] ^ xor2[j];
    }
    
    const tsDiff = s2.timestamp - s1.timestamp;
    console.log(`ts ${s1.timestamp} -> ${s2.timestamp} (diff: ${tsDiff}): ${diff.slice(0, 8).toString('hex')}...`);
  }
  
  // Try to find a pattern
  console.log('\n=== Pattern Search ===\n');
  
  // Try: XOR = f(timestamp) for various f
  for (const s of samples) {
    const ts = s.timestamp;
    const xorBuf = Buffer.from(s.xor, 'hex');
    
    // Try SHA256 of various timestamp representations
    const tests = [
      { name: 'SHA256(ts)', val: crypto.createHash('sha256').update(String(ts)).digest() },
      { name: 'SHA256(ts*1000)', val: crypto.createHash('sha256').update(String(ts * 1000)).digest() },
      { name: 'SHA256(ts.5000000)', val: crypto.createHash('sha256').update(`${ts}.5000000`).digest() },
    ];
    
    for (const { name, val } of tests) {
      if (val.equals(xorBuf)) {
        console.log(`*** MATCH for ts=${ts}: XOR = ${name} ***`);
      }
    }
  }
  
  // Output samples for further analysis
  console.log('\n=== Samples JSON ===\n');
  console.log(JSON.stringify(samples, null, 2));
}

collectSamples().catch(console.error);
