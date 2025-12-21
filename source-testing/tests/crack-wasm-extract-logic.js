/**
 * Crack WASM - Extract Decryption Logic
 * 
 * Let's use Puppeteer to:
 * 1. Intercept the WASM memory during decryption
 * 2. Find where the counter blocks are generated
 * 3. Extract the PRNG state
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function extractDecryptionLogic() {
  console.log('=== Extract Decryption Logic ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Inject code to intercept WASM memory operations
  await page.evaluateOnNewDocument(() => {
    window.__wasmMemoryWrites = [];
    window.__wasmMemoryReads = [];
    window.__aesOperations = [];
    
    // Intercept WebAssembly.instantiate
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      console.log('[WASM] Intercepting instantiate');
      
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      
      // Store reference to memory
      if (result.instance.exports.memory) {
        window.__wasmMemory = result.instance.exports.memory;
        console.log('[WASM] Memory captured');
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
  
  // Use a known key
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
  // Capture memory before and after decryption
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
    
    // Capture memory snapshot before decryption
    let memoryBefore = null;
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      // Capture first 64KB
      memoryBefore = Array.from(mem.slice(0, 65536));
    }
    
    // Perform decryption
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    // Capture memory snapshot after decryption
    let memoryAfter = null;
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      memoryAfter = Array.from(mem.slice(0, 65536));
    }
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      memoryBefore: memoryBefore,
      memoryAfter: memoryAfter,
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Decrypted text: ${result.decrypted}\n`);
  
  // Derive keystream and counter blocks
  const overhead = encrypted.length - decrypted.length;
  const ciphertext = encrypted.slice(overhead);
  
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  // Derive counter blocks
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
  
  // Analyze memory changes
  if (result.memoryBefore && result.memoryAfter) {
    const before = Buffer.from(result.memoryBefore);
    const after = Buffer.from(result.memoryAfter);
    
    // Find regions that changed
    const changedRegions = [];
    let inRegion = false;
    let regionStart = 0;
    
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) {
        if (!inRegion) {
          inRegion = true;
          regionStart = i;
        }
      } else {
        if (inRegion) {
          changedRegions.push({ start: regionStart, end: i });
          inRegion = false;
        }
      }
    }
    
    if (inRegion) {
      changedRegions.push({ start: regionStart, end: before.length });
    }
    
    console.log(`\nMemory changed regions: ${changedRegions.length}`);
    
    // Look for counter blocks in memory
    console.log('\nSearching for counter blocks in memory...');
    
    for (let i = 0; i < counterBlocks.length; i++) {
      const cb = counterBlocks[i];
      
      // Search in before memory
      for (let pos = 0; pos <= before.length - 16; pos++) {
        if (before.slice(pos, pos + 16).equals(cb)) {
          console.log(`Counter block ${i} found in BEFORE memory at offset ${pos}`);
        }
      }
      
      // Search in after memory
      for (let pos = 0; pos <= after.length - 16; pos++) {
        if (after.slice(pos, pos + 16).equals(cb)) {
          console.log(`Counter block ${i} found in AFTER memory at offset ${pos}`);
        }
      }
    }
    
    // Look for the key in memory
    console.log('\nSearching for key in memory...');
    
    for (let pos = 0; pos <= before.length - 32; pos++) {
      if (before.slice(pos, pos + 32).equals(keyBuf)) {
        console.log(`Key found in BEFORE memory at offset ${pos}`);
      }
    }
    
    for (let pos = 0; pos <= after.length - 32; pos++) {
      if (after.slice(pos, pos + 32).equals(keyBuf)) {
        console.log(`Key found in AFTER memory at offset ${pos}`);
      }
    }
    
    // Look for the encrypted data in memory
    console.log('\nSearching for encrypted data in memory...');
    
    const prefix = encrypted.slice(0, 32);
    for (let pos = 0; pos <= after.length - 32; pos++) {
      if (after.slice(pos, pos + 32).equals(prefix)) {
        console.log(`Encrypted prefix found in AFTER memory at offset ${pos}`);
      }
    }
    
    // Look for the decrypted data in memory
    console.log('\nSearching for decrypted data in memory...');
    
    const decPrefix = decrypted.slice(0, 32);
    for (let pos = 0; pos <= after.length - 32; pos++) {
      if (after.slice(pos, pos + 32).equals(decPrefix)) {
        console.log(`Decrypted prefix found in AFTER memory at offset ${pos}`);
      }
    }
  }
}

extractDecryptionLogic().catch(console.error);
