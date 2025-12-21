/**
 * Crack WASM - Intercept Internal State
 * 
 * New approach: Instead of trying to reverse the PRNG, let's:
 * 1. Intercept the WASM memory during decryption
 * 2. Find where the counter blocks are stored
 * 3. Understand the relationship between input and counter blocks
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptWasmState() {
  console.log('=== Intercept WASM Internal State ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM instantiation
  await page.evaluateOnNewDocument(() => {
    const originalInstantiate = WebAssembly.instantiate;
    const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    window.__wasmInstances = [];
    window.__wasmMemorySnapshots = [];
    
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[WASM] Intercepting instantiate');
      
      // Wrap the imports to log calls
      if (importObject && importObject.wbg) {
        const originalRandom = importObject.wbg.__wbg_random_3ad904d98382defe;
        if (originalRandom) {
          let randomCallCount = 0;
          importObject.wbg.__wbg_random_3ad904d98382defe = function() {
            const result = originalRandom.apply(this, arguments);
            randomCallCount++;
            if (randomCallCount <= 20) {
              console.log(`[WASM] Math.random() called, result: ${result}`);
            }
            return result;
          };
        }
      }
      
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      window.__wasmInstances.push(result.instance);
      console.log('[WASM] Instance created, exports:', Object.keys(result.instance.exports));
      return result;
    };
    
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      console.log('[WASM] Intercepting instantiateStreaming');
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
  
  // Get WASM memory before and after decryption
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
    
    // Get WASM memory before decryption
    let memoryBefore = null;
    if (window.__wasmInstances.length > 0) {
      const instance = window.__wasmInstances[0];
      if (instance.exports.memory) {
        const mem = new Uint8Array(instance.exports.memory.buffer);
        memoryBefore = Array.from(mem.slice(0, 4096)); // First 4KB
      }
    }
    
    // Perform decryption
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    // Get WASM memory after decryption
    let memoryAfter = null;
    if (window.__wasmInstances.length > 0) {
      const instance = window.__wasmInstances[0];
      if (instance.exports.memory) {
        const mem = new Uint8Array(instance.exports.memory.buffer);
        memoryAfter = Array.from(mem.slice(0, 4096)); // First 4KB
      }
    }
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      memoryBefore: memoryBefore,
      memoryAfter: memoryAfter,
      wasmInstanceCount: window.__wasmInstances.length,
    };
  }, testKey);
  
  await browser.close();
  
  console.log(`Encrypted: ${Buffer.from(result.encrypted, 'base64').length} bytes`);
  console.log(`Decrypted: ${result.decrypted.length} bytes`);
  console.log(`WASM instances: ${result.wasmInstanceCount}`);
  
  if (result.memoryBefore && result.memoryAfter) {
    // Find differences in memory
    const before = Buffer.from(result.memoryBefore);
    const after = Buffer.from(result.memoryAfter);
    
    const diffs = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) {
        diffs.push({ offset: i, before: before[i], after: after[i] });
      }
    }
    
    console.log(`\nMemory differences: ${diffs.length} bytes changed`);
    if (diffs.length > 0 && diffs.length < 100) {
      console.log('Changed offsets:', diffs.map(d => d.offset).join(', '));
    }
  }
  
  // Now let's try a different approach: analyze the encrypted data structure more carefully
  console.log('\n=== Encrypted Data Structure Analysis ===\n');
  
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  const keyBuf = Buffer.from(testKey, 'hex');
  
  // The overhead is 195 bytes
  // Let's see if there's a pattern in the prefix
  const prefix = encrypted.slice(0, 195);
  const ciphertext = encrypted.slice(195);
  
  console.log(`Prefix (195 bytes): ${prefix.toString('hex')}`);
  console.log(`Ciphertext (${ciphertext.length} bytes)`);
  
  // Check if prefix contains any recognizable structure
  // Common structures:
  // - Version byte
  // - Nonce (12-16 bytes)
  // - Salt (16-32 bytes)
  // - HMAC (32 bytes)
  
  // Let's check if the last 32 bytes of prefix are an HMAC
  const possibleHmac = prefix.slice(-32);
  console.log(`\nLast 32 bytes of prefix (possible HMAC): ${possibleHmac.toString('hex')}`);
  
  // Try to verify HMAC
  const dataWithoutHmac = encrypted.slice(0, -32);
  const computedHmac = crypto.createHmac('sha256', keyBuf).update(dataWithoutHmac).digest();
  console.log(`Computed HMAC of data[:-32]: ${computedHmac.toString('hex')}`);
  console.log(`Match: ${computedHmac.equals(encrypted.slice(-32))}`);
  
  // Try HMAC of ciphertext only
  const hmacCiphertext = crypto.createHmac('sha256', keyBuf).update(ciphertext).digest();
  console.log(`HMAC of ciphertext: ${hmacCiphertext.toString('hex')}`);
  
  // Try HMAC of prefix + ciphertext
  const hmacAll = crypto.createHmac('sha256', keyBuf).update(encrypted).digest();
  console.log(`HMAC of all data: ${hmacAll.toString('hex')}`);
  
  // Check if any 32-byte segment in prefix matches any HMAC
  for (let i = 0; i <= prefix.length - 32; i++) {
    const segment = prefix.slice(i, i + 32);
    
    // Try various HMAC computations
    const tests = [
      { name: 'HMAC(key, ciphertext)', value: crypto.createHmac('sha256', keyBuf).update(ciphertext).digest() },
      { name: 'HMAC(key, prefix[0:i])', value: crypto.createHmac('sha256', keyBuf).update(prefix.slice(0, i)).digest() },
      { name: 'SHA256(ciphertext)', value: crypto.createHash('sha256').update(ciphertext).digest() },
    ];
    
    for (const test of tests) {
      if (segment.equals(test.value)) {
        console.log(`\n*** FOUND: ${test.name} at prefix offset ${i} ***`);
      }
    }
  }
  
  // Let's also check if the prefix contains the key in any form
  console.log('\n=== Key Presence Check ===');
  
  // Check if key bytes appear in prefix
  for (let i = 0; i <= prefix.length - 32; i++) {
    if (prefix.slice(i, i + 32).equals(keyBuf)) {
      console.log(`Key found at prefix offset ${i}`);
    }
  }
  
  // Check if SHA256(key) appears
  const keyHash = crypto.createHash('sha256').update(keyBuf).digest();
  for (let i = 0; i <= prefix.length - 32; i++) {
    if (prefix.slice(i, i + 32).equals(keyHash)) {
      console.log(`SHA256(key) found at prefix offset ${i}`);
    }
  }
}

interceptWasmState().catch(console.error);
