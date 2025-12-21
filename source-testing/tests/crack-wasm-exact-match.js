/**
 * Exact Match - Use the exact string from memory and verify
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function exactMatch() {
  console.log('=== Exact Match Test ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__wasmMem = null;
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      window.__wasmMem = result.instance.exports.memory;
      return result;
    };
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the key and then immediately scan memory
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    // Scan memory for the fingerprint string
    const mem = new Uint8Array(window.__wasmMem.buffer);
    
    // Search for the timestamp
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
        // Found timestamp, extract the full string
        let start = i;
        while (start > 0 && mem[start - 1] >= 32 && mem[start - 1] < 127) {
          start--;
          if (i - start > 1000) break;
        }
        
        let end = i + timestampBytes.length;
        while (end < mem.length && mem[end] >= 32 && mem[end] < 127) {
          end++;
          if (end - i > 10000) break;
        }
        
        // Get the exact bytes
        const bytes = Array.from(mem.slice(start, end));
        const str = String.fromCharCode(...bytes);
        
        found.push({
          offset: start,
          length: str.length,
          str: str,
          bytes: bytes,
        });
        
        i = end;
      }
    }
    
    return {
      key,
      sessionId,
      found,
    };
  });
  
  await browser.close();
  
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  
  for (const s of data.found) {
    console.log(`\n[${s.offset}] Length: ${s.length}`);
    console.log(`String: ${s.str}`);
    console.log(`Bytes: ${s.bytes.slice(0, 50).join(', ')}...`);
    
    // Hash the exact string
    const hash = crypto.createHash('sha256').update(s.str).digest();
    console.log(`Hash: ${hash.toString('hex')}`);
    console.log(`Expected: ${data.key}`);
    
    if (hash.equals(keyBuf)) {
      console.log(`\n*** EXACT MATCH! ***`);
      
      // Analyze the format
      console.log('\n=== Format Analysis ===');
      const parts = s.str.split(':');
      console.log(`Parts (${parts.length}):`);
      for (let i = 0; i < parts.length; i++) {
        console.log(`  ${i}: "${parts[i]}" (${parts[i].length} chars)`);
      }
      
      fs.writeFileSync(
        'source-testing/tests/wasm-analysis/EXACT_FORMAT.txt',
        s.str
      );
      return;
    }
    
    // Try with Buffer directly from bytes
    const bufFromBytes = Buffer.from(s.bytes);
    const hashFromBytes = crypto.createHash('sha256').update(bufFromBytes).digest();
    console.log(`Hash (from bytes): ${hashFromBytes.toString('hex')}`);
    
    if (hashFromBytes.equals(keyBuf)) {
      console.log(`\n*** MATCH FROM BYTES! ***`);
      return;
    }
    
    // Check if there are any non-printable characters
    const nonPrintable = s.bytes.filter(b => b < 32 || b >= 127);
    if (nonPrintable.length > 0) {
      console.log(`Non-printable bytes: ${nonPrintable.join(', ')}`);
    }
  }
  
  console.log('\nNo exact match found.');
  
  // The string in memory might not be the exact input to SHA256
  // Let's try to understand what's happening
  
  console.log('\n=== Trying Variations ===\n');
  
  if (data.found.length > 0) {
    const s = data.found[0];
    
    // Try different encodings
    const variations = [
      s.str,
      s.str.trim(),
      s.str + '\n',
      s.str + '\0',
      '\0' + s.str,
    ];
    
    for (const v of variations) {
      const hash = crypto.createHash('sha256').update(v).digest();
      if (hash.equals(keyBuf)) {
        console.log(`Match with variation: ${JSON.stringify(v.slice(0, 50))}...`);
        return;
      }
    }
    
    // Try UTF-8 encoding explicitly
    const utf8 = Buffer.from(s.str, 'utf8');
    const hashUtf8 = crypto.createHash('sha256').update(utf8).digest();
    console.log(`UTF-8 hash: ${hashUtf8.toString('hex')}`);
    
    // Try with different line endings
    const withCRLF = s.str.replace(/\n/g, '\r\n');
    const hashCRLF = crypto.createHash('sha256').update(withCRLF).digest();
    console.log(`CRLF hash: ${hashCRLF.toString('hex')}`);
  }
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/exact-match-data.json',
    JSON.stringify(data, null, 2)
  );
}

exactMatch().catch(console.error);
