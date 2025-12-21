/**
 * Controlled Multi-Test - Run multiple tests with controlled inputs
 * to find the exact key derivation formula
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function runTest(browser, testConfig) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  await page.evaluateOnNewDocument((config) => {
    // Control screen
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
    
    // Control timezone
    Date.prototype.getTimezoneOffset = function() {
      return 0;
    };
    
    // Control Math.random
    let randomIndex = 0;
    Math.random = function() {
      return config.randomValue;
    };
    
    // Control Date.now
    let time = config.baseTime;
    Date.now = function() {
      return time++;
    };
    
    // Capture canvas
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
  }, testConfig);
  
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

async function controlledMultiTest() {
  console.log('=== Controlled Multi-Test ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const samples = [];
  
  // Test 1: Same timestamp, same random
  console.log('Test 1: baseTime=1700000000000, random=0.5');
  const result1 = await runTest(browser, { baseTime: 1700000000000, randomValue: 0.5 });
  samples.push({ ...result1, config: { baseTime: 1700000000000, randomValue: 0.5 } });
  
  // Test 2: Same timestamp, different random
  console.log('Test 2: baseTime=1700000000000, random=0.1');
  const result2 = await runTest(browser, { baseTime: 1700000000000, randomValue: 0.1 });
  samples.push({ ...result2, config: { baseTime: 1700000000000, randomValue: 0.1 } });
  
  // Test 3: Different timestamp, same random
  console.log('Test 3: baseTime=1700001000000, random=0.5');
  const result3 = await runTest(browser, { baseTime: 1700001000000, randomValue: 0.5 });
  samples.push({ ...result3, config: { baseTime: 1700001000000, randomValue: 0.5 } });
  
  // Test 4: Same as Test 1 (verify determinism)
  console.log('Test 4: baseTime=1700000000000, random=0.5 (repeat)');
  const result4 = await runTest(browser, { baseTime: 1700000000000, randomValue: 0.5 });
  samples.push({ ...result4, config: { baseTime: 1700000000000, randomValue: 0.5 } });
  
  await browser.close();
  
  // Analyze results
  console.log('\n=== Results ===\n');
  
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    console.log(`\nTest ${i + 1}:`);
    console.log(`  Config: baseTime=${s.config.baseTime}, random=${s.config.randomValue}`);
    console.log(`  Session ID: ${s.sessionId}`);
    console.log(`  Key: ${s.key}`);
    
    // Build fingerprint string
    const fp = s.fingerprint;
    const [timestamp] = s.sessionId.split('.');
    const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${s.canvasBase64.slice(0, 50)}`;
    
    const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
    console.log(`  FP Hash: ${fpHash}`);
    
    // Calculate XOR
    const fpHashBuf = Buffer.from(fpHash, 'hex');
    const keyBuf = Buffer.from(s.key, 'hex');
    const xorBuf = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      xorBuf[j] = fpHashBuf[j] ^ keyBuf[j];
    }
    console.log(`  XOR: ${xorBuf.toString('hex')}`);
    
    s.fpString = fpString;
    s.fpHash = fpHash;
    s.xor = xorBuf.toString('hex');
  }
  
  // Check determinism
  console.log('\n=== Determinism Check ===\n');
  console.log(`Test 1 key == Test 4 key: ${samples[0].key === samples[3].key}`);
  console.log(`Test 1 XOR == Test 4 XOR: ${samples[0].xor === samples[3].xor}`);
  
  // Check what changes between tests
  console.log('\n=== Change Analysis ===\n');
  
  // Test 1 vs Test 2: Same timestamp, different random
  console.log('Test 1 vs Test 2 (same timestamp, different random):');
  console.log(`  Session IDs: ${samples[0].sessionId} vs ${samples[1].sessionId}`);
  console.log(`  Keys same: ${samples[0].key === samples[1].key}`);
  console.log(`  XORs same: ${samples[0].xor === samples[1].xor}`);
  console.log(`  FP Hashes same: ${samples[0].fpHash === samples[1].fpHash}`);
  
  // Test 1 vs Test 3: Different timestamp, same random
  console.log('\nTest 1 vs Test 3 (different timestamp, same random):');
  console.log(`  Session IDs: ${samples[0].sessionId} vs ${samples[2].sessionId}`);
  console.log(`  Keys same: ${samples[0].key === samples[2].key}`);
  console.log(`  XORs same: ${samples[0].xor === samples[2].xor}`);
  console.log(`  FP Hashes same: ${samples[0].fpHash === samples[2].fpHash}`);
  
  // Try to find the XOR derivation
  console.log('\n=== XOR Derivation Analysis ===\n');
  
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const xorBuf = Buffer.from(s.xor, 'hex');
    
    console.log(`\nTest ${i + 1}:`);
    
    // Try: XOR = SHA256(sessionId)
    const sessionHash = crypto.createHash('sha256').update(s.sessionId).digest();
    if (sessionHash.equals(xorBuf)) {
      console.log('  *** XOR = SHA256(sessionId) ***');
    }
    
    // Try: XOR = SHA256(random part)
    const [, random] = s.sessionId.split('.');
    const randomHash = crypto.createHash('sha256').update(random).digest();
    if (randomHash.equals(xorBuf)) {
      console.log('  *** XOR = SHA256(random) ***');
    }
    
    // Try: XOR = SHA256(timestamp)
    const [timestamp] = s.sessionId.split('.');
    const timestampHash = crypto.createHash('sha256').update(timestamp).digest();
    if (timestampHash.equals(xorBuf)) {
      console.log('  *** XOR = SHA256(timestamp) ***');
    }
    
    // Try: XOR = HMAC(canvas, timestamp)
    const hmac1 = crypto.createHmac('sha256', s.canvasBase64).update(timestamp).digest();
    if (hmac1.equals(xorBuf)) {
      console.log('  *** XOR = HMAC(canvas, timestamp) ***');
    }
    
    // Try: XOR = HMAC(timestamp, canvas)
    const hmac2 = crypto.createHmac('sha256', timestamp).update(s.canvasBase64).digest();
    if (hmac2.equals(xorBuf)) {
      console.log('  *** XOR = HMAC(timestamp, canvas) ***');
    }
    
    // Try: XOR = HMAC(canvas50, timestamp)
    const hmac3 = crypto.createHmac('sha256', s.canvasBase64.slice(0, 50)).update(timestamp).digest();
    if (hmac3.equals(xorBuf)) {
      console.log('  *** XOR = HMAC(canvas50, timestamp) ***');
    }
    
    // Try: XOR = HMAC(timestamp, canvas50)
    const hmac4 = crypto.createHmac('sha256', timestamp).update(s.canvasBase64.slice(0, 50)).digest();
    if (hmac4.equals(xorBuf)) {
      console.log('  *** XOR = HMAC(timestamp, canvas50) ***');
    }
    
    // Try: XOR = SHA256(canvas + timestamp)
    const concat1 = crypto.createHash('sha256').update(s.canvasBase64 + timestamp).digest();
    if (concat1.equals(xorBuf)) {
      console.log('  *** XOR = SHA256(canvas + timestamp) ***');
    }
    
    // Try: XOR = SHA256(timestamp + canvas)
    const concat2 = crypto.createHash('sha256').update(timestamp + s.canvasBase64).digest();
    if (concat2.equals(xorBuf)) {
      console.log('  *** XOR = SHA256(timestamp + canvas) ***');
    }
    
    // Try: XOR = SHA256(canvas50 + timestamp)
    const concat3 = crypto.createHash('sha256').update(s.canvasBase64.slice(0, 50) + timestamp).digest();
    if (concat3.equals(xorBuf)) {
      console.log('  *** XOR = SHA256(canvas50 + timestamp) ***');
    }
    
    // Try: XOR = SHA256(timestamp + canvas50)
    const concat4 = crypto.createHash('sha256').update(timestamp + s.canvasBase64.slice(0, 50)).digest();
    if (concat4.equals(xorBuf)) {
      console.log('  *** XOR = SHA256(timestamp + canvas50) ***');
    }
    
    // Try: key = SHA256(fpString + random)
    const keyBuf = Buffer.from(s.key, 'hex');
    const keyTest1 = crypto.createHash('sha256').update(s.fpString + random).digest();
    if (keyTest1.equals(keyBuf)) {
      console.log('  *** key = SHA256(fpString + random) ***');
    }
    
    // Try: key = SHA256(random + fpString)
    const keyTest2 = crypto.createHash('sha256').update(random + s.fpString).digest();
    if (keyTest2.equals(keyBuf)) {
      console.log('  *** key = SHA256(random + fpString) ***');
    }
    
    // Try: key = HMAC(fpString, random)
    const keyTest3 = crypto.createHmac('sha256', s.fpString).update(random).digest();
    if (keyTest3.equals(keyBuf)) {
      console.log('  *** key = HMAC(fpString, random) ***');
    }
    
    // Try: key = HMAC(random, fpString)
    const keyTest4 = crypto.createHmac('sha256', random).update(s.fpString).digest();
    if (keyTest4.equals(keyBuf)) {
      console.log('  *** key = HMAC(random, fpString) ***');
    }
    
    // Try: key = HMAC(fpHash, random)
    const fpHashBuf = Buffer.from(s.fpHash, 'hex');
    const keyTest5 = crypto.createHmac('sha256', fpHashBuf).update(random).digest();
    if (keyTest5.equals(keyBuf)) {
      console.log('  *** key = HMAC(fpHash, random) ***');
    }
    
    // Try: key = HMAC(random, fpHash)
    const keyTest6 = crypto.createHmac('sha256', random).update(fpHashBuf).digest();
    if (keyTest6.equals(keyBuf)) {
      console.log('  *** key = HMAC(random, fpHash) ***');
    }
  }
  
  // Output raw data for further analysis
  console.log('\n=== Raw Data ===\n');
  console.log(JSON.stringify(samples.map(s => ({
    sessionId: s.sessionId,
    key: s.key,
    fpHash: s.fpHash,
    xor: s.xor,
    canvasBase64First50: s.canvasBase64.slice(0, 50),
  })), null, 2));
}

controlledMultiTest().catch(console.error);
