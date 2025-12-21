/**
 * Crack WASM V6 - Deep WASM Analysis
 * 
 * Based on WAT disassembly analysis:
 * 
 * KEY FINDINGS FROM WAT:
 * 1. Uses AES-256-CTR (ctr-0.9.2/ctr32.rs) with fixslice32 implementation
 * 2. Uses HMAC-SHA256 (hmac-0.12.1) for authentication
 * 3. Function 132 (process_img_data) is the main entry point
 * 4. Function 133 generates counter blocks - last 4 bytes are counter + base
 * 5. Function 134 is SHA256 compression (rotations: 26,21,7 and 30,19,10)
 * 
 * COUNTER BLOCK STRUCTURE (from func 133):
 * - Bytes 0-11: Nonce (from somewhere - likely response prefix or derived)
 * - Bytes 12-15: Counter (big-endian, increments per block)
 * 
 * The key insight from func 133:
 * ```wat
 * local.get 1 i32.load offset=12  ; Load base counter (nonce last 4 bytes)
 * local.get 1 i32.load offset=16  ; Load block counter
 * i32.add                          ; Add them together
 * ; Then byte-swap to big-endian
 * ```
 * 
 * This means the counter is: nonce[12:16] + block_number (in big-endian)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function deepAnalysis() {
  console.log('=== Deep WASM Analysis V6 ===\n');
  
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
  
  // Use a known key for analysis
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
  // Make multiple requests to analyze patterns
  const results = [];
  
  for (let i = 0; i < 3; i++) {
    const result = await page.evaluate(async (key, reqNum) => {
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
        reqNum,
        timestamp,
        nonce,
        encrypted: encryptedData,
        decrypted: decrypted,
      };
    }, testKey, i);
    
    results.push(result);
    console.log(`Request ${i}: Got ${result.encrypted.length} chars encrypted`);
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  
  // Analyze each result
  for (const result of results) {
    console.log(`\n=== Request ${result.reqNum} Analysis ===`);
    
    const encrypted = Buffer.from(result.encrypted, 'base64');
    const decrypted = Buffer.from(result.decrypted);
    
    console.log(`Encrypted: ${encrypted.length} bytes`);
    console.log(`Decrypted: ${decrypted.length} bytes`);
    console.log(`Overhead: ${encrypted.length - decrypted.length} bytes`);
    
    // The overhead should contain: nonce (12 bytes) + HMAC tag (32 bytes) + possibly more
    const overhead = encrypted.length - decrypted.length;
    
    // Try different offset positions for the ciphertext
    console.log('\n--- Analyzing prefix structure ---');
    console.log(`First 64 bytes: ${encrypted.subarray(0, 64).toString('hex')}`);
    
    // Derive keystream from known plaintext
    // Try offset = overhead (most likely)
    const offset = overhead;
    const keystream = Buffer.alloc(decrypted.length);
    for (let i = 0; i < decrypted.length; i++) {
      keystream[i] = encrypted[offset + i] ^ decrypted[i];
    }
    
    // Derive counter blocks by decrypting keystream with AES-ECB
    const counterBlocks = [];
    const numBlocks = Math.ceil(decrypted.length / 16);
    
    for (let block = 0; block < numBlocks; block++) {
      const start = block * 16;
      const end = Math.min(start + 16, keystream.length);
      const keystreamBlock = keystream.subarray(start, end);
      
      const padded = Buffer.alloc(16);
      keystreamBlock.copy(padded);
      
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
      decipher.setAutoPadding(false);
      const counterBlock = decipher.update(padded);
      counterBlocks.push(counterBlock);
    }
    
    console.log('\n--- Counter blocks (derived from keystream) ---');
    counterBlocks.slice(0, 5).forEach((cb, i) => {
      console.log(`  Block ${i}: ${cb.toString('hex')}`);
      // Show the last 4 bytes as big-endian integer
      const lastFour = cb.readUInt32BE(12);
      console.log(`    Last 4 bytes as BE int: ${lastFour}`);
    });
    
    // Check if first 12 bytes are consistent across blocks
    const nonce12 = counterBlocks[0].subarray(0, 12);
    console.log(`\n--- Nonce analysis ---`);
    console.log(`First 12 bytes of block 0: ${nonce12.toString('hex')}`);
    
    let nonceConsistent = true;
    for (let i = 1; i < Math.min(counterBlocks.length, 5); i++) {
      const thisNonce = counterBlocks[i].subarray(0, 12);
      if (!thisNonce.equals(nonce12)) {
        nonceConsistent = false;
        console.log(`Block ${i} nonce differs: ${thisNonce.toString('hex')}`);
      }
    }
    console.log(`Nonce consistent across blocks: ${nonceConsistent}`);
    
    // Check if counter increments
    if (nonceConsistent) {
      console.log('\n--- Counter increment analysis ---');
      for (let i = 0; i < Math.min(counterBlocks.length - 1, 5); i++) {
        const counter1 = counterBlocks[i].readUInt32BE(12);
        const counter2 = counterBlocks[i + 1].readUInt32BE(12);
        console.log(`  Block ${i} -> ${i+1}: ${counter1} -> ${counter2} (diff: ${counter2 - counter1})`);
      }
    }
    
    // Check if nonce is in the prefix
    console.log('\n--- Checking if nonce is in prefix ---');
    const prefix = encrypted.subarray(0, overhead);
    
    // Check various positions
    for (let pos = 0; pos <= overhead - 12; pos++) {
      const prefixSlice = prefix.subarray(pos, pos + 12);
      if (prefixSlice.equals(nonce12)) {
        console.log(`*** FOUND nonce at prefix offset ${pos}! ***`);
      }
    }
    
    // Check if nonce is derived from key
    console.log('\n--- Checking if nonce is derived from key ---');
    
    // SHA256(key)
    const keyHash = crypto.createHash('sha256').update(keyBuf).digest();
    console.log(`SHA256(key)[0:12]: ${keyHash.subarray(0, 12).toString('hex')}`);
    console.log(`Actual nonce:      ${nonce12.toString('hex')}`);
    console.log(`Match: ${keyHash.subarray(0, 12).equals(nonce12)}`);
    
    // HMAC-SHA256(key, prefix)
    const hmacNonce = crypto.createHmac('sha256', keyBuf).update(prefix.subarray(0, 32)).digest();
    console.log(`HMAC(key, prefix[0:32])[0:12]: ${hmacNonce.subarray(0, 12).toString('hex')}`);
    console.log(`Match: ${hmacNonce.subarray(0, 12).equals(nonce12)}`);
    
    // Check if nonce is first 12 bytes of prefix
    console.log(`Prefix[0:12]: ${prefix.subarray(0, 12).toString('hex')}`);
    console.log(`Match: ${prefix.subarray(0, 12).equals(nonce12)}`);
    
    // Check if nonce is XOR of key parts
    const keyXor = Buffer.alloc(12);
    for (let i = 0; i < 12; i++) {
      keyXor[i] = keyBuf[i] ^ keyBuf[i + 16];
    }
    console.log(`Key[0:12] XOR Key[16:28]: ${keyXor.toString('hex')}`);
    console.log(`Match: ${keyXor.equals(nonce12)}`);
  }
  
  // Cross-request analysis
  console.log('\n\n=== Cross-Request Analysis ===');
  
  // Check if nonces are the same across requests (they shouldn't be for security)
  const allNonces = results.map(r => {
    const encrypted = Buffer.from(r.encrypted, 'base64');
    const decrypted = Buffer.from(r.decrypted);
    const overhead = encrypted.length - decrypted.length;
    
    const keystream = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      keystream[i] = encrypted[overhead + i] ^ decrypted[i];
    }
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    return decipher.update(keystream).subarray(0, 12);
  });
  
  console.log('Nonces from each request:');
  allNonces.forEach((n, i) => console.log(`  Request ${i}: ${n.toString('hex')}`));
  
  const allSame = allNonces.every(n => n.equals(allNonces[0]));
  console.log(`All nonces same: ${allSame}`);
  
  if (!allSame) {
    console.log('\nNonces differ per request - likely derived from response-specific data');
    
    // Check if nonce is in the encrypted response prefix
    for (let i = 0; i < results.length; i++) {
      const encrypted = Buffer.from(results[i].encrypted, 'base64');
      const nonce = allNonces[i];
      
      for (let pos = 0; pos < 100; pos++) {
        if (encrypted.subarray(pos, pos + 12).equals(nonce)) {
          console.log(`Request ${i}: Nonce found at position ${pos}`);
          break;
        }
      }
    }
  }
}

deepAnalysis().catch(console.error);
