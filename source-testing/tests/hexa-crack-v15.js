/**
 * Crack Hexa Encryption v15 - Try nonce as part of key derivation
 */

const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');

async function crackHexa() {
  await _sodium.ready;
  const sodium = _sodium;
  
  console.log('=== Cracking Hexa Encryption v15 ===\n');
  
  const key = crypto.randomBytes(32).toString('hex');
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
  
  const nonce = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  console.log('Nonce:', nonce.toString('hex'));
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  const keyBuf = Buffer.from(key, 'hex');
  
  console.log('\n=== Try key derivation with nonce ===\n');
  
  // Maybe the actual encryption key is derived from key + nonce
  const keyDerivations = [
    { name: 'sha256(key+nonce)', key: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest() },
    { name: 'sha256(nonce+key)', key: crypto.createHash('sha256').update(Buffer.concat([nonce, keyBuf])).digest() },
    { name: 'sha256(keyStr+nonceHex)', key: crypto.createHash('sha256').update(key + nonce.toString('hex')).digest() },
    { name: 'sha256(nonceHex+keyStr)', key: crypto.createHash('sha256').update(nonce.toString('hex') + key).digest() },
    { name: 'hkdf(key,nonce)', key: Buffer.from(crypto.hkdfSync('sha256', keyBuf, nonce, '', 32)) },
    { name: 'hkdf(key,nonce,info)', key: Buffer.from(crypto.hkdfSync('sha256', keyBuf, nonce, 'hexa', 32)) },
    { name: 'hmac(key,nonce)', key: crypto.createHmac('sha256', keyBuf).update(nonce).digest() },
    { name: 'hmac(nonce,key)', key: crypto.createHmac('sha256', nonce).update(keyBuf).digest() },
    { name: 'xor(key,nonce*3)', key: xorBuffers(keyBuf, Buffer.concat([nonce, nonce, nonce.subarray(0, 8)])) },
  ];
  
  // Test each derivation with different ciphers
  for (const { name, key: derivedKey } of keyDerivations) {
    // AES-256-CTR with zero IV (since nonce is used in key derivation)
    try {
      const iv = Buffer.alloc(16);
      const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv).update(Buffer.alloc(ciphertext.length));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: AES-CTR(${name}, zeroIV) ***`);
        return;
      }
    } catch (e) {}
    
    // AES-256-CTR with nonce as IV
    try {
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv).update(Buffer.alloc(ciphertext.length));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: AES-CTR(${name}, nonce) ***`);
        return;
      }
    } catch (e) {}
    
    // ChaCha20-IETF
    try {
      const testKeystream = Buffer.from(sodium.crypto_stream_chacha20_ietf(
        ciphertext.length,
        new Uint8Array(nonce),
        new Uint8Array(derivedKey)
      ));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: ChaCha20-IETF(${name}) ***`);
        return;
      }
    } catch (e) {}
    
    // ChaCha20-IETF with zero nonce
    try {
      const zeroNonce = Buffer.alloc(12);
      const testKeystream = Buffer.from(sodium.crypto_stream_chacha20_ietf(
        ciphertext.length,
        new Uint8Array(zeroNonce),
        new Uint8Array(derivedKey)
      ));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: ChaCha20-IETF(${name}, zeroNonce) ***`);
        return;
      }
    } catch (e) {}
  }
  
  // Maybe it's a simple XOR with a derived keystream
  console.log('\n=== Try simple keystream generation ===\n');
  
  // Generate keystream by hashing key repeatedly
  function generateHashChain(seed, length, hashFn = 'sha256') {
    const result = Buffer.alloc(length);
    let current = seed;
    let offset = 0;
    
    while (offset < length) {
      current = crypto.createHash(hashFn).update(current).digest();
      const toCopy = Math.min(current.length, length - offset);
      current.copy(result, offset, 0, toCopy);
      offset += toCopy;
    }
    
    return result;
  }
  
  const hashChainSeeds = [
    { name: 'sha256-chain(key)', seed: keyBuf },
    { name: 'sha256-chain(keyStr)', seed: Buffer.from(key, 'utf8') },
    { name: 'sha256-chain(key+nonce)', seed: Buffer.concat([keyBuf, nonce]) },
    { name: 'sha256-chain(sha256(key))', seed: crypto.createHash('sha256').update(keyBuf).digest() },
  ];
  
  for (const { name, seed } of hashChainSeeds) {
    const testKeystream = generateHashChain(seed, ciphertext.length);
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: ${name} ***`);
      return;
    }
  }
  
  // Try counter mode with hash
  console.log('\n=== Try counter-based keystream ===\n');
  
  function generateCounterKeystream(key, nonce, length) {
    const result = Buffer.alloc(length);
    let offset = 0;
    let counter = 0;
    
    while (offset < length) {
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32LE(counter);
      
      const block = crypto.createHash('sha256')
        .update(key)
        .update(nonce)
        .update(counterBuf)
        .digest();
      
      const toCopy = Math.min(32, length - offset);
      block.copy(result, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    return result;
  }
  
  const counterKeystream = generateCounterKeystream(keyBuf, nonce, ciphertext.length);
  if (counterKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
    console.log('*** MATCH: Counter-based SHA256 ***');
    return;
  }
  
  console.log('No match found.');
  
  // Let's check if the first block of keystream matches any known value
  console.log('\n=== First block analysis ===');
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  console.log('SHA256(key):', crypto.createHash('sha256').update(keyBuf).digest().toString('hex'));
  console.log('SHA256(keyStr):', crypto.createHash('sha256').update(key).digest().toString('hex'));
  console.log('SHA256(key+nonce):', crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest().toString('hex'));
}

function xorBuffers(a, b) {
  const result = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i % b.length];
  }
  return result;
}

crackHexa().catch(console.error);
