/**
 * Crack Hexa Encryption v20 - Try Web Crypto API patterns
 */

const crypto = require('crypto');
const { webcrypto } = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v20 ===\n');
  
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
  
  console.log('Encrypted bytes:', encBytes.length);
  console.log('Expected bytes:', expectedBytes.length);
  
  const nonce12 = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce12.toString('hex'));
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Try Web Crypto API AES-CTR
  console.log('\n=== Web Crypto API AES-CTR ===\n');
  
  const keyVariants = [
    { name: 'raw', key: keyBuf },
    { name: 'sha256(str)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(bytes)', key: crypto.createHash('sha256').update(keyBuf).digest() },
  ];
  
  for (const { name, key: derivedKey } of keyVariants) {
    // Import key for Web Crypto
    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      derivedKey,
      { name: 'AES-CTR' },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Try different counter configurations
    // Web Crypto AES-CTR uses: counter (16 bytes) with length parameter
    
    const counterConfigs = [
      { name: 'nonce+zeros, len=32', counter: Buffer.concat([nonce12, Buffer.alloc(4)]), length: 32 },
      { name: 'nonce+zeros, len=64', counter: Buffer.concat([nonce12, Buffer.alloc(4)]), length: 64 },
      { name: 'nonce+zeros, len=128', counter: Buffer.concat([nonce12, Buffer.alloc(4)]), length: 128 },
      { name: 'zeros+nonce, len=32', counter: Buffer.concat([Buffer.alloc(4), nonce12]), length: 32 },
      { name: 'zeros+nonce, len=64', counter: Buffer.concat([Buffer.alloc(4), nonce12]), length: 64 },
    ];
    
    for (const { name: counterName, counter, length } of counterConfigs) {
      try {
        // Encrypt zeros to get keystream
        const testKeystream = Buffer.from(await webcrypto.subtle.encrypt(
          { name: 'AES-CTR', counter: new Uint8Array(counter), length },
          cryptoKey,
          new Uint8Array(ciphertext.length)
        ));
        
        if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: Web Crypto AES-CTR + ${name} + ${counterName} ***`);
          
          // Decrypt
          const decrypted = Buffer.from(await webcrypto.subtle.decrypt(
            { name: 'AES-CTR', counter: new Uint8Array(counter), length },
            cryptoKey,
            new Uint8Array(ciphertext)
          ));
          console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
          return;
        }
      } catch (e) {
        // console.log(`${name} + ${counterName}: ${e.message}`);
      }
    }
  }
  
  // Try with the key being the hex string itself (not decoded)
  console.log('\n=== Try with key as UTF-8 string ===\n');
  
  // The key is 64 hex chars, which is 64 bytes as UTF-8
  // Maybe they use first 32 bytes or hash it
  const keyUtf8 = Buffer.from(key, 'utf8');
  const keyFirst32Utf8 = keyUtf8.subarray(0, 32);
  
  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    keyFirst32Utf8,
    { name: 'AES-CTR' },
    false,
    ['encrypt']
  );
  
  const counter = Buffer.concat([nonce12, Buffer.alloc(4)]);
  
  try {
    const testKeystream = Buffer.from(await webcrypto.subtle.encrypt(
      { name: 'AES-CTR', counter: new Uint8Array(counter), length: 32 },
      cryptoKey,
      new Uint8Array(ciphertext.length)
    ));
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log('*** MATCH: Web Crypto AES-CTR + keyUtf8First32 ***');
      return;
    }
  } catch (e) {}
  
  // Maybe the algorithm is simpler - just XOR with a repeated key or hash chain
  console.log('\n=== Try simple XOR patterns ===\n');
  
  // XOR with repeated SHA256 blocks
  function sha256Chain(seed, length) {
    const result = Buffer.alloc(length);
    let current = seed;
    let offset = 0;
    let counter = 0;
    
    while (offset < length) {
      // Hash: seed || counter
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32BE(counter);
      current = crypto.createHash('sha256').update(Buffer.concat([seed, counterBuf])).digest();
      
      const toCopy = Math.min(32, length - offset);
      current.copy(result, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    return result;
  }
  
  const chainSeeds = [
    { name: 'sha256chain(key)', seed: keyBuf },
    { name: 'sha256chain(key+nonce)', seed: Buffer.concat([keyBuf, nonce12]) },
    { name: 'sha256chain(nonce+key)', seed: Buffer.concat([nonce12, keyBuf]) },
    { name: 'sha256chain(sha256(key))', seed: crypto.createHash('sha256').update(keyBuf).digest() },
  ];
  
  for (const { name, seed } of chainSeeds) {
    const testKeystream = sha256Chain(seed, ciphertext.length);
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: ${name} ***`);
      return;
    }
  }
  
  // Try HMAC-based counter mode
  console.log('\n=== Try HMAC counter mode ===\n');
  
  function hmacCounterMode(key, nonce, length) {
    const result = Buffer.alloc(length);
    let offset = 0;
    let counter = 0;
    
    while (offset < length) {
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32BE(counter);
      
      const block = crypto.createHmac('sha256', key)
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
  
  const hmacSeeds = [
    { name: 'hmac-ctr(key, nonce)', key: keyBuf, nonce: nonce12 },
    { name: 'hmac-ctr(sha256(key), nonce)', key: crypto.createHash('sha256').update(keyBuf).digest(), nonce: nonce12 },
  ];
  
  for (const { name, key: hmacKey, nonce } of hmacSeeds) {
    const testKeystream = hmacCounterMode(hmacKey, nonce, ciphertext.length);
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: ${name} ***`);
      return;
    }
  }
  
  console.log('No match found.');
}

crackHexa().catch(console.error);
