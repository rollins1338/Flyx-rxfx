/**
 * Deep WASM Analysis - Crack the PRNG
 * 
 * Strategy:
 * 1. Intercept the WASM memory to see the internal state
 * 2. Capture multiple encryption/decryption pairs
 * 3. Analyze the pattern to reverse-engineer the PRNG
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function deepWasmAnalysis() {
  console.log('=== Deep WASM Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Collect data
  const capturedData = [];
  
  // Inject code to intercept WASM memory and functions
  await page.evaluateOnNewDocument(() => {
    window.__wasmDebug = {
      memory: null,
      exports: null,
      captures: [],
    };
    
    // Intercept WebAssembly.instantiate
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      
      // Store exports and memory
      window.__wasmDebug.exports = instance.exports;
      window.__wasmDebug.memory = instance.exports.memory;
      
      console.log('[WASM] Captured exports:', Object.keys(instance.exports));
      
      return result;
    };
    
    // Also intercept instantiateStreaming
    const originalStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      const result = await originalStreaming.call(this, source, importObject);
      
      window.__wasmDebug.exports = result.instance.exports;
      window.__wasmDebug.memory = result.instance.exports.memory;
      
      console.log('[WASM] Captured exports (streaming):', Object.keys(result.instance.exports));
      
      return result;
    };
  });
  
  // Navigate to Flixer
  console.log('Loading Flixer...');
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  console.log('WASM ready, capturing decryption data...\n');
  
  // Capture multiple decryption operations with known keys
  for (let i = 0; i < 5; i++) {
    const testKey = crypto.randomBytes(32).toString('hex');
    
    const result = await page.evaluate(async (key) => {
      const crypto = window.crypto;
      
      // Generate request parameters
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
        .replace(/[/+=]/g, '').substring(0, 22);
      
      // Generate signature
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      
      const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
      const message = `${key}:${timestamp}:${nonce}:${path}`;
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      
      // Make request
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
      
      // Capture WASM memory before decryption
      let memoryBefore = null;
      if (window.__wasmDebug.memory) {
        const mem = new Uint8Array(window.__wasmDebug.memory.buffer);
        memoryBefore = Array.from(mem.slice(0, 1024)); // First 1KB
      }
      
      // Decrypt using WASM
      let decrypted = null;
      try {
        decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
      } catch (e) {
        console.log('Decryption error:', e.message);
      }
      
      // Capture WASM memory after decryption
      let memoryAfter = null;
      if (window.__wasmDebug.memory) {
        const mem = new Uint8Array(window.__wasmDebug.memory.buffer);
        memoryAfter = Array.from(mem.slice(0, 1024));
      }
      
      return {
        key,
        timestamp,
        nonce,
        signature,
        encryptedData,
        decrypted: decrypted ? JSON.stringify(decrypted) : null,
        memoryBefore,
        memoryAfter,
      };
    }, testKey);
    
    capturedData.push(result);
    
    console.log(`Capture ${i + 1}:`);
    console.log(`  Key: ${result.key.substring(0, 32)}...`);
    console.log(`  Encrypted: ${result.encryptedData.substring(0, 40)}...`);
    console.log(`  Decrypted: ${result.decrypted ? 'SUCCESS' : 'FAILED'}`);
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  await browser.close();
  
  // Analyze the captured data
  console.log('\n=== Analyzing Captured Data ===\n');
  
  // For each capture, derive the keystream and counter blocks
  for (let i = 0; i < capturedData.length; i++) {
    const data = capturedData[i];
    if (!data.decrypted) continue;
    
    const encrypted = Buffer.from(data.encryptedData, 'base64');
    const decrypted = Buffer.from(data.decrypted);
    const keyBuf = Buffer.from(data.key, 'hex');
    
    // Derive keystream
    const keystream = Buffer.alloc(Math.min(encrypted.length, decrypted.length));
    for (let j = 0; j < keystream.length; j++) {
      keystream[j] = encrypted[j] ^ decrypted[j];
    }
    
    // Derive counter blocks
    const counterBlocks = [];
    const numBlocks = Math.floor(keystream.length / 16);
    
    for (let block = 0; block < Math.min(numBlocks, 4); block++) {
      const keystreamBlock = keystream.subarray(block * 16, (block + 1) * 16);
      
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
      decipher.setAutoPadding(false);
      const counterBlock = decipher.update(keystreamBlock);
      
      counterBlocks.push(counterBlock.toString('hex'));
    }
    
    console.log(`Capture ${i + 1} counter blocks:`);
    counterBlocks.forEach((cb, idx) => console.log(`  Block ${idx}: ${cb}`));
    console.log();
  }
  
  // Look for patterns across captures
  console.log('=== Looking for Patterns ===\n');
  
  // Check if counter blocks are related to the key in any way
  for (let i = 0; i < capturedData.length; i++) {
    const data = capturedData[i];
    if (!data.decrypted) continue;
    
    const keyBuf = Buffer.from(data.key, 'hex');
    const encrypted = Buffer.from(data.encryptedData, 'base64');
    const decrypted = Buffer.from(data.decrypted);
    
    // Get first counter block
    const keystream0 = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      keystream0[j] = encrypted[j] ^ decrypted[j];
    }
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counter0 = decipher.update(keystream0);
    
    // Check various relationships
    const keyHash = crypto.createHash('sha256').update(keyBuf).digest();
    const keyMd5 = crypto.createHash('md5').update(keyBuf).digest();
    
    console.log(`Capture ${i + 1}:`);
    console.log(`  Counter0: ${counter0.toString('hex')}`);
    console.log(`  SHA256(key)[0:16]: ${keyHash.subarray(0, 16).toString('hex')}`);
    console.log(`  MD5(key): ${keyMd5.toString('hex')}`);
    console.log(`  Key[0:16]: ${keyBuf.subarray(0, 16).toString('hex')}`);
    console.log(`  Key[16:32]: ${keyBuf.subarray(16, 32).toString('hex')}`);
    
    // XOR counter with key parts
    const xorKeyFirst = Buffer.alloc(16);
    const xorKeyLast = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      xorKeyFirst[j] = counter0[j] ^ keyBuf[j];
      xorKeyLast[j] = counter0[j] ^ keyBuf[16 + j];
    }
    console.log(`  Counter0 XOR Key[0:16]: ${xorKeyFirst.toString('hex')}`);
    console.log(`  Counter0 XOR Key[16:32]: ${xorKeyLast.toString('hex')}`);
    console.log();
  }
  
  return capturedData;
}

deepWasmAnalysis().catch(console.error);
