/**
 * Trace XOR Source - Find where the XOR constant comes from
 * 
 * We know: actualKey = SHA256(fpString) XOR xorConstant
 * Now we need to find where xorConstant comes from
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceXorSource() {
  console.log('=== Tracing XOR Constant Source ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Collect multiple samples with different fingerprints
  const samples = [];
  
  for (let testNum = 1; testNum <= 3; testNum++) {
    console.log(`\n=== Test ${testNum} ===\n`);
    
    const testPage = await browser.newPage();
    await testPage.setViewport({ width: 1920, height: 1080 });
    
    // Use different controlled values for each test
    const baseTime = 1700000000000 + (testNum * 1000000);
    const randomValue = 0.1 * testNum;
    
    await testPage.evaluateOnNewDocument((params) => {
      const { baseTime, randomValue, testNum } = params;
      
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
        return randomValue;
      };
      
      let time = baseTime;
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
    }, { baseTime, randomValue, testNum });
    
    await testPage.goto('https://flixer.sh/watch/tv/106379/1/1', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    
    await testPage.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
    
    const data = await testPage.evaluate(() => {
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
    
    await testPage.close();
    
    const fp = data.fingerprint;
    const [timestamp] = data.sessionId.split('.');
    const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${data.canvasBase64.slice(0, 50)}`;
    
    const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
    
    // Calculate XOR constant
    const fpHashBuf = Buffer.from(fpHash, 'hex');
    const keyBuf = Buffer.from(data.key, 'hex');
    const xorBuf = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
    }
    
    const sample = {
      testNum,
      timestamp,
      sessionId: data.sessionId,
      canvasBase64First50: data.canvasBase64.slice(0, 50),
      fpString,
      fpHash,
      actualKey: data.key,
      xorConstant: xorBuf.toString('hex'),
    };
    
    samples.push(sample);
    
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Session ID: ${data.sessionId}`);
    console.log(`FP Hash: ${fpHash}`);
    console.log(`Actual Key: ${data.key}`);
    console.log(`XOR Constant: ${xorBuf.toString('hex')}`);
  }
  
  await browser.close();
  
  // Analyze the XOR constants
  console.log('\n=== Analyzing XOR Constants ===\n');
  
  // Check if all XOR constants are the same
  const allSame = samples.every(s => s.xorConstant === samples[0].xorConstant);
  console.log(`All XOR constants same: ${allSame}`);
  
  if (allSame) {
    console.log(`\n*** XOR constant is STATIC: ${samples[0].xorConstant} ***`);
    console.log('\nThis means the key derivation is:');
    console.log('  key = SHA256(fpString) XOR STATIC_CONSTANT');
    console.log('\nWe can now implement this in pure JS!');
  } else {
    console.log('\nXOR constants differ - analyzing differences...');
    
    for (const sample of samples) {
      console.log(`\nTest ${sample.testNum}:`);
      console.log(`  XOR: ${sample.xorConstant}`);
      
      // Check if XOR is related to timestamp
      const timestampHash = crypto.createHash('sha256').update(sample.timestamp).digest('hex');
      console.log(`  SHA256(timestamp): ${timestampHash}`);
      
      // Check if XOR is related to session ID
      const sessionHash = crypto.createHash('sha256').update(sample.sessionId).digest('hex');
      console.log(`  SHA256(sessionId): ${sessionHash}`);
      
      // Check if XOR is related to canvas
      const canvasHash = crypto.createHash('sha256').update(sample.canvasBase64First50).digest('hex');
      console.log(`  SHA256(canvas50): ${canvasHash}`);
    }
    
    // Check if XOR is derived from canvas (which might be same across tests)
    const canvasHashes = samples.map(s => 
      crypto.createHash('sha256').update(s.canvasBase64First50).digest('hex')
    );
    const canvasSame = canvasHashes.every(h => h === canvasHashes[0]);
    console.log(`\nCanvas hashes same: ${canvasSame}`);
    
    if (canvasSame) {
      console.log('Canvas is same across tests - XOR might be derived from canvas');
      
      // Check if XOR equals canvas hash
      if (samples[0].xorConstant === canvasHashes[0]) {
        console.log('*** XOR constant IS the canvas hash! ***');
      }
    }
  }
  
  // Output the samples for further analysis
  console.log('\n=== Full Sample Data ===\n');
  console.log(JSON.stringify(samples, null, 2));
}

traceXorSource().catch(console.error);
