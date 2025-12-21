/**
 * Final Trace - Hook WASM memory writes to find the exact key derivation
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function finalTrace() {
  console.log('=== Final Trace - Memory Write Hooks ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[TRACE]')) {
      console.log(text);
    }
  });
  
  await page.evaluateOnNewDocument(() => {
    window.__traceData = {
      memoryWrites: [],
      sha256Calls: [],
      stringBuilds: [],
    };
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      console.log('[TRACE] Intercepting WASM');
      
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      const memory = result.instance.exports.memory;
      const origGetImgKey = result.instance.exports.get_img_key;
      
      // Create a proxy for memory to track writes
      // This is tricky because WebAssembly.Memory doesn't support proxies directly
      // Instead, we'll take snapshots at key points
      
      result.instance.exports.get_img_key = function(retptr) {
        console.log('[TRACE] get_img_key called');
        
        // Take initial snapshot
        const initialMem = new Uint8Array(memory.buffer.slice(0));
        
        // Call original
        const ret = origGetImgKey.apply(this, arguments);
        
        // Take final snapshot
        const finalMem = new Uint8Array(memory.buffer.slice(0));
        
        // Find all regions that changed
        const changes = [];
        let currentChange = null;
        
        for (let i = 0; i < finalMem.length; i++) {
          if (initialMem[i] !== finalMem[i]) {
            if (!currentChange || i > currentChange.end + 10) {
              if (currentChange && currentChange.end - currentChange.start >= 10) {
                changes.push(currentChange);
              }
              currentChange = { start: i, end: i, bytes: [] };
            }
            currentChange.end = i;
            currentChange.bytes.push({
              offset: i,
              before: initialMem[i],
              after: finalMem[i],
            });
          }
        }
        if (currentChange && currentChange.end - currentChange.start >= 10) {
          changes.push(currentChange);
        }
        
        // Analyze changes
        for (const change of changes) {
          const afterBytes = change.bytes.map(b => b.after);
          const hex = afterBytes.map(b => b.toString(16).padStart(2, '0')).join('');
          const ascii = afterBytes.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
          
          window.__traceData.memoryWrites.push({
            start: change.start,
            length: afterBytes.length,
            hex: hex.slice(0, 128),
            ascii: ascii.slice(0, 64),
          });
        }
        
        console.log(`[TRACE] Found ${changes.length} changed regions`);
        
        return ret;
      };
      
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
      traceData: window.__traceData,
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
  
  console.log(`\nMemory writes: ${data.traceData.memoryWrites.length}`);
  
  // Look for the key in memory writes
  for (const write of data.traceData.memoryWrites) {
    const isKey = write.hex.includes(data.key);
    console.log(`\n[${write.start}] ${write.length} bytes ${isKey ? '*** KEY ***' : ''}`);
    console.log(`  Hex: ${write.hex}...`);
    console.log(`  ASCII: ${write.ascii}`);
    
    // Check if this could be a hash input
    if (write.length >= 100 && write.length <= 200) {
      // Try to hash the ASCII content
      const asciiBytes = [];
      for (let i = 0; i < write.hex.length; i += 2) {
        asciiBytes.push(parseInt(write.hex.slice(i, i + 2), 16));
      }
      const str = String.fromCharCode(...asciiBytes.filter(b => b >= 32 && b < 127));
      
      if (str.length > 50) {
        const hash = crypto.createHash('sha256').update(str).digest();
        if (hash.equals(keyBuf)) {
          console.log(`  *** SHA256 MATCH! ***`);
          console.log(`  Input: ${str}`);
        }
      }
    }
  }
  
  // Try to find the fingerprint string
  console.log('\n=== Looking for Fingerprint String ===\n');
  
  const fp = data.fingerprint;
  const timestamp = data.sessionId.split('.')[0];
  
  // The expected format
  const expectedFormat = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:`;
  console.log(`Expected prefix: ${expectedFormat}`);
  
  for (const write of data.traceData.memoryWrites) {
    if (write.ascii.includes(timestamp)) {
      console.log(`\nFound timestamp at offset ${write.start}:`);
      console.log(`  ${write.ascii}`);
      
      // Try to extract the full fingerprint string
      // The format should be 131 chars
      if (write.length >= 131) {
        const fullStr = write.ascii.slice(0, 131);
        console.log(`  Full string (131 chars): ${fullStr}`);
        
        const hash = crypto.createHash('sha256').update(fullStr).digest();
        console.log(`  SHA256: ${hash.toString('hex')}`);
        console.log(`  Expected: ${data.key}`);
        
        if (hash.equals(keyBuf)) {
          console.log(`  *** MATCH! ***`);
        }
      }
    }
  }
  
  // Save trace data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/final-trace.json',
    JSON.stringify(data, null, 2)
  );
  
  console.log('\nTrace data saved to: source-testing/tests/wasm-analysis/final-trace.json');
}

finalTrace().catch(console.error);
