/**
 * Memory Trace Key - Trace WASM memory during key derivation
 * to find intermediate values and understand the algorithm
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceKeyDerivation() {
  console.log('=== Tracing Key Derivation in WASM Memory ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Control all inputs
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'screen', {
      value: {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1080,
        colorDepth: 24,
        pixelDepth: 24,
      },
      writable: false,
    });
    
    Date.prototype.getTimezoneOffset = function() {
      return 0;
    };
    
    Math.random = function() {
      return 0.5;
    };
    
    let baseTime = 1700000000000;
    Date.now = function() {
      return baseTime++;
    };
    
    window.__canvasData = null;
    window.__memorySnapshots = [];
    
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
  
  // Now let's trace what happens during get_img_key
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    
    // Get the WASM memory
    const memory = wasm.memory || wasm.__wbindgen_export_0;
    if (!memory) {
      return { error: 'Could not find WASM memory' };
    }
    
    // Take a snapshot before calling get_img_key
    const memBefore = new Uint8Array(memory.buffer.slice(0, 2000000));
    
    // Call get_img_key
    const key = wasm.get_img_key();
    
    // Take a snapshot after
    const memAfter = new Uint8Array(memory.buffer.slice(0, 2000000));
    
    // Find differences
    const diffs = [];
    for (let i = 0; i < memBefore.length; i++) {
      if (memBefore[i] !== memAfter[i]) {
        diffs.push({
          offset: i,
          before: memBefore[i],
          after: memAfter[i],
        });
      }
    }
    
    // Look for the key in memory
    const keyBytes = [];
    for (let i = 0; i < key.length; i += 2) {
      keyBytes.push(parseInt(key.substr(i, 2), 16));
    }
    
    const keyLocations = [];
    for (let i = 0; i < memAfter.length - 32; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (memAfter[i + j] !== keyBytes[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        keyLocations.push(i);
      }
    }
    
    // Look for SHA256 intermediate values
    // The fpHash should be in memory somewhere
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      canvasBase64Length: canvasBase64.length,
      canvasBase64First50: canvasBase64.slice(0, 50),
      diffCount: diffs.length,
      keyLocations,
      // Return some diffs around interesting areas
      diffsNearKey: keyLocations.length > 0 ? 
        diffs.filter(d => Math.abs(d.offset - keyLocations[0]) < 200) : [],
      // Look for 32-byte sequences that changed
      changedRegions: findChangedRegions(diffs),
    };
    
    function findChangedRegions(diffs) {
      const regions = [];
      let currentRegion = null;
      
      for (const diff of diffs) {
        if (!currentRegion || diff.offset > currentRegion.end + 4) {
          if (currentRegion && currentRegion.end - currentRegion.start >= 16) {
            regions.push(currentRegion);
          }
          currentRegion = { start: diff.offset, end: diff.offset };
        } else {
          currentRegion.end = diff.offset;
        }
      }
      
      if (currentRegion && currentRegion.end - currentRegion.start >= 16) {
        regions.push(currentRegion);
      }
      
      return regions.slice(0, 20);
    }
  });
  
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Canvas base64 first 50:', result.canvasBase64First50);
  console.log('Diff count:', result.diffCount);
  console.log('Key locations in memory:', result.keyLocations);
  console.log('Changed regions:', result.changedRegions);
  
  // Now let's look at the memory around the key location
  if (result.keyLocations.length > 0) {
    const keyOffset = result.keyLocations[0];
    console.log(`\nKey found at offset ${keyOffset}`);
    
    // Read memory around the key
    const memoryDump = await page.evaluate((offset) => {
      const wasm = window.wasmImgData;
      const memory = wasm.memory || wasm.__wbindgen_export_0;
      const mem = new Uint8Array(memory.buffer);
      
      // Get 256 bytes before and after the key
      const start = Math.max(0, offset - 256);
      const end = Math.min(mem.length, offset + 32 + 256);
      
      const bytes = [];
      for (let i = start; i < end; i++) {
        bytes.push(mem[i]);
      }
      
      return {
        start,
        bytes,
        keyRelativeOffset: offset - start,
      };
    }, keyOffset);
    
    console.log(`\nMemory around key (offset ${memoryDump.start}):`);
    
    // Look for patterns
    const bytes = Buffer.from(memoryDump.bytes);
    
    // Check if there's a hash before the key
    const keyRelOffset = memoryDump.keyRelativeOffset;
    
    // Look for 32-byte sequences before the key
    for (let i = 0; i < keyRelOffset - 32; i += 32) {
      const seq = bytes.slice(i, i + 32);
      const seqHex = seq.toString('hex');
      console.log(`[${memoryDump.start + i}] ${seqHex}`);
    }
    
    console.log(`[${memoryDump.start + keyRelOffset}] ${result.key} <-- KEY`);
    
    // Look for 32-byte sequences after the key
    for (let i = keyRelOffset + 32; i < bytes.length - 32; i += 32) {
      const seq = bytes.slice(i, i + 32);
      const seqHex = seq.toString('hex');
      console.log(`[${memoryDump.start + i}] ${seqHex}`);
    }
  }
  
  // Calculate what we expect
  const fp = {
    colorDepth: 24,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/',
    platform: 'Win32',
    language: 'en-US',
    timezone: 0,
  };
  
  const [timestamp] = result.sessionId.split('.');
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${result.canvasBase64First50}`;
  
  console.log(`\nExpected FP String: ${fpString}`);
  
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  console.log(`Expected FP Hash: ${fpHash}`);
  console.log(`Actual Key: ${result.key}`);
  
  // Calculate XOR
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const keyBuf = Buffer.from(result.key, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  console.log(`XOR constant: ${xorBuf.toString('hex')}`);
  
  await browser.close();
}

traceKeyDerivation().catch(console.error);
