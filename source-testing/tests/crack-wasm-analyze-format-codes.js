/**
 * Analyze Format Codes - The WASM seems to use length-prefixed strings
 * 
 * Found patterns:
 * - E60src\lib.rsE1E8E10tmdb_session_id
 * - E13canvas2dE17top14px 'Arial'TMDB Image Enhancement
 * 
 * These might be: E{length}{string}
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function analyzeFormatCodes() {
  console.log('=== Analyze Format Codes ===\n');
  
  // Read the WASM binary
  const wasmPath = 'source-testing/tests/wasm-analysis/client-assets/img_data_bg.wasm';
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  // Find the data section with the format strings
  // Search for "tmdb_session_id"
  const searchStr = 'tmdb_session_id';
  const searchBytes = Buffer.from(searchStr);
  
  let offset = -1;
  for (let i = 0; i < wasmBuffer.length - searchBytes.length; i++) {
    let match = true;
    for (let j = 0; j < searchBytes.length; j++) {
      if (wasmBuffer[i + j] !== searchBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      offset = i;
      break;
    }
  }
  
  console.log(`Found "tmdb_session_id" at offset: ${offset}`);
  
  if (offset > 0) {
    // Read surrounding context
    const start = Math.max(0, offset - 200);
    const end = Math.min(wasmBuffer.length, offset + 200);
    const context = wasmBuffer.slice(start, end);
    
    console.log('\nContext around tmdb_session_id:');
    console.log('Hex:', context.toString('hex'));
    console.log('ASCII:', context.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
  }
  
  // Search for "TMDB Image Enhancement"
  const searchStr2 = 'TMDB Image Enhancement';
  const searchBytes2 = Buffer.from(searchStr2);
  
  let offset2 = -1;
  for (let i = 0; i < wasmBuffer.length - searchBytes2.length; i++) {
    let match = true;
    for (let j = 0; j < searchBytes2.length; j++) {
      if (wasmBuffer[i + j] !== searchBytes2[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      offset2 = i;
      break;
    }
  }
  
  console.log(`\nFound "TMDB Image Enhancement" at offset: ${offset2}`);
  
  if (offset2 > 0) {
    const start = Math.max(0, offset2 - 100);
    const end = Math.min(wasmBuffer.length, offset2 + 100);
    const context = wasmBuffer.slice(start, end);
    
    console.log('\nContext around TMDB Image Enhancement:');
    console.log('Hex:', context.toString('hex'));
    console.log('ASCII:', context.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
  }
  
  // Now let's test with Puppeteer
  console.log('\n=== Testing Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__canvasData = null;
    window.__wasmMem = null;
    
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
    
    // Search memory for the fingerprint string
    const mem = new Uint8Array(window.__wasmMem.buffer);
    const timestamp = sessionId.split('.')[0];
    
    // Find all occurrences of the timestamp
    const timestampBytes = new TextEncoder().encode(timestamp);
    const found = [];
    
    for (let i = 0; i < mem.length - timestampBytes.length; i++) {
      let match = true;
      for (let j = 0; j < timestampBytes.length; j++) {
        if (mem[i + j] !== timestampBytes[j]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        // Extract a larger context
        let start = i;
        while (start > 0 && mem[start - 1] !== 0) {
          start--;
          if (i - start > 5000) break;
        }
        
        let end = i + timestampBytes.length;
        while (end < mem.length && mem[end] !== 0) {
          end++;
          if (end - i > 10000) break;
        }
        
        const bytes = Array.from(mem.slice(start, end));
        
        found.push({
          offset: start,
          length: bytes.length,
          bytes: bytes,
        });
        
        i = end;
      }
    }
    
    return {
      key,
      sessionId,
      canvasBase64,
      found,
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
  console.log(`Found ${data.found.length} memory regions with timestamp`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  
  for (const region of data.found) {
    console.log(`\n[${region.offset}] Length: ${region.length}`);
    
    // Convert bytes to string (handling non-printable)
    const str = region.bytes.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
    console.log(`Content: ${str.slice(0, 200)}...`);
    
    // Try to hash the raw bytes
    const buf = Buffer.from(region.bytes);
    let hash = crypto.createHash('sha256').update(buf).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH (raw bytes)! ***`);
    }
    
    // Try to hash just the printable part
    const printable = region.bytes.filter(b => b >= 32 && b < 127);
    const printableStr = String.fromCharCode(...printable);
    hash = crypto.createHash('sha256').update(printableStr).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH (printable)! ***`);
    }
  }
  
  // Try different format variations
  console.log('\n=== Testing Format Variations ===\n');
  
  const fp = data.fingerprint;
  const canvasBase64 = data.canvasBase64;
  const [timestamp, random] = data.sessionId.split('.');
  
  // The memory shows: 24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:360:1766278596:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk
  // This is 131 chars
  
  // But the hash doesn't match. Maybe there's additional processing.
  
  // Try with the canvas text instead of base64
  const canvasText = 'TMDB Image Enhancement 🎬Processing capabilities test';
  
  const variations = [
    // With canvas text
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasText}`,
    
    // With emoji
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:TMDB Image Enhancement 🎬`,
    
    // Without emoji
    `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:TMDB Image Enhancement`,
    
    // With different canvas lengths
    ...Array.from({length: 20}, (_, i) => 
      `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 45 + i)}`
    ),
    
    // With different userAgent lengths
    ...Array.from({length: 20}, (_, i) => 
      `${fp.colorDepth}:${fp.userAgent.slice(0, 45 + i)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`
    ),
  ];
  
  for (const v of variations) {
    const hash = crypto.createHash('sha256').update(v).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH: ${v.slice(0, 100)}... ***`);
    }
  }
  
  console.log(`\nExpected: ${data.key}`);
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/format-codes-data.json',
    JSON.stringify({
      key: data.key,
      sessionId: data.sessionId,
      fingerprint: data.fingerprint,
      found: data.found.map(f => ({
        offset: f.offset,
        length: f.length,
        preview: f.bytes.slice(0, 200).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join(''),
      })),
    }, null, 2)
  );
}

analyzeFormatCodes().catch(console.error);
