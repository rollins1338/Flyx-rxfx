/**
 * Find Embedded Nonce in Encrypted Response
 * 
 * The encrypted response is 141 bytes longer than the decrypted data.
 * This extra data must contain the nonce/IV for decryption.
 * 
 * Possible structures:
 * 1. [16-byte nonce][ciphertext] - nonce at start
 * 2. [ciphertext][16-byte nonce] - nonce at end
 * 3. [nonce][ciphertext][mac] - authenticated encryption
 * 4. Some other encoding
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function findEmbeddedNonce() {
  console.log('=== Finding Embedded Nonce ===\n');
  
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
      decrypted: JSON.stringify(decrypted),
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Encrypted length: ${encrypted.length} bytes`);
  console.log(`Decrypted length: ${decrypted.length} bytes`);
  console.log(`Extra bytes: ${encrypted.length - decrypted.length}`);
  
  // The decrypted text starts with {"sources"
  const expectedStart = '{"sources"';
  console.log(`\nExpected plaintext start: "${expectedStart}"`);
  console.log(`Actual decrypted start: "${result.decrypted.substring(0, 20)}"`);
  
  // Try different offsets for the ciphertext
  console.log('\n=== Testing Different Ciphertext Offsets ===\n');
  
  for (let offset = 0; offset <= 32; offset++) {
    const ciphertext = encrypted.subarray(offset);
    
    // XOR with expected plaintext to get keystream
    const expectedBuf = Buffer.from(expectedStart);
    const keystream = Buffer.alloc(expectedBuf.length);
    for (let i = 0; i < expectedBuf.length; i++) {
      keystream[i] = ciphertext[i] ^ expectedBuf[i];
    }
    
    // Check if this produces valid AES keystream
    // (i.e., if we can derive a valid counter block)
    if (keystream.length >= 16) {
      const keystreamBlock = Buffer.alloc(16);
      for (let i = 0; i < 16; i++) {
        keystreamBlock[i] = ciphertext[i] ^ Buffer.from(expectedStart.padEnd(16, '\x00'))[i];
      }
      
      try {
        const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
        decipher.setAutoPadding(false);
        const counterBlock = decipher.update(keystreamBlock);
        
        // Check if the counter block looks like a valid nonce
        // (should be in the prefix of the encrypted data)
        const prefix = encrypted.subarray(0, offset);
        
        if (offset === 16 && prefix.equals(counterBlock)) {
          console.log(`*** FOUND: Offset ${offset} - Nonce is first 16 bytes! ***`);
          console.log(`  Nonce: ${counterBlock.toString('hex')}`);
        }
        
        // Also check if it's derived from the prefix
        if (offset > 0) {
          const prefixHash = crypto.createHash('sha256').update(prefix).digest().subarray(0, 16);
          if (prefixHash.equals(counterBlock)) {
            console.log(`*** FOUND: Offset ${offset} - Nonce is SHA256(prefix)[0:16]! ***`);
          }
        }
      } catch (e) {}
    }
  }
  
  // Let's try a different approach: find where the actual ciphertext starts
  console.log('\n=== Finding Ciphertext Start by Brute Force ===\n');
  
  // We know the decrypted text, so we can find where it aligns
  const decryptedBuf = Buffer.from(result.decrypted);
  
  for (let offset = 0; offset <= encrypted.length - decryptedBuf.length; offset++) {
    // Try decrypting from this offset with standard AES-CTR
    // using the bytes before the offset as the nonce
    
    if (offset >= 16) {
      const nonce = encrypted.subarray(offset - 16, offset);
      const ciphertext = encrypted.subarray(offset, offset + decryptedBuf.length);
      
      try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, nonce);
        const testDecrypted = decipher.update(ciphertext);
        
        if (testDecrypted.subarray(0, 10).equals(decryptedBuf.subarray(0, 10))) {
          console.log(`*** FOUND: Ciphertext starts at offset ${offset} ***`);
          console.log(`  Nonce (16 bytes before): ${nonce.toString('hex')}`);
          console.log(`  Decrypted: ${testDecrypted.toString('utf8').substring(0, 50)}...`);
        }
      } catch (e) {}
    }
  }
  
  // Try with the actual counter block we derived
  console.log('\n=== Deriving Counter Block from Known Plaintext ===\n');
  
  // Find where the plaintext aligns with the ciphertext
  for (let offset = 0; offset <= encrypted.length - decryptedBuf.length; offset++) {
    const ciphertext = encrypted.subarray(offset);
    
    // XOR to get keystream
    const keystream = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      keystream[i] = ciphertext[i] ^ decryptedBuf[i];
    }
    
    // Derive counter block
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(keystream);
    
    // Check if counter block appears in the prefix
    const prefix = encrypted.subarray(0, offset);
    const counterHex = counterBlock.toString('hex');
    const prefixHex = prefix.toString('hex');
    
    if (prefixHex.includes(counterHex)) {
      console.log(`*** FOUND: Counter block at offset ${offset} appears in prefix! ***`);
      console.log(`  Counter: ${counterHex}`);
      console.log(`  Position in prefix: ${prefixHex.indexOf(counterHex) / 2}`);
    }
    
    // Check if counter block is derived from prefix
    if (offset >= 16) {
      // Try various derivations
      const prefixPart = prefix.subarray(0, 16);
      
      // XOR with key
      const xorKey = Buffer.alloc(16);
      for (let i = 0; i < 16; i++) {
        xorKey[i] = prefixPart[i] ^ keyBuf[i];
      }
      if (xorKey.equals(counterBlock)) {
        console.log(`*** FOUND: Counter = prefix[0:16] XOR key[0:16] at offset ${offset}! ***`);
      }
      
      // AES encrypt prefix
      const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
      cipher.setAutoPadding(false);
      const encPrefix = cipher.update(prefixPart);
      if (encPrefix.equals(counterBlock)) {
        console.log(`*** FOUND: Counter = AES(key, prefix[0:16]) at offset ${offset}! ***`);
      }
    }
  }
  
  // Print the full structure
  console.log('\n=== Full Encrypted Data Structure ===\n');
  console.log('First 64 bytes (hex):');
  for (let i = 0; i < 64 && i < encrypted.length; i += 16) {
    console.log(`  ${i.toString().padStart(3)}: ${encrypted.subarray(i, i + 16).toString('hex')}`);
  }
  
  console.log('\nLast 64 bytes (hex):');
  const start = Math.max(0, encrypted.length - 64);
  for (let i = start; i < encrypted.length; i += 16) {
    console.log(`  ${i.toString().padStart(3)}: ${encrypted.subarray(i, Math.min(i + 16, encrypted.length)).toString('hex')}`);
  }
}

findEmbeddedNonce().catch(console.error);
