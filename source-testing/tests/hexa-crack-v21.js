/**
 * Crack Hexa Encryption v21 - Try Rust crypto patterns
 */

const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');

async function crackHexa() {
  await _sodium.ready;
  const sodium = _sodium;
  
  console.log('=== Cracking Hexa Encryption v21 ===\n');
  
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
  console.log('Overhead:', encBytes.length - expectedBytes.length);
  
  // With 12-byte overhead, the structure is likely:
  // nonce (12 bytes) + ciphertext (same length as plaintext)
  // This means NO authentication tag - just a stream cipher
  
  const nonce = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:64]:', keystream.subarray(0, 64).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // In Rust, common crypto libraries include:
  // - ring (uses BoringSSL)
  // - rust-crypto
  // - sodiumoxide (libsodium bindings)
  // - chacha20 crate
  // - aes-gcm crate
  
  // The chacha20 crate in Rust uses the IETF variant with 12-byte nonce
  // Let's try ChaCha20 stream cipher (without Poly1305)
  
  console.log('\n=== Try ChaCha20 stream (no auth) ===\n');
  
  // Generate ChaCha20 keystream using libsodium
  // crypto_stream_chacha20_ietf generates keystream
  
  const keyVariants = [
    { name: 'raw', key: keyBuf },
    { name: 'sha256(str)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(bytes)', key: crypto.createHash('sha256').update(keyBuf).digest() },
  ];
  
  // Check available sodium functions
  console.log('Available sodium stream functions:');
  const streamFuncs = Object.keys(sodium).filter(k => k.includes('stream'));
  console.log(streamFuncs.join(', '));
  
  // Try each key variant with ChaCha20 stream
  for (const { name, key: derivedKey } of keyVariants) {
    // Try using crypto_stream_chacha20_ietf_xor which XORs with keystream
    try {
      // First, let's try to decrypt directly
      const decrypted = sodium.crypto_stream_chacha20_ietf_xor(
        new Uint8Array(ciphertext),
        new Uint8Array(nonce),
        new Uint8Array(derivedKey)
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      if (str.startsWith('{') && str.includes('source')) {
        console.log(`*** MATCH: ChaCha20-IETF stream + ${name} ***`);
        console.log('Decrypted:', str.slice(0, 200));
        return { algorithm: 'chacha20-ietf-stream', keyDerivation: name };
      }
    } catch (e) {
      console.log(`${name}: ${e.message}`);
    }
  }
  
  // Try XSalsa20 stream (24-byte nonce, but we only have 12)
  console.log('\n=== Try XSalsa20 with padded nonce ===\n');
  
  for (const { name, key: derivedKey } of keyVariants) {
    // Pad nonce to 24 bytes
    const nonce24 = Buffer.alloc(24);
    nonce.copy(nonce24, 0);
    
    try {
      const decrypted = sodium.crypto_stream_xsalsa20_xor(
        new Uint8Array(ciphertext),
        new Uint8Array(nonce24),
        new Uint8Array(derivedKey)
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      if (str.startsWith('{') && str.includes('source')) {
        console.log(`*** MATCH: XSalsa20 stream + ${name} ***`);
        console.log('Decrypted:', str.slice(0, 200));
        return;
      }
    } catch (e) {
      console.log(`${name}: ${e.message}`);
    }
  }
  
  // Try Salsa20 (8-byte nonce)
  console.log('\n=== Try Salsa20 with 8-byte nonce ===\n');
  
  for (const { name, key: derivedKey } of keyVariants) {
    const nonce8 = nonce.subarray(0, 8);
    
    try {
      const decrypted = sodium.crypto_stream_salsa20_xor(
        new Uint8Array(ciphertext),
        new Uint8Array(nonce8),
        new Uint8Array(derivedKey)
      );
      
      const str = Buffer.from(decrypted).toString('utf8');
      if (str.startsWith('{') && str.includes('source')) {
        console.log(`*** MATCH: Salsa20 stream + ${name} ***`);
        console.log('Decrypted:', str.slice(0, 200));
        return;
      }
    } catch (e) {
      console.log(`${name}: ${e.message}`);
    }
  }
  
  // Maybe the key is used as-is (the hex string, not decoded)
  console.log('\n=== Try with key as hex string (UTF-8 bytes) ===\n');
  
  const keyUtf8 = Buffer.from(key, 'utf8'); // 64 bytes
  const keyFirst32Utf8 = keyUtf8.subarray(0, 32);
  
  try {
    const decrypted = sodium.crypto_stream_chacha20_ietf_xor(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(keyFirst32Utf8)
    );
    
    const str = Buffer.from(decrypted).toString('utf8');
    if (str.startsWith('{') && str.includes('source')) {
      console.log('*** MATCH: ChaCha20-IETF + keyUtf8First32 ***');
      console.log('Decrypted:', str.slice(0, 200));
      return;
    }
  } catch (e) {
    console.log('keyUtf8First32:', e.message);
  }
  
  console.log('\nNo match found.');
  
  // Print debug info
  console.log('\n=== Debug ===');
  console.log('Key (hex string):', key);
  console.log('Key (decoded bytes):', keyBuf.toString('hex'));
  console.log('Key (UTF-8 first 32):', keyFirst32Utf8.toString('hex'));
}

crackHexa().catch(console.error);
