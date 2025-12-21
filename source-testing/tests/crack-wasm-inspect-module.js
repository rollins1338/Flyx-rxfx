/**
 * Crack WASM - Inspect Module Structure
 * 
 * Let's inspect the wasmImgData module to understand its structure
 * and find the WASM memory.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function inspectModule() {
  console.log('=== Inspect WASM Module ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM instantiation to capture the instance
  await page.evaluateOnNewDocument(() => {
    window.__wasmInstances = [];
    
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await originalInstantiate.call(this, bufferSource, importObject);
      window.__wasmInstances.push({
        instance: result.instance,
        exports: Object.keys(result.instance.exports),
        memory: result.instance.exports.memory,
      });
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
  
  // Inspect the module structure
  const moduleInfo = await page.evaluate(() => {
    const info = {
      wasmImgDataKeys: Object.keys(window.wasmImgData || {}),
      wasmInstanceCount: window.__wasmInstances?.length || 0,
      wasmExports: [],
      memorySize: 0,
    };
    
    if (window.__wasmInstances && window.__wasmInstances.length > 0) {
      for (const inst of window.__wasmInstances) {
        info.wasmExports.push(inst.exports);
        if (inst.memory) {
          info.memorySize = inst.memory.buffer.byteLength;
        }
      }
    }
    
    return info;
  });
  
  console.log('Module info:');
  console.log(`  wasmImgData keys: ${moduleInfo.wasmImgDataKeys.join(', ')}`);
  console.log(`  WASM instances: ${moduleInfo.wasmInstanceCount}`);
  console.log(`  WASM exports: ${JSON.stringify(moduleInfo.wasmExports)}`);
  console.log(`  Memory size: ${moduleInfo.memorySize} bytes\n`);
  
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
  // Perform decryption and capture memory
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
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    // Capture memory from the WASM instance
    let memoryDump = null;
    if (window.__wasmInstances && window.__wasmInstances.length > 0) {
      for (const inst of window.__wasmInstances) {
        if (inst.memory) {
          const mem = new Uint8Array(inst.memory.buffer);
          // Dump first 512KB
          const dumpSize = Math.min(mem.length, 512 * 1024);
          memoryDump = Array.from(mem.slice(0, dumpSize));
          break;
        }
      }
    }
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      memoryDump: memoryDump,
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Memory dump: ${result.memoryDump?.length || 0} bytes\n`);
  
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
  
  if (result.memoryDump && result.memoryDump.length > 0) {
    const memory = Buffer.from(result.memoryDump);
    
    console.log('\n=== Memory Search ===\n');
    
    // Search for counter blocks
    let foundCounterBlocks = 0;
    for (let i = 0; i < counterBlocks.length; i++) {
      const cb = counterBlocks[i];
      for (let pos = 0; pos <= memory.length - 16; pos++) {
        if (memory.slice(pos, pos + 16).equals(cb)) {
          console.log(`Counter block ${i} at offset 0x${pos.toString(16)}`);
          foundCounterBlocks++;
        }
      }
    }
    console.log(`Found ${foundCounterBlocks} counter blocks in memory`);
    
    // Search for key
    let foundKey = false;
    for (let pos = 0; pos <= memory.length - 32; pos++) {
      if (memory.slice(pos, pos + 32).equals(keyBuf)) {
        console.log(`Key at offset 0x${pos.toString(16)}`);
        foundKey = true;
      }
    }
    if (!foundKey) console.log('Key not found in memory');
    
    // Search for AES S-box
    const sboxStart = Buffer.from([0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5]);
    for (let pos = 0; pos <= memory.length - 8; pos++) {
      if (memory.slice(pos, pos + 8).equals(sboxStart)) {
        console.log(`AES S-box at offset 0x${pos.toString(16)}`);
      }
    }
    
    // Search for keystream
    const ksPrefix = keystream.slice(0, 16);
    for (let pos = 0; pos <= memory.length - 16; pos++) {
      if (memory.slice(pos, pos + 16).equals(ksPrefix)) {
        console.log(`Keystream prefix at offset 0x${pos.toString(16)}`);
      }
    }
  }
}

inspectModule().catch(console.error);
