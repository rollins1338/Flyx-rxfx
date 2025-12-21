/**
 * Crack WASM - Memory Trace
 * 
 * This script intercepts WASM memory operations to understand
 * how the decryption works internally.
 * 
 * Key insight: The counter blocks are completely random per block,
 * which means either:
 * 1. The WASM uses a PRNG seeded with something to generate counters
 * 2. The "counter blocks" we're deriving are wrong (wrong offset or algorithm)
 * 
 * Let's trace the actual memory operations during decryption.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceWasmMemory() {
  console.log('=== WASM Memory Trace ===\n');
  
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
  
  // Use a simple key for analysis
  const testKey = '0'.repeat(64); // All zeros key for easier analysis
  console.log(`Test key: ${testKey}\n`);
  
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
    
    // Get the raw encrypted bytes
    const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Decrypt using WASM
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    return {
      encrypted: Array.from(encryptedBytes),
      decrypted: decrypted,
      encryptedBase64: encryptedData,
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.alloc(32, 0); // All zeros
  const encrypted = Buffer.from(result.encrypted);
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Overhead: ${encrypted.length - decrypted.length} bytes`);
  console.log(`\nDecrypted content: ${result.decrypted}\n`);
  
  // Parse the decrypted JSON to understand the structure
  try {
    const json = JSON.parse(result.decrypted);
    console.log('Decrypted JSON structure:', JSON.stringify(json, null, 2).substring(0, 500));
  } catch (e) {
    console.log('Could not parse as JSON');
  }
  
  // Analyze the encrypted structure
  console.log('\n=== Encrypted Structure Analysis ===');
  
  const overhead = encrypted.length - decrypted.length;
  console.log(`\nOverhead: ${overhead} bytes`);
  console.log(`Possible structure:`);
  console.log(`  - 12 bytes nonce + 32 bytes HMAC tag + 151 bytes ??? = 195 bytes`);
  console.log(`  - Or: 32 bytes HMAC + 12 bytes nonce + 151 bytes ??? = 195 bytes`);
  
  // Show the prefix in different chunk sizes
  console.log('\n--- Prefix breakdown ---');
  console.log(`Bytes 0-11 (possible nonce):   ${encrypted.subarray(0, 12).toString('hex')}`);
  console.log(`Bytes 12-43 (possible HMAC):   ${encrypted.subarray(12, 44).toString('hex')}`);
  console.log(`Bytes 44-55 (next 12):         ${encrypted.subarray(44, 56).toString('hex')}`);
  console.log(`Bytes 56-87 (next 32):         ${encrypted.subarray(56, 88).toString('hex')}`);
  
  // Alternative: HMAC first
  console.log('\n--- Alternative: HMAC first ---');
  console.log(`Bytes 0-31 (possible HMAC):    ${encrypted.subarray(0, 32).toString('hex')}`);
  console.log(`Bytes 32-43 (possible nonce):  ${encrypted.subarray(32, 44).toString('hex')}`);
  
  // Derive keystream
  const offset = overhead;
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = encrypted[offset + i] ^ decrypted[i];
  }
  
  console.log('\n=== Keystream Analysis ===');
  console.log(`First 64 bytes of keystream: ${keystream.subarray(0, 64).toString('hex')}`);
  
  // With all-zeros key, AES-ECB(0) = specific known value
  // Let's see what the "counter blocks" look like
  const counterBlocks = [];
  const numBlocks = Math.ceil(decrypted.length / 16);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, keystream.length);
    const keystreamBlock = keystream.subarray(start, end);
    
    const padded = Buffer.alloc(16);
    keystreamBlock.copy(padded);
    
    // With all-zeros key, we can derive what the "counter" would be
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(padded);
    counterBlocks.push(counterBlock);
  }
  
  console.log('\n--- Counter blocks (with all-zeros key) ---');
  counterBlocks.forEach((cb, i) => {
    console.log(`  Block ${i}: ${cb.toString('hex')}`);
  });
  
  // Check if counter blocks match any part of the prefix
  console.log('\n--- Checking if counter blocks are in prefix ---');
  for (let i = 0; i < Math.min(3, counterBlocks.length); i++) {
    const cb = counterBlocks[i];
    for (let pos = 0; pos <= overhead - 16; pos++) {
      if (encrypted.subarray(pos, pos + 16).equals(cb)) {
        console.log(`Counter block ${i} found at prefix position ${pos}!`);
      }
    }
  }
  
  // Check if the keystream itself is in the prefix (would indicate XOR-only encryption)
  console.log('\n--- Checking if keystream is derived from prefix ---');
  for (let i = 0; i < Math.min(3, numBlocks); i++) {
    const ksBlock = keystream.subarray(i * 16, (i + 1) * 16);
    for (let pos = 0; pos <= overhead - 16; pos++) {
      if (encrypted.subarray(pos, pos + 16).equals(ksBlock)) {
        console.log(`Keystream block ${i} found at prefix position ${pos}!`);
      }
    }
  }
  
  // Try: Maybe the encryption is simpler - just XOR with a derived key
  console.log('\n=== Testing Simple XOR Encryption ===');
  
  // Test: XOR with SHA256(key)
  const keyHash = crypto.createHash('sha256').update(keyBuf).digest();
  console.log(`SHA256(key): ${keyHash.toString('hex')}`);
  
  // Test: XOR with repeated key hash
  let xorDecrypted = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    xorDecrypted[i] = encrypted[offset + i] ^ keyHash[i % 32];
  }
  console.log(`XOR with SHA256(key): ${xorDecrypted.subarray(0, 50).toString()}`);
  
  // Test: XOR with HMAC(key, prefix)
  const hmacKey = crypto.createHmac('sha256', keyBuf).update(encrypted.subarray(0, 32)).digest();
  xorDecrypted = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    xorDecrypted[i] = encrypted[offset + i] ^ hmacKey[i % 32];
  }
  console.log(`XOR with HMAC(key, prefix[0:32]): ${xorDecrypted.subarray(0, 50).toString()}`);
  
  // Test: Maybe the ciphertext starts at a different offset
  console.log('\n=== Testing Different Ciphertext Offsets ===');
  for (let testOffset = 0; testOffset <= 64; testOffset += 4) {
    if (testOffset + decrypted.length > encrypted.length) break;
    
    // Try standard AES-256-CTR with nonce from prefix
    const nonce = encrypted.subarray(testOffset, testOffset + 12);
    const ciphertext = encrypted.subarray(testOffset + 12, testOffset + 12 + decrypted.length);
    
    if (ciphertext.length < decrypted.length) continue;
    
    try {
      // Create IV: nonce (12 bytes) + counter (4 bytes, starting at 0)
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      iv.writeUInt32BE(0, 12);
      
      const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
      const testDecrypted = decipher.update(ciphertext.subarray(0, decrypted.length));
      
      // Check if it looks like JSON
      const str = testDecrypted.toString();
      if (str.startsWith('{') || str.startsWith('[')) {
        console.log(`Offset ${testOffset}: Looks like JSON! ${str.substring(0, 100)}`);
      }
    } catch (e) {
      // Ignore errors
    }
  }
}

traceWasmMemory().catch(console.error);
