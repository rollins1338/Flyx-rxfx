/**
 * Crack Hexa Encryption v23 - Use @noble/ciphers correctly
 */

const crypto = require('crypto');

async function crackHexa() {
  // Dynamic import for ESM module
  const chacha = await import('@noble/ciphers/chacha.js');
  
  console.log('=== Cracking Hexa Encryption v23 ===\n');
  console.log('Available exports:', Object.keys(chacha));
  
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
  
  const nonce = new Uint8Array(encBytes.subarray(0, 12));
  const ciphertext = new Uint8Array(encBytes.subarray(12));
  
  console.log('Nonce:', Buffer.from(nonce).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Extract keystream for comparison
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  // Try ChaCha20 with @noble/ciphers
  console.log('\n=== ChaCha20 with @noble/ciphers ===\n');
  
  const keyVariants = [
    { name: 'raw', key: new Uint8Array(keyBuf) },
    { name: 'sha256(str)', key: new Uint8Array(crypto.createHash('sha256').update(key).digest()) },
    { name: 'sha256(bytes)', key: new Uint8Array(crypto.createHash('sha256').update(keyBuf).digest()) },
  ];
  
  for (const { name, key: derivedKey } of keyVariants) {
    // Try chacha20
    if (chacha.chacha20) {
      try {
        const decrypted = chacha.chacha20(derivedKey, nonce, ciphertext);
        const str = Buffer.from(decrypted).toString('utf8');
        if (str.startsWith('{') && str.includes('source')) {
          console.log(`*** MATCH: chacha20 + ${name} ***`);
          console.log('Decrypted:', str.slice(0, 300));
          return;
        } else {
          console.log(`chacha20 + ${name}: not valid JSON`);
        }
      } catch (e) {
        console.log(`chacha20 + ${name}: ${e.message}`);
      }
    }
    
    // Try xchacha20
    if (chacha.xchacha20) {
      try {
        // XChaCha20 needs 24-byte nonce
        const nonce24 = new Uint8Array(24);
        nonce24.set(nonce, 0);
        
        const decrypted = chacha.xchacha20(derivedKey, nonce24, ciphertext);
        const str = Buffer.from(decrypted).toString('utf8');
        if (str.startsWith('{') && str.includes('source')) {
          console.log(`*** MATCH: xchacha20 + ${name} ***`);
          console.log('Decrypted:', str.slice(0, 300));
          return;
        }
      } catch (e) {
        console.log(`xchacha20 + ${name}: ${e.message}`);
      }
    }
    
    // Try chacha20poly1305 (but skip the auth tag)
    if (chacha.chacha20poly1305) {
      try {
        // This expects ciphertext + 16-byte tag
        // Our ciphertext doesn't have a tag, so this won't work directly
        // But let's try anyway
        const cipher = chacha.chacha20poly1305(derivedKey, nonce);
        
        // Generate keystream by encrypting zeros
        const zeros = new Uint8Array(ciphertext.length);
        const encrypted = cipher.encrypt(zeros);
        // The encrypted output includes the tag, so take only the ciphertext part
        const generatedKeystream = encrypted.subarray(0, ciphertext.length);
        
        if (Buffer.from(generatedKeystream.subarray(0, 32)).equals(keystream.subarray(0, 32))) {
          console.log(`*** KEYSTREAM MATCH: chacha20poly1305 + ${name} ***`);
          
          // XOR to decrypt
          const decrypted = new Uint8Array(ciphertext.length);
          for (let i = 0; i < ciphertext.length; i++) {
            decrypted[i] = ciphertext[i] ^ generatedKeystream[i];
          }
          console.log('Decrypted:', Buffer.from(decrypted).toString('utf8').slice(0, 300));
          return;
        }
      } catch (e) {
        console.log(`chacha20poly1305 + ${name}: ${e.message}`);
      }
    }
  }
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
