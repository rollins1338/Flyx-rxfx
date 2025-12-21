/**
 * Hash Variations - Try different hashing methods
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function hashVariations() {
  console.log('=== Hash Variations Test ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__wasmMem = null;
    window.__canvasData = null;
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
      }
      return result;
    };
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      window.__wasmMem = result.instance.exports.memory;
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
    
    // Get the fingerprint string from memory
    const mem = new Uint8Array(window.__wasmMem.buffer);
    const timestamp = sessionId.split('.')[0];
    const timestampBytes = new TextEncoder().encode(timestamp);
    
    let fpString = null;
    
    for (let i = 0; i < mem.length - timestampBytes.length; i++) {
      let match = true;
      for (let j = 0; j < timestampBytes.length; j++) {
        if (mem[i + j] !== timestampBytes[j]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        let start = i;
        while (start > 0 && mem[start - 1] >= 32 && mem[start - 1] < 127) {
          start--;
          if (i - start > 1000) break;
        }
        
        let end = i + timestampBytes.length;
        while (end < mem.length && mem[end] >= 32 && mem[end] < 127) {
          end++;
          if (end - i > 10000) break;
        }
        
        fpString = String.fromCharCode(...mem.slice(start, end));
        break;
      }
    }
    
    return {
      key,
      sessionId,
      timestamp,
      canvasBase64,
      fpString,
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
  console.log(`FP String: ${data.fpString}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  const fp = data.fingerprint;
  const fpString = data.fpString;
  const canvasBase64 = data.canvasBase64;
  const timestamp = data.timestamp;
  
  console.log('\n=== Testing Hash Variations ===\n');
  
  // 1. Simple SHA256
  let hash = crypto.createHash('sha256').update(fpString).digest();
  console.log(`SHA256(fpString): ${hash.toString('hex')}`);
  
  // 2. Double SHA256
  hash = crypto.createHash('sha256').update(
    crypto.createHash('sha256').update(fpString).digest()
  ).digest();
  console.log(`SHA256(SHA256(fpString)): ${hash.toString('hex')}`);
  
  // 3. HMAC with various keys
  const hmacKeys = [
    'tmdb',
    'flixer',
    'image',
    'key',
    timestamp,
    data.sessionId,
    canvasBase64.slice(0, 32),
    fp.userAgent.slice(0, 32),
  ];
  
  for (const key of hmacKeys) {
    try {
      const hmac = crypto.createHmac('sha256', key).update(fpString).digest();
      if (hmac.equals(keyBuf)) {
        console.log(`*** HMAC MATCH with key: ${key} ***`);
      }
    } catch (e) {}
  }
  
  // 4. Try with full canvas base64
  const fullFpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`;
  hash = crypto.createHash('sha256').update(fullFpString).digest();
  console.log(`\nSHA256(full canvas): ${hash.toString('hex')}`);
  
  // 5. Try different truncation lengths for canvas
  console.log('\nTrying different canvas truncation lengths...');
  for (let len = 40; len <= 60; len++) {
    const testFp = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, len)}`;
    hash = crypto.createHash('sha256').update(testFp).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH with canvas length ${len}! ***`);
      console.log(`Format: ${testFp}`);
    }
  }
  
  // 6. Try different userAgent truncation lengths
  console.log('\nTrying different userAgent truncation lengths...');
  for (let len = 40; len <= 60; len++) {
    const testFp = `${fp.colorDepth}:${fp.userAgent.slice(0, len)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
    hash = crypto.createHash('sha256').update(testFp).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH with userAgent length ${len}! ***`);
      console.log(`Format: ${testFp}`);
    }
  }
  
  // 7. Try with session ID random part
  const [ts, rand] = data.sessionId.split('.');
  const withRand = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${rand}:${canvasBase64.slice(0, 50)}`;
  hash = crypto.createHash('sha256').update(withRand).digest();
  console.log(`\nSHA256(with random): ${hash.toString('hex')}`);
  
  // 8. Try with full session ID
  const withFullSid = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${data.sessionId}:${canvasBase64.slice(0, 50)}`;
  hash = crypto.createHash('sha256').update(withFullSid).digest();
  console.log(`SHA256(with full sessionId): ${hash.toString('hex')}`);
  
  // 9. Try without colorDepth
  const noColorDepth = `${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  hash = crypto.createHash('sha256').update(noColorDepth).digest();
  console.log(`SHA256(no colorDepth): ${hash.toString('hex')}`);
  
  // 10. Try with screen dimensions
  const withScreen = `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  hash = crypto.createHash('sha256').update(withScreen).digest();
  console.log(`SHA256(with screen): ${hash.toString('hex')}`);
  
  console.log(`\nExpected key: ${data.key}`);
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/hash-variations-data.json',
    JSON.stringify({
      key: data.key,
      sessionId: data.sessionId,
      fpString: data.fpString,
      fingerprint: data.fingerprint,
      canvasBase64Length: canvasBase64.length,
    }, null, 2)
  );
}

hashVariations().catch(console.error);
