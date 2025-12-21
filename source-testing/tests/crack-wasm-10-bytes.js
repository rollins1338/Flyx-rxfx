/**
 * Test if only 10 bytes of the first hash are used for the second hash
 * The WAT shows "10" being stored at offset 556, which might be the length
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function test10Bytes() {
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
  
  console.log('\n=== Testing 10-byte Theory ===\n');
  
  // Take first 10 bytes of hash1
  const first10 = hash1.slice(0, 10);
  console.log('First 10 bytes:', first10.toString('hex'));
  
  // Format as hex (20 chars)
  const first10Hex = first10.toString('hex');
  console.log('Hex of first 10 bytes:', first10Hex);
  
  // Second hash of the hex string
  const hash2 = crypto.createHash('sha256').update(first10Hex).digest();
  console.log('SHA256(hex of first 10 bytes):', hash2.toString('hex'));
  
  // Check if this is the key
  console.log('Match WASM key:', hash2.equals(wasmKey));
  
  // Format hash2 as hex
  const hash2Hex = hash2.toString('hex');
  console.log('Hex of hash2:', hash2Hex);
  console.log('Match WASM key (hex):', hash2Hex === result.key);
  
  // Try other interpretations of "10"
  console.log('\n=== Other Interpretations of "10" ===\n');
  
  // Maybe 10 is a format specifier, not length
  // In Rust, format specifiers are:
  // 0 = Display, 1 = Debug, 2 = Octal, 3 = LowerHex, 4 = UpperHex, etc.
  // 10 might be a custom type
  
  // Try formatting as decimal (Display)
  const decimalFormat = Array.from(hash1).join('');
  console.log('Decimal format:', decimalFormat.slice(0, 50) + '...');
  const hash2Decimal = crypto.createHash('sha256').update(decimalFormat).digest();
  console.log('SHA256(decimal):', hash2Decimal.toString('hex'));
  console.log('Match:', hash2Decimal.equals(wasmKey));
  
  // Try with spaces
  const spacedHex = Array.from(hash1).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log('Spaced hex:', spacedHex.slice(0, 50) + '...');
  const hash2Spaced = crypto.createHash('sha256').update(spacedHex).digest();
  console.log('SHA256(spaced hex):', hash2Spaced.toString('hex'));
  console.log('Match:', hash2Spaced.equals(wasmKey));
  
  // Try with 0x prefix
  const prefixedHex = Array.from(hash1).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ');
  console.log('Prefixed hex:', prefixedHex.slice(0, 50) + '...');
  const hash2Prefixed = crypto.createHash('sha256').update(prefixedHex).digest();
  console.log('SHA256(prefixed hex):', hash2Prefixed.toString('hex'));
  console.log('Match:', hash2Prefixed.equals(wasmKey));
  
  // XOR constant analysis
  const xorConstant = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorConstant[i] = hash1[i] ^ wasmKey[i];
  }
  console.log('\n=== XOR Constant ===');
  console.log(xorConstant.toString('hex'));
  
  // Check if XOR constant is related to hash2
  console.log('\nXOR constant == SHA256(hex of first 10):', xorConstant.equals(hash2));
  
  // Try: key = hash1 XOR SHA256(first10Hex)
  const theory = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    theory[i] = hash1[i] ^ hash2[i];
  }
  console.log('hash1 XOR SHA256(first10Hex):', theory.toString('hex'));
  console.log('Match WASM key:', theory.equals(wasmKey));
}

test10Bytes().catch(console.error);
