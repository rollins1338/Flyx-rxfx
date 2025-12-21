/**
 * Crack WASM - Deep Memory Trace
 * 
 * Let's hook into the WASM memory and trace all reads/writes during decryption.
 * This might reveal the counter block generation algorithm.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function deepTrace() {
  console.log('=== Deep WASM Memory Trace ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Inject memory tracing before page loads
  await page.evaluateOnNewDocument(() => {
    window.__memoryTrace = {
      writes: [],
      reads: [],
      enabled: false,
    };
    
    // Hook WebAssembly.instantiate to wrap memory
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      
      if (result.instance.exports.memory && result.instance.exports.process_img_data) {
        const memory = result.instance.exports.memory;
        window.__wasmMemory = memory;
        
        // Create a proxy to track memory access
        // Note: This is limited because we can't proxy ArrayBuffer directly
        // But we can take snapshots at key points
        
        console.log('[WASM] Memory captured for tracing');
      }
      
      return result;
    };
    
    const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      const response = await source;
      const buffer = await response.clone().arrayBuffer();
      return WebAssembly.instantiate(buffer, importObject);
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
  // Perform decryption with memory snapshots
  const result = await page.evaluate(async (apiKey) => {
    const crypto = window.crypto;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        'X-Client-Fingerprint': 'test',
        'bW90aGFmYWth': '1',
        'X-Only-Sources': '1',
        'X-Server': 'alpha',
      },
    });
    
    const encryptedData = await response.text();
    
    // Take memory snapshot before decryption
    let memBefore = null;
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      memBefore = Array.from(mem.slice(0, 128 * 1024)); // First 128KB
    }
    
    // Perform decryption
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
    
    // Take memory snapshot after decryption
    let memAfter = null;
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      memAfter = Array.from(mem.slice(0, 128 * 1024)); // First 128KB
    }
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      memBefore: memBefore,
      memAfter: memAfter,
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Memory before: ${result.memBefore?.length || 0} bytes`);
  console.log(`Memory after: ${result.memAfter?.length || 0} bytes\n`);
  
  // Derive keystream and counter blocks
  const overhead = encrypted.length - decrypted.length;
  const ciphertext = encrypted.slice(overhead);
  
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  const counterBlocks = [];
  const numBlocks = Math.ceil(decrypted.length / 16);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, keystream.length);
    const keystreamBlock = keystream.slice(start, end);
    
    const padded = Buffer.alloc(16);
    keystreamBlock.copy(padded);
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(padded);
    counterBlocks.push(counterBlock);
  }
  
  console.log('Counter blocks:');
  for (let i = 0; i < Math.min(counterBlocks.length, 5); i++) {
    console.log(`  ${i}: ${counterBlocks[i].toString('hex')}`);
  }
  
  if (result.memBefore && result.memAfter) {
    const before = Buffer.from(result.memBefore);
    const after = Buffer.from(result.memAfter);
    
    console.log('\n=== Memory Analysis ===\n');
    
    // Find all 16-byte sequences that match counter blocks
    console.log('Searching for counter blocks in memory...');
    
    for (let i = 0; i < counterBlocks.length; i++) {
      const cb = counterBlocks[i];
      
      // Search in after memory
      for (let pos = 0; pos <= after.length - 16; pos++) {
        if (after.slice(pos, pos + 16).equals(cb)) {
          console.log(`  Counter block ${i} found at offset 0x${pos.toString(16)}`);
          
          // Show surrounding context
          const contextStart = Math.max(0, pos - 32);
          const contextEnd = Math.min(after.length, pos + 48);
          console.log(`    Context: ${after.slice(contextStart, contextEnd).toString('hex')}`);
        }
      }
    }
    
    // Search for the API key in memory
    console.log('\nSearching for API key in memory...');
    
    for (let pos = 0; pos <= after.length - 32; pos++) {
      if (after.slice(pos, pos + 32).equals(keyBuf)) {
        console.log(`  API key found at offset 0x${pos.toString(16)}`);
      }
    }
    
    // Search for the API key as hex string
    const keyHex = Buffer.from(testKey, 'utf8');
    for (let pos = 0; pos <= after.length - 64; pos++) {
      if (after.slice(pos, pos + 64).equals(keyHex)) {
        console.log(`  API key (hex string) found at offset 0x${pos.toString(16)}`);
      }
    }
    
    // Search for encrypted data prefix
    const encPrefix = encrypted.slice(0, 32);
    console.log('\nSearching for encrypted prefix in memory...');
    for (let pos = 0; pos <= after.length - 32; pos++) {
      if (after.slice(pos, pos + 32).equals(encPrefix)) {
        console.log(`  Encrypted prefix found at offset 0x${pos.toString(16)}`);
      }
    }
    
    // Search for keystream
    const ksPrefix = keystream.slice(0, 32);
    console.log('\nSearching for keystream in memory...');
    for (let pos = 0; pos <= after.length - 32; pos++) {
      if (after.slice(pos, pos + 32).equals(ksPrefix)) {
        console.log(`  Keystream prefix found at offset 0x${pos.toString(16)}`);
      }
    }
    
    // Find memory regions that changed
    console.log('\n=== Changed Memory Regions ===\n');
    
    const changedRegions = [];
    let inRegion = false;
    let regionStart = 0;
    
    for (let i = 0; i < Math.min(before.length, after.length); i++) {
      if (before[i] !== after[i]) {
        if (!inRegion) {
          inRegion = true;
          regionStart = i;
        }
      } else {
        if (inRegion) {
          changedRegions.push({ start: regionStart, end: i, size: i - regionStart });
          inRegion = false;
        }
      }
    }
    
    if (inRegion) {
      changedRegions.push({ start: regionStart, end: before.length, size: before.length - regionStart });
    }
    
    // Sort by size and show largest
    changedRegions.sort((a, b) => b.size - a.size);
    
    console.log(`Total changed regions: ${changedRegions.length}`);
    console.log('Largest changed regions:');
    
    for (let i = 0; i < Math.min(changedRegions.length, 10); i++) {
      const region = changedRegions[i];
      console.log(`  0x${region.start.toString(16)} - 0x${region.end.toString(16)} (${region.size} bytes)`);
      
      // Show content if small enough
      if (region.size <= 64) {
        console.log(`    Before: ${before.slice(region.start, region.end).toString('hex')}`);
        console.log(`    After:  ${after.slice(region.start, region.end).toString('hex')}`);
      }
    }
  }
}

deepTrace().catch(console.error);
