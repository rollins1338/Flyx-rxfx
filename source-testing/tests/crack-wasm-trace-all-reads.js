/**
 * Trace All Reads - Capture every piece of data the WASM reads from the browser
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function traceAllReads() {
  console.log('=== Trace All Browser Reads ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[READ]')) {
      console.log(text);
    }
  });
  
  await page.evaluateOnNewDocument(() => {
    window.__reads = [];
    window.__readOrder = [];
    
    // Intercept all property reads that WASM might use
    const origScreen = window.screen;
    const screenProxy = new Proxy(origScreen, {
      get(target, prop) {
        const value = target[prop];
        if (typeof value !== 'function') {
          window.__reads.push({ type: 'screen', prop, value });
          window.__readOrder.push(`screen.${prop}=${value}`);
          console.log(`[READ] screen.${prop} = ${value}`);
        }
        return value;
      }
    });
    Object.defineProperty(window, 'screen', { value: screenProxy, writable: false });
    
    // Intercept navigator
    const navProps = ['userAgent', 'platform', 'language', 'languages', 'hardwareConcurrency', 'deviceMemory', 'maxTouchPoints'];
    for (const prop of navProps) {
      const origValue = navigator[prop];
      Object.defineProperty(navigator, prop, {
        get() {
          window.__reads.push({ type: 'navigator', prop, value: origValue });
          window.__readOrder.push(`navigator.${prop}=${typeof origValue === 'string' ? origValue.slice(0, 50) : origValue}`);
          console.log(`[READ] navigator.${prop} = ${typeof origValue === 'string' ? origValue.slice(0, 50) : origValue}`);
          return origValue;
        }
      });
    }
    
    // Intercept Date
    const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function() {
      const value = origGetTimezoneOffset.call(this);
      window.__reads.push({ type: 'date', prop: 'timezoneOffset', value });
      window.__readOrder.push(`timezoneOffset=${value}`);
      console.log(`[READ] timezoneOffset = ${value}`);
      return value;
    };
    
    // Intercept Math.random
    const origRandom = Math.random;
    Math.random = function() {
      const value = origRandom.call(this);
      window.__reads.push({ type: 'math', prop: 'random', value });
      window.__readOrder.push(`random=${value}`);
      console.log(`[READ] Math.random = ${value}`);
      return value;
    };
    
    // Intercept Date.now
    const origNow = Date.now;
    Date.now = function() {
      const value = origNow.call(this);
      window.__reads.push({ type: 'date', prop: 'now', value });
      window.__readOrder.push(`now=${value}`);
      console.log(`[READ] Date.now = ${value}`);
      return value;
    };
    
    // Intercept localStorage
    const origGetItem = Storage.prototype.getItem;
    const origSetItem = Storage.prototype.setItem;
    
    Storage.prototype.getItem = function(key) {
      const value = origGetItem.call(this, key);
      if (key === 'tmdb_session_id') {
        window.__reads.push({ type: 'storage', prop: 'getItem', key, value });
        window.__readOrder.push(`getItem(${key})=${value}`);
        console.log(`[READ] localStorage.getItem(${key}) = ${value}`);
      }
      return value;
    };
    
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tmdb_session_id') {
        window.__reads.push({ type: 'storage', prop: 'setItem', key, value });
        window.__readOrder.push(`setItem(${key})=${value}`);
        console.log(`[READ] localStorage.setItem(${key}, ${value})`);
      }
      return origSetItem.call(this, key, value);
    };
    
    // Intercept canvas
    const origFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
      window.__reads.push({ type: 'canvas', prop: 'fillText', text, x, y, font: this.font });
      window.__readOrder.push(`fillText(${text},${x},${y},${this.font})`);
      console.log(`[READ] fillText("${text}", ${x}, ${y}) font=${this.font}`);
      return origFillText.apply(this, arguments);
    };
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__reads.push({ type: 'canvas', prop: 'toDataURL', length: result.length, preview: result.slice(0, 100) });
        window.__readOrder.push(`toDataURL(len=${result.length})`);
        window.__canvasDataURL = result;
        console.log(`[READ] toDataURL length=${result.length}`);
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
    
    return {
      key,
      sessionId,
      reads: window.__reads,
      readOrder: window.__readOrder,
      canvasDataURL: window.__canvasDataURL,
    };
  });
  
  await browser.close();
  
  console.log(`\n=== Results ===\n`);
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  console.log(`\nRead order (${data.readOrder.length} reads):`);
  for (let i = 0; i < data.readOrder.length; i++) {
    console.log(`  ${i + 1}. ${data.readOrder[i]}`);
  }
  
  // Now try to derive the key using the exact read order
  console.log('\n=== Trying Key Derivation with Read Order ===\n');
  
  const keyBuf = Buffer.from(data.key, 'hex');
  
  // Extract values in order
  const values = [];
  for (const read of data.reads) {
    if (read.type === 'screen' && ['width', 'height', 'colorDepth'].includes(read.prop)) {
      values.push(read.value.toString());
    }
    if (read.type === 'navigator' && ['userAgent', 'platform', 'language'].includes(read.prop)) {
      values.push(read.value);
    }
    if (read.type === 'date' && read.prop === 'timezoneOffset') {
      values.push(read.value.toString());
    }
    if (read.type === 'storage' && read.prop === 'setItem' && read.key === 'tmdb_session_id') {
      values.push(read.value);
    }
    if (read.type === 'canvas' && read.prop === 'toDataURL') {
      values.push(data.canvasDataURL?.split(',')[1] || '');
    }
  }
  
  console.log('Values collected:');
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    console.log(`  ${i}: ${typeof v === 'string' && v.length > 50 ? v.slice(0, 50) + '...' : v}`);
  }
  
  // Try different combinations
  const separators = [':', '|', '', '.'];
  
  for (const sep of separators) {
    const combined = values.join(sep);
    const hash = crypto.createHash('sha256').update(combined).digest();
    
    if (hash.equals(keyBuf)) {
      console.log(`\n*** MATCH with separator "${sep}"! ***`);
      console.log(`Format: ${combined.slice(0, 200)}...`);
    }
  }
  
  // Try with truncated values (like we found in memory)
  const [timestamp, random] = data.sessionId.split('.');
  const canvasBase64 = data.canvasDataURL?.split(',')[1] || '';
  
  // Find userAgent in reads
  const uaRead = data.reads.find(r => r.type === 'navigator' && r.prop === 'userAgent');
  const ua = uaRead?.value || '';
  
  // Find other values
  const colorDepthRead = data.reads.find(r => r.type === 'screen' && r.prop === 'colorDepth');
  const platformRead = data.reads.find(r => r.type === 'navigator' && r.prop === 'platform');
  const languageRead = data.reads.find(r => r.type === 'navigator' && r.prop === 'language');
  const tzRead = data.reads.find(r => r.type === 'date' && r.prop === 'timezoneOffset');
  
  const colorDepth = colorDepthRead?.value?.toString() || '24';
  const platform = platformRead?.value || 'Win32';
  const language = languageRead?.value || 'en-US';
  const tz = tzRead?.value?.toString() || '360';
  
  // The format we found in memory
  const memoryFormat = `${colorDepth}:${ua.slice(0, 50)}:${platform}:${language}:${tz}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  
  console.log(`\nMemory format: ${memoryFormat}`);
  console.log(`Memory format length: ${memoryFormat.length}`);
  
  const memoryHash = crypto.createHash('sha256').update(memoryFormat).digest();
  console.log(`Memory format SHA256: ${memoryHash.toString('hex')}`);
  console.log(`Expected key:         ${data.key}`);
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/trace-all-reads.json',
    JSON.stringify({
      key: data.key,
      sessionId: data.sessionId,
      reads: data.reads,
      readOrder: data.readOrder,
    }, null, 2)
  );
  
  console.log('\nData saved to: source-testing/tests/wasm-analysis/trace-all-reads.json');
}

traceAllReads().catch(console.error);
