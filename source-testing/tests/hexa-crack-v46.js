/**
 * Crack Hexa Encryption v46 - Test Rust/WASM crypto libraries
 * 
 * Since flixer.su uses WASM, the encryption might be using Rust crypto libraries:
 * 1. ring (Rust crypto library)
 * 2. rust-crypto
 * 3. sodiumoxide
 * 4. chacha20poly1305 crate
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v46 - Rust/WASM Patterns ===\n');
  
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
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
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  // Test ring-style ChaCha20 (uses different nonce format)
  console.log('\n=== Testing ring-style ChaCha20 ===');
  
  // ring uses a 12-byte nonce with counter at the beginning
  const ringNonceVariants = [
    { name: 'counter||nonce', nonce: Buffer.concat([Buffer.from([0,0,0,0]), nonce]) },
    { name: 'counter||nonce (1)', nonce: Buffer.concat([Buffer.from([1,0,0,0]), nonce]) },
    { name: 'nonce||counter', nonce: Buffer.concat([nonce, Buffer.from([0,0,0,0])]) },
  ];
  
  const keyVariants = [
    { name: 'keyBuf', key: keyBuf },
    { name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'sha256(key)', key: crypto.createHash('sha256').update(key).digest() },
  ];
  
  for (const { name: keyName, key: derivedKey } of keyVariants) {
    for (const { name: nonceName, nonce: ringNonce } of ringNonceVariants) {
      try {
        const cipher = crypto.createCipheriv('chacha20', derivedKey, ringNonce);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: ring ChaCha20 + ${keyName} + ${nonceName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('ring ChaCha20: No match');
  
  // Test with BLAKE2b key derivation (common in Rust)
  console.log('\n=== Testing BLAKE2b Key Derivation ===');
  
  try {
    const { blake2b } = await import('@noble/hashes/blake2b');
    
    const blake2Variants = [
      { name: 'blake2b(keyBuf)', key: blake2b(keyBuf, { dkLen: 32 }) },
      { name: 'blake2b(key)', key: blake2b(Buffer.from(key), { dkLen: 32 }) },
      { name: 'blake2b(key||nonce)', key: blake2b(Buffer.concat([keyBuf, nonce]), { dkLen: 32 }) },
      { name: 'blake2b(nonce||key)', key: blake2b(Buffer.concat([nonce, keyBuf]), { dkLen: 32 }) },
    ];
    
    for (const { name: keyName, key: derivedKey } of blake2Variants) {
      const ivVariants = [
        { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
        { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
      ];
      
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.from(derivedKey), iv);
          const testKs = cipher.update(Buffer.alloc(keystream.length));
          
          if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ${keyName} + AES-CTR + ${ivName} ***`);
            return;
          }
        } catch (e) {}
      }
      
      // Also test with ChaCha20
      try {
        const chacha20Iv = Buffer.concat([Buffer.alloc(4), nonce]);
        const cipher = crypto.createCipheriv('chacha20', Buffer.from(derivedKey), chacha20Iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: ${keyName} + ChaCha20 ***`);
          return;
        }
      } catch (e) {}
    }
    console.log('BLAKE2b: No match');
  } catch (e) {
    console.log('BLAKE2b not available:', e.message);
  }
  
  // Test with SHA3 (Keccak)
  console.log('\n=== Testing SHA3/Keccak ===');
  
  try {
    const { sha3_256, keccak_256 } = await import('@noble/hashes/sha3');
    
    const sha3Variants = [
      { name: 'sha3_256(keyBuf)', key: sha3_256(keyBuf) },
      { name: 'sha3_256(key)', key: sha3_256(Buffer.from(key)) },
      { name: 'keccak_256(keyBuf)', key: keccak_256(keyBuf) },
      { name: 'sha3_256(key||nonce)', key: sha3_256(Buffer.concat([keyBuf, nonce])) },
    ];
    
    for (const { name: keyName, key: derivedKey } of sha3Variants) {
      const ivVariants = [
        { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
        { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
      ];
      
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.from(derivedKey), iv);
          const testKs = cipher.update(Buffer.alloc(keystream.length));
          
          if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ${keyName} + AES-CTR + ${ivName} ***`);
            return;
          }
        } catch (e) {}
      }
    }
    console.log('SHA3/Keccak: No match');
  } catch (e) {
    console.log('SHA3 not available:', e.message);
  }
  
  // Test with Argon2 (common in Rust for key derivation)
  console.log('\n=== Testing Argon2 ===');
  
  try {
    const argon2 = require('argon2');
    
    const argon2Configs = [
      { type: argon2.argon2i, memoryCost: 1024, timeCost: 1, parallelism: 1 },
      { type: argon2.argon2id, memoryCost: 1024, timeCost: 1, parallelism: 1 },
    ];
    
    for (const config of argon2Configs) {
      try {
        const derivedKey = await argon2.hash(keyBuf, {
          ...config,
          salt: nonce,
          hashLength: 32,
          raw: true,
        });
        
        const iv = Buffer.concat([nonce, Buffer.alloc(4)]);
        const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: Argon2 + AES-CTR ***`);
          return;
        }
      } catch (e) {}
    }
    console.log('Argon2: No match');
  } catch (e) {
    console.log('Argon2 not available');
  }
  
  // Test with different counter positions in ChaCha20
  console.log('\n=== Testing ChaCha20 Counter Positions ===');
  
  // ChaCha20 state: constants (4) + key (8) + counter (1) + nonce (3)
  // But some implementations put counter at different positions
  
  for (const { name: keyName, key: derivedKey } of keyVariants) {
    // Try with counter at position 12 (standard IETF)
    for (let counter = 0; counter <= 2; counter++) {
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32LE(counter);
      
      const ivVariants = [
        Buffer.concat([counterBuf, nonce]),
        Buffer.concat([nonce, counterBuf]),
      ];
      
      for (const iv of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('chacha20', derivedKey, iv);
          const testKs = cipher.update(Buffer.alloc(keystream.length));
          
          if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ChaCha20 + ${keyName} + counter=${counter} ***`);
            return;
          }
        } catch (e) {}
      }
    }
  }
  console.log('ChaCha20 counter positions: No match');
  
  // Test with XChaCha20 using HChaCha20 key derivation
  console.log('\n=== Testing XChaCha20 with HChaCha20 ===');
  
  try {
    const { xchacha20 } = await import('@noble/ciphers/chacha.js');
    
    // XChaCha20 uses first 16 bytes of nonce for HChaCha20
    // and last 8 bytes as the actual nonce
    
    // Pad our 12-byte nonce to 24 bytes
    const nonce24Variants = [
      { name: 'nonce||zeros', n: new Uint8Array(Buffer.concat([nonce, Buffer.alloc(12)])) },
      { name: 'zeros||nonce', n: new Uint8Array(Buffer.concat([Buffer.alloc(12), nonce])) },
      { name: 'nonce||nonce', n: new Uint8Array(Buffer.concat([nonce, nonce])) },
    ];
    
    for (const { name: keyName, key: derivedKey } of keyVariants) {
      for (const { name: nonceName, n } of nonce24Variants) {
        try {
          const cipher = xchacha20(new Uint8Array(derivedKey), n);
          const zeros = new Uint8Array(keystream.length);
          const testKs = cipher.encrypt(zeros);
          
          if (Buffer.from(testKs.subarray(0, 32)).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: XChaCha20 + ${keyName} + ${nonceName} ***`);
            return;
          }
        } catch (e) {}
      }
    }
    console.log('XChaCha20: No match');
  } catch (e) {
    console.log('XChaCha20 error:', e.message);
  }
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
