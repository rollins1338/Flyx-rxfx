/**
 * Test theory: The WASM does SHA256(SHA256(fingerprint).toHex())
 * 
 * Based on decompiled code analysis:
 * 1. First hash: SHA256(fingerprint_string) -> 32 bytes
 * 2. Format to hex string: 64 chars
 * 3. Second hash: SHA256(hex_string) -> 32 bytes
 * 4. XOR the two hashes together
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function testDoubleHashTheory() {
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
  console.log('WASM Key:', result.key);
  console.log('Session ID:', result.sessionId);
  
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  
  // Build fingerprint string
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64First50}`;
  console.log('\nFingerprint string:', fpString);
  console.log('Length:', fpString.length);
  
  // First hash - SHA256 of fingerprint
  const hash1Bytes = crypto.createHash('sha256').update(fpString).digest();
  const hash1Hex = hash1Bytes.toString('hex');
  console.log('\nHash1 (bytes):', hash1Bytes.toString('hex'));
  
  // Second hash - SHA256 of hex string
  const hash2FromHex = crypto.createHash('sha256').update(hash1Hex).digest();
  console.log('Hash2 (SHA256 of hex):', hash2FromHex.toString('hex'));
  
  // Second hash - SHA256 of bytes
  const hash2FromBytes = crypto.createHash('sha256').update(hash1Bytes).digest();
  console.log('Hash2 (SHA256 of bytes):', hash2FromBytes.toString('hex'));
  
  const wasmKeyBuf = Buffer.from(result.key, 'hex');
  
  console.log('\n=== Testing XOR Combinations ===');
  
  // Theory 1: key = hash1 XOR hash2(hex)
  const theory1 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    theory1[i] = hash1Bytes[i] ^ hash2FromHex[i];
  }
  console.log('hash1 XOR SHA256(hash1.hex):', theory1.toString('hex'));
  console.log('Match:', theory1.toString('hex') === result.key);
  
  // Theory 2: key = hash1 XOR hash2(bytes)
  const theory2 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    theory2[i] = hash1Bytes[i] ^ hash2FromBytes[i];
  }
  console.log('\nhash1 XOR SHA256(hash1.bytes):', theory2.toString('hex'));
  console.log('Match:', theory2.toString('hex') === result.key);
  
  // Theory 3: key = hash2(hex) XOR hash2(bytes)
  const theory3 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    theory3[i] = hash2FromHex[i] ^ hash2FromBytes[i];
  }
  console.log('\nSHA256(hex) XOR SHA256(bytes):', theory3.toString('hex'));
  console.log('Match:', theory3.toString('hex') === result.key);
  
  // Theory 4: key = hash2(hex) only
  console.log('\nSHA256(hash1.hex) only:', hash2FromHex.toString('hex'));
  console.log('Match:', hash2FromHex.toString('hex') === result.key);
  
  // Theory 5: key = hash2(bytes) only
  console.log('\nSHA256(hash1.bytes) only:', hash2FromBytes.toString('hex'));
  console.log('Match:', hash2FromBytes.toString('hex') === result.key);
  
  // Calculate XOR constant
  const xorConstant = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorConstant[i] = hash1Bytes[i] ^ wasmKeyBuf[i];
  }
  console.log('\n=== XOR Constant Analysis ===');
  console.log('XOR constant (hash1 XOR wasmKey):', xorConstant.toString('hex'));
  
  // Check if XOR constant matches any hash
  console.log('\nXOR constant == SHA256(hash1.hex)?', xorConstant.toString('hex') === hash2FromHex.toString('hex'));
  console.log('XOR constant == SHA256(hash1.bytes)?', xorConstant.toString('hex') === hash2FromBytes.toString('hex'));
  
  // Theory 6: Maybe the second hash input is formatted differently
  // Try with uppercase hex
  const hash1HexUpper = hash1Hex.toUpperCase();
  const hash2FromHexUpper = crypto.createHash('sha256').update(hash1HexUpper).digest();
  console.log('\nSHA256(hash1.HEX uppercase):', hash2FromHexUpper.toString('hex'));
  console.log('XOR constant == SHA256(uppercase)?', xorConstant.toString('hex') === hash2FromHexUpper.toString('hex'));
  
  // Theory 7: Maybe it's the hash formatted as a specific string
  // Looking at the code, it uses "variant" string and length 10
  // This might be Rust's Debug format for [u8; 32]
  const rustDebugFormat = `[${Array.from(hash1Bytes).join(', ')}]`;
  const hash2FromRustDebug = crypto.createHash('sha256').update(rustDebugFormat).digest();
  console.log('\nRust Debug format:', rustDebugFormat.slice(0, 50) + '...');
  console.log('SHA256(rust debug):', hash2FromRustDebug.toString('hex'));
  console.log('XOR constant == SHA256(rust debug)?', xorConstant.toString('hex') === hash2FromRustDebug.toString('hex'));
  
  // Theory 8: Maybe it's base64 encoded
  const hash1Base64 = hash1Bytes.toString('base64');
  const hash2FromBase64 = crypto.createHash('sha256').update(hash1Base64).digest();
  console.log('\nBase64 format:', hash1Base64);
  console.log('SHA256(base64):', hash2FromBase64.toString('hex'));
  console.log('XOR constant == SHA256(base64)?', xorConstant.toString('hex') === hash2FromBase64.toString('hex'));
}

testDoubleHashTheory().catch(console.error);
