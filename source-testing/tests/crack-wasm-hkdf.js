/**
 * Crack WASM - Try HKDF and other KDFs
 * 
 * The WASM might be using a Key Derivation Function to derive:
 * 1. The AES key from the API key
 * 2. The nonce/IV from the prefix
 * 3. Counter blocks from a seed
 * 
 * Let's try various KDF approaches.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

// HKDF implementation
function hkdf(ikm, salt, info, length) {
  // Extract
  const prk = crypto.createHmac('sha256', salt || Buffer.alloc(32)).update(ikm).digest();
  
  // Expand
  const n = Math.ceil(length / 32);
  let okm = Buffer.alloc(0);
  let t = Buffer.alloc(0);
  
  for (let i = 1; i <= n; i++) {
    t = crypto.createHmac('sha256', prk)
      .update(Buffer.concat([t, info, Buffer.from([i])]))
      .digest();
    okm = Buffer.concat([okm, t]);
  }
  
  return okm.slice(0, length);
}

async function tryHkdf() {
  console.log('=== Try HKDF and KDFs ===\n');
  
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
  
  const overhead = encrypted.length - decrypted.length;
  const prefix = encrypted.slice(0, overhead);
  const ciphertext = encrypted.slice(overhead);
  
  // Derive keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  // Derive first counter block
  const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
  decipher.setAutoPadding(false);
  const counterBlock0 = decipher.update(keystream.slice(0, 16));
  
  console.log(`Counter block 0: ${counterBlock0.toString('hex')}`);
  console.log(`Keystream[0:16]: ${keystream.slice(0, 16).toString('hex')}\n`);
  
  // Try various HKDF combinations
  console.log('=== Testing HKDF ===\n');
  
  const infos = [
    Buffer.from('aes'),
    Buffer.from('ctr'),
    Buffer.from('nonce'),
    Buffer.from('counter'),
    Buffer.from(''),
    Buffer.from('flixer'),
    Buffer.from('img_data'),
  ];
  
  for (const info of infos) {
    // Try HKDF with key as IKM and prefix segments as salt
    for (let saltStart = 0; saltStart <= overhead - 16; saltStart += 16) {
      const salt = prefix.slice(saltStart, saltStart + 16);
      
      // Derive 16 bytes for nonce
      const derivedNonce = hkdf(keyBuf, salt, info, 16);
      
      // Try as IV for AES-CTR
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', keyBuf, derivedNonce);
        const zeros = Buffer.alloc(16);
        const expectedKeystream = cipher.update(zeros);
        
        if (expectedKeystream.equals(keystream.slice(0, 16))) {
          console.log(`*** FOUND! HKDF(key, prefix[${saltStart}:${saltStart+16}], "${info.toString()}") ***`);
          console.log(`  Derived nonce: ${derivedNonce.toString('hex')}`);
          return;
        }
      } catch (e) {}
      
      // Also try deriving the key
      const derivedKey = hkdf(keyBuf, salt, info, 32);
      
      for (let noncePos = 0; noncePos <= overhead - 16; noncePos += 4) {
        const nonce = prefix.slice(noncePos, noncePos + 16);
        
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, nonce);
          const zeros = Buffer.alloc(16);
          const expectedKeystream = cipher.update(zeros);
          
          if (expectedKeystream.equals(keystream.slice(0, 16))) {
            console.log(`*** FOUND! Derived key from HKDF, nonce at ${noncePos} ***`);
            console.log(`  Salt: prefix[${saltStart}:${saltStart+16}]`);
            console.log(`  Info: "${info.toString()}"`);
            console.log(`  Derived key: ${derivedKey.toString('hex')}`);
            return;
          }
        } catch (e) {}
      }
    }
  }
  
  console.log('HKDF approach did not find a match.\n');
  
  // Try PBKDF2
  console.log('=== Testing PBKDF2 ===\n');
  
  for (let saltStart = 0; saltStart <= overhead - 16; saltStart += 16) {
    const salt = prefix.slice(saltStart, saltStart + 16);
    
    for (const iterations of [1, 10, 100, 1000]) {
      const derivedKey = crypto.pbkdf2Sync(keyBuf, salt, iterations, 32, 'sha256');
      
      for (let noncePos = 0; noncePos <= overhead - 16; noncePos += 4) {
        const nonce = prefix.slice(noncePos, noncePos + 16);
        
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, nonce);
          const zeros = Buffer.alloc(16);
          const expectedKeystream = cipher.update(zeros);
          
          if (expectedKeystream.equals(keystream.slice(0, 16))) {
            console.log(`*** FOUND! PBKDF2 with ${iterations} iterations ***`);
            console.log(`  Salt: prefix[${saltStart}:${saltStart+16}]`);
            console.log(`  Nonce: prefix[${noncePos}:${noncePos+16}]`);
            return;
          }
        } catch (e) {}
      }
    }
  }
  
  console.log('PBKDF2 approach did not find a match.\n');
  
  // Try simple hash chains
  console.log('=== Testing Hash Chains ===\n');
  
  // Maybe counter blocks are generated by: H(H(H(seed)))
  // where seed = key || prefix[0:N]
  
  for (let seedLen = 16; seedLen <= 64; seedLen += 16) {
    const seed = Buffer.concat([keyBuf, prefix.slice(0, seedLen)]);
    
    let state = crypto.createHash('sha256').update(seed).digest();
    
    // Generate counter blocks
    const generatedBlocks = [];
    for (let i = 0; i < 5; i++) {
      generatedBlocks.push(state.slice(0, 16));
      state = crypto.createHash('sha256').update(state).digest();
    }
    
    // Check if first generated block matches
    if (generatedBlocks[0].equals(counterBlock0)) {
      console.log(`*** FOUND! Hash chain with seed = key || prefix[0:${seedLen}] ***`);
      return;
    }
  }
  
  // Try HMAC chain
  for (let seedLen = 16; seedLen <= 64; seedLen += 16) {
    const seed = prefix.slice(0, seedLen);
    
    let state = crypto.createHmac('sha256', keyBuf).update(seed).digest();
    
    // Generate counter blocks
    const generatedBlocks = [];
    for (let i = 0; i < 5; i++) {
      generatedBlocks.push(state.slice(0, 16));
      state = crypto.createHmac('sha256', keyBuf).update(state).digest();
    }
    
    // Check if first generated block matches
    if (generatedBlocks[0].equals(counterBlock0)) {
      console.log(`*** FOUND! HMAC chain with seed = prefix[0:${seedLen}] ***`);
      return;
    }
  }
  
  console.log('Hash chain approach did not find a match.\n');
  
  // Try AES-based PRNG
  console.log('=== Testing AES-based PRNG ===\n');
  
  // AES-CTR DRBG style: state = AES(key, state)
  for (let seedPos = 0; seedPos <= overhead - 16; seedPos += 4) {
    let state = prefix.slice(seedPos, seedPos + 16);
    
    // Generate counter blocks
    const generatedBlocks = [];
    for (let i = 0; i < 5; i++) {
      const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
      cipher.setAutoPadding(false);
      state = cipher.update(state);
      generatedBlocks.push(state);
    }
    
    // Check if first generated block matches
    if (generatedBlocks[0].equals(counterBlock0)) {
      console.log(`*** FOUND! AES PRNG with seed = prefix[${seedPos}:${seedPos+16}] ***`);
      return;
    }
  }
  
  console.log('AES PRNG approach did not find a match.\n');
  
  // Print counter blocks for manual analysis
  console.log('=== Counter Blocks for Manual Analysis ===\n');
  
  const numBlocks = Math.ceil(decrypted.length / 16);
  for (let block = 0; block < Math.min(numBlocks, 5); block++) {
    const start = block * 16;
    const end = Math.min(start + 16, keystream.length);
    const keystreamBlock = keystream.slice(start, end);
    
    const padded = Buffer.alloc(16);
    keystreamBlock.copy(padded);
    
    const dec = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    dec.setAutoPadding(false);
    const cb = dec.update(padded);
    
    console.log(`Block ${block}: ${cb.toString('hex')}`);
  }
}

tryHkdf().catch(console.error);
