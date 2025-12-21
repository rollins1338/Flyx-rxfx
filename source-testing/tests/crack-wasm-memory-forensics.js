/**
 * Memory forensics - dump and analyze WASM memory to find XOR derivation
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function memoryForensics() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  await page.evaluateOnNewDocument((ts) => {
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    Math.random = function() { return 0.5; };
    let time = ts * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Dump memory and search for patterns
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    // Access WASM memory through the module
    const memory = wasm.memory || (wasm.__wbindgen_export_0 && wasm.__wbindgen_export_0());
    
    if (!memory) {
      return { key, sessionId, error: 'Could not access WASM memory' };
    }
    
    const buffer = new Uint8Array(memory.buffer);
    
    // Convert key to bytes
    const keyBytes = [];
    for (let i = 0; i < key.length; i += 2) {
      keyBytes.push(parseInt(key.slice(i, i + 2), 16));
    }
    
    // Find all occurrences of the key in memory
    const keyLocations = [];
    for (let i = 0; i < buffer.length - 32; i++) {
      let found = true;
      for (let j = 0; j < 32; j++) {
        if (buffer[i + j] !== keyBytes[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        keyLocations.push(i);
      }
    }
    
    // Find the key as hex string
    const keyHexLocations = [];
    const keyHex = key.toLowerCase();
    for (let i = 0; i < buffer.length - 64; i++) {
      let found = true;
      for (let j = 0; j < 64; j++) {
        if (buffer[i + j] !== keyHex.charCodeAt(j)) {
          found = false;
          break;
        }
      }
      if (found) {
        keyHexLocations.push(i);
      }
    }
    
    // Dump memory around key locations
    const memoryDumps = [];
    for (const loc of keyLocations.slice(0, 3)) {
      const start = Math.max(0, loc - 256);
      const end = Math.min(buffer.length, loc + 288);
      memoryDumps.push({
        location: loc,
        offset: loc - start,
        data: Array.from(buffer.slice(start, end)).map(b => b.toString(16).padStart(2, '0')).join(''),
      });
    }
    
    // Search for fpHash in memory
    // fpHash = SHA256("24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk")
    // = 54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e
    const fpHashHex = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
    const fpHashBytes = [];
    for (let i = 0; i < fpHashHex.length; i += 2) {
      fpHashBytes.push(parseInt(fpHashHex.slice(i, i + 2), 16));
    }
    
    const fpHashLocations = [];
    for (let i = 0; i < buffer.length - 32; i++) {
      let found = true;
      for (let j = 0; j < 32; j++) {
        if (buffer[i + j] !== fpHashBytes[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        fpHashLocations.push(i);
      }
    }
    
    // Search for XOR constant in memory
    // xorConstant = 1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc
    const xorHex = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';
    const xorBytes = [];
    for (let i = 0; i < xorHex.length; i += 2) {
      xorBytes.push(parseInt(xorHex.slice(i, i + 2), 16));
    }
    
    const xorLocations = [];
    for (let i = 0; i < buffer.length - 32; i++) {
      let found = true;
      for (let j = 0; j < 32; j++) {
        if (buffer[i + j] !== xorBytes[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        xorLocations.push(i);
      }
    }
    
    // Search for fingerprint string
    const fpString = '24:Mozilla/5.0';
    const fpStringLocations = [];
    for (let i = 0; i < buffer.length - fpString.length; i++) {
      let found = true;
      for (let j = 0; j < fpString.length; j++) {
        if (buffer[i + j] !== fpString.charCodeAt(j)) {
          found = false;
          break;
        }
      }
      if (found) {
        fpStringLocations.push(i);
      }
    }
    
    return {
      key,
      sessionId,
      memorySize: buffer.length,
      keyLocations,
      keyHexLocations,
      fpHashLocations,
      xorLocations,
      fpStringLocations,
      memoryDumps,
    };
  });
  
  await browser.close();
  
  console.log('=== Memory Forensics Results ===\n');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Memory size:', result.memorySize, 'bytes');
  
  console.log('\n--- Key Locations ---');
  console.log('Key bytes found at:', result.keyLocations);
  console.log('Key hex string found at:', result.keyHexLocations);
  
  console.log('\n--- fpHash Locations ---');
  console.log('fpHash bytes found at:', result.fpHashLocations);
  
  console.log('\n--- XOR Constant Locations ---');
  console.log('XOR constant bytes found at:', result.xorLocations);
  
  console.log('\n--- Fingerprint String Locations ---');
  console.log('Fingerprint string found at:', result.fpStringLocations);
  
  // Analyze memory dumps
  if (result.memoryDumps && result.memoryDumps.length > 0) {
    console.log('\n--- Memory Dump Analysis ---');
    
    const fpHash = '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e';
    const xorConst = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';
    const fpHashBytes = Buffer.from(fpHash, 'hex');
    const xorBytes = Buffer.from(xorConst, 'hex');
    const keyBytes = Buffer.from(result.key, 'hex');
    
    for (const dump of result.memoryDumps) {
      console.log(`\nKey at offset ${dump.location}:`);
      const data = Buffer.from(dump.data, 'hex');
      const keyStart = dump.offset;
      
      // Check bytes before key
      console.log('Checking 256 bytes before key for XOR constant or fpHash...');
      
      for (let i = 0; i <= keyStart - 32; i++) {
        const candidate = data.slice(i, i + 32);
        
        // Check if candidate XOR key = fpHash
        const xored = Buffer.alloc(32);
        for (let j = 0; j < 32; j++) {
          xored[j] = candidate[j] ^ keyBytes[j];
        }
        
        if (xored.equals(fpHashBytes)) {
          console.log(`  FOUND XOR constant at relative offset ${i}!`);
          console.log(`  XOR constant: ${candidate.toString('hex')}`);
        }
        
        // Check if candidate = fpHash
        if (candidate.equals(fpHashBytes)) {
          console.log(`  FOUND fpHash at relative offset ${i}!`);
        }
        
        // Check if candidate = xorConst
        if (candidate.equals(xorBytes)) {
          console.log(`  FOUND known XOR constant at relative offset ${i}!`);
        }
      }
      
      // Check bytes after key
      console.log('Checking 256 bytes after key...');
      const afterStart = keyStart + 32;
      
      for (let i = afterStart; i <= data.length - 32; i++) {
        const candidate = data.slice(i, i + 32);
        
        if (candidate.equals(fpHashBytes)) {
          console.log(`  FOUND fpHash at relative offset ${i}!`);
        }
        
        if (candidate.equals(xorBytes)) {
          console.log(`  FOUND known XOR constant at relative offset ${i}!`);
        }
      }
    }
  }
  
  // If fpHash is not in memory, the XOR must happen byte-by-byte
  if (result.fpHashLocations.length === 0) {
    console.log('\n*** fpHash NOT found in memory as contiguous bytes ***');
    console.log('This suggests the XOR operation happens byte-by-byte during computation.');
  }
  
  if (result.xorLocations.length === 0) {
    console.log('\n*** XOR constant NOT found in memory as contiguous bytes ***');
    console.log('This confirms the XOR constant is computed on-the-fly, not stored.');
  }
  
  return result;
}

memoryForensics().catch(console.error);
