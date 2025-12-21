/**
 * Crack WASM - Final V5
 * 
 * Key realization: Standard AES-CTR doesn't work at ANY offset.
 * This means the counter blocks are generated per-block, not incrementing.
 * 
 * The WASM must be using a PRNG to generate counter blocks.
 * The PRNG must be seeded with something both client and server know.
 * 
 * Possible PRNG seeds:
 * 1. API key alone
 * 2. API key + nonce from response
 * 3. API key + some other shared data
 * 
 * Let's try to find the PRNG by analyzing multiple blocks.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzePRNG() {
  console.log('=== Analyzing PRNG Pattern ===\n');
  
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
  
  // Assume offset 195 (overhead)
  const offset = 195;
  
  // Derive all counter blocks
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = encrypted[offset + i] ^ decrypted[i];
  }
  
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
  
  console.log('Counter blocks:');
  counterBlocks.forEach((cb, i) => console.log(`  ${i}: ${cb.toString('hex')}`));
  
  // Now let's try to find a PRNG that generates these counter blocks
  console.log('\n=== Testing PRNG Algorithms ===\n');
  
  // The prefix might contain the PRNG seed
  const prefix = encrypted.subarray(0, offset);
  
  // Try: PRNG seeded with first 16 bytes of prefix
  const seed16 = prefix.subarray(0, 16);
  console.log(`Seed (first 16 bytes of prefix): ${seed16.toString('hex')}`);
  
  // Try: PRNG seeded with first 32 bytes of prefix
  const seed32 = prefix.subarray(0, 32);
  console.log(`Seed (first 32 bytes of prefix): ${seed32.toString('hex')}`);
  
  // Try HMAC-DRBG style PRNG
  console.log('\n--- HMAC-DRBG Style ---');
  
  // HMAC-DRBG: state = HMAC(key, seed), output = HMAC(state, counter)
  let state = crypto.createHmac('sha256', keyBuf).update(seed16).digest();
  
  for (let i = 0; i < 3; i++) {
    const output = crypto.createHmac('sha256', state).update(Buffer.from([i])).digest().subarray(0, 16);
    console.log(`  Block ${i}: ${output.toString('hex')}`);
    console.log(`  Actual:   ${counterBlocks[i].toString('hex')}`);
    console.log(`  Match: ${output.equals(counterBlocks[i])}`);
  }
  
  // Try: Hash chain
  console.log('\n--- Hash Chain ---');
  
  let hashState = crypto.createHash('sha256').update(Buffer.concat([keyBuf, seed16])).digest();
  
  for (let i = 0; i < 3; i++) {
    const output = hashState.subarray(0, 16);
    console.log(`  Block ${i}: ${output.toString('hex')}`);
    console.log(`  Actual:   ${counterBlocks[i].toString('hex')}`);
    console.log(`  Match: ${output.equals(counterBlocks[i])}`);
    
    hashState = crypto.createHash('sha256').update(hashState).digest();
  }
  
  // Try: AES-based PRNG
  console.log('\n--- AES-based PRNG ---');
  
  // state = seed, output_n = AES(key, state), state = output_n
  let aesState = Buffer.from(seed16);
  
  for (let i = 0; i < 3; i++) {
    const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
    cipher.setAutoPadding(false);
    const output = cipher.update(aesState);
    
    console.log(`  Block ${i}: ${output.toString('hex')}`);
    console.log(`  Actual:   ${counterBlocks[i].toString('hex')}`);
    console.log(`  Match: ${output.equals(counterBlocks[i])}`);
    
    aesState = output;
  }
  
  // Try: XOR with prefix blocks
  console.log('\n--- XOR with Prefix Blocks ---');
  
  for (let i = 0; i < Math.min(3, Math.floor(prefix.length / 16)); i++) {
    const prefixBlock = prefix.subarray(i * 16, (i + 1) * 16);
    const xored = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      xored[j] = prefixBlock[j] ^ counterBlocks[i][j];
    }
    console.log(`  Block ${i} XOR prefix[${i}]: ${xored.toString('hex')}`);
  }
  
  // Check if XOR results are consistent (same value for all blocks)
  const xorResults = [];
  for (let i = 0; i < Math.min(counterBlocks.length, Math.floor(prefix.length / 16)); i++) {
    const prefixBlock = prefix.subarray(i * 16, (i + 1) * 16);
    const xored = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      xored[j] = prefixBlock[j] ^ counterBlocks[i][j];
    }
    xorResults.push(xored);
  }
  
  // Check if all XOR results are the same
  const allSame = xorResults.every(x => x.equals(xorResults[0]));
  console.log(`\nAll XOR results same: ${allSame}`);
  
  if (allSame) {
    console.log(`XOR mask: ${xorResults[0].toString('hex')}`);
    
    // Check if XOR mask is derived from key
    if (xorResults[0].equals(keyBuf.subarray(0, 16))) {
      console.log('*** XOR mask is key[0:16]! ***');
    }
    if (xorResults[0].equals(keyBuf.subarray(16, 32))) {
      console.log('*** XOR mask is key[16:32]! ***');
    }
  }
}

analyzePRNG().catch(console.error);
