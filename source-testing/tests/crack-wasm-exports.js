/**
 * Crack WASM - Analyze Module Exports
 * 
 * Look at all WASM module exports and try to access internal state.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const EMBEDDED_KEY = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';

async function analyzeExports() {
  console.log('=== WASM Module Exports Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM instantiation
  await page.evaluateOnNewDocument(() => {
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      window.__wasmInstance = result.instance || result;
      window.__wasmModule = result.module;
      console.log('[WASM] Instantiated');
      return result;
    };
    
    const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function(source, importObject) {
      const result = await originalInstantiateStreaming.call(this, source, importObject);
      window.__wasmInstance = result.instance;
      window.__wasmModule = result.module;
      console.log('[WASM] Instantiated via streaming');
      return result;
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get WASM exports
  const exports = await page.evaluate(() => {
    const instance = window.__wasmInstance;
    if (!instance) return { error: 'No WASM instance found' };
    
    const exports = instance.exports;
    const exportNames = Object.keys(exports);
    
    const exportInfo = {};
    for (const name of exportNames) {
      const exp = exports[name];
      if (typeof exp === 'function') {
        exportInfo[name] = { type: 'function', length: exp.length };
      } else if (exp instanceof WebAssembly.Memory) {
        exportInfo[name] = { type: 'memory', size: exp.buffer.byteLength };
      } else if (exp instanceof WebAssembly.Table) {
        exportInfo[name] = { type: 'table', length: exp.length };
      } else if (exp instanceof WebAssembly.Global) {
        exportInfo[name] = { type: 'global', value: exp.value };
      } else {
        exportInfo[name] = { type: typeof exp };
      }
    }
    
    return {
      exportCount: exportNames.length,
      exports: exportInfo,
    };
  });
  
  console.log(`WASM exports: ${exports.exportCount}`);
  console.log('\nExport details:');
  for (const [name, info] of Object.entries(exports.exports || {})) {
    console.log(`  ${name}: ${JSON.stringify(info)}`);
  }
  
  // Now make a request and dump memory
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`\nAPI key: ${testKey}\n`);
  
  const result = await page.evaluate(async (key, embeddedKey) => {
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
    
    // Get memory before decryption
    const instance = window.__wasmInstance;
    const memory = instance?.exports?.memory;
    
    let memoryBefore = null;
    if (memory) {
      memoryBefore = new Uint8Array(memory.buffer.slice(0, 131072)); // 128KB
    }
    
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    // Get memory after decryption
    let memoryAfter = null;
    if (memory) {
      memoryAfter = new Uint8Array(memory.buffer.slice(0, 131072));
    }
    
    // Find changed regions
    const changedRegions = [];
    if (memoryBefore && memoryAfter) {
      let inChange = false;
      let changeStart = 0;
      
      for (let i = 0; i < memoryBefore.length; i++) {
        if (memoryBefore[i] !== memoryAfter[i]) {
          if (!inChange) {
            inChange = true;
            changeStart = i;
          }
        } else {
          if (inChange) {
            changedRegions.push({
              start: changeStart,
              end: i,
              length: i - changeStart,
              data: Array.from(memoryAfter.slice(changeStart, Math.min(i, changeStart + 64))),
            });
            inChange = false;
          }
        }
      }
    }
    
    // Search for API key (as hex string bytes)
    const keyStringBytes = new TextEncoder().encode(key);
    const keyHexBytes = [];
    for (let i = 0; i < key.length; i += 2) {
      keyHexBytes.push(parseInt(key.substr(i, 2), 16));
    }
    
    const keyStringPositions = [];
    const keyHexPositions = [];
    
    if (memoryAfter) {
      // Search for key as string
      for (let i = 0; i <= memoryAfter.length - keyStringBytes.length; i++) {
        let match = true;
        for (let j = 0; j < keyStringBytes.length; j++) {
          if (memoryAfter[i + j] !== keyStringBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) keyStringPositions.push(i);
      }
      
      // Search for key as hex bytes
      for (let i = 0; i <= memoryAfter.length - 32; i++) {
        let match = true;
        for (let j = 0; j < 32; j++) {
          if (memoryAfter[i + j] !== keyHexBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) keyHexPositions.push(i);
      }
    }
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      memorySize: memory ? memory.buffer.byteLength : 0,
      changedRegions: changedRegions.slice(0, 20),
      keyStringPositions,
      keyHexPositions,
    };
  }, testKey, EMBEDDED_KEY);
  
  await browser.close();
  
  console.log(`Memory size: ${result.memorySize} bytes`);
  console.log(`Changed regions: ${result.changedRegions.length}`);
  console.log(`API key (string) found at: ${result.keyStringPositions.join(', ') || 'not found'}`);
  console.log(`API key (hex) found at: ${result.keyHexPositions.join(', ') || 'not found'}`);
  
  console.log('\nChanged regions:');
  for (const region of result.changedRegions) {
    console.log(`  Offset ${region.start}-${region.end} (${region.length} bytes): ${Buffer.from(region.data).toString('hex').slice(0, 64)}...`);
  }
  
  // Analyze the encrypted data
  const apiKeyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  const overhead = encrypted.length - decrypted.length;
  const prefix = encrypted.subarray(0, overhead);
  const ciphertext = encrypted.subarray(overhead);
  
  // Derive keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  console.log(`\nOverhead: ${overhead} bytes`);
  console.log(`Keystream: ${keystream.length} bytes`);
  console.log(`Prefix: ${prefix.toString('hex')}`);
  console.log(`Keystream: ${keystream.toString('hex')}`);
  
  // Try to find keystream in changed regions
  console.log('\n=== Searching for Keystream in Changed Regions ===\n');
  
  const keystreamFirst16 = keystream.subarray(0, 16);
  
  for (const region of result.changedRegions) {
    const regionBuf = Buffer.from(region.data);
    
    for (let i = 0; i <= regionBuf.length - 16; i++) {
      if (regionBuf.subarray(i, i + 16).equals(keystreamFirst16)) {
        console.log(`Found keystream at region offset ${region.start + i}`);
      }
    }
  }
  
  // Try each changed region as a potential key
  console.log('\n=== Testing Changed Regions as Keys ===\n');
  
  for (const region of result.changedRegions) {
    if (region.data.length >= 32) {
      const potentialKey = Buffer.from(region.data.slice(0, 32));
      
      for (let ivStart = 0; ivStart <= overhead - 16; ivStart += 16) {
        const iv = prefix.subarray(ivStart, ivStart + 16);
        
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', potentialKey, iv);
          const zeros = Buffer.alloc(keystream.length);
          const testKeystream = cipher.update(zeros);
          
          if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
            console.log(`*** MATCH! Key from region ${region.start}, IV at prefix[${ivStart}] ***`);
            console.log(`Key: ${potentialKey.toString('hex')}`);
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }
  
  console.log('\nDone.');
}

analyzeExports().catch(console.error);
