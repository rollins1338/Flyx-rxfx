/**
 * Analyze the XOR constant pattern across multiple timestamps
 * to find any mathematical relationship
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function collectSample(browser, timestamp) {
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
  
  try {
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
    return result;
  } catch (e) {
    await page.close();
    throw e;
  }
}

async function analyzeXorPattern() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  // Collect samples at consecutive timestamps
  const baseTimestamp = 1700000000;
  const samples = [];
  
  console.log('Collecting samples...\n');
  
  for (let i = 0; i < 5; i++) {
    const ts = baseTimestamp + i;
    console.log(`Collecting sample for timestamp ${ts}...`);
    const result = await collectSample(browser, ts);
    
    const fp = result.fingerprint;
    const [sessionTs] = result.sessionId.split('.');
    
    // Build fingerprint string
    const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${sessionTs}:${result.canvasBase64First50}`;
    
    // Calculate hash
    const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
    
    // Calculate XOR constant
    const fpHashBuf = Buffer.from(fpHash, 'hex');
    const keyBuf = Buffer.from(result.key, 'hex');
    const xorBuf = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      xorBuf[j] = fpHashBuf[j] ^ keyBuf[j];
    }
    
    samples.push({
      timestamp: ts,
      fpHash,
      key: result.key,
      xorConstant: xorBuf.toString('hex'),
    });
  }
  
  await browser.close();
  
  console.log('\n=== XOR Constant Analysis ===\n');
  
  for (const s of samples) {
    console.log(`Timestamp: ${s.timestamp}`);
    console.log(`  FP Hash:      ${s.fpHash}`);
    console.log(`  Key:          ${s.key}`);
    console.log(`  XOR Constant: ${s.xorConstant}`);
    console.log();
  }
  
  // Analyze XOR constant differences between consecutive timestamps
  console.log('=== XOR Constant Differences ===\n');
  
  for (let i = 1; i < samples.length; i++) {
    const prev = Buffer.from(samples[i-1].xorConstant, 'hex');
    const curr = Buffer.from(samples[i].xorConstant, 'hex');
    
    const diff = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      diff[j] = prev[j] ^ curr[j];
    }
    
    console.log(`XOR[${samples[i-1].timestamp}] XOR XOR[${samples[i].timestamp}]:`);
    console.log(`  ${diff.toString('hex')}`);
    
    // Check if diff is related to timestamp difference
    const tsDiff = samples[i].timestamp - samples[i-1].timestamp;
    const tsDiffHash = crypto.createHash('sha256').update(tsDiff.toString()).digest('hex');
    console.log(`  SHA256(${tsDiff}): ${tsDiffHash}`);
    console.log(`  Match: ${diff.toString('hex') === tsDiffHash}`);
    console.log();
  }
  
  // Try to find if XOR constant is derived from timestamp in any way
  console.log('=== Testing XOR Constant Derivations ===\n');
  
  for (const s of samples) {
    const ts = s.timestamp;
    const xor = s.xorConstant;
    
    // Test various derivations
    const tests = [
      { name: 'SHA256(ts)', value: crypto.createHash('sha256').update(ts.toString()).digest('hex') },
      { name: 'SHA256(ts bytes LE)', value: crypto.createHash('sha256').update(Buffer.from([ts & 0xff, (ts >> 8) & 0xff, (ts >> 16) & 0xff, (ts >> 24) & 0xff])).digest('hex') },
      { name: 'SHA256(ts bytes BE)', value: crypto.createHash('sha256').update(Buffer.from([(ts >> 24) & 0xff, (ts >> 16) & 0xff, (ts >> 8) & 0xff, ts & 0xff])).digest('hex') },
      { name: 'SHA256(ts * 1000)', value: crypto.createHash('sha256').update((ts * 1000).toString()).digest('hex') },
    ];
    
    console.log(`Timestamp ${ts}:`);
    console.log(`  XOR Constant: ${xor}`);
    
    for (const t of tests) {
      if (t.value === xor) {
        console.log(`  *** MATCH: ${t.name} ***`);
      }
    }
    console.log();
  }
  
  // Analyze byte-by-byte patterns
  console.log('=== Byte-by-Byte Analysis ===\n');
  
  console.log('XOR constant bytes (first 8 bytes):');
  for (const s of samples) {
    const bytes = Buffer.from(s.xorConstant, 'hex');
    console.log(`  ${s.timestamp}: ${Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  }
  
  // Check if any bytes are constant across samples
  console.log('\nConstant bytes across all samples:');
  const firstXor = Buffer.from(samples[0].xorConstant, 'hex');
  for (let i = 0; i < 32; i++) {
    let isConstant = true;
    for (const s of samples) {
      const xorBuf = Buffer.from(s.xorConstant, 'hex');
      if (xorBuf[i] !== firstXor[i]) {
        isConstant = false;
        break;
      }
    }
    if (isConstant) {
      console.log(`  Byte ${i}: 0x${firstXor[i].toString(16).padStart(2, '0')}`);
    }
  }
}

analyzeXorPattern().catch(console.error);
