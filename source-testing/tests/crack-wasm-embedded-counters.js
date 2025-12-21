/**
 * Crack WASM - Embedded Counter Blocks
 * 
 * New hypothesis: The 195-byte prefix contains the encrypted counter blocks!
 * 
 * Structure might be:
 * [nonce (16)] [encrypted_counter_blocks (13*16=208)] [HMAC (32)] = 256 bytes
 * But we only have 195 bytes...
 * 
 * Or maybe:
 * [nonce (12)] [encrypted_counter_blocks (151)] [HMAC (32)] = 195 bytes
 * 151 bytes = 9.4 blocks (not exact)
 * 
 * Let's try: maybe the counter blocks are XORed with something derived from the key
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function tryEmbeddedCounters() {
  console.log('=== Try Embedded Counter Blocks ===\n');
  
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
  
  console.log(`Overhead: ${overhead} bytes`);
  console.log(`Ciphertext: ${ciphertext.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes\n`);
  
  // Derive keystream and counter blocks
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  const counterBlocks = [];
  const numBlocks = Math.ceil(decrypted.length / 16);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, keystream.length);
    const keystreamBlock = keystream.slice(start, end);
    
    const padded = Buffer.alloc(16);
    keystreamBlock.copy(padded);
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(padded);
    counterBlocks.push(counterBlock);
  }
  
  console.log('Counter blocks:');
  for (let i = 0; i < counterBlocks.length; i++) {
    console.log(`  ${i}: ${counterBlocks[i].toString('hex')}`);
  }
  
  // Hypothesis: Counter blocks are in the prefix, encrypted with a different key
  console.log('\n=== Testing Embedded Counter Blocks ===\n');
  
  // Generate key stream for decrypting counter blocks
  const keyStreams = [
    { name: 'SHA256(key)', stream: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'HMAC(key, "counter")', stream: crypto.createHmac('sha256', keyBuf).update('counter').digest() },
    { name: 'HMAC(key, "nonce")', stream: crypto.createHmac('sha256', keyBuf).update('nonce').digest() },
    { name: 'key itself', stream: keyBuf },
  ];
  
  // Extend key streams to cover all counter blocks
  for (const ks of keyStreams) {
    // Extend to 208 bytes (13 blocks * 16 bytes)
    let extended = ks.stream;
    while (extended.length < 208) {
      const next = crypto.createHash('sha256').update(extended.slice(-32)).digest();
      extended = Buffer.concat([extended, next]);
    }
    ks.extended = extended.slice(0, 208);
  }
  
  // For each possible position in prefix, try to extract counter blocks
  for (let startPos = 0; startPos <= overhead - 16; startPos++) {
    for (const ks of keyStreams) {
      // XOR prefix[startPos:] with key stream to get counter blocks
      const extractedBlocks = [];
      let valid = true;
      
      for (let i = 0; i < numBlocks && valid; i++) {
        const prefixPos = startPos + i * 16;
        if (prefixPos + 16 > overhead) {
          valid = false;
          break;
        }
        
        const prefixBlock = prefix.slice(prefixPos, prefixPos + 16);
        const xored = Buffer.alloc(16);
        for (let j = 0; j < 16; j++) {
          xored[j] = prefixBlock[j] ^ ks.extended[i * 16 + j];
        }
        extractedBlocks.push(xored);
      }
      
      if (valid && extractedBlocks.length === numBlocks) {
        // Check if extracted blocks match counter blocks
        let allMatch = true;
        for (let i = 0; i < numBlocks; i++) {
          if (!extractedBlocks[i].equals(counterBlocks[i])) {
            allMatch = false;
            break;
          }
        }
        
        if (allMatch) {
          console.log(`*** FOUND! Counter blocks at prefix[${startPos}:], XOR with ${ks.name} ***`);
          return;
        }
      }
    }
  }
  
  console.log('XOR approach did not find embedded counter blocks.\n');
  
  // Try AES decryption of prefix to get counter blocks
  console.log('=== Testing AES Decryption of Prefix ===\n');
  
  const derivedKeys = [
    { name: 'key', key: keyBuf },
    { name: 'SHA256(key)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'HMAC(key, "aes")', key: crypto.createHmac('sha256', keyBuf).update('aes').digest() },
  ];
  
  for (const dk of derivedKeys) {
    for (let startPos = 0; startPos <= overhead - numBlocks * 16; startPos++) {
      // Try AES-ECB decryption
      const extractedBlocks = [];
      
      for (let i = 0; i < numBlocks; i++) {
        const prefixPos = startPos + i * 16;
        const prefixBlock = prefix.slice(prefixPos, prefixPos + 16);
        
        const decipher = crypto.createDecipheriv('aes-256-ecb', dk.key, null);
        decipher.setAutoPadding(false);
        const decrypted = decipher.update(prefixBlock);
        extractedBlocks.push(decrypted);
      }
      
      // Check if extracted blocks match counter blocks
      let allMatch = true;
      for (let i = 0; i < numBlocks; i++) {
        if (!extractedBlocks[i].equals(counterBlocks[i])) {
          allMatch = false;
          break;
        }
      }
      
      if (allMatch) {
        console.log(`*** FOUND! AES-ECB decrypt prefix[${startPos}:] with ${dk.name} ***`);
        return;
      }
    }
  }
  
  console.log('AES decryption approach did not find embedded counter blocks.\n');
  
  // Let's check if the keystream itself is embedded in the prefix
  console.log('=== Testing Embedded Keystream ===\n');
  
  for (let startPos = 0; startPos <= overhead - decrypted.length; startPos++) {
    const prefixSegment = prefix.slice(startPos, startPos + decrypted.length);
    
    // Check if prefix segment XOR something = keystream
    for (const dk of derivedKeys) {
      // Extend key to keystream length
      let extended = dk.key;
      while (extended.length < decrypted.length) {
        const next = crypto.createHash('sha256').update(extended.slice(-32)).digest();
        extended = Buffer.concat([extended, next]);
      }
      extended = extended.slice(0, decrypted.length);
      
      const xored = Buffer.alloc(decrypted.length);
      for (let i = 0; i < decrypted.length; i++) {
        xored[i] = prefixSegment[i] ^ extended[i];
      }
      
      if (xored.equals(keystream)) {
        console.log(`*** FOUND! Keystream = prefix[${startPos}:] XOR extended(${dk.name}) ***`);
        return;
      }
    }
  }
  
  console.log('Embedded keystream approach did not work.\n');
  
  // Final attempt: maybe the entire encrypted blob uses a different structure
  console.log('=== Testing Alternative Structures ===\n');
  
  // Maybe it's: [encrypted_data (395)] where encrypted_data = AES-CTR(key, nonce, plaintext || counter_blocks)
  // And the WASM extracts the counter blocks from the decrypted data
  
  // Or maybe: [nonce (16)] [AES-CTR encrypted (plaintext || padding)] [HMAC (32)]
  // 395 = 16 + X + 32 => X = 347 bytes of encrypted data
  // But plaintext is only 200 bytes...
  
  // Let's try: first 16 bytes as nonce, last 32 as HMAC, middle as ciphertext
  const possibleNonce = encrypted.slice(0, 16);
  const possibleHmac = encrypted.slice(-32);
  const possibleCiphertext = encrypted.slice(16, -32);
  
  console.log(`Possible nonce: ${possibleNonce.toString('hex')}`);
  console.log(`Possible HMAC: ${possibleHmac.toString('hex')}`);
  console.log(`Possible ciphertext: ${possibleCiphertext.length} bytes`);
  
  // Verify HMAC
  const hmacData = encrypted.slice(0, -32);
  const computedHmac = crypto.createHmac('sha256', keyBuf).update(hmacData).digest();
  console.log(`Computed HMAC: ${computedHmac.toString('hex')}`);
  console.log(`HMAC match: ${computedHmac.equals(possibleHmac)}`);
  
  // Try decryption with this structure
  try {
    const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, possibleNonce);
    const decryptedFull = decipher.update(possibleCiphertext);
    console.log(`Decrypted (first 100 bytes): ${decryptedFull.slice(0, 100).toString('utf8')}`);
  } catch (e) {
    console.log(`Decryption failed: ${e.message}`);
  }
}

tryEmbeddedCounters().catch(console.error);
