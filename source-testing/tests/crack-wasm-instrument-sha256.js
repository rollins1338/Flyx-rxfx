/**
 * Instrument SHA256 in WASM
 * 
 * The WASM uses function 122 for SHA256 update and function 175 for finalize.
 * Let's instrument these to capture the exact data being hashed.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function instrumentSha256() {
  console.log('=== Instrument SHA256 in WASM ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM to instrument SHA256 functions
  await page.evaluateOnNewDocument(() => {
    window.__sha256Trace = {
      updates: [],
      finalizes: [],
      memorySnapshots: [],
    };
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      window.__wasmMemory = result.instance.exports.memory;
      window.__wasmExports = result.instance.exports;
      
      // The WASM table contains function pointers
      // We can't easily wrap internal functions, but we can monitor memory
      
      // Wrap get_img_key to capture memory state
      const origGetImgKey = result.instance.exports.get_img_key;
      result.instance.exports.get_img_key = function(retptr) {
        console.log('[WASM] get_img_key called');
        
        // Take memory snapshot before
        const memBefore = new Uint8Array(window.__wasmMemory.buffer.slice(0, 100000));
        
        const startTime = performance.now();
        const ret = origGetImgKey.apply(this, arguments);
        const endTime = performance.now();
        
        // Take memory snapshot after
        const memAfter = new Uint8Array(window.__wasmMemory.buffer.slice(0, 100000));
        
        console.log(`[WASM] get_img_key completed in ${endTime - startTime}ms`);
        
        // Find memory regions that changed
        const changes = [];
        for (let i = 0; i < memBefore.length; i++) {
          if (memBefore[i] !== memAfter[i]) {
            changes.push({ offset: i, before: memBefore[i], after: memAfter[i] });
          }
        }
        
        // Group consecutive changes
        const groups = [];
        let currentGroup = null;
        for (const change of changes) {
          if (!currentGroup || change.offset !== currentGroup.end) {
            if (currentGroup) groups.push(currentGroup);
            currentGroup = { start: change.offset, end: change.offset + 1, bytes: [change.after] };
          } else {
            currentGroup.end = change.offset + 1;
            currentGroup.bytes.push(change.after);
          }
        }
        if (currentGroup) groups.push(currentGroup);
        
        // Look for 32-byte sequences (potential SHA256 outputs)
        const sha256Candidates = [];
        for (const group of groups) {
          if (group.bytes.length >= 32) {
            // Check if it looks like a hash (high entropy)
            const bytes = group.bytes.slice(0, 32);
            const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
            sha256Candidates.push({ offset: group.start, hex });
          }
        }
        
        window.__sha256Trace.memorySnapshots.push({
          changesCount: changes.length,
          groupsCount: groups.length,
          sha256Candidates,
          largestGroups: groups.sort((a, b) => b.bytes.length - a.bytes.length).slice(0, 10).map(g => ({
            start: g.start,
            length: g.bytes.length,
            preview: g.bytes.slice(0, 64).map(b => b.toString(16).padStart(2, '0')).join(''),
          })),
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
  
  // Get the key and trace data
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    return {
      embeddedKey: key,
      sessionId: localStorage.getItem('tmdb_session_id'),
      sha256Trace: window.__sha256Trace,
    };
  });
  
  await browser.close();
  
  console.log(`Embedded key: ${data.embeddedKey}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  if (data.sha256Trace.memorySnapshots.length > 0) {
    const snapshot = data.sha256Trace.memorySnapshots[0];
    console.log(`\nMemory changes: ${snapshot.changesCount}`);
    console.log(`Change groups: ${snapshot.groupsCount}`);
    
    console.log('\nSHA256 candidates (32-byte sequences):');
    for (const candidate of snapshot.sha256Candidates) {
      const isKey = candidate.hex === data.embeddedKey;
      console.log(`  ${candidate.offset}: ${candidate.hex} ${isKey ? '*** KEY ***' : ''}`);
    }
    
    console.log('\nLargest memory change groups:');
    for (const group of snapshot.largestGroups) {
      console.log(`  ${group.start}: ${group.length} bytes`);
      console.log(`    ${group.preview.slice(0, 64)}...`);
    }
  }
  
  // Now let's try to find the input to SHA256 by looking at the memory
  console.log('\n=== Analyzing Memory for SHA256 Input ===\n');
  
  // The key is derived from fingerprint data
  // Let's capture the exact fingerprint string
  
  const browser2 = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page2 = await browser2.newPage();
  
  // Capture the exact strings being created
  await page2.evaluateOnNewDocument(() => {
    window.__strings = [];
    
    // Intercept string creation in WASM
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      // Wrap __wbindgen_string_new to capture strings
      if (imports && imports.wbg && imports.wbg.__wbindgen_string_new) {
        const orig = imports.wbg.__wbindgen_string_new;
        imports.wbg.__wbindgen_string_new = function(ptr, len) {
          // Read the string from memory after WASM is initialized
          if (window.__wasmMemory) {
            const mem = new Uint8Array(window.__wasmMemory.buffer);
            let str = '';
            for (let i = 0; i < len; i++) {
              str += String.fromCharCode(mem[ptr + i]);
            }
            window.__strings.push({ ptr, len, str: str.slice(0, 200) });
          }
          return orig.apply(this, arguments);
        };
      }
      
      const result = await origInstantiateStreaming.call(this, source, imports);
      window.__wasmMemory = result.instance.exports.memory;
      return result;
    };
    
    localStorage.clear();
  });
  
  await page2.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page2.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const data2 = await page2.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    return {
      embeddedKey: key,
      sessionId: localStorage.getItem('tmdb_session_id'),
      strings: window.__strings,
    };
  });
  
  await browser2.close();
  
  console.log(`Embedded key (2nd run): ${data2.embeddedKey}`);
  console.log(`Session ID (2nd run): ${data2.sessionId}`);
  console.log(`\nStrings created during key derivation: ${data2.strings.length}`);
  
  // Filter for interesting strings
  const interestingStrings = data2.strings.filter(s => 
    s.str.length > 10 && 
    (s.str.includes('data:') || 
     s.str.includes('image') || 
     /^\d+\.\d+$/.test(s.str) ||
     /^[a-f0-9]{32,}$/i.test(s.str) ||
     s.str.includes('TMDB') ||
     s.str.includes('800') ||
     s.str.includes('600'))
  );
  
  console.log('\nInteresting strings:');
  for (const s of interestingStrings.slice(0, 20)) {
    console.log(`  [${s.ptr}:${s.len}] ${s.str.slice(0, 100)}${s.str.length > 100 ? '...' : ''}`);
  }
  
  // Save all data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/sha256-instrument.json',
    JSON.stringify({ data, data2 }, null, 2)
  );
  
  console.log('\nData saved to: source-testing/tests/wasm-analysis/sha256-instrument.json');
}

instrumentSha256().catch(console.error);
