/**
 * WASM Memory Trace v2
 * 
 * Trace memory writes during get_img_key() to understand the key derivation
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function traceMemory() {
  console.log('=== WASM Memory Trace v2 ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM to trace memory
  await page.evaluateOnNewDocument(() => {
    window.__memorySnapshots = [];
    window.__stringWrites = [];
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      console.log('[WASM] Intercepting instantiateStreaming');
      
      // Wrap string_new to capture strings being created
      if (imports && imports.wbg && imports.wbg.__wbindgen_string_new) {
        const origStringNew = imports.wbg.__wbindgen_string_new;
        imports.wbg.__wbindgen_string_new = function(ptr, len) {
          // We'll capture this after WASM is loaded
          return origStringNew.apply(this, arguments);
        };
      }
      
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      // Store reference to memory
      window.__wasmMemory = result.instance.exports.memory;
      window.__wasmInstance = result.instance;
      
      // Wrap get_img_key to capture memory before and after
      const origGetImgKey = result.instance.exports.get_img_key;
      result.instance.exports.get_img_key = function(retptr) {
        console.log('[WASM] get_img_key called with retptr:', retptr);
        
        // Snapshot memory before
        const memBefore = new Uint8Array(window.__wasmMemory.buffer.slice(0, 65536));
        
        // Call original
        const result = origGetImgKey.apply(this, arguments);
        
        // Snapshot memory after
        const memAfter = new Uint8Array(window.__wasmMemory.buffer.slice(0, 65536));
        
        // Find differences
        const diffs = [];
        for (let i = 0; i < memBefore.length; i++) {
          if (memBefore[i] !== memAfter[i]) {
            diffs.push({ offset: i, before: memBefore[i], after: memAfter[i] });
          }
        }
        
        window.__memorySnapshots.push({
          retptr,
          diffsCount: diffs.length,
          diffs: diffs.slice(0, 1000),
        });
        
        // Look for the key in memory (32 bytes of hex = 64 chars)
        const memView = new Uint8Array(window.__wasmMemory.buffer);
        
        // Search for hex strings (potential keys)
        const hexStrings = [];
        for (let i = 0; i < 65536 - 64; i++) {
          let isHex = true;
          let hexStr = '';
          for (let j = 0; j < 64; j++) {
            const byte = memView[i + j];
            if ((byte >= 48 && byte <= 57) || (byte >= 97 && byte <= 102)) {
              hexStr += String.fromCharCode(byte);
            } else {
              isHex = false;
              break;
            }
          }
          if (isHex && hexStr.length === 64) {
            hexStrings.push({ offset: i, hex: hexStr });
          }
        }
        
        window.__hexStrings = hexStrings;
        
        return result;
      };
      
      // Wrap process_img_data to trace decryption
      const origProcessImgData = result.instance.exports.process_img_data;
      result.instance.exports.process_img_data = function(ptr0, len0, ptr1, len1) {
        console.log('[WASM] process_img_data called');
        console.log('  encrypted ptr:', ptr0, 'len:', len0);
        console.log('  api_key ptr:', ptr1, 'len:', len1);
        
        // Read the api_key from memory
        const memView = new Uint8Array(window.__wasmMemory.buffer);
        let apiKey = '';
        for (let i = 0; i < len1; i++) {
          apiKey += String.fromCharCode(memView[ptr1 + i]);
        }
        console.log('  api_key:', apiKey);
        
        // Read first 100 bytes of encrypted data
        let encryptedPreview = '';
        for (let i = 0; i < Math.min(100, len0); i++) {
          encryptedPreview += String.fromCharCode(memView[ptr0 + i]);
        }
        console.log('  encrypted preview:', encryptedPreview.slice(0, 50));
        
        window.__lastApiKey = apiKey;
        window.__lastEncryptedLen = len0;
        
        return origProcessImgData.apply(this, arguments);
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
  
  // Get the key and memory data
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    return {
      embeddedKey: key,
      sessionId: localStorage.getItem('tmdb_session_id'),
      memorySnapshots: window.__memorySnapshots,
      hexStrings: window.__hexStrings?.slice(0, 20) || [],
      lastApiKey: window.__lastApiKey,
    };
  });
  
  console.log(`Embedded key: ${result.embeddedKey}`);
  console.log(`Session ID: ${result.sessionId}`);
  console.log(`Memory snapshots: ${result.memorySnapshots?.length || 0}`);
  console.log(`Hex strings found: ${result.hexStrings?.length || 0}`);
  
  if (result.hexStrings?.length > 0) {
    console.log('\nHex strings in memory:');
    for (const hs of result.hexStrings) {
      const isKey = hs.hex === result.embeddedKey;
      console.log(`  ${hs.offset}: ${hs.hex} ${isKey ? '*** KEY ***' : ''}`);
    }
  }
  
  if (result.memorySnapshots?.length > 0) {
    const snapshot = result.memorySnapshots[0];
    console.log(`\nMemory changes: ${snapshot.diffsCount}`);
    
    // Group consecutive changes
    const groups = [];
    let currentGroup = null;
    
    for (const diff of snapshot.diffs) {
      if (!currentGroup || diff.offset !== currentGroup.end) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { start: diff.offset, end: diff.offset + 1, bytes: [diff.after] };
      } else {
        currentGroup.end = diff.offset + 1;
        currentGroup.bytes.push(diff.after);
      }
    }
    if (currentGroup) groups.push(currentGroup);
    
    console.log(`\nMemory change groups: ${groups.length}`);
    for (const group of groups.slice(0, 20)) {
      const bytesHex = group.bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      const bytesAscii = group.bytes.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
      console.log(`  ${group.start}-${group.end} (${group.bytes.length} bytes): ${bytesHex.slice(0, 64)} | ${bytesAscii.slice(0, 32)}`);
    }
  }
  
  // Now let's try to understand the key derivation by looking at what data goes into it
  console.log('\n=== Analyzing Key Derivation ===\n');
  
  // Get more detailed fingerprint data
  const fpData = await page.evaluate(() => {
    // Recreate the canvas fingerprint
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillText('TMDB Image Enhancement', 2, 2);
    ctx.font = "11px 'Arial'";
    ctx.fillText('Processing capabilities test', 4, 17);
    
    return {
      canvasData: canvas.toDataURL(),
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: new Date().getTimezoneOffset(),
    };
  });
  
  await browser.close();
  
  // The key is 32 bytes (64 hex chars)
  // It's likely derived from a combination of fingerprint data
  
  // Based on the WASM analysis, the key derivation likely uses:
  // 1. Canvas fingerprint (toDataURL)
  // 2. Session ID
  // 3. Screen properties
  // 4. Navigator properties
  // 5. Timezone
  
  // The WASM uses HMAC-SHA256 internally (from the crate strings)
  // Let's try HMAC with various combinations
  
  const embeddedKeyBuf = Buffer.from(result.embeddedKey, 'hex');
  
  console.log('Trying HMAC-SHA256 combinations...\n');
  
  // The session ID format is: timestamp.random
  // e.g., "1766277030.4851556"
  
  const sessionParts = result.sessionId.split('.');
  const timestamp = sessionParts[0];
  const randomPart = sessionParts[1];
  
  // Try various HMAC combinations
  const hmacAttempts = [
    // Canvas as key, session as data
    { key: fpData.canvasData, data: result.sessionId, name: 'HMAC(canvas, session)' },
    { key: result.sessionId, data: fpData.canvasData, name: 'HMAC(session, canvas)' },
    
    // Canvas base64 as key
    { key: fpData.canvasData.split(',')[1], data: result.sessionId, name: 'HMAC(canvas_b64, session)' },
    { key: result.sessionId, data: fpData.canvasData.split(',')[1], name: 'HMAC(session, canvas_b64)' },
    
    // Timestamp as key
    { key: timestamp, data: fpData.canvasData, name: 'HMAC(timestamp, canvas)' },
    { key: fpData.canvasData, data: timestamp, name: 'HMAC(canvas, timestamp)' },
    
    // Random part as key
    { key: randomPart, data: fpData.canvasData, name: 'HMAC(random, canvas)' },
    { key: fpData.canvasData, data: randomPart, name: 'HMAC(canvas, random)' },
    
    // Fingerprint string as key
    { key: `${fpData.screenWidth}x${fpData.screenHeight}`, data: fpData.canvasData, name: 'HMAC(screen, canvas)' },
    { key: fpData.canvasData, data: `${fpData.screenWidth}x${fpData.screenHeight}`, name: 'HMAC(canvas, screen)' },
    
    // Combined fingerprint
    { key: `${fpData.screenWidth}:${fpData.screenHeight}:${fpData.colorDepth}:${fpData.timezone}`, data: fpData.canvasData, name: 'HMAC(fp, canvas)' },
    { key: fpData.canvasData, data: `${fpData.screenWidth}:${fpData.screenHeight}:${fpData.colorDepth}:${fpData.timezone}`, name: 'HMAC(canvas, fp)' },
    
    // Session + fingerprint
    { key: result.sessionId, data: `${fpData.screenWidth}:${fpData.screenHeight}:${fpData.colorDepth}:${fpData.timezone}`, name: 'HMAC(session, fp)' },
    { key: `${fpData.screenWidth}:${fpData.screenHeight}:${fpData.colorDepth}:${fpData.timezone}`, data: result.sessionId, name: 'HMAC(fp, session)' },
    
    // Canvas + session + fingerprint
    { key: fpData.canvasData, data: `${result.sessionId}:${fpData.screenWidth}:${fpData.screenHeight}:${fpData.colorDepth}:${fpData.timezone}`, name: 'HMAC(canvas, session:fp)' },
    { key: result.sessionId, data: `${fpData.canvasData}:${fpData.screenWidth}:${fpData.screenHeight}:${fpData.colorDepth}:${fpData.timezone}`, name: 'HMAC(session, canvas:fp)' },
  ];
  
  for (const attempt of hmacAttempts) {
    try {
      const hmac = crypto.createHmac('sha256', attempt.key).update(attempt.data).digest();
      if (hmac.equals(embeddedKeyBuf)) {
        console.log(`*** MATCH: ${attempt.name} ***`);
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Try double HMAC
  console.log('\nTrying double HMAC...');
  for (const attempt of hmacAttempts.slice(0, 5)) {
    try {
      const hmac1 = crypto.createHmac('sha256', attempt.key).update(attempt.data).digest();
      const hmac2 = crypto.createHmac('sha256', attempt.key).update(hmac1).digest();
      if (hmac2.equals(embeddedKeyBuf)) {
        console.log(`*** MATCH: double ${attempt.name} ***`);
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Try SHA256 of concatenated hashes
  console.log('\nTrying SHA256 of concatenated hashes...');
  const canvasHash = crypto.createHash('sha256').update(fpData.canvasData).digest();
  const sessionHash = crypto.createHash('sha256').update(result.sessionId).digest();
  const fpHash = crypto.createHash('sha256').update(`${fpData.screenWidth}:${fpData.screenHeight}:${fpData.colorDepth}:${fpData.timezone}`).digest();
  
  const concatAttempts = [
    { data: Buffer.concat([canvasHash, sessionHash]), name: 'SHA256(canvas) || SHA256(session)' },
    { data: Buffer.concat([sessionHash, canvasHash]), name: 'SHA256(session) || SHA256(canvas)' },
    { data: Buffer.concat([canvasHash, fpHash]), name: 'SHA256(canvas) || SHA256(fp)' },
    { data: Buffer.concat([sessionHash, fpHash]), name: 'SHA256(session) || SHA256(fp)' },
    { data: Buffer.concat([canvasHash, sessionHash, fpHash]), name: 'SHA256(canvas) || SHA256(session) || SHA256(fp)' },
  ];
  
  for (const attempt of concatAttempts) {
    const hash = crypto.createHash('sha256').update(attempt.data).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: SHA256(${attempt.name}) ***`);
    }
  }
  
  console.log('\nKey derivation analysis complete.');
  console.log('The algorithm is likely more complex, possibly involving:');
  console.log('  - Multiple rounds of hashing');
  console.log('  - Custom byte manipulation');
  console.log('  - Internal WASM state');
  
  // Save all data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/memory-trace.json',
    JSON.stringify({ ...result, fpData }, null, 2)
  );
}

traceMemory().catch(console.error);
