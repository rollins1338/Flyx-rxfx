/**
 * Trace WASM Decryption Process
 * 
 * Hook into the WASM to understand exactly what it does during decryption.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceWasmDecryption() {
  console.log('=== Tracing WASM Decryption ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Inject hooks to trace WASM operations
  await page.evaluateOnNewDocument(() => {
    window.__wasmTrace = {
      memoryReads: [],
      memoryWrites: [],
      functionCalls: [],
    };
    
    // Intercept WebAssembly.instantiate to wrap memory access
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      
      // Store original memory
      window.__wasmMemory = instance.exports.memory;
      
      // Log exported function names
      console.log('[WASM] Exports:', Object.keys(instance.exports));
      
      return result;
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Using key: ${testKey}\n`);
  
  // Get the encrypted data and trace the decryption
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
    
    // Capture memory before decryption
    let memBefore = null;
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      memBefore = Array.from(mem.slice(0, 4096));
    }
    
    // Decrypt
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    // Capture memory after decryption
    let memAfter = null;
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      memAfter = Array.from(mem.slice(0, 4096));
    }
    
    // Find differences in memory
    const memDiffs = [];
    if (memBefore && memAfter) {
      for (let i = 0; i < memBefore.length; i++) {
        if (memBefore[i] !== memAfter[i]) {
          memDiffs.push({ offset: i, before: memBefore[i], after: memAfter[i] });
        }
      }
    }
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      decryptedType: typeof decrypted,
      decryptedStringified: JSON.stringify(decrypted),
      memDiffs: memDiffs.slice(0, 100),
    };
  }, testKey);
  
  await browser.close();
  
  console.log('Encrypted (base64):', result.encrypted.substring(0, 60) + '...');
  console.log('Decrypted type:', result.decryptedType);
  console.log('Decrypted value:', typeof result.decrypted === 'string' ? result.decrypted.substring(0, 100) : JSON.stringify(result.decrypted).substring(0, 100));
  console.log('Decrypted stringified:', result.decryptedStringified.substring(0, 100));
  
  // Analyze the encrypted data
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const keyBuf = Buffer.from(testKey, 'hex');
  
  console.log(`\nEncrypted length: ${encrypted.length} bytes`);
  
  // The decrypted is a string that looks like JSON
  // Let's see what the actual plaintext is
  let plaintext;
  if (typeof result.decrypted === 'string') {
    plaintext = result.decrypted;
  } else {
    plaintext = JSON.stringify(result.decrypted);
  }
  
  console.log(`Plaintext length: ${plaintext.length} bytes`);
  console.log(`Plaintext: ${plaintext.substring(0, 100)}...`);
  
  // Now let's try to find the nonce
  console.log('\n=== Searching for Nonce ===\n');
  
  const plaintextBuf = Buffer.from(plaintext);
  
  // Try different offsets
  for (let offset = 0; offset <= 32; offset++) {
    const ciphertext = encrypted.subarray(offset);
    
    if (ciphertext.length < plaintextBuf.length) continue;
    
    // XOR to get keystream
    const keystream = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      keystream[i] = ciphertext[i] ^ plaintextBuf[i];
    }
    
    // Derive counter block
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(keystream);
    
    console.log(`Offset ${offset}: Counter = ${counterBlock.toString('hex')}`);
    
    // Check if this counter block is in the prefix
    const prefix = encrypted.subarray(0, offset);
    if (offset === 16 && prefix.equals(counterBlock)) {
      console.log(`  *** MATCH: Nonce is first 16 bytes! ***`);
    }
    
    // Try standard AES-CTR with this nonce
    if (offset === 16) {
      try {
        const testDecipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, prefix);
        const testDecrypted = testDecipher.update(ciphertext.subarray(0, plaintextBuf.length));
        console.log(`  Standard CTR result: ${testDecrypted.toString('utf8').substring(0, 50)}...`);
        
        if (testDecrypted.toString('utf8').startsWith('{')) {
          console.log(`  *** SUCCESS with standard AES-256-CTR! ***`);
        }
      } catch (e) {
        console.log(`  CTR error: ${e.message}`);
      }
    }
  }
  
  // Memory analysis
  if (result.memDiffs.length > 0) {
    console.log(`\nMemory changes: ${result.memDiffs.length} bytes changed`);
    console.log('First 20 changes:');
    result.memDiffs.slice(0, 20).forEach(d => {
      console.log(`  Offset ${d.offset}: ${d.before} -> ${d.after}`);
    });
  }
}

traceWasmDecryption().catch(console.error);
