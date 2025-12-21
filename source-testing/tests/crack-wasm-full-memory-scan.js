/**
 * Full Memory Scan - Search entire WASM memory for fingerprint patterns
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function fullMemoryScan() {
  console.log('=== Full Memory Scan ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key first
  const initialData = await page.evaluate(() => {
    return {
      key: window.wasmImgData.get_img_key(),
      sessionId: localStorage.getItem('tmdb_session_id'),
    };
  });
  
  console.log(`Key: ${initialData.key}`);
  console.log(`Session ID: ${initialData.sessionId}`);
  
  // Now scan memory for all long strings
  const memoryData = await page.evaluate(() => {
    // Access WASM memory through the module
    // The memory is typically exported as 'memory'
    const wasmExports = window.wasmImgData;
    
    // Try to find the memory
    let memory = null;
    
    // Check if there's a __wbindgen_export_0 or similar
    for (const key of Object.keys(window)) {
      if (key.includes('wasm') || key.includes('Wasm')) {
        const obj = window[key];
        if (obj && obj.memory && obj.memory.buffer) {
          memory = obj.memory;
          break;
        }
      }
    }
    
    // Also check the wasmImgData object
    if (!memory && wasmExports) {
      for (const key of Object.keys(wasmExports)) {
        const val = wasmExports[key];
        if (val && val.buffer instanceof ArrayBuffer) {
          memory = val;
          break;
        }
      }
    }
    
    if (!memory) {
      // Try to access through the init function's module
      return { error: 'Could not find WASM memory' };
    }
    
    const mem = new Uint8Array(memory.buffer);
    const strings = [];
    
    // Find all contiguous printable ASCII regions
    let currentStart = -1;
    let currentBytes = [];
    
    for (let i = 0; i < mem.length; i++) {
      const byte = mem[i];
      const isPrintable = byte >= 32 && byte < 127;
      
      if (isPrintable) {
        if (currentStart === -1) {
          currentStart = i;
          currentBytes = [];
        }
        currentBytes.push(byte);
      } else {
        if (currentBytes.length >= 100) {
          const str = String.fromCharCode(...currentBytes);
          strings.push({
            offset: currentStart,
            length: str.length,
            str: str,
          });
        }
        currentStart = -1;
        currentBytes = [];
      }
    }
    
    return {
      memorySize: mem.length,
      stringsFound: strings.length,
      strings: strings,
    };
  });
  
  if (memoryData.error) {
    console.log(`Error: ${memoryData.error}`);
    console.log('\nTrying alternative approach...\n');
    
    // Alternative: inject before WASM loads and capture memory reference
    await alternativeMemoryScan();
    return;
  }
  
  console.log(`Memory size: ${memoryData.memorySize}`);
  console.log(`Strings found: ${memoryData.stringsFound}`);
  
  const keyBuf = Buffer.from(initialData.key, 'hex');
  const timestamp = initialData.sessionId.split('.')[0];
  
  console.log('\n=== Searching for fingerprint string ===\n');
  
  // Look for strings containing the timestamp
  const relevantStrings = memoryData.strings.filter(s => 
    s.str.includes(timestamp) || s.str.includes('iVBORw')
  );
  
  console.log(`Strings containing timestamp or canvas: ${relevantStrings.length}`);
  
  for (const s of relevantStrings) {
    console.log(`\n[${s.offset}] Length: ${s.length}`);
    console.log(`Content: ${s.str.slice(0, 300)}...`);
    
    // Try to hash
    const hash = crypto.createHash('sha256').update(s.str).digest();
    if (hash.equals(keyBuf)) {
      console.log(`\n*** SHA256 MATCH! ***`);
      console.log(`\nFull fingerprint string:\n${s.str}`);
      
      fs.writeFileSync(
        'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
        s.str
      );
      
      // Analyze the format
      console.log('\n=== Format Analysis ===');
      const parts = s.str.split(':');
      console.log(`Parts (${parts.length}):`);
      for (let i = 0; i < parts.length; i++) {
        console.log(`  ${i}: ${parts[i].slice(0, 50)}${parts[i].length > 50 ? '...' : ''}`);
      }
      
      await browser.close();
      return;
    }
  }
  
  await browser.close();
  
  console.log('\nNo direct match found.');
  
  // Save data for analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/full-memory-scan.json',
    JSON.stringify({
      key: initialData.key,
      sessionId: initialData.sessionId,
      relevantStrings: relevantStrings,
    }, null, 2)
  );
}

async function alternativeMemoryScan() {
  console.log('=== Alternative Memory Scan ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Inject to capture memory reference during WASM init
  await page.evaluateOnNewDocument(() => {
    window.__wasmMem = null;
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      window.__wasmMem = result.instance.exports.memory;
      console.log('[WASM] Memory captured, size:', window.__wasmMem.buffer.byteLength);
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
    
    if (!window.__wasmMem) {
      return { error: 'Memory not captured' };
    }
    
    const mem = new Uint8Array(window.__wasmMem.buffer);
    
    // Search for strings containing the timestamp
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
        // Found timestamp, extract surrounding context
        let start = i;
        while (start > 0 && mem[start - 1] >= 32 && mem[start - 1] < 127) {
          start--;
          if (i - start > 5000) break;
        }
        
        let end = i + timestampBytes.length;
        while (end < mem.length && mem[end] >= 32 && mem[end] < 127) {
          end++;
          if (end - i > 10000) break;
        }
        
        const bytes = mem.slice(start, end);
        const str = String.fromCharCode(...bytes);
        
        found.push({
          offset: start,
          timestampOffset: i,
          length: str.length,
          str: str,
        });
        
        // Skip ahead
        i = end;
      }
    }
    
    return {
      key,
      sessionId,
      timestamp,
      memorySize: mem.length,
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
  
  if (data.error) {
    console.log(`Error: ${data.error}`);
    return;
  }
  
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  console.log(`Memory size: ${data.memorySize}`);
  console.log(`Strings with timestamp: ${data.found.length}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  
  for (const s of data.found) {
    console.log(`\n[${s.offset}] Length: ${s.length}`);
    console.log(`Content: ${s.str.slice(0, 300)}...`);
    
    // Try to hash
    const hash = crypto.createHash('sha256').update(s.str).digest();
    if (hash.equals(keyBuf)) {
      console.log(`\n*** SHA256 MATCH! ***`);
      console.log(`\nFull fingerprint string:\n${s.str}`);
      
      fs.writeFileSync(
        'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
        s.str
      );
      
      // Analyze the format
      console.log('\n=== Format Analysis ===');
      const parts = s.str.split(':');
      console.log(`Parts (${parts.length}):`);
      for (let i = 0; i < parts.length; i++) {
        console.log(`  ${i}: ${parts[i].slice(0, 50)}${parts[i].length > 50 ? '...' : ''}`);
      }
      return;
    }
    
    // Try variations
    const trimmed = s.str.trim();
    const hashTrimmed = crypto.createHash('sha256').update(trimmed).digest();
    if (hashTrimmed.equals(keyBuf)) {
      console.log(`\n*** SHA256 MATCH (trimmed)! ***`);
      console.log(`\nFull fingerprint string:\n${trimmed}`);
      return;
    }
  }
  
  console.log('\nNo direct match found.');
  
  // Let's try to manually construct the format based on what we found
  if (data.found.length > 0) {
    console.log('\n=== Analyzing Found Strings ===\n');
    
    const longestStr = data.found.reduce((a, b) => a.length > b.length ? a : b);
    console.log(`Longest string (${longestStr.length} chars):`);
    console.log(longestStr.str.slice(0, 500));
    
    // Parse the format
    const parts = longestStr.str.split(':');
    console.log(`\nParts (${parts.length}):`);
    for (let i = 0; i < Math.min(parts.length, 10); i++) {
      const part = parts[i];
      console.log(`  ${i}: ${part.slice(0, 80)}${part.length > 80 ? '...' : ''} (${part.length} chars)`);
    }
    
    // Save for analysis
    fs.writeFileSync(
      'source-testing/tests/wasm-analysis/found-string.txt',
      longestStr.str
    );
    console.log('\nSaved to: source-testing/tests/wasm-analysis/found-string.txt');
  }
}

fullMemoryScan().catch(console.error);
