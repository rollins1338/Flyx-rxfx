/**
 * Init Trace - Capture memory during WASM initialization
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function initTrace() {
  console.log('=== Init Trace - Capture During WASM Init ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[TRACE]') || text.includes('[INIT]')) {
      console.log(text);
    }
  });
  
  await page.evaluateOnNewDocument(() => {
    window.__initTrace = {
      memorySnapshots: [],
      keyGenerated: null,
    };
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      console.log('[INIT] WASM instantiation starting');
      
      // Take snapshot before
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      const memory = result.instance.exports.memory;
      
      // Take snapshot immediately after instantiation
      const afterInit = new Uint8Array(memory.buffer.slice(0));
      console.log(`[INIT] Memory size after init: ${afterInit.length}`);
      
      // Store memory reference
      window.__wasmMem = memory;
      
      // Wrap get_img_key to capture the key and memory state
      const origGetImgKey = result.instance.exports.get_img_key;
      
      result.instance.exports.get_img_key = function(retptr) {
        // Snapshot before
        const beforeKey = new Uint8Array(memory.buffer.slice(0));
        
        const ret = origGetImgKey.apply(this, arguments);
        
        // Snapshot after
        const afterKey = new Uint8Array(memory.buffer.slice(0));
        
        // Find differences
        const diffs = [];
        for (let i = 0; i < afterKey.length; i++) {
          if (beforeKey[i] !== afterKey[i]) {
            diffs.push({ offset: i, before: beforeKey[i], after: afterKey[i] });
          }
        }
        
        console.log(`[INIT] get_img_key: ${diffs.length} bytes changed`);
        
        // Group consecutive diffs
        const groups = [];
        let currentGroup = null;
        
        for (const diff of diffs) {
          if (!currentGroup || diff.offset > currentGroup.end + 50) {
            if (currentGroup) groups.push(currentGroup);
            currentGroup = { start: diff.offset, end: diff.offset, diffs: [] };
          }
          currentGroup.end = diff.offset;
          currentGroup.diffs.push(diff);
        }
        if (currentGroup) groups.push(currentGroup);
        
        window.__initTrace.memorySnapshots.push({
          phase: 'get_img_key',
          groups: groups.map(g => ({
            start: g.start,
            length: g.diffs.length,
            afterHex: g.diffs.map(d => d.after.toString(16).padStart(2, '0')).join(''),
            afterAscii: g.diffs.map(d => d.after >= 32 && d.after < 127 ? String.fromCharCode(d.after) : '.').join(''),
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
  
  // Now call get_img_key to trigger our hook
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    // Also search memory for the fingerprint string
    const mem = new Uint8Array(window.__wasmMem.buffer);
    const timestamp = sessionId.split('.')[0];
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
        // Extract context
        let start = i;
        while (start > 0 && mem[start - 1] >= 32 && mem[start - 1] < 127) {
          start--;
          if (i - start > 500) break;
        }
        
        let end = i + timestampBytes.length;
        while (end < mem.length && mem[end] >= 32 && mem[end] < 127) {
          end++;
          if (end - i > 1000) break;
        }
        
        const bytes = Array.from(mem.slice(start, end));
        const str = String.fromCharCode(...bytes);
        
        found.push({
          offset: start,
          length: str.length,
          str: str,
        });
        
        i = end;
      }
    }
    
    return {
      key,
      sessionId,
      initTrace: window.__initTrace,
      foundStrings: found,
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
  const fp = data.fingerprint;
  const timestamp = data.sessionId.split('.')[0];
  
  console.log(`\nMemory snapshots: ${data.initTrace.memorySnapshots.length}`);
  
  for (const snapshot of data.initTrace.memorySnapshots) {
    console.log(`\nPhase: ${snapshot.phase}`);
    console.log(`Groups: ${snapshot.groups.length}`);
    
    for (const group of snapshot.groups) {
      const isKey = group.afterHex === data.key;
      console.log(`\n  [${group.start}] ${group.length} bytes ${isKey ? '*** KEY ***' : ''}`);
      console.log(`    Hex: ${group.afterHex.slice(0, 64)}...`);
      console.log(`    ASCII: ${group.afterAscii.slice(0, 64)}...`);
      
      // Try to hash if it looks like the fingerprint string
      if (group.afterAscii.includes(timestamp)) {
        console.log(`    Contains timestamp!`);
        
        // Try to hash
        const hash = crypto.createHash('sha256').update(group.afterAscii).digest();
        console.log(`    SHA256: ${hash.toString('hex')}`);
        
        if (hash.equals(keyBuf)) {
          console.log(`    *** MATCH! ***`);
        }
      }
    }
  }
  
  console.log(`\n=== Found Strings with Timestamp ===`);
  
  for (const found of data.foundStrings) {
    console.log(`\n[${found.offset}] ${found.length} chars`);
    console.log(`  ${found.str.slice(0, 200)}...`);
    
    // Try to hash
    const hash = crypto.createHash('sha256').update(found.str).digest();
    console.log(`  SHA256: ${hash.toString('hex')}`);
    
    if (hash.equals(keyBuf)) {
      console.log(`  *** MATCH! ***`);
    }
  }
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/init-trace.json',
    JSON.stringify(data, null, 2)
  );
  
  console.log('\nData saved to: source-testing/tests/wasm-analysis/init-trace.json');
}

initTrace().catch(console.error);
