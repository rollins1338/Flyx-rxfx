/**
 * Crack Hexa Encryption v17 - Try more cipher variations
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v17 ===\n');
  
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
  
  const nonce = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // List all available ciphers
  const ciphers = crypto.getCiphers();
  console.log('\n=== Available stream ciphers ===');
  const streamCiphers = ciphers.filter(c => 
    c.includes('ctr') || c.includes('cfb') || c.includes('ofb') || 
    c.includes('chacha') || c.includes('salsa') || c.includes('rc4')
  );
  console.log(streamCiphers.join(', '));
  
  // Key derivations to try
  const keyDerivations = [
    { name: 'raw', key: keyBuf },
    { name: 'sha256(str)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(bytes)', key: crypto.createHash('sha256').update(keyBuf).digest() },
  ];
  
  console.log('\n=== Testing ciphers ===\n');
  
  // Test ChaCha20 variants
  const chachaCiphers = streamCiphers.filter(c => c.includes('chacha'));
  console.log('ChaCha ciphers:', chachaCiphers);
  
  for (const cipher of chachaCiphers) {
    for (const { name, key: derivedKey } of keyDerivations) {
      // ChaCha20 in Node needs 16-byte IV (4-byte counter + 12-byte nonce)
      const ivVariants = [
        { name: '0+nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
        { name: 'nonce+0', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      ];
      
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const testKeystream = crypto.createCipheriv(cipher, derivedKey, iv).update(Buffer.alloc(ciphertext.length));
          
          if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ${cipher} + ${name} + ${ivName} ***`);
            
            const decrypted = Buffer.alloc(ciphertext.length);
            for (let i = 0; i < ciphertext.length; i++) {
              decrypted[i] = ciphertext[i] ^ testKeystream[i];
            }
            console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
            return { cipher, keyDerivation: name, ivConstruction: ivName };
          }
        } catch (e) {
          // console.log(`${cipher} + ${name} + ${ivName}: ${e.message}`);
        }
      }
    }
  }
  
  // Test AES-CTR variants
  console.log('\nTesting AES-CTR...');
  
  for (const { name, key: derivedKey } of keyDerivations) {
    const ivVariants = [
      { name: 'nonce+0', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      { name: '0+nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
      { name: 'nonce padded', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
    ];
    
    for (const { name: ivName, iv } of ivVariants) {
      try {
        const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv).update(Buffer.alloc(ciphertext.length));
        
        if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: aes-256-ctr + ${name} + ${ivName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  
  // Maybe the overhead isn't 12 bytes - let's check different nonce sizes
  console.log('\n=== Try different nonce sizes ===\n');
  
  for (let nonceSize = 8; nonceSize <= 24; nonceSize += 4) {
    const testNonce = encBytes.subarray(0, nonceSize);
    const testCiphertext = encBytes.subarray(nonceSize);
    
    // Check if ciphertext length matches expected
    if (testCiphertext.length !== expectedBytes.length) {
      continue;
    }
    
    // Extract keystream for this nonce size
    const testKeystream = Buffer.alloc(testCiphertext.length);
    for (let i = 0; i < testCiphertext.length; i++) {
      testKeystream[i] = testCiphertext[i] ^ expectedBytes[i];
    }
    
    console.log(`Nonce size ${nonceSize}: nonce=${testNonce.toString('hex')}`);
    
    // Try ChaCha20 with this nonce
    for (const { name, key: derivedKey } of keyDerivations) {
      if (nonceSize === 16) {
        // ChaCha20 with 16-byte IV
        try {
          const genKeystream = crypto.createCipheriv('chacha20', derivedKey, testNonce).update(Buffer.alloc(testCiphertext.length));
          
          if (genKeystream.subarray(0, 32).equals(testKeystream.subarray(0, 32))) {
            console.log(`*** MATCH: chacha20 + ${name} + nonce${nonceSize} ***`);
            return;
          }
        } catch (e) {}
      }
    }
  }
  
  console.log('\nNo match found.');
  
  // Print some debug info
  console.log('\n=== Debug info ===');
  console.log('Key (hex string):', key);
  console.log('Key (decoded):', keyBuf.toString('hex'));
  console.log('SHA256(key string):', crypto.createHash('sha256').update(key).digest().toString('hex'));
  console.log('SHA256(key bytes):', crypto.createHash('sha256').update(keyBuf).digest().toString('hex'));
}

crackHexa().catch(console.error);
