/**
 * Crack Hexa Encryption v10 - Try libsodium properly
 */

const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');

async function crackHexa() {
  await _sodium.ready;
  const sodium = _sodium;
  
  console.log('=== Cracking Hexa Encryption v10 (libsodium) ===\n');
  console.log('Sodium version:', sodium.SODIUM_VERSION_STRING);
  
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
  
  console.log('Encrypted base64 length:', encrypted.length);
  
  // Verify with enc-dec.app
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  const decResult = await decResponse.json();
  console.log('Expected:', JSON.stringify(decResult.result).slice(0, 100));
  
  const encBytes = Buffer.from(encrypted, 'base64');
  console.log('Encrypted bytes:', encBytes.length);
  
  // Key variations
  const keyVariations = [
    { name: 'hex-decoded', key: Buffer.from(key, 'hex') },
    { name: 'sha256-of-hex-string', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256-of-hex-bytes', key: crypto.createHash('sha256').update(Buffer.from(key, 'hex')).digest() },
  ];
  
  console.log('\n=== Testing XSalsa20-Poly1305 (secretbox) ===\n');
  
  for (const { name, key: keyBuf } of keyVariations) {
    console.log(`\n--- ${name} ---`);
    
    // secretbox uses 24-byte nonce
    // Format: nonce (24) + ciphertext_with_tag (tag is 16 bytes prepended to ciphertext)
    
    try {
      const nonce = new Uint8Array(encBytes.subarray(0, 24));
      const ciphertext = new Uint8Array(encBytes.subarray(24));
      
      console.log('Nonce:', Buffer.from(nonce).toString('hex').slice(0, 32) + '...');
      console.log('Ciphertext length:', ciphertext.length);
      
      const decrypted = sodium.crypto_secretbox_open_easy(
        ciphertext,
        nonce,
        new Uint8Array(keyBuf)
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      console.log('SUCCESS! Decrypted:', str.slice(0, 300));
      return { algorithm: 'xsalsa20-poly1305', keyDerivation: name };
    } catch (e) {
      console.log('secretbox failed:', e.message);
    }
    
    // Try with nonce at end
    try {
      const nonce = new Uint8Array(encBytes.subarray(-24));
      const ciphertext = new Uint8Array(encBytes.subarray(0, -24));
      
      const decrypted = sodium.crypto_secretbox_open_easy(
        ciphertext,
        nonce,
        new Uint8Array(keyBuf)
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      console.log('SUCCESS (nonce at end)! Decrypted:', str.slice(0, 300));
      return;
    } catch (e) {
      // Silent
    }
  }
  
  console.log('\n=== Testing XChaCha20-Poly1305 IETF ===\n');
  
  for (const { name, key: keyBuf } of keyVariations) {
    // XChaCha20 uses 24-byte nonce
    try {
      const nonce = new Uint8Array(encBytes.subarray(0, 24));
      const ciphertext = new Uint8Array(encBytes.subarray(24));
      
      const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertext,
        null,
        nonce,
        new Uint8Array(keyBuf)
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      console.log(`SUCCESS with XChaCha20 (${name})! Decrypted:`, str.slice(0, 300));
      return;
    } catch (e) {
      console.log(`${name}: xchacha20 failed -`, e.message);
    }
  }
  
  console.log('\n=== Testing ChaCha20-Poly1305 IETF (12-byte nonce) ===\n');
  
  for (const { name, key: keyBuf } of keyVariations) {
    try {
      const nonce = new Uint8Array(encBytes.subarray(0, 12));
      const ciphertext = new Uint8Array(encBytes.subarray(12));
      
      const decrypted = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
        null,
        ciphertext,
        null,
        nonce,
        new Uint8Array(keyBuf)
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      console.log(`SUCCESS with ChaCha20 (${name})! Decrypted:`, str.slice(0, 300));
      return;
    } catch (e) {
      console.log(`${name}: chacha20 failed`);
    }
  }
  
  console.log('\n=== Testing Sealed Box ===\n');
  
  for (const { name, key: keyBuf } of keyVariations) {
    try {
      const keypair = sodium.crypto_box_seed_keypair(new Uint8Array(keyBuf));
      console.log(`${name} - Public key:`, Buffer.from(keypair.publicKey).toString('hex').slice(0, 32) + '...');
      
      const decrypted = sodium.crypto_box_seal_open(
        new Uint8Array(encBytes),
        keypair.publicKey,
        keypair.privateKey
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      console.log(`SUCCESS with sealed box (${name})! Decrypted:`, str.slice(0, 300));
      return;
    } catch (e) {
      console.log(`${name}: sealed box failed`);
    }
  }
  
  console.log('\nNo algorithm found.');
}

crackHexa().catch(console.error);
