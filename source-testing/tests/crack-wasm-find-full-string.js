/**
 * Find Full Fingerprint String
 * 
 * Based on the partial string found:
 * 24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:360:1766278298:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk
 * 
 * Format appears to be:
 * {colorDepth}:{userAgent_50chars}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64_50chars}
 * 
 * But this is only 131 chars. The full canvas base64 is ~5000 chars.
 * Let's find the full string.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function findFullString() {
  console.log('=== Find Full Fingerprint String ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__wasmMem = null;
    window.__canvasData = null;
    
    // Capture canvas data
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
    const timestamp = sessionId.split('.')[0];
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    // Search for the canvas base64 in memory
    const mem = new Uint8Array(window.__wasmMem.buffer);
    
    // Search for "iVBORw" (PNG header in base64)
    const pngHeader = [105, 86, 66, 79, 82, 119]; // "iVBORw"
    const found = [];
    
    for (let i = 0; i < mem.length - 100; i++) {
      let match = true;
      for (let j = 0; j < pngHeader.length; j++) {
        if (mem[i + j] !== pngHeader[j]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        // Found PNG header, extract the full string
        let start = i;
        while (start > 0 && mem[start - 1] >= 32 && mem[start - 1] < 127) {
          start--;
          if (i - start > 1000) break;
        }
        
        let end = i;
        while (end < mem.length && mem[end] >= 32 && mem[end] < 127) {
          end++;
          if (end - i > 10000) break;
        }
        
        const bytes = mem.slice(start, end);
        const str = String.fromCharCode(...bytes);
        
        found.push({
          offset: start,
          pngOffset: i,
          length: str.length,
          str: str,
        });
        
        i = end;
      }
    }
    
    return {
      key,
      sessionId,
      timestamp,
      canvasBase64Length: canvasBase64.length,
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
  console.log(`Canvas base64 length: ${data.canvasBase64Length}`);
  console.log(`Strings with PNG header: ${data.found.length}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  const fp = data.fingerprint;
  
  // First, let's try the truncated format we found
  console.log('\n=== Testing Truncated Format ===\n');
  
  // Format: {colorDepth}:{userAgent_50}:{platform}:{language}:{timezone}:{timestamp}:{canvas_50}
  const ua50 = fp.userAgent.slice(0, 50);
  
  // We need to get the actual canvas base64 from the page
  // For now, let's try with the found strings
  
  for (const s of data.found) {
    console.log(`\n[${s.offset}] Length: ${s.length}`);
    console.log(`Content: ${s.str.slice(0, 200)}...`);
    
    // Try to hash
    const hash = crypto.createHash('sha256').update(s.str).digest();
    if (hash.equals(keyBuf)) {
      console.log(`\n*** SHA256 MATCH! ***`);
      console.log(`\nFull fingerprint string:\n${s.str}`);
      
      fs.writeFileSync(
        'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
        s.str
      );
      return;
    }
  }
  
  // Try constructing the format manually
  console.log('\n=== Testing Manual Construction ===\n');
  
  // The format from memory was:
  // 24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:360:1766278298:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk
  
  // This is 131 chars total
  // colorDepth (2) + : + userAgent_50 (50) + : + platform (5) + : + language (5) + : + timezone (3) + : + timestamp (10) + : + canvas_50 (50)
  // = 2 + 1 + 50 + 1 + 5 + 1 + 5 + 1 + 3 + 1 + 10 + 1 + 50 = 131 ✓
  
  // So the format is definitely:
  // {colorDepth}:{userAgent.slice(0,50)}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64.slice(0,50)}
  
  // But we need the exact canvas base64 that the WASM generates
  // Let's get it from the found string
  
  if (data.found.length > 0) {
    const foundStr = data.found[0].str;
    const parts = foundStr.split(':');
    
    if (parts.length >= 7) {
      const canvas50 = parts[6];
      console.log(`Canvas 50 from memory: ${canvas50}`);
      
      // Reconstruct
      const reconstructed = `${fp.colorDepth}:${ua50}:${fp.platform}:${fp.language}:${fp.timezone}:${data.timestamp}:${canvas50}`;
      console.log(`\nReconstructed: ${reconstructed}`);
      console.log(`Length: ${reconstructed.length}`);
      
      const hash = crypto.createHash('sha256').update(reconstructed).digest();
      console.log(`Hash: ${hash.toString('hex')}`);
      console.log(`Expected: ${data.key}`);
      
      if (hash.equals(keyBuf)) {
        console.log(`\n*** SHA256 MATCH! ***`);
        
        // Save the format
        fs.writeFileSync(
          'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
          reconstructed
        );
        
        console.log('\n=== FORMAT DISCOVERED ===');
        console.log('Format: {colorDepth}:{userAgent.slice(0,50)}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64.slice(0,50)}');
        return;
      }
    }
  }
  
  console.log('\nNo match. Let me try more variations...');
  
  // Save data for analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/find-full-string.json',
    JSON.stringify(data, null, 2)
  );
}

findFullString().catch(console.error);
