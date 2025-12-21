/**
 * Trace SHA256 Input - Find the exact bytes being hashed
 * 
 * Strategy: The SHA256 implementation in WASM will write the hash result
 * to memory. We can find where the key is stored and look at what data
 * was processed before it.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function traceSHA256Input() {
  console.log('=== Trace SHA256 Input ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__memSnapshots = [];
    window.__wasmMem = null;
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      const memory = result.instance.exports.memory;
      window.__wasmMem = memory;
      
      // Wrap get_img_key to take multiple snapshots
      const origGetImgKey = result.instance.exports.get_img_key;
      
      result.instance.exports.get_img_key = function(retptr) {
        // Take snapshot before
        const before = new Uint8Array(memory.buffer.slice(0));
        
        const ret = origGetImgKey.apply(this, arguments);
        
        // Take snapshot after
        const after = new Uint8Array(memory.buffer.slice(0));
        
        // Find the key in memory (32 bytes that match the hex key)
        // The key will be stored somewhere after generation
        
        // Find all 32-byte regions that changed
        const changedRegions = [];
        
        for (let i = 0; i < after.length - 32; i++) {
          // Check if this 32-byte region changed
          let changed = false;
          for (let j = 0; j < 32; j++) {
            if (before[i + j] !== after[i + j]) {
              changed = true;
              break;
            }
          }
          
          if (changed) {
            // Extract the 32 bytes
            const bytes = Array.from(after.slice(i, i + 32));
            const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
            
            changedRegions.push({
              offset: i,
              hex: hex,
              bytes: bytes,
            });
            
            // Skip ahead to avoid overlapping regions
            i += 31;
          }
        }
        
        window.__memSnapshots.push({
          changedRegions: changedRegions.slice(0, 100), // Limit to first 100
        });
        
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
    
    // Find the key in the changed regions
    const keyRegions = [];
    for (const snapshot of window.__memSnapshots) {
      for (const region of snapshot.changedRegions) {
        if (region.hex === key) {
          keyRegions.push(region);
        }
      }
    }
    
    return {
      key,
      sessionId,
      snapshots: window.__memSnapshots,
      keyRegions,
    };
  });
  
  await browser.close();
  
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  console.log(`Snapshots: ${data.snapshots.length}`);
  console.log(`Key found in regions: ${data.keyRegions.length}`);
  
  if (data.keyRegions.length > 0) {
    console.log('\nKey found at offsets:');
    for (const region of data.keyRegions) {
      console.log(`  ${region.offset}`);
    }
  }
  
  // Look at all changed 32-byte regions
  console.log('\n=== Changed 32-byte Regions ===\n');
  
  const keyBuf = Buffer.from(data.key, 'hex');
  
  for (const snapshot of data.snapshots) {
    console.log(`Snapshot with ${snapshot.changedRegions.length} changed regions`);
    
    for (const region of snapshot.changedRegions.slice(0, 20)) {
      const isKey = region.hex === data.key;
      console.log(`  [${region.offset}] ${region.hex.slice(0, 32)}... ${isKey ? '*** KEY ***' : ''}`);
    }
  }
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/sha256-trace.json',
    JSON.stringify(data, null, 2)
  );
}

traceSHA256Input().catch(console.error);
