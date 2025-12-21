/**
 * Crack WASM - Final V3
 * 
 * Let's try a completely different approach:
 * 
 * The WASM decrypts successfully, so it must know the counter blocks.
 * The counter blocks are random per-request.
 * 
 * Hypothesis: The counter blocks are embedded in the response, but XORed
 * with something derived from the key to hide them.
 * 
 * Let's check if: counter_block_n = prefix_part XOR f(key, n)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function findXoredCounterBlocks() {
  console.log('=== Finding XORed Counter Blocks ===\n');
  
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
  
  // Derive counter blocks from known plaintext at offset 195
  const offset = 195;
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = encrypted[offset + i] ^ decrypted[i];
  }
  
  // Get first few counter blocks
  const counterBlocks = [];
  const numBlocks = Math.ceil(decrypted.length / 16);
  
  for (let block = 0; block < Math.min(numBlocks, 13); block++) {
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
  
  console.log('\nCounter blocks (assuming offset 195):');
  counterBlocks.forEach((cb, i) => console.log(`  Block ${i}: ${cb.toString('hex')}`));
  
  // The prefix is 195 bytes = 12 blocks of 16 bytes + 3 bytes
  // Maybe each 16-byte block in the prefix is the counter block XORed with something
  
  console.log('\n=== Checking if Prefix Contains XORed Counter Blocks ===\n');
  
  const prefix = encrypted.subarray(0, 195);
  
  // For each counter block, check if it's XORed with a key-derived value
  for (let i = 0; i < Math.min(counterBlocks.length, 12); i++) {
    const cb = counterBlocks[i];
    const prefixBlock = prefix.subarray(i * 16, (i + 1) * 16);
    
    // XOR counter block with prefix block
    const xored = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      xored[j] = cb[j] ^ prefixBlock[j];
    }
    
    console.log(`Block ${i}:`);
    console.log(`  Counter: ${cb.toString('hex')}`);
    console.log(`  Prefix:  ${prefixBlock.toString('hex')}`);
    console.log(`  XOR:     ${xored.toString('hex')}`);
    
    // Check if XOR result is related to the key
    // Try: key[0:16], key[16:32], SHA256(key), HMAC(key, i), etc.
    
    if (xored.equals(keyBuf.subarray(0, 16))) {
      console.log(`  *** MATCH: key[0:16] ***`);
    }
    if (xored.equals(keyBuf.subarray(16, 32))) {
      console.log(`  *** MATCH: key[16:32] ***`);
    }
    
    // Check SHA256(key || i)
    const hashKeyI = crypto.createHash('sha256').update(Buffer.concat([keyBuf, Buffer.from([i])])).digest().subarray(0, 16);
    if (xored.equals(hashKeyI)) {
      console.log(`  *** MATCH: SHA256(key || i)[0:16] ***`);
    }
    
    // Check HMAC(key, i)
    const hmacI = crypto.createHmac('sha256', keyBuf).update(Buffer.from([i])).digest().subarray(0, 16);
    if (xored.equals(hmacI)) {
      console.log(`  *** MATCH: HMAC(key, i)[0:16] ***`);
    }
    
    // Check AES(key, i)
    const iBlock = Buffer.alloc(16);
    iBlock.writeUInt32BE(i, 12);
    const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
    cipher.setAutoPadding(false);
    const aesI = cipher.update(iBlock);
    if (xored.equals(aesI)) {
      console.log(`  *** MATCH: AES(key, i) ***`);
    }
    
    console.log();
  }
  
  // Let's also check if the structure is different
  // Maybe: [random_seed (16)] [encrypted_counter_blocks (N*16)] [ciphertext (200)]
  
  console.log('=== Alternative Structure Analysis ===\n');
  
  // If the first 16 bytes are a random seed, and the next bytes are encrypted counter blocks
  const seed = encrypted.subarray(0, 16);
  console.log(`Potential seed: ${seed.toString('hex')}`);
  
  // Derive a key from the seed and API key
  const derivedKey = crypto.createHmac('sha256', keyBuf).update(seed).digest();
  console.log(`Derived key: ${derivedKey.toString('hex')}`);
  
  // Try to decrypt the next 192 bytes (12 counter blocks) with the derived key
  const encryptedCounters = encrypted.subarray(16, 16 + 192);
  
  // Try AES-CTR with derived key
  const iv = Buffer.alloc(16);
  try {
    const decipher = crypto.createDecipheriv('aes-256-ctr', derivedKey, iv);
    const decryptedCounters = decipher.update(encryptedCounters);
    console.log(`Decrypted counters (first 64 bytes): ${decryptedCounters.subarray(0, 64).toString('hex')}`);
    
    // Check if the first 16 bytes match our expected counter block 0
    if (decryptedCounters.subarray(0, 16).equals(counterBlocks[0])) {
      console.log(`*** MATCH: Counter blocks are encrypted with HMAC(key, seed)! ***`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  // Try AES-ECB
  try {
    const decipher = crypto.createDecipheriv('aes-256-ecb', derivedKey, null);
    decipher.setAutoPadding(false);
    const decryptedCounters = decipher.update(encryptedCounters);
    console.log(`Decrypted counters (ECB, first 64 bytes): ${decryptedCounters.subarray(0, 64).toString('hex')}`);
    
    if (decryptedCounters.subarray(0, 16).equals(counterBlocks[0])) {
      console.log(`*** MATCH: Counter blocks are AES-ECB encrypted! ***`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

findXoredCounterBlocks().catch(console.error);
