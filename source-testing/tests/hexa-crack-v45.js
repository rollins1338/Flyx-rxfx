/**
 * Crack Hexa Encryption v45 - Test JavaScript-specific implementations
 * 
 * Try implementations that might be used in JavaScript:
 * 1. Web Crypto API patterns
 * 2. CryptoJS patterns
 * 3. Stanford JavaScript Crypto Library (sjcl)
 * 4. forge patterns
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v45 - JS Implementations ===\n');
  
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
  
  // Test CryptoJS-style key derivation (uses WordArray internally)
  console.log('\n=== Testing CryptoJS-style Patterns ===');
  
  // CryptoJS often uses PBKDF2 with specific defaults
  const cryptoJsConfigs = [
    { keySize: 256/32, iterations: 1, hasher: 'sha1' },
    { keySize: 256/32, iterations: 1, hasher: 'sha256' },
    { keySize: 256/32, iterations: 1000, hasher: 'sha1' },
    { keySize: 256/32, iterations: 10000, hasher: 'sha256' },
  ];
  
  for (const { keySize, iterations, hasher } of cryptoJsConfigs) {
    try {
      // CryptoJS uses the passphrase as-is (UTF-8)
      const derivedKey = crypto.pbkdf2Sync(key, nonce, iterations, 32, hasher);
      
      const ivVariants = [
        Buffer.concat([nonce, Buffer.alloc(4)]),
        Buffer.concat([Buffer.alloc(4), nonce]),
        Buffer.alloc(16),
      ];
      
      for (const iv of ivVariants) {
        const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: CryptoJS PBKDF2(${iterations}, ${hasher}) + AES-CTR ***`);
          return;
        }
      }
    } catch (e) {}
  }
  console.log('CryptoJS patterns: No match');
  
  // Test with key derived using MD5 (common in older JS libraries)
  console.log('\n=== Testing MD5-based Key Derivation ===');
  
  const md5Variants = [
    { name: 'md5(key)', key: crypto.createHash('md5').update(key).digest() },
    { name: 'md5(keyBuf)', key: crypto.createHash('md5').update(keyBuf).digest() },
    { name: 'md5(key||nonce)', key: crypto.createHash('md5').update(key + nonce.toString('hex')).digest() },
    { name: 'md5(md5(key))', key: crypto.createHash('md5').update(crypto.createHash('md5').update(key).digest()).digest() },
  ];
  
  // Expand MD5 to 32 bytes
  for (const { name, key: md5Key } of md5Variants) {
    const expandedKey = Buffer.concat([md5Key, md5Key]); // 32 bytes
    
    const ivVariants = [
      { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
      { name: 'md5(nonce)', iv: crypto.createHash('md5').update(nonce).digest() },
    ];
    
    for (const { name: ivName, iv } of ivVariants) {
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', expandedKey, iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: ${name} (expanded) + AES-CTR + ${ivName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('MD5 derivation: No match');
  
  // Test with EVP_BytesToKey (OpenSSL-style, used by CryptoJS)
  console.log('\n=== Testing EVP_BytesToKey ===');
  
  function evpBytesToKey(password, salt, keyLen, ivLen, iterations = 1) {
    const key = Buffer.alloc(keyLen);
    const iv = Buffer.alloc(ivLen);
    let derived = Buffer.alloc(0);
    
    while (derived.length < keyLen + ivLen) {
      const hash = crypto.createHash('md5');
      if (derived.length > 0) hash.update(derived.subarray(derived.length - 16));
      hash.update(password);
      if (salt) hash.update(salt);
      
      let block = hash.digest();
      for (let i = 1; i < iterations; i++) {
        block = crypto.createHash('md5').update(block).digest();
      }
      
      derived = Buffer.concat([derived, block]);
    }
    
    derived.copy(key, 0, 0, keyLen);
    derived.copy(iv, 0, keyLen, keyLen + ivLen);
    
    return { key, iv };
  }
  
  const evpPasswords = [
    Buffer.from(key),
    keyBuf,
    Buffer.from(key, 'utf8'),
  ];
  
  const evpSalts = [
    null,
    nonce.subarray(0, 8),
    nonce,
  ];
  
  for (const password of evpPasswords) {
    for (const salt of evpSalts) {
      try {
        const { key: evpKey, iv: evpIv } = evpBytesToKey(password, salt, 32, 16);
        
        // Test with derived IV
        const cipher1 = crypto.createCipheriv('aes-256-ctr', evpKey, evpIv);
        const testKs1 = cipher1.update(Buffer.alloc(keystream.length));
        
        if (testKs1.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: EVP_BytesToKey + AES-CTR ***`);
          return;
        }
        
        // Test with nonce as IV
        const iv = Buffer.concat([nonce, Buffer.alloc(4)]);
        const cipher2 = crypto.createCipheriv('aes-256-ctr', evpKey, iv);
        const testKs2 = cipher2.update(Buffer.alloc(keystream.length));
        
        if (testKs2.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: EVP_BytesToKey key + nonce IV ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('EVP_BytesToKey: No match');
  
  // Test with HKDF using different info strings
  console.log('\n=== Testing HKDF with Various Info Strings ===');
  
  const hkdfInfos = [
    '',
    'hexa',
    'flixer',
    'encrypt',
    'decrypt',
    'aes-256-ctr',
    'chacha20',
    key,
    nonce.toString('hex'),
  ];
  
  for (const info of hkdfInfos) {
    try {
      const derivedKey = Buffer.from(crypto.hkdfSync('sha256', keyBuf, nonce, info, 32));
      
      const ivVariants = [
        Buffer.concat([nonce, Buffer.alloc(4)]),
        Buffer.concat([Buffer.alloc(4), nonce]),
        Buffer.alloc(16),
      ];
      
      for (const iv of ivVariants) {
        const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: HKDF(info="${info}") + AES-CTR ***`);
          return;
        }
      }
    } catch (e) {}
  }
  console.log('HKDF with info: No match');
  
  // Test with key as raw bytes interpreted differently
  console.log('\n=== Testing Key Byte Interpretations ===');
  
  // What if the hex string is interpreted as raw bytes (not hex-decoded)?
  const keyAsBytes = Buffer.from(key, 'utf8'); // 64 bytes
  
  // SHA256 to get 32 bytes
  const keyBytesHash = crypto.createHash('sha256').update(keyAsBytes).digest();
  
  // Or take first/last 32 bytes
  const keyBytesFirst32 = keyAsBytes.subarray(0, 32);
  const keyBytesLast32 = keyAsBytes.subarray(32, 64);
  
  const byteInterpretations = [
    { name: 'sha256(keyAsBytes)', key: keyBytesHash },
    { name: 'keyAsBytes[:32]', key: keyBytesFirst32 },
    { name: 'keyAsBytes[32:]', key: keyBytesLast32 },
  ];
  
  for (const { name: keyName, key: derivedKey } of byteInterpretations) {
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
  console.log('Key byte interpretations: No match');
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
