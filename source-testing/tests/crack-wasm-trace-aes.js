/**
 * Crack WASM - Trace AES Operations
 * 
 * Key insight: The WASM uses AES-256-CTR. Let's trace:
 * 1. What key is actually used for AES (might be derived from input key)
 * 2. What IV/nonce is used
 * 3. The exact structure of the encrypted data
 * 
 * We know:
 * - Encrypted: 395 bytes
 * - Decrypted: 200 bytes
 * - Overhead: 195 bytes
 * 
 * Let's try to find the AES key by testing if it's derived from the input key.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function traceAesOperations() {
  console.log('=== Trace AES Operations ===\n');
  
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
  
  // Use a simple key for easier analysis
  const testKey = 'a'.repeat(64); // 32 bytes of 0xaa when hex decoded
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
  console.log(`Decrypted text: ${result.decrypted}\n`);
  
  // Derive the keystream
  const overhead = encrypted.length - decrypted.length;
  const ciphertext = encrypted.slice(overhead);
  
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  console.log('=== Keystream Analysis ===\n');
  console.log(`First 64 bytes of keystream: ${keystream.slice(0, 64).toString('hex')}`);
  
  // Derive counter blocks from keystream
  const counterBlocks = [];
  const numBlocks = Math.ceil(decrypted.length / 16);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, keystream.length);
    const keystreamBlock = keystream.slice(start, end);
    
    const padded = Buffer.alloc(16);
    keystreamBlock.copy(padded);
    
    // Keystream = AES_ECB(key, counter_block)
    // So: counter_block = AES_ECB_DECRYPT(key, keystream)
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(padded);
    counterBlocks.push(counterBlock);
  }
  
  console.log('\nCounter blocks:');
  for (let i = 0; i < counterBlocks.length; i++) {
    console.log(`  Block ${i}: ${counterBlocks[i].toString('hex')}`);
  }
  
  // Now let's try different key derivations
  console.log('\n=== Testing Key Derivations ===\n');
  
  const prefix = encrypted.slice(0, overhead);
  
  // List of possible derived keys
  const derivedKeys = [
    { name: 'Original key', key: keyBuf },
    { name: 'SHA256(key)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'SHA256(hex_key)', key: crypto.createHash('sha256').update(testKey).digest() },
    { name: 'HMAC(key, "aes")', key: crypto.createHmac('sha256', keyBuf).update('aes').digest() },
    { name: 'HMAC(key, "key")', key: crypto.createHmac('sha256', keyBuf).update('key').digest() },
    { name: 'HMAC(key, prefix[0:16])', key: crypto.createHmac('sha256', keyBuf).update(prefix.slice(0, 16)).digest() },
    { name: 'HMAC(key, prefix[0:32])', key: crypto.createHmac('sha256', keyBuf).update(prefix.slice(0, 32)).digest() },
    { name: 'SHA256(key + prefix[0:16])', key: crypto.createHash('sha256').update(Buffer.concat([keyBuf, prefix.slice(0, 16)])).digest() },
    { name: 'SHA256(prefix[0:16] + key)', key: crypto.createHash('sha256').update(Buffer.concat([prefix.slice(0, 16), keyBuf])).digest() },
    { name: 'XOR(key, prefix[0:32])', key: Buffer.from(keyBuf.map((b, i) => b ^ prefix[i])) },
  ];
  
  for (const { name, key } of derivedKeys) {
    // For each derived key, try to find a nonce that produces the correct keystream
    for (let noncePos = 0; noncePos <= overhead - 16; noncePos++) {
      const nonce = prefix.slice(noncePos, noncePos + 16);
      
      try {
        // Try AES-256-CTR with this key and nonce
        const cipher = crypto.createCipheriv('aes-256-ctr', key, nonce);
        const zeros = Buffer.alloc(16);
        const expectedKeystream = cipher.update(zeros);
        
        if (expectedKeystream.equals(keystream.slice(0, 16))) {
          console.log(`*** FOUND! ${name} with nonce at position ${noncePos} ***`);
          console.log(`  Derived key: ${key.toString('hex')}`);
          console.log(`  Nonce: ${nonce.toString('hex')}`);
          
          // Verify full decryption
          const decipher = crypto.createDecipheriv('aes-256-ctr', key, nonce);
          const testDecrypted = decipher.update(ciphertext);
          console.log(`  Full decryption matches: ${testDecrypted.toString() === result.decrypted}`);
          return;
        }
      } catch (e) {
        // Invalid key length, skip
      }
    }
    
    // Also try with 12-byte nonce + 4-byte counter
    for (let noncePos = 0; noncePos <= overhead - 12; noncePos++) {
      const nonce12 = prefix.slice(noncePos, noncePos + 12);
      const iv = Buffer.alloc(16);
      nonce12.copy(iv, 0);
      
      for (let startCounter = 0; startCounter <= 2; startCounter++) {
        iv.writeUInt32BE(startCounter, 12);
        
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
          const zeros = Buffer.alloc(16);
          const expectedKeystream = cipher.update(zeros);
          
          if (expectedKeystream.equals(keystream.slice(0, 16))) {
            console.log(`*** FOUND! ${name} with 12-byte nonce at position ${noncePos}, counter=${startCounter} ***`);
            console.log(`  Derived key: ${key.toString('hex')}`);
            console.log(`  Nonce: ${nonce12.toString('hex')}`);
            return;
          }
        } catch (e) {
          // Invalid key length, skip
        }
      }
    }
  }
  
  console.log('No matching key derivation found.\n');
  
  // Let's check if the counter blocks themselves reveal any pattern
  console.log('=== Counter Block Pattern Analysis ===\n');
  
  // Check if counter blocks are in the prefix
  for (let i = 0; i < counterBlocks.length; i++) {
    const cb = counterBlocks[i];
    for (let pos = 0; pos <= prefix.length - 16; pos++) {
      if (prefix.slice(pos, pos + 16).equals(cb)) {
        console.log(`Counter block ${i} found at prefix position ${pos}`);
      }
    }
  }
  
  // Check if counter blocks are derived from prefix
  for (let i = 0; i < Math.min(counterBlocks.length, 3); i++) {
    const cb = counterBlocks[i];
    
    // Try XOR with various prefix segments
    for (let pos = 0; pos <= overhead - 16; pos++) {
      const segment = prefix.slice(pos, pos + 16);
      const xored = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) {
        xored[j] = cb[j] ^ segment[j];
      }
      
      // Check if XOR result is simple (e.g., all zeros, incrementing, etc.)
      const isAllZeros = xored.every(b => b === 0);
      const isAllSame = xored.every(b => b === xored[0]);
      
      if (isAllZeros) {
        console.log(`Counter block ${i} = prefix[${pos}:${pos+16}]`);
      } else if (isAllSame) {
        console.log(`Counter block ${i} XOR prefix[${pos}:${pos+16}] = all ${xored[0].toString(16)}`);
      }
    }
  }
  
  // Check if there's a relationship between consecutive counter blocks
  console.log('\nRelationship between counter blocks:');
  for (let i = 0; i < counterBlocks.length - 1; i++) {
    const diff = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      diff[j] = counterBlocks[i + 1][j] - counterBlocks[i][j];
    }
    console.log(`  Block ${i+1} - Block ${i}: ${diff.toString('hex')}`);
  }
}

traceAesOperations().catch(console.error);
