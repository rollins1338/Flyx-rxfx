/**
 * Crack WASM - Final V2
 * 
 * Key insight: The first 16 bytes of plaintext always decrypt correctly
 * regardless of the offset we try. This is strange...
 * 
 * Wait, I think I misread the output. Let me re-analyze.
 * 
 * The output shows "{"sources":[{"se" at every offset, but the rest is garbage.
 * This means the first 16 bytes of the XOR result happen to produce valid JSON
 * by coincidence, but the rest doesn't match.
 * 
 * Let me try a different approach: find the exact offset where the ENTIRE
 * decrypted text matches.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function findExactOffset() {
  console.log('=== Finding Exact Ciphertext Offset ===\n');
  
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
  console.log(`Using key: ${testKey}\n`);
  
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
      encrypted: encryptedData,
      decrypted: decrypted,
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Decrypted: ${result.decrypted}\n`);
  
  // The decrypted text is 200 bytes
  // The encrypted is 395 bytes
  // Overhead is 195 bytes
  
  // Let's derive the keystream for the ENTIRE decrypted text
  // by trying every possible offset
  
  console.log('=== Trying Every Offset ===\n');
  
  for (let offset = 0; offset <= encrypted.length - decrypted.length; offset++) {
    // XOR encrypted[offset:offset+200] with decrypted to get keystream
    const keystream = Buffer.alloc(decrypted.length);
    for (let i = 0; i < decrypted.length; i++) {
      keystream[i] = encrypted[offset + i] ^ decrypted[i];
    }
    
    // Now, for AES-CTR, the keystream is AES(key, counter_n) for each block
    // Let's derive the counter blocks
    const counterBlocks = [];
    const numBlocks = Math.ceil(decrypted.length / 16);
    
    let validCTR = true;
    
    for (let block = 0; block < numBlocks; block++) {
      const start = block * 16;
      const end = Math.min(start + 16, keystream.length);
      const keystreamBlock = keystream.subarray(start, end);
      
      if (keystreamBlock.length < 16) {
        // Pad with zeros for the last block
        const padded = Buffer.alloc(16);
        keystreamBlock.copy(padded);
        
        const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
        decipher.setAutoPadding(false);
        const counterBlock = decipher.update(padded);
        counterBlocks.push(counterBlock);
      } else {
        const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
        decipher.setAutoPadding(false);
        const counterBlock = decipher.update(keystreamBlock);
        counterBlocks.push(counterBlock);
      }
    }
    
    // Check if the counter blocks follow a standard CTR pattern
    // (i.e., incrementing by 1 for each block)
    if (counterBlocks.length >= 2) {
      const cb0 = counterBlocks[0];
      const cb1 = counterBlocks[1];
      
      // Check if cb1 = cb0 + 1 (in the last 4 bytes, big-endian)
      const val0 = cb0.readUInt32BE(12);
      const val1 = cb1.readUInt32BE(12);
      
      if (val1 === val0 + 1) {
        // Check if the first 12 bytes are the same (nonce)
        if (cb0.subarray(0, 12).equals(cb1.subarray(0, 12))) {
          console.log(`*** FOUND STANDARD CTR at offset ${offset}! ***`);
          console.log(`  Nonce: ${cb0.subarray(0, 12).toString('hex')}`);
          console.log(`  Counter 0: ${val0}`);
          
          // Verify by decrypting
          const nonce = cb0.subarray(0, 12);
          const iv = Buffer.concat([nonce, Buffer.from([0, 0, 0, 0])]);
          iv.writeUInt32BE(val0, 12);
          
          const ciphertext = encrypted.subarray(offset, offset + decrypted.length);
          const testDecipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
          const testDecrypted = testDecipher.update(ciphertext);
          
          if (testDecrypted.equals(decrypted)) {
            console.log(`  *** VERIFIED! ***`);
            console.log(`  IV: ${iv.toString('hex')}`);
          }
        }
      }
      
      // Also check little-endian
      const val0LE = cb0.readUInt32LE(12);
      const val1LE = cb1.readUInt32LE(12);
      
      if (val1LE === val0LE + 1) {
        if (cb0.subarray(0, 12).equals(cb1.subarray(0, 12))) {
          console.log(`*** FOUND STANDARD CTR (LE) at offset ${offset}! ***`);
        }
      }
    }
    
    // Also check if counter blocks are in the prefix
    const prefix = encrypted.subarray(0, offset);
    for (let i = 0; i < counterBlocks.length && i < 3; i++) {
      const cb = counterBlocks[i];
      for (let j = 0; j <= prefix.length - 16; j++) {
        if (prefix.subarray(j, j + 16).equals(cb)) {
          console.log(`Offset ${offset}: Counter block ${i} found in prefix at position ${j}`);
        }
      }
    }
  }
  
  // Let's also try to find if the counter blocks are derived from the prefix
  console.log('\n=== Checking Counter Block Derivation ===\n');
  
  // Try offset 195 (since overhead is 195 bytes)
  const offset = 195;
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = encrypted[offset + i] ^ decrypted[i];
  }
  
  const keystreamBlock0 = keystream.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
  decipher.setAutoPadding(false);
  const counterBlock0 = decipher.update(keystreamBlock0);
  
  console.log(`Offset 195:`);
  console.log(`  Counter block 0: ${counterBlock0.toString('hex')}`);
  console.log(`  Prefix (195 bytes): ${encrypted.subarray(0, 195).toString('hex').substring(0, 64)}...`);
  
  // Check various derivations
  const prefix = encrypted.subarray(0, 195);
  
  // SHA256 of prefix
  const sha256Prefix = crypto.createHash('sha256').update(prefix).digest();
  console.log(`  SHA256(prefix)[0:16]: ${sha256Prefix.subarray(0, 16).toString('hex')}`);
  console.log(`  Match: ${sha256Prefix.subarray(0, 16).equals(counterBlock0)}`);
  
  // HMAC of prefix
  const hmacPrefix = crypto.createHmac('sha256', keyBuf).update(prefix).digest();
  console.log(`  HMAC(key, prefix)[0:16]: ${hmacPrefix.subarray(0, 16).toString('hex')}`);
  console.log(`  Match: ${hmacPrefix.subarray(0, 16).equals(counterBlock0)}`);
  
  // First 16 bytes of prefix
  console.log(`  prefix[0:16]: ${prefix.subarray(0, 16).toString('hex')}`);
  console.log(`  Match: ${prefix.subarray(0, 16).equals(counterBlock0)}`);
  
  // AES encrypt first 16 bytes of prefix
  const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
  cipher.setAutoPadding(false);
  const aesPrefix = cipher.update(prefix.subarray(0, 16));
  console.log(`  AES(key, prefix[0:16]): ${aesPrefix.toString('hex')}`);
  console.log(`  Match: ${aesPrefix.equals(counterBlock0)}`);
}

findExactOffset().catch(console.error);
