/**
 * Crack Hexa Encryption v16 - Try Web Crypto patterns and more
 */

const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');

async function crackHexa() {
  await _sodium.ready;
  const sodium = _sodium;
  
  console.log('=== Cracking Hexa Encryption v16 ===\n');
  
  // Use a simple key for easier debugging
  const key = 'a'.repeat(64);
  console.log('Key:', key);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  // Verify with enc-dec.app
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  const decResult = await decResponse.json();
  const expectedStr = JSON.stringify(decResult.result);
  
  const encBytes = Buffer.from(encrypted, 'base64');
  const expectedBytes = Buffer.from(expectedStr, 'utf8');
  
  console.log('Encrypted bytes:', encBytes.length);
  console.log('Expected bytes:', expectedBytes.length);
  console.log('Overhead:', encBytes.length - expectedBytes.length);
  
  const nonce = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  console.log('Nonce:', nonce.toString('hex'));
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Keystream[0:64]:', keystream.subarray(0, 64).toString('hex'));
  
  // The key is 'aaaa...' (64 chars)
  // As hex bytes: 0xaa repeated 32 times
  // As UTF-8: 0x61 repeated 64 times
  
  const keyHex = Buffer.from(key, 'hex'); // 32 bytes of 0xaa
  const keyUtf8 = Buffer.from(key, 'utf8'); // 64 bytes of 0x61
  const keyFirst32 = keyUtf8.subarray(0, 32); // 32 bytes of 0x61
  
  console.log('\n=== Key representations ===');
  console.log('Key as hex-decoded:', keyHex.toString('hex'));
  console.log('Key as UTF-8 first 32:', keyFirst32.toString('hex'));
  
  // Try ChaCha20 with different key representations
  console.log('\n=== ChaCha20-IETF tests ===');
  
  const keyVariants = [
    { name: 'hex-decoded (0xaa...)', key: keyHex },
    { name: 'utf8-first32 (0x61...)', key: keyFirst32 },
    { name: 'sha256(hex-decoded)', key: crypto.createHash('sha256').update(keyHex).digest() },
    { name: 'sha256(utf8)', key: crypto.createHash('sha256').update(keyUtf8).digest() },
    { name: 'sha256(key-string)', key: crypto.createHash('sha256').update(key).digest() },
  ];
  
  for (const { name, key: keyBuf } of keyVariants) {
    try {
      const testKeystream = Buffer.from(sodium.crypto_stream_chacha20_ietf(
        ciphertext.length,
        new Uint8Array(nonce),
        new Uint8Array(keyBuf)
      ));
      
      const matches = testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32));
      console.log(`${name}: ${matches ? 'MATCH!' : 'no match'}`);
      
      if (matches) {
        // Decrypt
        const decrypted = Buffer.alloc(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i++) {
          decrypted[i] = ciphertext[i] ^ testKeystream[i];
        }
        console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
        return;
      }
    } catch (e) {
      console.log(`${name}: error - ${e.message}`);
    }
  }
  
  // Try XChaCha20 with 24-byte nonce (pad our 12-byte nonce)
  console.log('\n=== XChaCha20 tests ===');
  
  for (const { name, key: keyBuf } of keyVariants) {
    // Pad nonce to 24 bytes
    const nonce24 = Buffer.alloc(24);
    nonce.copy(nonce24, 0);
    
    try {
      const testKeystream = Buffer.from(sodium.crypto_stream_xchacha20(
        ciphertext.length,
        new Uint8Array(nonce24),
        new Uint8Array(keyBuf)
      ));
      
      const matches = testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32));
      console.log(`${name}: ${matches ? 'MATCH!' : 'no match'}`);
      
      if (matches) {
        const decrypted = Buffer.alloc(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i++) {
          decrypted[i] = ciphertext[i] ^ testKeystream[i];
        }
        console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
        return;
      }
    } catch (e) {
      console.log(`${name}: error - ${e.message}`);
    }
  }
  
  // Try AES-CTR
  console.log('\n=== AES-256-CTR tests ===');
  
  for (const { name, key: keyBuf } of keyVariants) {
    // Pad nonce to 16 bytes
    const iv = Buffer.alloc(16);
    nonce.copy(iv, 0);
    
    try {
      const testKeystream = crypto.createCipheriv('aes-256-ctr', keyBuf, iv).update(Buffer.alloc(ciphertext.length));
      
      const matches = testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32));
      console.log(`${name}: ${matches ? 'MATCH!' : 'no match'}`);
      
      if (matches) {
        const decrypted = Buffer.alloc(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i++) {
          decrypted[i] = ciphertext[i] ^ testKeystream[i];
        }
        console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
        return;
      }
    } catch (e) {
      console.log(`${name}: error - ${e.message}`);
    }
  }
  
  // Maybe the nonce is used as part of the IV differently
  console.log('\n=== Try different IV constructions ===');
  
  const ivConstructions = [
    { name: 'nonce at end', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
    { name: 'nonce + counter', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
    { name: 'sha256(nonce)[:16]', iv: crypto.createHash('sha256').update(nonce).digest().subarray(0, 16) },
  ];
  
  for (const { name: ivName, iv } of ivConstructions) {
    for (const { name: keyName, key: keyBuf } of keyVariants) {
      try {
        const testKeystream = crypto.createCipheriv('aes-256-ctr', keyBuf, iv).update(Buffer.alloc(ciphertext.length));
        
        if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`MATCH: AES-CTR + ${keyName} + ${ivName}`);
          return;
        }
      } catch (e) {}
    }
  }
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
