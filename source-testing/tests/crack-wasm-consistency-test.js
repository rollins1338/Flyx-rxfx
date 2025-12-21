/**
 * Consistency Test - Run multiple times with same inputs
 * 
 * Check if the key generation is deterministic.
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

async function runConsistencyTest() {
  console.log('=== Consistency Test ===\n');
  
  const timestamp = 1700000000;
  const results = [];
  
  // Run 3 times with the same timestamp
  for (let i = 0; i < 3; i++) {
    console.log(`Run ${i + 1}...`);
    const result = await getKeyForTimestamp(timestamp);
    results.push(result);
    console.log(`  Key: ${result.key}`);
    console.log(`  Session ID: ${result.sessionId}`);
  }
  
  // Check if all keys are the same
  const allSame = results.every(r => r.key === results[0].key);
  console.log(`\nAll keys same: ${allSame}`);
  
  if (!allSame) {
    console.log('\nKeys differ! Analyzing differences...');
    
    for (let i = 0; i < results.length; i++) {
      const keyBuf = Buffer.from(results[i].key, 'hex');
      console.log(`\nRun ${i + 1}:`);
      console.log(`  Key bytes: ${Array.from(keyBuf.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
    
    // Find which bytes differ
    console.log('\nByte-by-byte comparison:');
    const key0 = Buffer.from(results[0].key, 'hex');
    for (let i = 1; i < results.length; i++) {
      const keyI = Buffer.from(results[i].key, 'hex');
      const diffs = [];
      for (let j = 0; j < 32; j++) {
        if (key0[j] !== keyI[j]) {
          diffs.push({ pos: j, v0: key0[j], vi: keyI[j] });
        }
      }
      console.log(`  Run 0 vs Run ${i}: ${diffs.length} bytes differ`);
      for (const d of diffs) {
        console.log(`    Byte ${d.pos}: ${d.v0.toString(16)} vs ${d.vi.toString(16)}`);
      }
    }
  }
  
  // Calculate fingerprint hash for first result
  const fp = results[0].fingerprint;
  const [ts] = results[0].sessionId.split('.');
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${results[0].canvasBase64First50}`;
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  
  console.log('\n=== Fingerprint Analysis ===');
  console.log('Fingerprint string:', fpString);
  console.log('Fingerprint hash:', fpHash);
  
  // Calculate XOR for each result
  console.log('\n=== XOR Constants ===');
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  for (let i = 0; i < results.length; i++) {
    const keyBuf = Buffer.from(results[i].key, 'hex');
    const xorBuf = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      xorBuf[j] = fpHashBuf[j] ^ keyBuf[j];
    }
    console.log(`Run ${i + 1} XOR: ${xorBuf.toString('hex')}`);
  }
}

runConsistencyTest().catch(console.error);
