/**
 * Crack Hexa Encryption v14 - Deep keystream analysis
 */

const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');

async function crackHexa() {
  await _sodium.ready;
  const sodium = _sodium;
  
  console.log('=== Cracking Hexa Encryption v14 ===\n');
  
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
  console.log('Ciphertext length:', ciphertext.length);
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Keystream first 64:', keystream.subarray(0, 64).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Try all possible key derivations with all possible cipher modes
  console.log('\n=== Exhaustive cipher search ===\n');
  
  const keyDerivations = [
    { name: 'raw', key: keyBuf },
    { name: 'sha256(str)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(bytes)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'sha512[:32](str)', key: crypto.createHash('sha512').update(key).digest().subarray(0, 32) },
    { name: 'sha512[:32](bytes)', key: crypto.createHash('sha512').update(keyBuf).digest().subarray(0, 32) },
    { name: 'md5+md5', key: Buffer.concat([
      crypto.createHash('md5').update(key).digest(),
      crypto.createHash('md5').update(key + '1').digest()
    ]) },
  ];
  
  // Add HKDF
  try {
    keyDerivations.push({ name: 'hkdf(bytes)', key: Buffer.from(crypto.hkdfSync('sha256', keyBuf, '', '', 32)) });
    keyDerivations.push({ name: 'hkdf(str)', key: Buffer.from(crypto.hkdfSync('sha256', key, '', '', 32)) });
  } catch (e) {}
  
  const ciphers = ['aes-256-ctr', 'aes-256-cfb', 'aes-256-ofb'];
  
  for (const { name: keyName, key: derivedKey } of keyDerivations) {
    for (const cipher of ciphers) {
      // Try with nonce padded to 16 bytes at different positions
      for (let offset = 0; offset <= 4; offset++) {
        const iv = Buffer.alloc(16);
        nonce.copy(iv, offset);
        
        try {
          const testKeystream = crypto.createCipheriv(cipher, derivedKey, iv).update(Buffer.alloc(ciphertext.length));
          
          if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ${cipher} + ${keyName} + offset=${offset} ***`);
            
            // Verify full decryption
            const decrypted = Buffer.alloc(ciphertext.length);
            for (let i = 0; i < ciphertext.length; i++) {
              decrypted[i] = ciphertext[i] ^ testKeystream[i];
            }
            console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
            return;
          }
        } catch (e) {}
      }
      
      // Try with nonce as-is (12 bytes) - some ciphers might accept it
      try {
        const testKeystream = crypto.createCipheriv(cipher, derivedKey, nonce).update(Buffer.alloc(ciphertext.length));
        
        if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: ${cipher} + ${keyName} + 12-byte nonce ***`);
          return;
        }
      } catch (e) {}
    }
  }
  
  // Try libsodium stream ciphers
  console.log('\n=== Try libsodium stream ciphers ===\n');
  
  for (const { name: keyName, key: derivedKey } of keyDerivations) {
    // XSalsa20 (24-byte nonce) - pad our 12-byte nonce
    try {
      const nonce24 = Buffer.alloc(24);
      nonce.copy(nonce24, 0);
      
      const testKeystream = Buffer.from(sodium.crypto_stream_xsalsa20(
        ciphertext.length,
        new Uint8Array(nonce24),
        new Uint8Array(derivedKey)
      ));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: XSalsa20 + ${keyName} ***`);
        return;
      }
    } catch (e) {}
    
    // Salsa20 (8-byte nonce)
    try {
      const nonce8 = nonce.subarray(0, 8);
      
      const testKeystream = Buffer.from(sodium.crypto_stream_salsa20(
        ciphertext.length,
        new Uint8Array(nonce8),
        new Uint8Array(derivedKey)
      ));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: Salsa20 + ${keyName} ***`);
        return;
      }
    } catch (e) {}
    
    // XChaCha20 (24-byte nonce)
    try {
      const nonce24 = Buffer.alloc(24);
      nonce.copy(nonce24, 0);
      
      const testKeystream = Buffer.from(sodium.crypto_stream_xchacha20(
        ciphertext.length,
        new Uint8Array(nonce24),
        new Uint8Array(derivedKey)
      ));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: XChaCha20 + ${keyName} ***`);
        return;
      }
    } catch (e) {}
    
    // ChaCha20 (12-byte nonce) - using IETF variant
    try {
      const testKeystream = Buffer.from(sodium.crypto_stream_chacha20_ietf(
        ciphertext.length,
        new Uint8Array(nonce),
        new Uint8Array(derivedKey)
      ));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: ChaCha20-IETF + ${keyName} ***`);
        return;
      }
    } catch (e) {}
  }
  
  console.log('No match found.');
  
  // Print some analysis
  console.log('\n=== Keystream analysis ===');
  console.log('First 32 bytes:', keystream.subarray(0, 32).toString('hex'));
  console.log('Bytes 32-64:', keystream.subarray(32, 64).toString('hex'));
  
  // Check if keystream has any pattern
  let hasPattern = false;
  for (let period = 1; period <= 64; period++) {
    let matches = true;
    for (let i = period; i < Math.min(period * 3, keystream.length); i++) {
      if (keystream[i] !== keystream[i % period]) {
        matches = false;
        break;
      }
    }
    if (matches && period < keystream.length / 2) {
      console.log(`Keystream has period of ${period} bytes`);
      hasPattern = true;
      break;
    }
  }
  if (!hasPattern) {
    console.log('Keystream appears random (no short period)');
  }
}

crackHexa().catch(console.error);
