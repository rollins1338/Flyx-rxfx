/**
 * Crack Hexa Encryption v43 - Test more cipher combinations
 * 
 * Try:
 * 1. AES with different key schedules
 * 2. Blowfish, Twofish
 * 3. Custom constructions
 * 4. WebCrypto-style derivations
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v43 ===\n');
  
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const keyBuf = Buffer.from(key, 'hex');
  const keyStr = Buffer.from(key, 'utf8');
  
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
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  // Test Blowfish
  console.log('\n=== Testing Blowfish ===');
  const bfKeys = [
    { name: 'keyBuf', key: keyBuf },
    { name: 'keyBuf[:16]', key: keyBuf.subarray(0, 16) },
    { name: 'sha256(keyBuf)[:16]', key: crypto.createHash('sha256').update(keyBuf).digest().subarray(0, 16) },
  ];
  
  for (const { name: keyName, key: bfKey } of bfKeys) {
    try {
      // Blowfish-CFB with 8-byte IV
      const iv = nonce.subarray(0, 8);
      const cipher = crypto.createCipheriv('bf-cfb', bfKey, iv);
      const testKs = cipher.update(Buffer.alloc(keystream.length));
      
      if (testKs.subarray(0, 16).equals(keystream.subarray(0, 16))) {
        console.log(`*** MATCH: Blowfish-CFB + ${keyName} ***`);
        return;
      }
    } catch (e) {}
    
    try {
      // Blowfish-OFB
      const iv = nonce.subarray(0, 8);
      const cipher = crypto.createCipheriv('bf-ofb', bfKey, iv);
      const testKs = cipher.update(Buffer.alloc(keystream.length));
      
      if (testKs.subarray(0, 16).equals(keystream.subarray(0, 16))) {
        console.log(`*** MATCH: Blowfish-OFB + ${keyName} ***`);
        return;
      }
    } catch (e) {}
  }
  console.log('Blowfish: No match');
  
  // Test CAST5
  console.log('\n=== Testing CAST5 ===');
  for (const { name: keyName, key: castKey } of bfKeys) {
    try {
      const iv = nonce.subarray(0, 8);
      const cipher = crypto.createCipheriv('cast5-cfb', castKey, iv);
      const testKs = cipher.update(Buffer.alloc(keystream.length));
      
      if (testKs.subarray(0, 16).equals(keystream.subarray(0, 16))) {
        console.log(`*** MATCH: CAST5-CFB + ${keyName} ***`);
        return;
      }
    } catch (e) {}
  }
  console.log('CAST5: No match');
  
  // Test DES-EDE3 (3DES)
  console.log('\n=== Testing 3DES ===');
  const des3Keys = [
    { name: 'keyBuf[:24]', key: keyBuf.subarray(0, 24) },
    { name: 'sha256(keyBuf)[:24]', key: crypto.createHash('sha256').update(keyBuf).digest().subarray(0, 24) },
  ];
  
  for (const { name: keyName, key: desKey } of des3Keys) {
    try {
      const iv = nonce.subarray(0, 8);
      const cipher = crypto.createCipheriv('des-ede3-cfb', desKey, iv);
      const testKs = cipher.update(Buffer.alloc(keystream.length));
      
      if (testKs.subarray(0, 16).equals(keystream.subarray(0, 16))) {
        console.log(`*** MATCH: 3DES-CFB + ${keyName} ***`);
        return;
      }
    } catch (e) {}
  }
  console.log('3DES: No match');
  
  // Test with WebCrypto-style PBKDF2 (common in browser implementations)
  console.log('\n=== Testing WebCrypto-style PBKDF2 ===');
  
  // Common WebCrypto patterns
  const pbkdf2Configs = [
    { iterations: 1, salt: nonce, hash: 'sha256' },
    { iterations: 1, salt: nonce, hash: 'sha1' },
    { iterations: 100, salt: nonce, hash: 'sha256' },
    { iterations: 1000, salt: nonce, hash: 'sha256' },
    { iterations: 1, salt: Buffer.from(''), hash: 'sha256' },
    { iterations: 1, salt: Buffer.from('hexa'), hash: 'sha256' },
  ];
  
  for (const { iterations, salt, hash } of pbkdf2Configs) {
    try {
      const derivedKey = crypto.pbkdf2Sync(keyBuf, salt, iterations, 32, hash);
      
      // Test with AES-CTR
      const ivVariants = [
        Buffer.concat([nonce, Buffer.alloc(4)]),
        Buffer.concat([Buffer.alloc(4), nonce]),
        Buffer.alloc(16),
      ];
      
      for (const iv of ivVariants) {
        const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: PBKDF2(${iterations}, ${salt.toString('hex') || 'empty'}, ${hash}) + AES-CTR ***`);
          return;
        }
      }
      
      // Test with ChaCha20
      const chacha20Iv = Buffer.concat([Buffer.alloc(4), nonce]);
      try {
        const cipher = crypto.createCipheriv('chacha20', derivedKey, chacha20Iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: PBKDF2(${iterations}) + ChaCha20 ***`);
          return;
        }
      } catch (e) {}
    } catch (e) {}
  }
  console.log('WebCrypto PBKDF2: No match');
  
  // Test with key derived from concatenation of key parts
  console.log('\n=== Testing Key Part Combinations ===');
  
  // Split key into parts
  const keyParts = [
    keyBuf.subarray(0, 8),
    keyBuf.subarray(8, 16),
    keyBuf.subarray(16, 24),
    keyBuf.subarray(24, 32),
  ];
  
  // Try different combinations
  const keyCombinations = [
    { name: 'p0||p2||p1||p3', key: Buffer.concat([keyParts[0], keyParts[2], keyParts[1], keyParts[3]]) },
    { name: 'p3||p2||p1||p0', key: Buffer.concat([keyParts[3], keyParts[2], keyParts[1], keyParts[0]]) },
    { name: 'p1||p0||p3||p2', key: Buffer.concat([keyParts[1], keyParts[0], keyParts[3], keyParts[2]]) },
  ];
  
  for (const { name: keyName, key: derivedKey } of keyCombinations) {
    const ivVariants = [
      { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
    ];
    
    for (const { name: ivName, iv } of ivVariants) {
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: ${keyName} + AES-CTR + ${ivName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('Key combinations: No match');
  
  // Test with reversed key/nonce
  console.log('\n=== Testing Reversed Key/Nonce ===');
  
  const reversedKey = Buffer.from(keyBuf).reverse();
  const reversedNonce = Buffer.from(nonce).reverse();
  
  const reversedVariants = [
    { name: 'reversed key', key: reversedKey, nonce: nonce },
    { name: 'reversed nonce', key: keyBuf, nonce: reversedNonce },
    { name: 'both reversed', key: reversedKey, nonce: reversedNonce },
  ];
  
  for (const { name, key: rKey, nonce: rNonce } of reversedVariants) {
    const iv = Buffer.concat([rNonce, Buffer.alloc(4)]);
    try {
      const cipher = crypto.createCipheriv('aes-256-ctr', rKey, iv);
      const testKs = cipher.update(Buffer.alloc(keystream.length));
      
      if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: ${name} + AES-CTR ***`);
        return;
      }
    } catch (e) {}
  }
  console.log('Reversed: No match');
  
  // Test AES-128 with half the key
  console.log('\n=== Testing AES-128 ===');
  
  const aes128Keys = [
    { name: 'keyBuf[:16]', key: keyBuf.subarray(0, 16) },
    { name: 'keyBuf[16:]', key: keyBuf.subarray(16, 32) },
    { name: 'sha256(keyBuf)[:16]', key: crypto.createHash('sha256').update(keyBuf).digest().subarray(0, 16) },
    { name: 'md5(keyBuf)', key: crypto.createHash('md5').update(keyBuf).digest() },
  ];
  
  for (const { name: keyName, key: aesKey } of aes128Keys) {
    const ivVariants = [
      { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
    ];
    
    for (const { name: ivName, iv } of ivVariants) {
      try {
        const cipher = crypto.createCipheriv('aes-128-ctr', aesKey, iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: AES-128-CTR + ${keyName} + ${ivName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('AES-128: No match');
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
