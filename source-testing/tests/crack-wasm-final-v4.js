/**
 * Crack WASM - Final V4
 * 
 * Let's step back and think about this more carefully.
 * 
 * The WASM uses:
 * - aes-0.10.4
 * - ctr-0.9.2
 * - hmac-0.12.1
 * 
 * This suggests AES-CTR + HMAC for authentication.
 * 
 * The structure might be:
 * [HMAC (32 bytes)] [nonce (16 bytes)] [ciphertext (200 bytes)] = 248 bytes
 * But we have 395 bytes...
 * 
 * OR the ciphertext might be padded/expanded somehow.
 * 
 * Let me try to find the exact structure by looking at what happens
 * when we use the correct offset.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeStructure() {
  console.log('=== Analyzing Exact Structure ===\n');
  
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
  
  // Get multiple samples to compare
  const samples = [];
  
  for (let i = 0; i < 2; i++) {
    const testKey = crypto.randomBytes(32).toString('hex');
    
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
      
      return {
        key,
        encrypted: encryptedData,
        decrypted: decrypted,
      };
    }, testKey);
    
    samples.push(result);
    await new Promise(r => setTimeout(r, 300));
  }
  
  await browser.close();
  
  // Analyze each sample
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const keyBuf = Buffer.from(sample.key, 'hex');
    const encrypted = Buffer.from(sample.encrypted, 'base64');
    const decrypted = Buffer.from(sample.decrypted);
    
    console.log(`\n=== Sample ${i + 1} ===`);
    console.log(`Key: ${sample.key}`);
    console.log(`Encrypted: ${encrypted.length} bytes`);
    console.log(`Decrypted: ${decrypted.length} bytes`);
    
    // The overhead is 195 bytes
    // Let's see if we can find the exact ciphertext position
    
    // Try every possible offset and check if the decryption is correct
    for (let offset = 0; offset <= encrypted.length - decrypted.length; offset++) {
      // XOR to get keystream
      const keystream = Buffer.alloc(decrypted.length);
      for (let j = 0; j < decrypted.length; j++) {
        keystream[j] = encrypted[offset + j] ^ decrypted[j];
      }
      
      // Get counter block 0
      const keystreamBlock0 = keystream.subarray(0, 16);
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
      decipher.setAutoPadding(false);
      const counterBlock0 = decipher.update(keystreamBlock0);
      
      // Try to decrypt with this counter block as IV
      try {
        const ciphertext = encrypted.subarray(offset, offset + decrypted.length);
        const testDecipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, counterBlock0);
        const testDecrypted = testDecipher.update(ciphertext);
        
        if (testDecrypted.equals(decrypted)) {
          console.log(`\n*** FOUND EXACT MATCH at offset ${offset}! ***`);
          console.log(`  IV (counter block 0): ${counterBlock0.toString('hex')}`);
          console.log(`  Prefix length: ${offset} bytes`);
          console.log(`  Suffix length: ${encrypted.length - offset - decrypted.length} bytes`);
          
          // Analyze prefix
          const prefix = encrypted.subarray(0, offset);
          console.log(`  Prefix: ${prefix.toString('hex')}`);
          
          // Analyze suffix
          const suffix = encrypted.subarray(offset + decrypted.length);
          console.log(`  Suffix: ${suffix.toString('hex')}`);
          
          // Check if IV is in prefix
          for (let k = 0; k <= prefix.length - 16; k++) {
            if (prefix.subarray(k, k + 16).equals(counterBlock0)) {
              console.log(`  IV found in prefix at position ${k}!`);
            }
          }
          
          // Check if suffix is HMAC
          const hmacCiphertext = crypto.createHmac('sha256', keyBuf).update(ciphertext).digest();
          if (suffix.equals(hmacCiphertext)) {
            console.log(`  Suffix is HMAC(key, ciphertext)!`);
          }
          
          const hmacAll = crypto.createHmac('sha256', keyBuf).update(encrypted.subarray(0, offset + decrypted.length)).digest();
          if (suffix.length >= 32 && suffix.subarray(0, 32).equals(hmacAll)) {
            console.log(`  Suffix starts with HMAC(key, prefix+ciphertext)!`);
          }
          
          break;
        }
      } catch (e) {
        // Ignore
      }
    }
  }
}

analyzeStructure().catch(console.error);
