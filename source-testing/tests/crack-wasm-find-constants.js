/**
 * Find Constants - Search WASM data section for potential salts/keys
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function findConstants() {
  console.log('=== Find Constants in WASM ===\n');
  
  // Read the WASM binary
  const wasmPath = 'source-testing/tests/wasm-analysis/client-assets/img_data_bg.wasm';
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  console.log(`WASM size: ${wasmBuffer.length} bytes`);
  
  // Search for interesting strings
  const strings = [];
  let currentString = '';
  let currentStart = -1;
  
  for (let i = 0; i < wasmBuffer.length; i++) {
    const byte = wasmBuffer[i];
    if (byte >= 32 && byte < 127) {
      if (currentStart === -1) currentStart = i;
      currentString += String.fromCharCode(byte);
    } else {
      if (currentString.length >= 8) {
        strings.push({ offset: currentStart, str: currentString });
      }
      currentString = '';
      currentStart = -1;
    }
  }
  
  console.log(`Found ${strings.length} strings\n`);
  
  // Look for interesting patterns
  const interestingStrings = strings.filter(s => 
    s.str.includes('key') ||
    s.str.includes('hash') ||
    s.str.includes('sha') ||
    s.str.includes('hmac') ||
    s.str.includes('salt') ||
    s.str.includes('secret') ||
    s.str.includes('tmdb') ||
    s.str.includes('flixer') ||
    s.str.includes('image') ||
    s.str.includes('fingerprint') ||
    s.str.includes('canvas') ||
    s.str.includes('session') ||
    s.str.length === 32 || // Potential hex key
    s.str.length === 64 || // Potential hex key
    /^[a-f0-9]{16,}$/i.test(s.str) // Hex string
  );
  
  console.log('Interesting strings:');
  for (const s of interestingStrings.slice(0, 50)) {
    console.log(`  [${s.offset}] ${s.str.slice(0, 80)}${s.str.length > 80 ? '...' : ''}`);
  }
  
  // Look for format strings (containing {})
  const formatStrings = strings.filter(s => s.str.includes('{}') || s.str.includes('%'));
  console.log('\nFormat strings:');
  for (const s of formatStrings.slice(0, 20)) {
    console.log(`  [${s.offset}] ${s.str}`);
  }
  
  // Look for separator patterns
  const separatorStrings = strings.filter(s => 
    s.str.includes(':') && s.str.length > 10 && s.str.length < 100
  );
  console.log('\nStrings with colons:');
  for (const s of separatorStrings.slice(0, 20)) {
    console.log(`  [${s.offset}] ${s.str}`);
  }
  
  // Now let's test with Puppeteer to see if there's a salt
  console.log('\n=== Testing with Salt Variations ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
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
  const canvasBase64 = data.canvasBase64;
  const [timestamp, random] = data.sessionId.split('.');
  
  // The fingerprint string we found in memory
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  
  console.log(`\nFP String: ${fpString}`);
  
  // Try with various salts from the WASM
  const potentialSalts = [
    'tmdb_image_key',
    'flixer_key',
    'image_enhancement',
    'TMDB Image Enhancement',
    'Processing capabilities test',
    'tmdb_session_id',
    ...interestingStrings.slice(0, 20).map(s => s.str),
  ];
  
  console.log('\nTrying salts...');
  
  for (const salt of potentialSalts) {
    // Try prepending salt
    let hash = crypto.createHash('sha256').update(salt + fpString).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH: salt + fpString, salt="${salt}" ***`);
    }
    
    // Try appending salt
    hash = crypto.createHash('sha256').update(fpString + salt).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH: fpString + salt, salt="${salt}" ***`);
    }
    
    // Try HMAC with salt as key
    try {
      const hmac = crypto.createHmac('sha256', salt).update(fpString).digest();
      if (hmac.equals(keyBuf)) {
        console.log(`*** HMAC MATCH: key="${salt}" ***`);
      }
    } catch (e) {}
    
    // Try HMAC with fpString as key
    try {
      const hmac = crypto.createHmac('sha256', fpString).update(salt).digest();
      if (hmac.equals(keyBuf)) {
        console.log(`*** HMAC MATCH: data="${salt}" ***`);
      }
    } catch (e) {}
  }
  
  // Try with the random part of session ID
  console.log('\nTrying with session random part...');
  
  const withRandom = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${random}:${canvasBase64.slice(0, 50)}`;
  let hash = crypto.createHash('sha256').update(withRandom).digest();
  console.log(`With random: ${hash.toString('hex')}`);
  
  // Try with full session ID
  const withFullSession = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${data.sessionId}:${canvasBase64.slice(0, 50)}`;
  hash = crypto.createHash('sha256').update(withFullSession).digest();
  console.log(`With full session: ${hash.toString('hex')}`);
  
  console.log(`\nExpected: ${data.key}`);
}

findConstants().catch(console.error);
