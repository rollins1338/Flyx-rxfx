/**
 * Use Chrome DevTools Protocol to set breakpoints and trace WASM execution
 * This gives us more control over debugging than regular Puppeteer
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function cdpBreakpoints() {
  const browser = await puppeteer.launch({
    headless: false, // Need visible browser for debugging
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Get CDP session
  const client = await page.target().createCDPSession();
  
  // Enable debugging domains
  await client.send('Debugger.enable');
  await client.send('Runtime.enable');
  
  const timestamp = 1700000000;
  
  // Track WASM script IDs
  let wasmScriptId = null;
  
  // Listen for script parsed events
  client.on('Debugger.scriptParsed', (params) => {
    if (params.url && params.url.includes('.wasm')) {
      console.log('[CDP] WASM script parsed:', params.scriptId, params.url);
      wasmScriptId = params.scriptId;
    }
  });
  
  // Listen for paused events
  client.on('Debugger.paused', async (params) => {
    console.log('[CDP] Paused at:', params.callFrames[0]?.functionName || 'unknown');
    console.log('[CDP] Reason:', params.reason);
    
    // Get call stack
    for (const frame of params.callFrames.slice(0, 5)) {
      console.log(`  - ${frame.functionName || 'anonymous'} at ${frame.location.scriptId}:${frame.location.lineNumber}`);
    }
    
    // Resume execution
    await client.send('Debugger.resume');
  });
  
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
    
    // Intercept WASM to get function info
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      console.log('[WASM] instantiateStreaming called');
      
      // Clone the response to read the bytes
      const response = await source;
      const clonedResponse = response.clone();
      const wasmBytes = await clonedResponse.arrayBuffer();
      
      console.log('[WASM] Module size:', wasmBytes.byteLength);
      
      const result = await origInstantiateStreaming.call(this, response, importObject);
      
      window.__wasmInstance = result.instance;
      window.__wasmMemory = result.instance.exports.memory;
      window.__wasmExports = result.instance.exports;
      
      // Wrap get_img_key to trace calls
      const origGetImgKey = result.instance.exports.get_img_key;
      if (origGetImgKey) {
        result.instance.exports.get_img_key = function(...args) {
          console.log('[WASM] get_img_key called with args:', args);
          
          // Take memory snapshot before
          const memBefore = new Uint8Array(window.__wasmMemory.buffer.slice(0));
          
          const result = origGetImgKey.apply(this, args);
          
          // Take memory snapshot after
          const memAfter = new Uint8Array(window.__wasmMemory.buffer);
          
          // Find differences
          const diffs = [];
          for (let i = 0; i < memBefore.length; i++) {
            if (memBefore[i] !== memAfter[i]) {
              diffs.push({ offset: i, before: memBefore[i], after: memAfter[i] });
            }
          }
          
          console.log('[WASM] get_img_key returned, memory changes:', diffs.length);
          window.__memoryDiffs = diffs;
          
          return result;
        };
      }
      
      return result;
    };
  }, timestamp);
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[WASM]') || text.includes('[CDP]')) {
      console.log('Browser:', text);
    }
  });
  
  console.log('Navigating to page...');
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  console.log('Waiting for WASM to be ready...');
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Now call get_img_key and analyze memory changes
  const analysis = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    
    // Get memory diffs
    const diffs = window.__memoryDiffs || [];
    
    // Group consecutive diffs
    const groups = [];
    let currentGroup = null;
    
    for (const diff of diffs) {
      if (!currentGroup || diff.offset !== currentGroup.end) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          start: diff.offset,
          end: diff.offset + 1,
          changes: [diff],
        };
      } else {
        currentGroup.end = diff.offset + 1;
        currentGroup.changes.push(diff);
      }
    }
    if (currentGroup) groups.push(currentGroup);
    
    // Find groups of 32 bytes (potential hash writes)
    const hash32Groups = groups.filter(g => g.changes.length >= 32);
    
    return {
      key,
      totalDiffs: diffs.length,
      groupCount: groups.length,
      hash32Groups: hash32Groups.map(g => ({
        start: g.start,
        length: g.changes.length,
        afterBytes: g.changes.map(c => c.after),
      })),
      // Get first 10 groups for analysis
      sampleGroups: groups.slice(0, 10).map(g => ({
        start: g.start,
        length: g.changes.length,
        afterBytes: g.changes.slice(0, 32).map(c => c.after),
      })),
    };
  });
  
  console.log('\n=== Memory Change Analysis ===');
  console.log('Key:', analysis.key);
  console.log('Total memory changes:', analysis.totalDiffs);
  console.log('Change groups:', analysis.groupCount);
  console.log('32+ byte groups:', analysis.hash32Groups.length);
  
  if (analysis.hash32Groups.length > 0) {
    console.log('\n=== 32+ Byte Write Groups ===');
    for (const group of analysis.hash32Groups) {
      console.log(`\nOffset ${group.start} (${group.length} bytes):`);
      const hex = group.afterBytes.slice(0, 32).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log('First 32 bytes:', hex);
      
      // Check if this is the key
      if (hex === analysis.key.slice(0, 64)) {
        console.log('*** THIS IS THE KEY! ***');
      }
      
      // Check if this is the FP hash
      if (hex === '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e') {
        console.log('*** THIS IS THE FP HASH! ***');
      }
      
      // Check if this is the XOR constant
      if (hex === '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc') {
        console.log('*** THIS IS THE XOR CONSTANT! ***');
      }
    }
  }
  
  console.log('\n=== Sample Groups ===');
  for (const group of analysis.sampleGroups) {
    console.log(`Offset ${group.start} (${group.length} bytes): ${group.afterBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  }
  
  await browser.close();
}

cdpBreakpoints().catch(console.error);
