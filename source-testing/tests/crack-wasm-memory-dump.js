/**
 * Crack WASM - Memory Dump During Decryption
 * 
 * Dump the WASM memory before and after decryption to find:
 * - The actual encryption key
 * - The IV/nonce
 * - Any intermediate values
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const EMBEDDED_KEY = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';

async function dumpMemory() {
  console.log('=== WASM Memory Dump ===\n');
  
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
  console.log(`API key: ${testKey}\n`);
  
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
    
    // Get WASM memory before decryption
    const wasmModule = window.wasmImgData;
    const memory = wasmModule.__wbindgen_wasm_module?.exports?.memory || 
                   wasmModule.memory;
    
    let memoryBefore = null;
    if (memory) {
      const memArray = new Uint8Array(memory.buffer);
      // Only capture first 64KB to avoid huge data
      memoryBefore = Array.from(memArray.slice(0, 65536));
    }
    
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    // Get WASM memory after decryption
    let memoryAfter = null;
    if (memory) {
      const memArray = new Uint8Array(memory.buffer);
      memoryAfter = Array.from(memArray.slice(0, 65536));
    }
    
    // Find differences
    const diffs = [];
    if (memoryBefore && memoryAfter) {
      for (let i = 0; i < memoryBefore.length; i++) {
        if (memoryBefore[i] !== memoryAfter[i]) {
          diffs.push({ offset: i, before: memoryBefore[i], after: memoryAfter[i] });
        }
      }
    }
    
    // Search for the API key in memory
    const keyBytes = [];
    for (let i = 0; i < key.length; i += 2) {
      keyBytes.push(parseInt(key.substr(i, 2), 16));
    }
    
    const keyPositions = [];
    if (memoryAfter) {
      for (let i = 0; i <= memoryAfter.length - 32; i++) {
        let match = true;
        for (let j = 0; j < 32; j++) {
          if (memoryAfter[i + j] !== keyBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          keyPositions.push(i);
        }
      }
    }
    
    // Search for embedded key in memory
    const embeddedKeyBytes = [];
    for (let i = 0; i < embeddedKey.length; i += 2) {
      embeddedKeyBytes.push(parseInt(embeddedKey.substr(i, 2), 16));
    }
    
    const embeddedKeyPositions = [];
    if (memoryAfter) {
      for (let i = 0; i <= memoryAfter.length - 32; i++) {
        let match = true;
        for (let j = 0; j < 32; j++) {
          if (memoryAfter[i + j] !== embeddedKeyBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          embeddedKeyPositions.push(i);
        }
      }
    }
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      memorySize: memory ? memory.buffer.byteLength : 0,
      diffCount: diffs.length,
      diffSample: diffs.slice(0, 100),
      keyPositions,
      embeddedKeyPositions,
      // Sample memory regions that might contain keys
      memorySamples: memoryAfter ? [
        { offset: 0, data: memoryAfter.slice(0, 256) },
        { offset: 1024, data: memoryAfter.slice(1024, 1280) },
        { offset: 4096, data: memoryAfter.slice(4096, 4352) },
        { offset: 8192, data: memoryAfter.slice(8192, 8448) },
        { offset: 16384, data: memoryAfter.slice(16384, 16640) },
        { offset: 32768, data: memoryAfter.slice(32768, 33024) },
      ] : [],
    };
  }, testKey, EMBEDDED_KEY);
  
  await browser.close();
  
  console.log(`WASM memory size: ${result.memorySize} bytes`);
  console.log(`Memory differences: ${result.diffCount}`);
  console.log(`API key found at positions: ${result.keyPositions.join(', ') || 'not found'}`);
  console.log(`Embedded key found at positions: ${result.embeddedKeyPositions.join(', ') || 'not found'}`);
  
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
  
  // Search for keystream in memory samples
  console.log('\n=== Searching for Keystream in Memory ===\n');
  
  const keystreamFirst16 = keystream.subarray(0, 16);
  
  for (const sample of result.memorySamples) {
    const sampleBuf = Buffer.from(sample.data);
    
    for (let i = 0; i <= sampleBuf.length - 16; i++) {
      if (sampleBuf.subarray(i, i + 16).equals(keystreamFirst16)) {
        console.log(`Found keystream at memory offset ${sample.offset + i}`);
      }
    }
  }
  
  // Search for prefix in memory
  console.log('\n=== Searching for Prefix in Memory ===\n');
  
  const prefixFirst16 = prefix.subarray(0, 16);
  
  for (const sample of result.memorySamples) {
    const sampleBuf = Buffer.from(sample.data);
    
    for (let i = 0; i <= sampleBuf.length - 16; i++) {
      if (sampleBuf.subarray(i, i + 16).equals(prefixFirst16)) {
        console.log(`Found prefix at memory offset ${sample.offset + i}`);
      }
    }
  }
  
  // Look for potential keys in memory (32-byte sequences with high entropy)
  console.log('\n=== High Entropy 32-byte Sequences ===\n');
  
  for (const sample of result.memorySamples) {
    const sampleBuf = Buffer.from(sample.data);
    
    for (let i = 0; i <= sampleBuf.length - 32; i += 16) {
      const seq = sampleBuf.subarray(i, i + 32);
      
      // Calculate entropy
      const counts = new Array(256).fill(0);
      for (const byte of seq) counts[byte]++;
      
      let entropy = 0;
      for (const count of counts) {
        if (count > 0) {
          const p = count / 32;
          entropy -= p * Math.log2(p);
        }
      }
      
      // High entropy sequences (potential keys)
      if (entropy > 4.5) {
        console.log(`Offset ${sample.offset + i}: entropy=${entropy.toFixed(2)}, data=${seq.toString('hex')}`);
        
        // Try this as a key
        for (let ivStart = 0; ivStart <= overhead - 16; ivStart += 16) {
          const iv = prefix.subarray(ivStart, ivStart + 16);
          
          try {
            const cipher = crypto.createCipheriv('aes-256-ctr', seq, iv);
            const zeros = Buffer.alloc(keystream.length);
            const testKeystream = cipher.update(zeros);
            
            if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
              console.log(`*** MATCH! Key at offset ${sample.offset + i}, IV at prefix[${ivStart}] ***`);
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    }
  }
  
  console.log('\nDone.');
}

dumpMemory().catch(console.error);
