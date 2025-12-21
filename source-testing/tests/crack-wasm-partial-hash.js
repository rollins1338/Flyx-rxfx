/**
 * Test if only partial hash bytes are used in the second hash
 * The WAT shows "10" being stored, which might mean only 10 bytes are used
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function testPartialHash() {
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
  
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  
  // Build fingerprint string
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64First50}`;
  
  console.log('Fingerprint:', fpString);
  console.log('Length:', fpString.length);
  
  // First hash
  const hash1 = crypto.createHash('sha256').update(fpString).digest();
  console.log('\nHash1:', hash1.toString('hex'));
  
  const wasmKey = Buffer.from(result.key, 'hex');
  console.log('WASM Key:', result.key);
  
  // XOR constant
  const xorConstant = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorConstant[i] = hash1[i] ^ wasmKey[i];
  }
  console.log('XOR Constant:', xorConstant.toString('hex'));
  
  console.log('\n=== Testing Partial Hash Theories ===\n');
  
  // Test various partial lengths
  for (const len of [10, 16, 20, 8, 4]) {
    console.log(`\n--- Testing with ${len} bytes ---`);
    
    // Take first N bytes of hash1
    const partial = hash1.slice(0, len);
    console.log(`First ${len} bytes of hash1:`, partial.toString('hex'));
    
    // Hash the partial bytes
    const hash2 = crypto.createHash('sha256').update(partial).digest();
    console.log(`SHA256(first ${len} bytes):`, hash2.toString('hex'));
    
    // Check if this is the XOR constant
    console.log('Match XOR constant:', hash2.equals(xorConstant));
    
    // Hash the hex string of partial
    const partialHex = partial.toString('hex');
    const hash2Hex = crypto.createHash('sha256').update(partialHex).digest();
    console.log(`SHA256(hex of first ${len} bytes):`, hash2Hex.toString('hex'));
    console.log('Match XOR constant:', hash2Hex.equals(xorConstant));
    
    // Try XOR with hash1
    const xored = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xored[i] = hash1[i] ^ hash2[i];
    }
    console.log(`hash1 XOR SHA256(first ${len} bytes):`, xored.toString('hex'));
    console.log('Match WASM key:', xored.equals(wasmKey));
  }
  
  // Test if the second hash input is the formatted hash (hex string)
  console.log('\n=== Testing Hex String Formatting ===\n');
  
  const hash1Hex = hash1.toString('hex');
  
  // Various truncations of hex string
  for (const len of [10, 20, 32, 40, 64]) {
    const truncated = hash1Hex.slice(0, len);
    const hash2 = crypto.createHash('sha256').update(truncated).digest();
    console.log(`SHA256(hex[:${len}]):`, hash2.toString('hex'));
    console.log('Match XOR constant:', hash2.equals(xorConstant));
  }
  
  // Test if the key is derived from double hashing with specific format
  console.log('\n=== Testing Double Hash Formats ===\n');
  
  // Format: "{:02x}" for each byte (lowercase hex with padding)
  const formattedHex = Array.from(hash1).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('Formatted hex:', formattedHex);
  const hash2Formatted = crypto.createHash('sha256').update(formattedHex).digest();
  console.log('SHA256(formatted hex):', hash2Formatted.toString('hex'));
  console.log('Match XOR constant:', hash2Formatted.equals(xorConstant));
  
  // Try with Rust's Debug format: [0x54, 0xc5, ...]
  const rustDebug = '[' + Array.from(hash1).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ') + ']';
  console.log('Rust Debug format:', rustDebug.slice(0, 50) + '...');
  const hash2Debug = crypto.createHash('sha256').update(rustDebug).digest();
  console.log('SHA256(Rust Debug):', hash2Debug.toString('hex'));
  console.log('Match XOR constant:', hash2Debug.equals(xorConstant));
}

testPartialHash().catch(console.error);
