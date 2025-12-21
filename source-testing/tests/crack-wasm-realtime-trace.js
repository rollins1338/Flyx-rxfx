/**
 * Crack WASM - Real-time Memory Trace
 * 
 * Let's try to capture memory snapshots during decryption by:
 * 1. Hooking into the WASM function calls
 * 2. Taking memory snapshots at key points
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function realtimeTrace() {
  console.log('=== Real-time WASM Trace ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM and wrap the process_img_data function
  await page.evaluateOnNewDocument(() => {
    window.__memorySnapshots = [];
    window.__wasmInstance = null;
    
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      
      // Check if this is the flixer WASM (has process_img_data)
      if (result.instance.exports.process_img_data) {
        window.__wasmInstance = result.instance;
        
        // Wrap the process_img_data function
        const originalProcess = result.instance.exports.process_img_data;
        result.instance.exports.process_img_data = function(...args) {
          // Take memory snapshot before
          const memory = result.instance.exports.memory;
          if (memory) {
            const mem = new Uint8Array(memory.buffer);
            window.__memorySnapshots.push({
              phase: 'before',
              data: Array.from(mem.slice(0, 256 * 1024)),
            });
          }
          
          // Call original function
          const ret = originalProcess.apply(this, args);
          
          // Take memory snapshot after
          if (memory) {
            const mem = new Uint8Array(memory.buffer);
            window.__memorySnapshots.push({
              phase: 'after',
              data: Array.from(mem.slice(0, 256 * 1024)),
            });
          }
          
          return ret;
        };
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
  
  const result = await page.evaluate(async (key) => {
    const crypto = window.crypto;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${key}:${timestamp}:${nonce}:${path}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': key,
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
    
    // Clear previous snapshots
    window.__memorySnapshots = [];
    
    // Perform decryption (this will trigger our hooks)
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      snapshotCount: window.__memorySnapshots.length,
      beforeSnapshot: window.__memorySnapshots.find(s => s.phase === 'before')?.data,
      afterSnapshot: window.__memorySnapshots.find(s => s.phase === 'after')?.data,
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Snapshots captured: ${result.snapshotCount}`);
  console.log(`Before snapshot: ${result.beforeSnapshot?.length || 0} bytes`);
  console.log(`After snapshot: ${result.afterSnapshot?.length || 0} bytes\n`);
  
  // Derive counter blocks
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
  
  if (result.beforeSnapshot && result.afterSnapshot) {
    const before = Buffer.from(result.beforeSnapshot);
    const after = Buffer.from(result.afterSnapshot);
    
    console.log('\n=== Memory Diff Analysis ===\n');
    
    // Find changed regions
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
    
    console.log(`Changed regions: ${changedRegions.length}`);
    
    // Show largest changed regions
    changedRegions.sort((a, b) => b.size - a.size);
    for (let i = 0; i < Math.min(changedRegions.length, 10); i++) {
      const region = changedRegions[i];
      console.log(`  Region ${i}: 0x${region.start.toString(16)} - 0x${region.end.toString(16)} (${region.size} bytes)`);
      
      // Show content of this region in after snapshot
      if (region.size <= 64) {
        console.log(`    After: ${after.slice(region.start, region.end).toString('hex')}`);
      }
    }
    
    // Search for counter blocks in both snapshots
    console.log('\n=== Counter Block Search ===\n');
    
    for (let i = 0; i < counterBlocks.length; i++) {
      const cb = counterBlocks[i];
      
      for (let pos = 0; pos <= before.length - 16; pos++) {
        if (before.slice(pos, pos + 16).equals(cb)) {
          console.log(`Counter block ${i} in BEFORE at 0x${pos.toString(16)}`);
        }
      }
      
      for (let pos = 0; pos <= after.length - 16; pos++) {
        if (after.slice(pos, pos + 16).equals(cb)) {
          console.log(`Counter block ${i} in AFTER at 0x${pos.toString(16)}`);
        }
      }
    }
    
    // Search for key
    console.log('\n=== Key Search ===\n');
    
    for (let pos = 0; pos <= before.length - 32; pos++) {
      if (before.slice(pos, pos + 32).equals(keyBuf)) {
        console.log(`Key in BEFORE at 0x${pos.toString(16)}`);
      }
    }
    
    for (let pos = 0; pos <= after.length - 32; pos++) {
      if (after.slice(pos, pos + 32).equals(keyBuf)) {
        console.log(`Key in AFTER at 0x${pos.toString(16)}`);
      }
    }
    
    // Search for encrypted data
    const encPrefix = encrypted.slice(0, 32);
    for (let pos = 0; pos <= after.length - 32; pos++) {
      if (after.slice(pos, pos + 32).equals(encPrefix)) {
        console.log(`Encrypted prefix in AFTER at 0x${pos.toString(16)}`);
      }
    }
  }
}

realtimeTrace().catch(console.error);
