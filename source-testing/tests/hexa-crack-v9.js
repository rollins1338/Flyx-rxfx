/**
 * Crack Hexa Encryption v9 - Try libsodium XChaCha20-Poly1305
 */

const crypto = require('crypto');

async function crackHexa() {
  // Dynamic import for libsodium
  const sodium = await import('libsodium-wrappers');
  await sodium.ready;
  
  console.log('=== Cracking Hexa Encryption v9 (libsodium) ===\n');
  
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
  
  console.log('\n=== Testing XChaCha20-Poly1305 ===\n');
  
  for (const { name, key: keyBuf } of keyVariations) {
    console.log(`\n--- ${name} ---`);
    
    // XChaCha20-Poly1305 uses 24-byte nonce
    // Format: nonce (24) + ciphertext + tag (16)
    // But libsodium secretbox includes tag in ciphertext
    
    // Try: nonce (24) + ciphertext_with_tag
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
    
    // Try XChaCha20-Poly1305 AEAD (crypto_aead_xchacha20poly1305_ietf_decrypt)
    try {
      const nonce = new Uint8Array(encBytes.subarray(0, 24));
      const ciphertext = new Uint8Array(encBytes.subarray(24));
      
      const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, // nsec (not used)
        ciphertext,
        null, // additional data
        nonce,
        new Uint8Array(keyBuf)
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      console.log('SUCCESS with XChaCha20! Decrypted:', str.slice(0, 300));
      return { algorithm: 'xchacha20-poly1305', keyDerivation: name };
    } catch (e) {
      console.log('xchacha20 failed:', e.message);
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
      return { algorithm: 'xsalsa20-poly1305', noncePosition: 'end', keyDerivation: name };
    } catch (e) {
      // Silent
    }
  }
  
  // Try ChaCha20-Poly1305 IETF (12-byte nonce)
  console.log('\n=== Testing ChaCha20-Poly1305 IETF ===\n');
  
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
      console.log(`SUCCESS with ${name}! Decrypted:`, str.slice(0, 300));
      return { algorithm: 'chacha20-poly1305-ietf', keyDerivation: name };
    } catch (e) {
      console.log(`${name}: failed`);
    }
  }
  
  // Try sealed box (anonymous encryption)
  console.log('\n=== Testing Sealed Box ===\n');
  
  for (const { name, key: keyBuf } of keyVariations) {
    try {
      // Generate keypair from seed
      const keypair = sodium.crypto_box_seed_keypair(new Uint8Array(keyBuf));
      console.log(`${name} - Public key:`, Buffer.from(keypair.publicKey).toString('hex').slice(0, 32) + '...');
      
      const decrypted = sodium.crypto_box_seal_open(
        new Uint8Array(encBytes),
        keypair.publicKey,
        keypair.privateKey
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      console.log(`SUCCESS with sealed box (${name})! Decrypted:`, str.slice(0, 300));
      return { algorithm: 'sealed-box', keyDerivation: name };
    } catch (e) {
      console.log(`${name}: failed -`, e.message);
    }
  }
  
  console.log('\nNo algorithm found.');
}

crackHexa().catch(console.error);
