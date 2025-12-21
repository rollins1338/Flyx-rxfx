/**
 * Crack Hexa Encryption v44 - Deep keystream pattern analysis
 * 
 * Analyze the keystream to find patterns that might reveal the algorithm
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v44 - Deep Pattern Analysis ===\n');
  
  // Use a known key for reproducibility
  const key = 'a'.repeat(64); // All 'a' characters
  console.log('Key:', key);
  
  const keyBuf = Buffer.from(key, 'hex');
  console.log('Key bytes:', keyBuf.toString('hex'));
  
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
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream length:', keystream.length);
  console.log('Keystream[0:64]:', keystream.subarray(0, 64).toString('hex'));
  
  // Analyze keystream in 64-byte blocks (ChaCha20 block size)
  console.log('\n=== 64-byte Block Analysis ===');
  for (let i = 0; i < Math.min(4, Math.ceil(keystream.length / 64)); i++) {
    const block = keystream.subarray(i * 64, (i + 1) * 64);
    console.log(`Block ${i}: ${block.toString('hex')}`);
  }
  
  // Analyze keystream in 16-byte blocks (AES block size)
  console.log('\n=== 16-byte Block Analysis ===');
  for (let i = 0; i < Math.min(8, Math.ceil(keystream.length / 16)); i++) {
    const block = keystream.subarray(i * 16, (i + 1) * 16);
    console.log(`Block ${i}: ${block.toString('hex')}`);
  }
  
  // Check for ChaCha20 constants in keystream
  console.log('\n=== Checking for ChaCha20 Constants ===');
  const chacha20Constants = Buffer.from('expand 32-byte k', 'ascii');
  console.log('ChaCha20 constants:', chacha20Constants.toString('hex'));
  
  // XOR first 16 bytes with constants
  const xorWithConstants = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    xorWithConstants[i] = keystream[i] ^ chacha20Constants[i];
  }
  console.log('KS[0:16] XOR constants:', xorWithConstants.toString('hex'));
  
  // Now test with a different key pattern
  console.log('\n\n=== Testing with Different Key Pattern ===\n');
  
  const key2 = '0'.repeat(64);
  console.log('Key2:', key2);
  
  const headers2 = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key2,
  };
  
  const encResponse2 = await fetch(url, { headers: headers2 });
  const encrypted2 = await encResponse2.text();
  
  const decResponse2 = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted2, key: key2 }),
  });
  const decResult2 = await decResponse2.json();
  const expectedStr2 = JSON.stringify(decResult2.result);
  
  const encBytes2 = Buffer.from(encrypted2, 'base64');
  const expectedBytes2 = Buffer.from(expectedStr2, 'utf8');
  
  const nonce2 = encBytes2.subarray(0, 12);
  const ciphertext2 = encBytes2.subarray(12);
  
  const keystream2 = Buffer.alloc(ciphertext2.length);
  for (let i = 0; i < ciphertext2.length; i++) {
    keystream2[i] = ciphertext2[i] ^ expectedBytes2[i];
  }
  
  console.log('Nonce2:', nonce2.toString('hex'));
  console.log('Keystream2[0:64]:', keystream2.subarray(0, 64).toString('hex'));
  
  // Compare the two keystreams
  console.log('\n=== Comparing Keystreams ===');
  const xorKeystreams = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    xorKeystreams[i] = keystream[i] ^ keystream2[i];
  }
  console.log('KS1 XOR KS2:', xorKeystreams.toString('hex'));
  
  // Test with the actual algorithm using libsodium's crypto_stream
  console.log('\n=== Testing libsodium crypto_stream variants ===');
  
  try {
    const sodium = require('libsodium-wrappers');
    await sodium.ready;
    
    // Test with key as all 0xaa
    const testKey = Buffer.alloc(32, 0xaa);
    
    // Generate keystream with different algorithms
    const algorithms = [
      { name: 'xsalsa20', fn: (len, n, k) => sodium.crypto_stream_xsalsa20(len, n, k) },
      { name: 'chacha20', fn: (len, n, k) => sodium.crypto_stream_chacha20(len, n, k) },
      { name: 'chacha20_ietf', fn: (len, n, k) => sodium.crypto_stream_chacha20_ietf(len, n, k) },
      { name: 'xchacha20', fn: (len, n, k) => sodium.crypto_stream_xchacha20(len, n, k) },
    ];
    
    for (const { name, fn } of algorithms) {
      try {
        let testNonce;
        if (name === 'xsalsa20' || name === 'xchacha20') {
          testNonce = Buffer.concat([nonce, Buffer.alloc(12)]); // 24 bytes
        } else if (name === 'chacha20') {
          testNonce = nonce.subarray(0, 8); // 8 bytes
        } else {
          testNonce = nonce; // 12 bytes
        }
        
        const testKs = fn(64, testNonce, testKey);
        console.log(`${name} with 0xaa key: ${Buffer.from(testKs).toString('hex')}`);
      } catch (e) {
        console.log(`${name}: ${e.message}`);
      }
    }
  } catch (e) {
    console.log('libsodium error:', e.message);
  }
  
  // Test if the encryption might be using a simple XOR with a derived key
  console.log('\n=== Testing Simple XOR Patterns ===');
  
  // What if keystream = SHA256(key || nonce || block_counter) repeated?
  const keyBuf1 = Buffer.from(key, 'hex');
  
  for (let blockSize of [16, 32, 64]) {
    const testKs = Buffer.alloc(keystream.length);
    
    for (let block = 0; block * blockSize < keystream.length; block++) {
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32LE(block);
      
      const hash = crypto.createHash('sha256')
        .update(keyBuf1)
        .update(nonce)
        .update(counterBuf)
        .digest();
      
      const offset = block * blockSize;
      const toCopy = Math.min(blockSize, keystream.length - offset);
      hash.subarray(0, toCopy).copy(testKs, offset);
    }
    
    if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: SHA256(key||nonce||counter) with ${blockSize}-byte blocks ***`);
      return;
    }
  }
  console.log('SHA256 counter mode: No match');
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
