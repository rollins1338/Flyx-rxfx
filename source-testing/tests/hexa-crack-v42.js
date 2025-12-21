/**
 * Crack Hexa Encryption v42 - Correlation analysis between key and keystream
 * 
 * Try to find mathematical relationships between key, nonce, and keystream
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v42 - Correlation Analysis ===\n');
  
  // Collect multiple samples with different keys
  const samples = [];
  
  for (let i = 0; i < 5; i++) {
    const key = crypto.randomBytes(32).toString('hex');
    const keyBuf = Buffer.from(key, 'hex');
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/plain',
      'X-Api-Key': key,
    };
    
    const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
    const encResponse = await fetch(url, { headers });
    const encrypted = await encResponse.text();
    
    const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: encrypted, key }),
    });
    const decResult = await decResponse.json();
    const expectedStr = JSON.stringify(decResult.result);
    
    const encBytes = Buffer.from(encrypted, 'base64');
    const expectedBytes = Buffer.from(expectedStr, 'utf8');
    
    const nonce = encBytes.subarray(0, 12);
    const ciphertext = encBytes.subarray(12);
    
    const keystream = Buffer.alloc(ciphertext.length);
    for (let j = 0; j < ciphertext.length; j++) {
      keystream[j] = ciphertext[j] ^ expectedBytes[j];
    }
    
    samples.push({ key, keyBuf, nonce, keystream });
    console.log(`Sample ${i + 1}:`);
    console.log(`  Key: ${key}`);
    console.log(`  Nonce: ${nonce.toString('hex')}`);
    console.log(`  KS[0:16]: ${keystream.subarray(0, 16).toString('hex')}`);
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Analyze correlations
  console.log('\n=== Correlation Analysis ===\n');
  
  for (const sample of samples) {
    const { keyBuf, nonce, keystream } = sample;
    
    // Check if keystream[i] = f(key[i], nonce[i % 12])
    console.log('Checking byte-level correlations...');
    
    // XOR key with nonce (repeated)
    const keyXorNonce = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      keyXorNonce[i] = keyBuf[i] ^ nonce[i % 12];
    }
    console.log(`  Key XOR Nonce: ${keyXorNonce.subarray(0, 16).toString('hex')}`);
    console.log(`  Keystream[0:16]: ${keystream.subarray(0, 16).toString('hex')}`);
    
    // Check if any simple transformation matches
    const transforms = [
      { name: 'key+nonce', fn: (k, n, i) => (k + n) & 0xff },
      { name: 'key-nonce', fn: (k, n, i) => (k - n) & 0xff },
      { name: 'key*nonce', fn: (k, n, i) => (k * n) & 0xff },
      { name: 'key^nonce^i', fn: (k, n, i) => k ^ n ^ i },
      { name: 'rotl(key,nonce)', fn: (k, n, i) => ((k << (n & 7)) | (k >> (8 - (n & 7)))) & 0xff },
    ];
    
    for (const { name, fn } of transforms) {
      let matches = 0;
      for (let i = 0; i < 16; i++) {
        const expected = fn(keyBuf[i], nonce[i % 12], i);
        if (expected === keystream[i]) matches++;
      }
      if (matches > 4) {
        console.log(`  ${name}: ${matches}/16 matches`);
      }
    }
    
    console.log('');
  }
  
  // Test libsodium crypto_stream_xsalsa20
  console.log('\n=== Testing libsodium ===\n');
  
  try {
    const sodium = require('libsodium-wrappers');
    await sodium.ready;
    
    for (const sample of samples.slice(0, 2)) {
      const { keyBuf, nonce, keystream } = sample;
      
      // XSalsa20 needs 24-byte nonce
      const nonce24Variants = [
        { name: 'nonce||zeros', n: Buffer.concat([nonce, Buffer.alloc(12)]) },
        { name: 'zeros||nonce', n: Buffer.concat([Buffer.alloc(12), nonce]) },
        { name: 'nonce||nonce', n: Buffer.concat([nonce, nonce]) },
      ];
      
      const keyVariants = [
        { name: 'keyBuf', k: keyBuf },
        { name: 'sha256(keyBuf)', k: crypto.createHash('sha256').update(keyBuf).digest() },
      ];
      
      for (const { name: keyName, k } of keyVariants) {
        for (const { name: nonceName, n } of nonce24Variants) {
          try {
            // crypto_stream_xsalsa20 generates keystream
            const testKs = sodium.crypto_stream_xsalsa20(keystream.length, n, k);
            
            if (Buffer.from(testKs.subarray(0, 32)).equals(keystream.subarray(0, 32))) {
              console.log(`*** MATCH: XSalsa20 stream + ${keyName} + ${nonceName} ***`);
              return;
            }
          } catch (e) {}
        }
      }
      
      // Try crypto_stream_chacha20
      const nonce8Variants = [
        { name: 'nonce[:8]', n: nonce.subarray(0, 8) },
        { name: 'nonce[4:]', n: nonce.subarray(4, 12) },
      ];
      
      for (const { name: keyName, k } of keyVariants) {
        for (const { name: nonceName, n } of nonce8Variants) {
          try {
            const testKs = sodium.crypto_stream_chacha20(keystream.length, n, k);
            
            if (Buffer.from(testKs.subarray(0, 32)).equals(keystream.subarray(0, 32))) {
              console.log(`*** MATCH: ChaCha20 stream + ${keyName} + ${nonceName} ***`);
              return;
            }
          } catch (e) {}
        }
      }
      
      // Try crypto_stream_chacha20_ietf (12-byte nonce)
      for (const { name: keyName, k } of keyVariants) {
        try {
          const testKs = sodium.crypto_stream_chacha20_ietf(keystream.length, nonce, k);
          
          if (Buffer.from(testKs.subarray(0, 32)).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ChaCha20-IETF stream + ${keyName} ***`);
            return;
          }
        } catch (e) {}
      }
      
      // Try crypto_stream_xchacha20 (24-byte nonce)
      for (const { name: keyName, k } of keyVariants) {
        for (const { name: nonceName, n } of nonce24Variants) {
          try {
            const testKs = sodium.crypto_stream_xchacha20(keystream.length, n, k);
            
            if (Buffer.from(testKs.subarray(0, 32)).equals(keystream.subarray(0, 32))) {
              console.log(`*** MATCH: XChaCha20 stream + ${keyName} + ${nonceName} ***`);
              return;
            }
          } catch (e) {}
        }
      }
    }
    
    console.log('libsodium: No match');
  } catch (e) {
    console.log('libsodium error:', e.message);
  }
  
  // Test with key as the hex string directly (not decoded)
  console.log('\n=== Testing with Hex String Key ===\n');
  
  for (const sample of samples.slice(0, 2)) {
    const { key, nonce, keystream } = sample;
    
    // The key is 64 hex characters = 64 bytes as UTF-8
    const keyUtf8 = Buffer.from(key, 'utf8');
    
    // SHA256 of the hex string
    const keyHash = crypto.createHash('sha256').update(key).digest();
    
    // Try with first 32 bytes of UTF-8 key
    const keyFirst32 = keyUtf8.subarray(0, 32);
    
    const keyVariants = [
      { name: 'sha256(hexStr)', k: keyHash },
      { name: 'hexStr[:32]', k: keyFirst32 },
    ];
    
    const ivVariants = [
      { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
    ];
    
    for (const { name: keyName, k } of keyVariants) {
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', k, iv);
          const testKs = cipher.update(Buffer.alloc(keystream.length));
          
          if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: AES-CTR + ${keyName} + ${ivName} ***`);
            return;
          }
        } catch (e) {}
      }
    }
  }
  console.log('Hex string key: No match');
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
