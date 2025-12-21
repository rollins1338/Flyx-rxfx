/**
 * Crack Hexa Encryption v28 - Try Rust-specific crypto patterns
 * 
 * Common Rust crypto crates:
 * - ring (uses BoringSSL)
 * - rust-crypto (deprecated)
 * - RustCrypto (aes-gcm, chacha20poly1305, etc.)
 * - sodiumoxide (libsodium bindings)
 * - orion (pure Rust)
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v28 ===\n');
  
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
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // The orion crate uses HKDF for key derivation
  // Let's try various HKDF configurations
  
  console.log('\n=== Try HKDF variations ===\n');
  
  const hkdfConfigs = [
    { salt: '', info: '' },
    { salt: 'hexa', info: '' },
    { salt: '', info: 'hexa' },
    { salt: 'hexa', info: 'hexa' },
    { salt: nonce.toString('hex'), info: '' },
    { salt: '', info: nonce.toString('hex') },
    { salt: nonce, info: '' },
    { salt: '', info: nonce },
  ];
  
  for (const { salt, info } of hkdfConfigs) {
    try {
      const derivedKey = Buffer.from(crypto.hkdfSync(
        'sha256',
        keyBuf,
        typeof salt === 'string' ? salt : salt,
        typeof info === 'string' ? info : info,
        32
      ));
      
      // Try AES-CTR with derived key
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      
      const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv)
        .update(Buffer.alloc(ciphertext.length));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: HKDF(salt=${salt}, info=${info}) + AES-CTR ***`);
        return;
      }
    } catch (e) {}
  }
  
  // Try with the key being the hex string (not decoded)
  console.log('\n=== Try with key as string ===\n');
  
  const keyStr = key; // 64 hex chars
  
  // HKDF with string key
  for (const { salt, info } of hkdfConfigs) {
    try {
      const derivedKey = Buffer.from(crypto.hkdfSync(
        'sha256',
        keyStr,
        typeof salt === 'string' ? salt : salt,
        typeof info === 'string' ? info : info,
        32
      ));
      
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      
      const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv)
        .update(Buffer.alloc(ciphertext.length));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: HKDF(keyStr, salt=${salt}, info=${info}) + AES-CTR ***`);
        return;
      }
    } catch (e) {}
  }
  
  // Try Argon2-like key derivation (simplified)
  console.log('\n=== Try PBKDF2 variations ===\n');
  
  const pbkdf2Configs = [
    { salt: nonce, iterations: 1 },
    { salt: nonce, iterations: 100 },
    { salt: nonce, iterations: 1000 },
    { salt: Buffer.from('hexa'), iterations: 1 },
    { salt: Buffer.alloc(16), iterations: 1 },
  ];
  
  for (const { salt, iterations } of pbkdf2Configs) {
    try {
      const derivedKey = crypto.pbkdf2Sync(keyBuf, salt, iterations, 32, 'sha256');
      
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      
      const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv)
        .update(Buffer.alloc(ciphertext.length));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: PBKDF2(iterations=${iterations}) + AES-CTR ***`);
        return;
      }
    } catch (e) {}
  }
  
  // Try scrypt-like derivation
  console.log('\n=== Try scrypt ===\n');
  
  try {
    const derivedKey = crypto.scryptSync(keyBuf, nonce, 32, { N: 16384, r: 8, p: 1 });
    
    const iv = Buffer.alloc(16);
    nonce.copy(iv, 0);
    
    const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv)
      .update(Buffer.alloc(ciphertext.length));
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log('*** MATCH: scrypt + AES-CTR ***');
      return;
    }
  } catch (e) {
    console.log('scrypt failed:', e.message);
  }
  
  // Maybe the encryption is using a different block cipher
  console.log('\n=== Try other block ciphers ===\n');
  
  const ciphers = ['camellia-256-ctr', 'aria-256-ctr'];
  
  for (const cipher of ciphers) {
    try {
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      
      const testKeystream = crypto.createCipheriv(cipher, keyBuf, iv)
        .update(Buffer.alloc(ciphertext.length));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: ${cipher} ***`);
        return;
      }
    } catch (e) {}
  }
  
  console.log('No match found.');
  
  // At this point, we've exhausted most standard algorithms
  // The encryption might be using a custom implementation
  console.log('\n=== Conclusion ===');
  console.log('Unable to determine the encryption algorithm.');
  console.log('The encryption appears to use a custom or proprietary algorithm.');
  console.log('');
  console.log('For production use, consider:');
  console.log('1. Using enc-dec.app API (current working solution)');
  console.log('2. Reverse engineering the enc-dec.app frontend');
  console.log('3. Analyzing the hexa.su server-side code if accessible');
}

crackHexa().catch(console.error);
