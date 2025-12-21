/**
 * Crack Hexa Encryption v11 - Analyze enc-dec.app and try more variations
 */

const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');

async function crackHexa() {
  await _sodium.ready;
  const sodium = _sodium;
  
  console.log('=== Cracking Hexa Encryption v11 ===\n');
  
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  console.log('Key length:', key.length, 'chars');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  console.log('Encrypted base64 length:', encrypted.length);
  
  // Verify with enc-dec.app
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  const decResult = await decResponse.json();
  const expected = JSON.stringify(decResult.result);
  console.log('Expected:', expected.slice(0, 100));
  console.log('Expected length:', expected.length);
  
  const encBytes = Buffer.from(encrypted, 'base64');
  console.log('\nEncrypted bytes:', encBytes.length);
  console.log('First 64 bytes:', encBytes.subarray(0, 64).toString('hex'));
  
  // The key is 64 hex chars = 32 bytes when decoded
  // But maybe they use it differently
  
  console.log('\n=== Analyzing structure ===');
  console.log('If XSalsa20 (nonce=24, tag=16): plaintext =', encBytes.length - 24 - 16);
  console.log('If XChaCha20 (nonce=24, tag=16): plaintext =', encBytes.length - 24 - 16);
  console.log('If ChaCha20 (nonce=12, tag=16): plaintext =', encBytes.length - 12 - 16);
  console.log('If AES-GCM (nonce=12, tag=16): plaintext =', encBytes.length - 12 - 16);
  console.log('Expected plaintext length:', expected.length);
  
  // The expected plaintext is ~1278 chars, encrypted is 1318 bytes
  // 1318 - 24 - 16 = 1278 ✓ This matches XSalsa20/XChaCha20!
  
  console.log('\n=== Structure matches XSalsa20/XChaCha20! ===');
  console.log('Trying more key derivations...\n');
  
  // More key derivation methods
  const keyDerivations = [
    { name: 'raw-hex-decoded', key: Buffer.from(key, 'hex') },
    { name: 'sha256(key-string)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(key-bytes)', key: crypto.createHash('sha256').update(Buffer.from(key, 'hex')).digest() },
    { name: 'sha512-first32(key-string)', key: crypto.createHash('sha512').update(key).digest().subarray(0, 32) },
    { name: 'sha512-first32(key-bytes)', key: crypto.createHash('sha512').update(Buffer.from(key, 'hex')).digest().subarray(0, 32) },
    { name: 'md5+md5(key)', key: Buffer.concat([
      crypto.createHash('md5').update(key).digest(),
      crypto.createHash('md5').update(key).digest()
    ]) },
    { name: 'first32-chars-as-bytes', key: Buffer.from(key.slice(0, 32), 'utf8') },
    { name: 'last32-chars-as-bytes', key: Buffer.from(key.slice(32), 'utf8') },
  ];
  
  // Add HKDF variations
  try {
    keyDerivations.push({
      name: 'hkdf-sha256-empty',
      key: Buffer.from(crypto.hkdfSync('sha256', Buffer.from(key, 'hex'), '', '', 32))
    });
    keyDerivations.push({
      name: 'hkdf-sha256-hexa-info',
      key: Buffer.from(crypto.hkdfSync('sha256', Buffer.from(key, 'hex'), '', 'hexa', 32))
    });
    keyDerivations.push({
      name: 'hkdf-sha256-hexa-salt',
      key: Buffer.from(crypto.hkdfSync('sha256', Buffer.from(key, 'hex'), 'hexa', '', 32))
    });
  } catch (e) {}
  
  // Add PBKDF2 variations
  keyDerivations.push({
    name: 'pbkdf2-sha256-1iter',
    key: crypto.pbkdf2Sync(key, '', 1, 32, 'sha256')
  });
  keyDerivations.push({
    name: 'pbkdf2-sha256-1000iter',
    key: crypto.pbkdf2Sync(key, '', 1000, 32, 'sha256')
  });
  
  const nonce = new Uint8Array(encBytes.subarray(0, 24));
  const ciphertext = new Uint8Array(encBytes.subarray(24));
  
  for (const { name, key: keyBuf } of keyDerivations) {
    if (!keyBuf || keyBuf.length !== 32) continue;
    
    // Try XSalsa20-Poly1305 (secretbox)
    try {
      const decrypted = sodium.crypto_secretbox_open_easy(
        ciphertext,
        nonce,
        new Uint8Array(keyBuf)
      );
      console.log(`*** SUCCESS with ${name} (secretbox)! ***`);
      console.log(Buffer.from(decrypted).toString('utf8').slice(0, 300));
      return;
    } catch (e) {}
    
    // Try XChaCha20-Poly1305
    try {
      const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, ciphertext, null, nonce, new Uint8Array(keyBuf)
      );
      console.log(`*** SUCCESS with ${name} (xchacha20)! ***`);
      console.log(Buffer.from(decrypted).toString('utf8').slice(0, 300));
      return;
    } catch (e) {}
  }
  
  // Maybe the nonce is derived from something?
  console.log('\n=== Try with derived nonce ===');
  
  const keyBuf = Buffer.from(key, 'hex');
  const derivedNonces = [
    { name: 'sha256(key)[:24]', nonce: crypto.createHash('sha256').update(key).digest().subarray(0, 24) },
    { name: 'sha256(key-bytes)[:24]', nonce: crypto.createHash('sha256').update(keyBuf).digest().subarray(0, 24) },
    { name: 'zeros', nonce: Buffer.alloc(24) },
    { name: 'md5(key)+md5(key)[:8]', nonce: Buffer.concat([
      crypto.createHash('md5').update(key).digest(),
      crypto.createHash('md5').update(key).digest().subarray(0, 8)
    ]) },
  ];
  
  for (const { name: nonceName, nonce: derivedNonce } of derivedNonces) {
    // Use full encrypted data as ciphertext (no nonce prefix)
    const fullCiphertext = new Uint8Array(encBytes);
    
    for (const { name: keyName, key: keyBuf } of keyDerivations) {
      if (!keyBuf || keyBuf.length !== 32) continue;
      
      try {
        const decrypted = sodium.crypto_secretbox_open_easy(
          fullCiphertext,
          new Uint8Array(derivedNonce),
          new Uint8Array(keyBuf)
        );
        console.log(`*** SUCCESS with ${keyName} + ${nonceName}! ***`);
        console.log(Buffer.from(decrypted).toString('utf8').slice(0, 300));
        return;
      } catch (e) {}
    }
  }
  
  console.log('\nNo algorithm found.');
}

crackHexa().catch(console.error);
