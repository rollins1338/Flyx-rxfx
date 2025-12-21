/**
 * HMAC Search - The WASM uses hmac-0.12.1
 * Let's find the HMAC key and try to replicate the key derivation
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function hmacSearch() {
  console.log('=== HMAC Key Search ===\n');
  
  // Read the WASM binary
  const wasmPath = 'source-testing/tests/wasm-analysis/client-assets/img_data_bg.wasm';
  const wasm = fs.readFileSync(wasmPath);
  
  // Extract all 32-byte sequences from the data section (after offset 100000)
  const potentialHmacKeys = [];
  
  for (let i = 100000; i < wasm.length - 32; i++) {
    const bytes = wasm.slice(i, i + 32);
    
    // Check if it looks like a key (has entropy)
    const uniqueBytes = new Set(bytes);
    if (uniqueBytes.size >= 8 && uniqueBytes.size <= 32) {
      // Not all same byte, not all zeros
      const allZero = bytes.every(b => b === 0);
      const allSame = bytes.every(b => b === bytes[0]);
      
      if (!allZero && !allSame) {
        potentialHmacKeys.push({
          offset: i,
          hex: bytes.toString('hex'),
          bytes: bytes,
        });
      }
    }
  }
  
  console.log(`Found ${potentialHmacKeys.length} potential HMAC keys`);
  
  // Now test with Puppeteer
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
  
  console.log(`\nKey: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  const fp = data.fingerprint;
  const canvasBase64 = data.canvasBase64;
  const [timestamp, random] = data.sessionId.split('.');
  
  // The fingerprint string
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  
  console.log(`\nFP String: ${fpString}`);
  console.log(`FP String length: ${fpString.length}`);
  
  // Test HMAC with each potential key
  console.log('\n=== Testing HMAC with Embedded Keys ===\n');
  
  let found = false;
  
  // Test first 1000 potential keys
  for (let i = 0; i < Math.min(1000, potentialHmacKeys.length); i++) {
    const potentialKey = potentialHmacKeys[i];
    
    try {
      // HMAC with potential key
      const hmac = crypto.createHmac('sha256', potentialKey.bytes).update(fpString).digest();
      
      if (hmac.equals(keyBuf)) {
        console.log(`*** HMAC MATCH at offset ${potentialKey.offset}! ***`);
        console.log(`Key: ${potentialKey.hex}`);
        found = true;
        break;
      }
      
      // Also try HMAC with fpString as key and potential key as data
      const hmac2 = crypto.createHmac('sha256', fpString).update(potentialKey.bytes).digest();
      
      if (hmac2.equals(keyBuf)) {
        console.log(`*** HMAC MATCH (reversed) at offset ${potentialKey.offset}! ***`);
        console.log(`Data: ${potentialKey.hex}`);
        found = true;
        break;
      }
    } catch (e) {}
    
    if (i % 100 === 0) {
      process.stdout.write(`\rTested ${i}/${Math.min(1000, potentialHmacKeys.length)} keys...`);
    }
  }
  
  console.log('');
  
  if (!found) {
    console.log('No HMAC match found with embedded keys.');
    
    // Try with specific strings from the WASM
    console.log('\n=== Testing HMAC with Known Strings ===\n');
    
    const knownStrings = [
      'tmdb_session_id',
      'canvas2d',
      'TMDB Image Enhancement',
      'Processing capabilities test',
      'top',
      '14px Arial',
      '11px Arial',
      'src\\lib.rs',
      'flixer',
      'image',
      'key',
    ];
    
    for (const str of knownStrings) {
      try {
        const hmac = crypto.createHmac('sha256', str).update(fpString).digest();
        if (hmac.equals(keyBuf)) {
          console.log(`*** HMAC MATCH with key "${str}"! ***`);
          found = true;
          break;
        }
        
        const hmac2 = crypto.createHmac('sha256', fpString).update(str).digest();
        if (hmac2.equals(keyBuf)) {
          console.log(`*** HMAC MATCH with data "${str}"! ***`);
          found = true;
          break;
        }
      } catch (e) {}
    }
  }
  
  if (!found) {
    // Try XOR with embedded constants
    console.log('\n=== Testing XOR with Embedded Constants ===\n');
    
    const fpHash = crypto.createHash('sha256').update(fpString).digest();
    
    for (let i = 0; i < Math.min(500, potentialHmacKeys.length); i++) {
      const potentialKey = potentialHmacKeys[i];
      
      // XOR fpHash with potential key
      const xorResult = Buffer.alloc(32);
      for (let j = 0; j < 32; j++) {
        xorResult[j] = fpHash[j] ^ potentialKey.bytes[j];
      }
      
      if (xorResult.equals(keyBuf)) {
        console.log(`*** XOR MATCH at offset ${potentialKey.offset}! ***`);
        console.log(`XOR key: ${potentialKey.hex}`);
        found = true;
        break;
      }
    }
  }
  
  if (!found) {
    // Try concatenation with embedded constants
    console.log('\n=== Testing Concatenation with Constants ===\n');
    
    for (let i = 0; i < Math.min(200, potentialHmacKeys.length); i++) {
      const potentialKey = potentialHmacKeys[i];
      
      // Hash(fpString + constant)
      const hash1 = crypto.createHash('sha256').update(fpString + potentialKey.hex).digest();
      if (hash1.equals(keyBuf)) {
        console.log(`*** CONCAT MATCH (fp + hex) at offset ${potentialKey.offset}! ***`);
        found = true;
        break;
      }
      
      // Hash(constant + fpString)
      const hash2 = crypto.createHash('sha256').update(potentialKey.hex + fpString).digest();
      if (hash2.equals(keyBuf)) {
        console.log(`*** CONCAT MATCH (hex + fp) at offset ${potentialKey.offset}! ***`);
        found = true;
        break;
      }
      
      // Hash(fpString + bytes)
      const hash3 = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(fpString), potentialKey.bytes])).digest();
      if (hash3.equals(keyBuf)) {
        console.log(`*** CONCAT MATCH (fp + bytes) at offset ${potentialKey.offset}! ***`);
        found = true;
        break;
      }
    }
  }
  
  if (!found) {
    console.log('\nNo match found. The key derivation uses a more complex algorithm.');
  }
}

hmacSearch().catch(console.error);
