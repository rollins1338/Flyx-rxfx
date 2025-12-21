/**
 * Crack Hexa Encryption v39 - Deep keystream analysis
 * 
 * Analyze the keystream structure more carefully:
 * 1. Check if it's block-based (32, 64, 128 bytes)
 * 2. Look for counter patterns
 * 3. Test if keystream = f(key XOR nonce)
 * 4. Test various PBKDF2/scrypt derivations
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v39 - Deep Analysis ===\n');
  
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
  
  // Test PBKDF2 with various iterations
  console.log('\n=== Testing PBKDF2 ===');
  const pbkdf2Iterations = [1, 10, 100, 1000, 10000];
  const pbkdf2Salts = [
    { name: 'nonce', salt: nonce },
    { name: 'empty', salt: Buffer.alloc(0) },
    { name: '"hexa"', salt: Buffer.from('hexa') },
    { name: '"flixer"', salt: Buffer.from('flixer') },
  ];
  
  for (const iterations of pbkdf2Iterations) {
    for (const { name: saltName, salt } of pbkdf2Salts) {
      try {
        const derivedKey = crypto.pbkdf2Sync(keyBuf, salt, iterations, 32, 'sha256');
        
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
            console.log(`*** MATCH: PBKDF2(${iterations}, ${saltName}) + AES-CTR ***`);
            return;
          }
        }
      } catch (e) {}
    }
  }
  console.log('PBKDF2: No match');
  
  // Test scrypt
  console.log('\n=== Testing scrypt ===');
  const scryptParams = [
    { N: 16, r: 1, p: 1 },
    { N: 64, r: 1, p: 1 },
    { N: 256, r: 1, p: 1 },
    { N: 1024, r: 1, p: 1 },
  ];
  
  for (const { N, r, p } of scryptParams) {
    for (const { name: saltName, salt } of pbkdf2Salts) {
      try {
        const derivedKey = crypto.scryptSync(keyBuf, salt, 32, { N, r, p });
        
        const ivVariants = [
          Buffer.concat([nonce, Buffer.alloc(4)]),
          Buffer.concat([Buffer.alloc(4), nonce]),
          Buffer.alloc(16),
        ];
        
        for (const iv of ivVariants) {
          const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
          const testKs = cipher.update(Buffer.alloc(keystream.length));
          
          if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: scrypt(N=${N}, ${saltName}) + AES-CTR ***`);
            return;
          }
        }
      } catch (e) {}
    }
  }
  console.log('scrypt: No match');
  
  // Test simple XOR-based constructions
  console.log('\n=== Testing XOR Constructions ===');
  
  // Test: keystream = repeating(sha256(key || nonce))
  const simpleHash = crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest();
  const repeatedHash = Buffer.alloc(keystream.length);
  for (let i = 0; i < keystream.length; i++) {
    repeatedHash[i] = simpleHash[i % 32];
  }
  if (repeatedHash.subarray(0, 32).equals(keystream.subarray(0, 32))) {
    console.log('*** MATCH: Repeating SHA256(key||nonce) ***');
    return;
  }
  
  // Test: keystream[i] = sha256(key || nonce || i)[0]
  const counterHash = Buffer.alloc(keystream.length);
  for (let i = 0; i < keystream.length; i++) {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32LE(i);
    const hash = crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce, counterBuf])).digest();
    counterHash[i] = hash[0];
  }
  if (counterHash.subarray(0, 32).equals(keystream.subarray(0, 32))) {
    console.log('*** MATCH: SHA256(key||nonce||counter)[0] ***');
    return;
  }
  
  console.log('XOR constructions: No match');
  
  // Test AES-GCM without auth tag verification
  console.log('\n=== Testing AES-GCM (ignoring auth) ===');
  
  const keyVariants = [
    { name: 'keyBuf', key: keyBuf },
    { name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'sha256(keyStr)', key: crypto.createHash('sha256').update(keyStr).digest() },
  ];
  
  for (const { name: keyName, key: derivedKey } of keyVariants) {
    try {
      // AES-GCM with 12-byte nonce
      const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, nonce);
      const testKs = cipher.update(Buffer.alloc(keystream.length));
      
      if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: AES-256-GCM + ${keyName} ***`);
        return;
      }
    } catch (e) {}
  }
  console.log('AES-GCM: No match');
  
  // Test with key as the hex string (not decoded)
  console.log('\n=== Testing with Key as Hex String ===');
  
  // SHA256 of the hex string
  const keyHexHash = crypto.createHash('sha256').update(key).digest();
  
  const ivVariants = [
    { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
    { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
    { name: 'zeros', iv: Buffer.alloc(16) },
  ];
  
  for (const { name: ivName, iv } of ivVariants) {
    try {
      const cipher = crypto.createCipheriv('aes-256-ctr', keyHexHash, iv);
      const testKs = cipher.update(Buffer.alloc(keystream.length));
      
      if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: AES-CTR + sha256(keyHex) + ${ivName} ***`);
        return;
      }
    } catch (e) {}
  }
  console.log('Hex string key: No match');
  
  // Test Camellia, ARIA, SM4 if available
  console.log('\n=== Testing Other Block Ciphers ===');
  const otherCiphers = ['camellia-256-ctr', 'aria-256-ctr'];
  
  for (const cipherName of otherCiphers) {
    for (const { name: keyName, key: derivedKey } of keyVariants) {
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv(cipherName, derivedKey, iv);
          const testKs = cipher.update(Buffer.alloc(keystream.length));
          
          if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ${cipherName} + ${keyName} + ${ivName} ***`);
            return;
          }
        } catch (e) {}
      }
    }
  }
  console.log('Other ciphers: No match');
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
