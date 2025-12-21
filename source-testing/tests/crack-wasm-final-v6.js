/**
 * Crack WASM - Final V6
 * 
 * Key insight from WAT analysis:
 * 1. The WASM uses AES-256-CTR (confirmed by ctr-0.9.2 and aes-0.8.4 crates)
 * 2. Function 133 generates counter blocks with structure: [nonce 12][counter 4]
 * 3. The counter increments for each block
 * 4. The nonce must come from somewhere in the encrypted response
 * 
 * The 195-byte overhead likely contains:
 * - HMAC tag (32 bytes) for authentication
 * - Nonce (12 bytes) for CTR mode
 * - Something else (151 bytes) - possibly encrypted metadata or padding
 * 
 * Let's try to find the nonce by testing different positions.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function crackWasm() {
  console.log('=== Crack WASM Final V6 ===\n');
  
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
  
  // Use a known key
  const testKey = crypto.randomBytes(32).toString('hex');
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
  console.log(`Overhead: ${encrypted.length - decrypted.length} bytes`);
  console.log(`\nDecrypted: ${result.decrypted}\n`);
  
  const overhead = encrypted.length - decrypted.length;
  
  // Derive the keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = encrypted[overhead + i] ^ decrypted[i];
  }
  
  console.log('=== Brute Force Nonce Search ===\n');
  
  // Try every possible 12-byte nonce position in the prefix
  for (let noncePos = 0; noncePos <= overhead - 12; noncePos++) {
    const nonce = encrypted.subarray(noncePos, noncePos + 12);
    
    // Create IV: nonce (12 bytes) + counter starting at 0 (4 bytes, big-endian)
    const iv = Buffer.alloc(16);
    nonce.copy(iv, 0);
    iv.writeUInt32BE(0, 12);
    
    // Generate expected keystream with AES-256-CTR
    const cipher = crypto.createCipheriv('aes-256-ctr', keyBuf, iv);
    const zeros = Buffer.alloc(decrypted.length);
    const expectedKeystream = cipher.update(zeros);
    
    // Check if it matches
    if (expectedKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
      console.log(`*** FOUND! Nonce at position ${noncePos} ***`);
      console.log(`Nonce: ${nonce.toString('hex')}`);
      
      // Verify full decryption
      const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
      const testDecrypted = decipher.update(encrypted.subarray(overhead));
      console.log(`Decrypted: ${testDecrypted.toString()}`);
      return;
    }
    
    // Also try with counter starting at 1
    iv.writeUInt32BE(1, 12);
    const cipher2 = crypto.createCipheriv('aes-256-ctr', keyBuf, iv);
    const expectedKeystream2 = cipher2.update(zeros);
    
    if (expectedKeystream2.subarray(0, 16).equals(keystream.subarray(0, 16))) {
      console.log(`*** FOUND! Nonce at position ${noncePos} (counter starts at 1) ***`);
      console.log(`Nonce: ${nonce.toString('hex')}`);
      return;
    }
  }
  
  console.log('Nonce not found in prefix with standard positions.\n');
  
  // Try derived nonces
  console.log('=== Testing Derived Nonces ===\n');
  
  // Test various derivation methods
  const derivations = [
    { name: 'SHA256(key)[0:12]', nonce: crypto.createHash('sha256').update(keyBuf).digest().subarray(0, 12) },
    { name: 'SHA256(key)[16:28]', nonce: crypto.createHash('sha256').update(keyBuf).digest().subarray(16, 28) },
    { name: 'SHA256(prefix[0:32])[0:12]', nonce: crypto.createHash('sha256').update(encrypted.subarray(0, 32)).digest().subarray(0, 12) },
    { name: 'HMAC(key, prefix[0:32])[0:12]', nonce: crypto.createHmac('sha256', keyBuf).update(encrypted.subarray(0, 32)).digest().subarray(0, 12) },
    { name: 'HMAC(key, prefix[32:64])[0:12]', nonce: crypto.createHmac('sha256', keyBuf).update(encrypted.subarray(32, 64)).digest().subarray(0, 12) },
    { name: 'SHA256(key + prefix[0:32])[0:12]', nonce: crypto.createHash('sha256').update(Buffer.concat([keyBuf, encrypted.subarray(0, 32)])).digest().subarray(0, 12) },
    { name: 'SHA256(prefix[0:32] + key)[0:12]', nonce: crypto.createHash('sha256').update(Buffer.concat([encrypted.subarray(0, 32), keyBuf])).digest().subarray(0, 12) },
  ];
  
  for (const { name, nonce } of derivations) {
    const iv = Buffer.alloc(16);
    nonce.copy(iv, 0);
    
    for (let startCounter = 0; startCounter <= 2; startCounter++) {
      iv.writeUInt32BE(startCounter, 12);
      
      const cipher = crypto.createCipheriv('aes-256-ctr', keyBuf, iv);
      const zeros = Buffer.alloc(16);
      const expectedKeystream = cipher.update(zeros);
      
      if (expectedKeystream.equals(keystream.subarray(0, 16))) {
        console.log(`*** FOUND! ${name} with counter=${startCounter} ***`);
        console.log(`Nonce: ${nonce.toString('hex')}`);
        return;
      }
    }
  }
  
  console.log('Derived nonces did not match.\n');
  
  // Try: Maybe the key is transformed before use
  console.log('=== Testing Transformed Keys ===\n');
  
  const keyTransforms = [
    { name: 'SHA256(key)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'SHA256(hex_key)', key: crypto.createHash('sha256').update(testKey).digest() },
    { name: 'HMAC(key, "aes")', key: crypto.createHmac('sha256', keyBuf).update('aes').digest() },
    { name: 'HMAC(key, prefix[0:12])', key: crypto.createHmac('sha256', keyBuf).update(encrypted.subarray(0, 12)).digest() },
  ];
  
  for (const { name, key } of keyTransforms) {
    // Try with nonce from various prefix positions
    for (let noncePos = 0; noncePos <= 64; noncePos += 4) {
      const nonce = encrypted.subarray(noncePos, noncePos + 12);
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      iv.writeUInt32BE(0, 12);
      
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        const zeros = Buffer.alloc(16);
        const expectedKeystream = cipher.update(zeros);
        
        if (expectedKeystream.equals(keystream.subarray(0, 16))) {
          console.log(`*** FOUND! ${name} with nonce at ${noncePos} ***`);
          console.log(`Transformed key: ${key.toString('hex')}`);
          console.log(`Nonce: ${nonce.toString('hex')}`);
          return;
        }
      } catch (e) {
        // Invalid key length, skip
      }
    }
  }
  
  console.log('Transformed keys did not match.\n');
  
  // Print the actual keystream for manual analysis
  console.log('=== Keystream Analysis ===\n');
  console.log(`First 64 bytes of keystream: ${keystream.subarray(0, 64).toString('hex')}`);
  console.log(`First 64 bytes of prefix: ${encrypted.subarray(0, 64).toString('hex')}`);
  
  // Derive counter blocks
  const counterBlocks = [];
  const numBlocks = Math.ceil(decrypted.length / 16);
  
  for (let block = 0; block < Math.min(numBlocks, 5); block++) {
    const start = block * 16;
    const end = Math.min(start + 16, keystream.length);
    const keystreamBlock = keystream.subarray(start, end);
    
    const padded = Buffer.alloc(16);
    keystreamBlock.copy(padded);
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(padded);
    counterBlocks.push(counterBlock);
    
    console.log(`Counter block ${block}: ${counterBlock.toString('hex')}`);
  }
  
  // Check if counter blocks have any pattern
  console.log('\n=== Counter Block Pattern Analysis ===');
  
  // Check if first 12 bytes are the same (standard CTR)
  const first12 = counterBlocks[0].subarray(0, 12);
  let allSameNonce = true;
  for (let i = 1; i < counterBlocks.length; i++) {
    if (!counterBlocks[i].subarray(0, 12).equals(first12)) {
      allSameNonce = false;
      break;
    }
  }
  console.log(`All blocks have same nonce (first 12 bytes): ${allSameNonce}`);
  
  if (allSameNonce) {
    console.log(`Nonce: ${first12.toString('hex')}`);
    console.log('Counter values:');
    for (let i = 0; i < counterBlocks.length; i++) {
      const counter = counterBlocks[i].readUInt32BE(12);
      console.log(`  Block ${i}: ${counter}`);
    }
  } else {
    // Check if there's any XOR relationship between blocks
    console.log('\nXOR between consecutive blocks:');
    for (let i = 0; i < counterBlocks.length - 1; i++) {
      const xored = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) {
        xored[j] = counterBlocks[i][j] ^ counterBlocks[i + 1][j];
      }
      console.log(`  Block ${i} XOR Block ${i+1}: ${xored.toString('hex')}`);
    }
  }
}

crackWasm().catch(console.error);
