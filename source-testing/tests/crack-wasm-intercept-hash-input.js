/**
 * Intercept Hash Input
 * 
 * The WASM uses SHA256 (confirmed by the H0-H7 constants).
 * Let's intercept the memory writes to the SHA256 state
 * to capture the exact input being hashed.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function interceptHashInput() {
  console.log('=== Intercept Hash Input ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[HASH]') || text.includes('[MEM]')) {
      console.log(text);
    }
  });
  
  await page.evaluateOnNewDocument(() => {
    window.__hashInputs = [];
    window.__memoryAccess = [];
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      window.__wasmMemory = result.instance.exports.memory;
      
      // The SHA256 initial values are at offsets 1050664-1050688
      // We'll monitor memory around these offsets
      
      // Wrap get_img_key to capture memory state at key points
      const origGetImgKey = result.instance.exports.get_img_key;
      result.instance.exports.get_img_key = function(retptr) {
        console.log('[HASH] get_img_key called');
        
        // Take periodic memory snapshots during execution
        const snapshots = [];
        const mem = new Uint8Array(window.__wasmMemory.buffer);
        
        // Snapshot before
        snapshots.push({
          time: 'before',
          // Look for strings in memory
          strings: findStringsInMemory(mem, 0, 100000),
        });
        
        const ret = origGetImgKey.apply(this, arguments);
        
        // Snapshot after
        const memAfter = new Uint8Array(window.__wasmMemory.buffer);
        snapshots.push({
          time: 'after',
          strings: findStringsInMemory(memAfter, 0, 100000),
        });
        
        window.__hashInputs = snapshots;
        
        return ret;
      };
      
      return result;
    };
    
    function findStringsInMemory(mem, start, end) {
      const strings = [];
      let currentStr = '';
      let strStart = start;
      
      for (let i = start; i < end; i++) {
        const byte = mem[i];
        if (byte >= 32 && byte < 127) {
          if (currentStr.length === 0) strStart = i;
          currentStr += String.fromCharCode(byte);
        } else {
          if (currentStr.length > 20) {
            // Check if it looks like fingerprint data
            if (currentStr.includes('data:image') ||
                currentStr.includes('iVBOR') ||
                /^\d+\.\d+$/.test(currentStr) ||
                currentStr.includes('Mozilla') ||
                currentStr.includes('Win32') ||
                currentStr.includes('TMDB')) {
              strings.push({ offset: strStart, str: currentStr.slice(0, 200) });
            }
          }
          currentStr = '';
        }
      }
      
      return strings;
    }
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    return {
      embeddedKey: key,
      sessionId: localStorage.getItem('tmdb_session_id'),
      hashInputs: window.__hashInputs,
    };
  });
  
  await browser.close();
  
  console.log(`\nEmbedded key: ${data.embeddedKey}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  console.log('\n=== Memory Strings ===\n');
  
  for (const snapshot of data.hashInputs) {
    console.log(`\n${snapshot.time.toUpperCase()}:`);
    for (const s of snapshot.strings.slice(0, 20)) {
      console.log(`  [${s.offset}] ${s.str}`);
    }
  }
  
  // Now let's try to find the exact format by looking at what strings appear
  console.log('\n=== Analyzing String Patterns ===\n');
  
  // The key might be derived from a formatted string that appears in memory
  // Let's look for patterns
  
  const afterStrings = data.hashInputs[1]?.strings || [];
  const embeddedKeyBuf = Buffer.from(data.embeddedKey, 'hex');
  
  // Try hashing each string found in memory
  for (const s of afterStrings) {
    const hash = crypto.createHash('sha256').update(s.str).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: String at offset ${s.offset} ***`);
      console.log(`Content: ${s.str}`);
    }
  }
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/hash-intercept.json',
    JSON.stringify(data, null, 2)
  );
  
  console.log('\nData saved to: source-testing/tests/wasm-analysis/hash-intercept.json');
}

interceptHashInput().catch(console.error);
