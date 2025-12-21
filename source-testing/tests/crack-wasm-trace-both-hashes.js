/**
 * Trace both hash operations in the WASM
 * The decompiled code shows:
 * 1. First hash: SHA256(fingerprint_string)
 * 2. Second hash: SHA256(something_derived_from_first_hash)
 * 
 * The final key might be: hash2 XOR hash1, or similar
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceHashes() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
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
      fullCanvasBase64: canvasBase64,
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
  
  console.log('=== Collected Data ===');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  
  // Build fingerprint string
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64First50}`;
  console.log('\nFingerprint string:', fpString);
  console.log('Length:', fpString.length);
  
  // First hash
  const hash1 = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log('\nHash1 (SHA256 of fingerprint):', hash1);
  
  // The key from WASM
  const wasmKey = result.key;
  console.log('WASM Key:', wasmKey);
  
  // XOR between hash1 and key
  const hash1Buf = Buffer.from(hash1, 'hex');
  const keyBuf = Buffer.from(wasmKey, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = hash1Buf[i] ^ keyBuf[i];
  }
  const xorConstant = xorBuf.toString('hex');
  console.log('XOR constant (hash1 XOR key):', xorConstant);
  
  // Now let's try various second hash inputs
  console.log('\n=== Testing Second Hash Theories ===');
  
  // Theory 1: Second hash is SHA256(hash1_hex)
  const hash2_hex = crypto.createHash('sha256').update(hash1).digest('hex');
  console.log('SHA256(hash1_hex):', hash2_hex);
  
  // Theory 2: Second hash is SHA256(hash1_bytes)
  const hash2_bytes = crypto.createHash('sha256').update(hash1Buf).digest('hex');
  console.log('SHA256(hash1_bytes):', hash2_bytes);
  
  // Theory 3: Key = hash1 XOR hash2_hex
  const hash2HexBuf = Buffer.from(hash2_hex, 'hex');
  const theory3 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    theory3[i] = hash1Buf[i] ^ hash2HexBuf[i];
  }
  console.log('hash1 XOR SHA256(hash1_hex):', theory3.toString('hex'));
  
  // Theory 4: Key = hash1 XOR hash2_bytes
  const hash2BytesBuf = Buffer.from(hash2_bytes, 'hex');
  const theory4 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    theory4[i] = hash1Buf[i] ^ hash2BytesBuf[i];
  }
  console.log('hash1 XOR SHA256(hash1_bytes):', theory4.toString('hex'));
  
  // Theory 5: Key = SHA256(timestamp) XOR hash1
  const tsHash = crypto.createHash('sha256').update(ts).digest('hex');
  const tsHashBuf = Buffer.from(tsHash, 'hex');
  const theory5 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    theory5[i] = hash1Buf[i] ^ tsHashBuf[i];
  }
  console.log('hash1 XOR SHA256(timestamp):', theory5.toString('hex'));
  console.log('SHA256(timestamp):', tsHash);
  
  // Theory 6: XOR constant = SHA256(timestamp)
  console.log('\nIs XOR constant = SHA256(timestamp)?', xorConstant === tsHash);
  
  // Theory 7: XOR constant = SHA256(sessionId)
  const sessionHash = crypto.createHash('sha256').update(result.sessionId).digest('hex');
  console.log('Is XOR constant = SHA256(sessionId)?', xorConstant === sessionHash);
  console.log('SHA256(sessionId):', sessionHash);
  
  // Theory 8: Try HMAC
  const hmac1 = crypto.createHmac('sha256', ts).update(fpString).digest('hex');
  console.log('\nHMAC-SHA256(ts, fpString):', hmac1);
  console.log('Is key = HMAC?', wasmKey === hmac1);
  
  // Theory 9: Try with canvas hash
  const canvasHash = crypto.createHash('sha256').update(result.fullCanvasBase64).digest('hex');
  console.log('\nSHA256(full canvas):', canvasHash);
  
  // Theory 10: XOR with canvas hash
  const canvasHashBuf = Buffer.from(canvasHash, 'hex');
  const theory10 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    theory10[i] = hash1Buf[i] ^ canvasHashBuf[i];
  }
  console.log('hash1 XOR SHA256(canvas):', theory10.toString('hex'));
  
  // Check if any match
  console.log('\n=== Match Check ===');
  const theories = [
    { name: 'SHA256(hash1_hex)', value: hash2_hex },
    { name: 'SHA256(hash1_bytes)', value: hash2_bytes },
    { name: 'hash1 XOR SHA256(hash1_hex)', value: theory3.toString('hex') },
    { name: 'hash1 XOR SHA256(hash1_bytes)', value: theory4.toString('hex') },
    { name: 'hash1 XOR SHA256(timestamp)', value: theory5.toString('hex') },
    { name: 'HMAC-SHA256(ts, fpString)', value: hmac1 },
    { name: 'hash1 XOR SHA256(canvas)', value: theory10.toString('hex') },
  ];
  
  for (const t of theories) {
    if (t.value === wasmKey) {
      console.log(`*** MATCH: ${t.name} ***`);
    }
  }
  
  console.log('\nNo direct match found. The XOR constant derivation is more complex.');
  console.log('XOR constant for ts=' + ts + ':', xorConstant);
}

traceHashes().catch(console.error);
