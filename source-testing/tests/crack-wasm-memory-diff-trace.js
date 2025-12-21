/**
 * Trace memory changes during get_img_key call
 * Take snapshots before and after to find where values are written
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function traceMemoryDiff() {
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
    
    // Intercept WASM
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      const result = await origInstantiateStreaming.call(this, source, importObject);
      window.__wasmMemory = result.instance.exports.memory;
      return result;
    };
    
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await origInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      if (instance.exports.memory) {
        window.__wasmMemory = instance.exports.memory;
      }
      return result;
    };
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Take memory snapshot, call get_img_key, take another snapshot
  const analysis = await page.evaluate(() => {
    const memory = window.__wasmMemory;
    if (!memory) return { error: 'No memory' };
    
    // Take snapshot before
    const memBefore = new Uint8Array(memory.buffer.slice(0));
    
    // Call get_img_key
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    // Take snapshot after
    const memAfter = new Uint8Array(memory.buffer);
    
    // Find all differences
    const diffs = [];
    for (let i = 0; i < memBefore.length; i++) {
      if (memBefore[i] !== memAfter[i]) {
        diffs.push({ offset: i, before: memBefore[i], after: memAfter[i] });
      }
    }
    
    // Group consecutive diffs
    const groups = [];
    let currentGroup = null;
    
    for (const diff of diffs) {
      if (!currentGroup || diff.offset !== currentGroup.end) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          start: diff.offset,
          end: diff.offset + 1,
          beforeBytes: [diff.before],
          afterBytes: [diff.after],
        };
      } else {
        currentGroup.end = diff.offset + 1;
        currentGroup.beforeBytes.push(diff.before);
        currentGroup.afterBytes.push(diff.after);
      }
    }
    if (currentGroup) groups.push(currentGroup);
    
    // Convert key to bytes
    const keyBytes = [];
    for (let i = 0; i < key.length; i += 2) {
      keyBytes.push(parseInt(key.substr(i, 2), 16));
    }
    
    // Known values
    const fpHashBytes = [0x54, 0xc5, 0x2b, 0x1a, 0x96, 0x97, 0x5f, 0x71, 0xb9, 0xbe, 0x36, 0xe4, 0xa4, 0x65, 0x26, 0x6a, 0x09, 0xea, 0xef, 0xee, 0xdc, 0xf6, 0x8b, 0x9c, 0x3a, 0xc8, 0x89, 0x06, 0x1e, 0xcb, 0xd2, 0x2e];
    const xorBytes = [0x1c, 0x11, 0xd0, 0x4d, 0xa6, 0x59, 0xf2, 0x4b, 0x1c, 0x9e, 0xd0, 0x2e, 0x83, 0x1c, 0xa7, 0x8d, 0x42, 0xc8, 0xee, 0xd0, 0x53, 0x49, 0xc9, 0x18, 0xb1, 0xbb, 0xc1, 0x47, 0x64, 0x68, 0x95, 0xdc];
    
    // Check each group for matches
    const annotatedGroups = groups.map(g => {
      const afterHex = g.afterBytes.map(b => b.toString(16).padStart(2, '0')).join('');
      const beforeHex = g.beforeBytes.map(b => b.toString(16).padStart(2, '0')).join('');
      
      let annotation = '';
      
      // Check if it's the key
      if (g.afterBytes.length >= 32) {
        let isKey = true;
        for (let i = 0; i < 32; i++) {
          if (g.afterBytes[i] !== keyBytes[i]) {
            isKey = false;
            break;
          }
        }
        if (isKey) annotation = 'KEY';
      }
      
      // Check if it's the FP hash
      if (g.afterBytes.length >= 32 && !annotation) {
        let isFpHash = true;
        for (let i = 0; i < 32; i++) {
          if (g.afterBytes[i] !== fpHashBytes[i]) {
            isFpHash = false;
            break;
          }
        }
        if (isFpHash) annotation = 'FP_HASH';
      }
      
      // Check if it's the XOR constant
      if (g.afterBytes.length >= 32 && !annotation) {
        let isXor = true;
        for (let i = 0; i < 32; i++) {
          if (g.afterBytes[i] !== xorBytes[i]) {
            isXor = false;
            break;
          }
        }
        if (isXor) annotation = 'XOR_CONSTANT';
      }
      
      // Check if it's the key hex string
      if (g.afterBytes.length >= 64 && !annotation) {
        const keyHexBytes = new TextEncoder().encode(key);
        let isKeyHex = true;
        for (let i = 0; i < 64; i++) {
          if (g.afterBytes[i] !== keyHexBytes[i]) {
            isKeyHex = false;
            break;
          }
        }
        if (isKeyHex) annotation = 'KEY_HEX_STRING';
      }
      
      return {
        start: g.start,
        length: g.afterBytes.length,
        beforeHex: beforeHex.slice(0, 64),
        afterHex: afterHex.slice(0, 64),
        annotation,
      };
    });
    
    // Filter to groups >= 32 bytes
    const largeGroups = annotatedGroups.filter(g => g.length >= 32);
    
    return {
      key,
      totalDiffs: diffs.length,
      groupCount: groups.length,
      largeGroups,
      allGroups: annotatedGroups.slice(0, 50), // First 50 groups
    };
  });
  
  await browser.close();
  
  console.log('=== Memory Diff Analysis ===');
  console.log('Key:', analysis.key);
  console.log('Total byte changes:', analysis.totalDiffs);
  console.log('Change groups:', analysis.groupCount);
  console.log('Large groups (>=32 bytes):', analysis.largeGroups?.length || 0);
  
  if (analysis.largeGroups?.length > 0) {
    console.log('\n=== Large Groups (>=32 bytes) ===');
    for (const group of analysis.largeGroups) {
      console.log(`\nOffset ${group.start} (${group.length} bytes)${group.annotation ? ' [' + group.annotation + ']' : ''}:`);
      console.log('  Before:', group.beforeHex || '(zeros)');
      console.log('  After: ', group.afterHex);
    }
  }
  
  console.log('\n=== All Groups (first 50) ===');
  for (const group of analysis.allGroups || []) {
    const ann = group.annotation ? ` [${group.annotation}]` : '';
    console.log(`${group.start.toString().padStart(7)}: ${group.length.toString().padStart(4)} bytes${ann}`);
  }
}

traceMemoryDiff().catch(console.error);
