/**
 * Random Seed Analysis - The WASM calls Math.random() many times
 * Maybe the key is derived from the random values combined with fingerprint
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function randomSeedAnalysis() {
  console.log('=== Random Seed Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__randomValues = [];
    window.__canvasData = null;
    
    // Intercept Math.random
    const origRandom = Math.random;
    Math.random = function() {
      const value = origRandom.call(this);
      window.__randomValues.push(value);
      return value;
    };
    
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
      randomValues: window.__randomValues,
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
  console.log(`Random values collected: ${data.randomValues.length}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  const fp = data.fingerprint;
  const canvasBase64 = data.canvasBase64;
  const [timestamp, random] = data.sessionId.split('.');
  
  // The fingerprint string
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  
  console.log(`\nFP String: ${fpString}`);
  
  // The session ID random part comes from Math.random()
  // Find which random value was used for the session ID
  const sessionRandom = parseFloat('0.' + random);
  const sessionRandomIdx = data.randomValues.findIndex(v => Math.abs(v - sessionRandom) < 0.0000001);
  
  console.log(`\nSession random: ${sessionRandom}`);
  console.log(`Session random index: ${sessionRandomIdx}`);
  
  // Try using random values in key derivation
  console.log('\n=== Testing Random Value Combinations ===\n');
  
  // Maybe the key uses the random value that generated the session ID
  if (sessionRandomIdx >= 0) {
    const randomStr = data.randomValues[sessionRandomIdx].toString();
    
    const formats = [
      `${fpString}:${randomStr}`,
      `${randomStr}:${fpString}`,
      `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${randomStr}:${canvasBase64.slice(0, 50)}`,
    ];
    
    for (const format of formats) {
      const hash = crypto.createHash('sha256').update(format).digest();
      if (hash.equals(keyBuf)) {
        console.log(`*** MATCH: ${format.slice(0, 100)}... ***`);
      }
    }
  }
  
  // Try hashing all random values together
  const allRandomStr = data.randomValues.join('');
  const allRandomHash = crypto.createHash('sha256').update(allRandomStr).digest();
  console.log(`Hash of all random values: ${allRandomHash.toString('hex')}`);
  
  // Try XOR with fingerprint hash
  const fpHash = crypto.createHash('sha256').update(fpString).digest();
  const xorResult = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorResult[i] = fpHash[i] ^ allRandomHash[i];
  }
  console.log(`fpHash XOR allRandomHash: ${xorResult.toString('hex')}`);
  if (xorResult.equals(keyBuf)) console.log('*** MATCH! ***');
  
  // Try with specific random values
  console.log('\n=== Testing Specific Random Values ===\n');
  
  // The random values around the session ID creation might be important
  if (sessionRandomIdx >= 0) {
    const nearbyRandoms = data.randomValues.slice(Math.max(0, sessionRandomIdx - 5), sessionRandomIdx + 5);
    console.log(`Random values near session ID: ${nearbyRandoms.join(', ')}`);
    
    // Try hashing these
    const nearbyStr = nearbyRandoms.join('');
    const nearbyHash = crypto.createHash('sha256').update(nearbyStr).digest();
    console.log(`Hash of nearby randoms: ${nearbyHash.toString('hex')}`);
    
    // Try combining with fingerprint
    const combined = fpString + nearbyStr;
    const combinedHash = crypto.createHash('sha256').update(combined).digest();
    console.log(`Hash of fp + nearby: ${combinedHash.toString('hex')}`);
    if (combinedHash.equals(keyBuf)) console.log('*** MATCH! ***');
  }
  
  console.log(`\nExpected: ${data.key}`);
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/random-seed-data.json',
    JSON.stringify({
      key: data.key,
      sessionId: data.sessionId,
      randomValuesCount: data.randomValues.length,
      randomValues: data.randomValues.slice(0, 100), // First 100
      fingerprint: data.fingerprint,
    }, null, 2)
  );
}

randomSeedAnalysis().catch(console.error);
