/**
 * Memory Diff - Compare memory before and after key generation
 * to find the fingerprint string
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function memoryDiff() {
  console.log('=== Memory Diff Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__memDiff = {
      before: null,
      after: null,
      strings: [],
    };
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      const memory = result.instance.exports.memory;
      const origGetImgKey = result.instance.exports.get_img_key;
      
      // Wrap get_img_key
      result.instance.exports.get_img_key = function(retptr) {
        // Snapshot before
        window.__memDiff.before = new Uint8Array(memory.buffer.slice(0));
        
        const ret = origGetImgKey.apply(this, arguments);
        
        // Snapshot after
        window.__memDiff.after = new Uint8Array(memory.buffer.slice(0));
        
        // Find all new strings (regions that changed from 0 to printable ASCII)
        const before = window.__memDiff.before;
        const after = window.__memDiff.after;
        
        // Find contiguous regions of printable ASCII that appeared
        let currentString = null;
        
        for (let i = 0; i < after.length; i++) {
          const wasZero = before[i] === 0;
          const isPrintable = after[i] >= 32 && after[i] < 127;
          
          if (isPrintable) {
            if (!currentString) {
              currentString = { start: i, bytes: [] };
            }
            currentString.bytes.push(after[i]);
          } else {
            if (currentString && currentString.bytes.length >= 50) {
              const str = String.fromCharCode(...currentString.bytes);
              window.__memDiff.strings.push({
                offset: currentString.start,
                length: str.length,
                str: str,
              });
            }
            currentString = null;
          }
        }
        
        return ret;
      };
      
      window.__wasmMemory = memory;
      
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
    
    // Also search for strings containing the session ID
    const sessionId = localStorage.getItem('tmdb_session_id');
    const timestamp = sessionId.split('.')[0];
    
    // Filter strings that might be the fingerprint
    const relevantStrings = window.__memDiff.strings.filter(s => {
      // Must contain timestamp or canvas header
      return s.str.includes(timestamp) || s.str.includes('iVBORw');
    });
    
    return {
      key,
      sessionId,
      totalStrings: window.__memDiff.strings.length,
      relevantStrings,
      allStrings: window.__memDiff.strings.slice(0, 50), // First 50 strings
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
  console.log(`Total strings found: ${data.totalStrings}`);
  console.log(`Relevant strings: ${data.relevantStrings.length}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  
  console.log('\n=== Relevant Strings (containing timestamp or canvas) ===\n');
  
  for (const s of data.relevantStrings) {
    console.log(`[${s.offset}] Length: ${s.length}`);
    console.log(`  ${s.str.slice(0, 200)}...`);
    
    // Try to hash
    const hash = crypto.createHash('sha256').update(s.str).digest();
    if (hash.equals(keyBuf)) {
      console.log(`  *** SHA256 MATCH! ***`);
      console.log(`\nFull string:\n${s.str}`);
      
      fs.writeFileSync(
        'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
        s.str
      );
      return;
    }
  }
  
  console.log('\n=== All Strings (first 50) ===\n');
  
  for (const s of data.allStrings) {
    // Skip very short strings
    if (s.length < 100) continue;
    
    console.log(`[${s.offset}] Length: ${s.length}`);
    console.log(`  ${s.str.slice(0, 100)}...`);
    
    // Try to hash
    const hash = crypto.createHash('sha256').update(s.str).digest();
    if (hash.equals(keyBuf)) {
      console.log(`  *** SHA256 MATCH! ***`);
      return;
    }
  }
  
  // Save all data for analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/memory-diff-data.json',
    JSON.stringify({
      key: data.key,
      sessionId: data.sessionId,
      fingerprint: data.fingerprint,
      relevantStrings: data.relevantStrings,
      allStrings: data.allStrings,
    }, null, 2)
  );
  
  console.log('\nData saved to: source-testing/tests/wasm-analysis/memory-diff-data.json');
}

memoryDiff().catch(console.error);
