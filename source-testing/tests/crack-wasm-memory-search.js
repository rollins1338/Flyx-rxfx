/**
 * Crack WASM - Search Full Memory
 * 
 * Search the entire WASM memory for counter blocks and key material.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function searchFullMemory() {
  console.log('=== Search Full WASM Memory ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
  // Get the full memory dump after decryption
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
    
    // Get WASM memory - search for the wasmImgData module
    let memoryDump = null;
    let memorySize = 0;
    
    // Try to access the WASM memory through the module
    if (window.wasmImgData && window.wasmImgData._wasm) {
      const memory = window.wasmImgData._wasm.memory;
      if (memory) {
        memorySize = memory.buffer.byteLength;
        // Only dump first 256KB to avoid memory issues
        const dumpSize = Math.min(memorySize, 256 * 1024);
        memoryDump = Array.from(new Uint8Array(memory.buffer, 0, dumpSize));
      }
    }
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      memoryDump: memoryDump,
      memorySize: memorySize,
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`WASM memory size: ${result.memorySize} bytes`);
  console.log(`Memory dump size: ${result.memoryDump?.length || 0} bytes\n`);
  
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
  for (let i = 0; i < counterBlocks.length; i++) {
    console.log(`  ${i}: ${counterBlocks[i].toString('hex')}`);
  }
  
  if (result.memoryDump) {
    const memory = Buffer.from(result.memoryDump);
    
    console.log('\n=== Searching Memory ===\n');
    
    // Search for counter blocks
    console.log('Counter blocks in memory:');
    for (let i = 0; i < counterBlocks.length; i++) {
      const cb = counterBlocks[i];
      for (let pos = 0; pos <= memory.length - 16; pos++) {
        if (memory.slice(pos, pos + 16).equals(cb)) {
          console.log(`  Block ${i} at offset ${pos} (0x${pos.toString(16)})`);
        }
      }
    }
    
    // Search for key
    console.log('\nKey in memory:');
    for (let pos = 0; pos <= memory.length - 32; pos++) {
      if (memory.slice(pos, pos + 32).equals(keyBuf)) {
        console.log(`  Key at offset ${pos} (0x${pos.toString(16)})`);
      }
    }
    
    // Search for key as hex string
    const keyHex = Buffer.from(testKey, 'utf8');
    console.log('\nKey (hex string) in memory:');
    for (let pos = 0; pos <= memory.length - 64; pos++) {
      if (memory.slice(pos, pos + 64).equals(keyHex)) {
        console.log(`  Key hex at offset ${pos} (0x${pos.toString(16)})`);
      }
    }
    
    // Search for encrypted prefix
    const encPrefix = encrypted.slice(0, 32);
    console.log('\nEncrypted prefix in memory:');
    for (let pos = 0; pos <= memory.length - 32; pos++) {
      if (memory.slice(pos, pos + 32).equals(encPrefix)) {
        console.log(`  Encrypted prefix at offset ${pos} (0x${pos.toString(16)})`);
      }
    }
    
    // Search for decrypted prefix
    const decPrefix = decrypted.slice(0, 32);
    console.log('\nDecrypted prefix in memory:');
    for (let pos = 0; pos <= memory.length - 32; pos++) {
      if (memory.slice(pos, pos + 32).equals(decPrefix)) {
        console.log(`  Decrypted prefix at offset ${pos} (0x${pos.toString(16)})`);
      }
    }
    
    // Search for keystream
    const ksPrefix = keystream.slice(0, 32);
    console.log('\nKeystream prefix in memory:');
    for (let pos = 0; pos <= memory.length - 32; pos++) {
      if (memory.slice(pos, pos + 32).equals(ksPrefix)) {
        console.log(`  Keystream prefix at offset ${pos} (0x${pos.toString(16)})`);
      }
    }
    
    // Look for AES S-box (common in AES implementations)
    const sboxStart = Buffer.from([0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5]);
    console.log('\nAES S-box in memory:');
    for (let pos = 0; pos <= memory.length - 8; pos++) {
      if (memory.slice(pos, pos + 8).equals(sboxStart)) {
        console.log(`  S-box at offset ${pos} (0x${pos.toString(16)})`);
      }
    }
  }
}

searchFullMemory().catch(console.error);
