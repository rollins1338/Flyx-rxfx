/**
 * Crack Hexa Encryption v22 - Use @noble/ciphers for ChaCha20
 */

const crypto = require('crypto');

async function crackHexa() {
  // Dynamic import for ESM module
  const { chacha20 } = await import('@noble/ciphers/chacha.js');
  
  console.log('=== Cracking Hexa Encryption v22 ===\n');
  
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
  
  const nonce = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  console.log('Nonce:', nonce.toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Try ChaCha20 with @noble/ciphers
  console.log('\n=== ChaCha20 with @noble/ciphers ===\n');
  
  const keyVariants = [
    { name: 'raw', key: new Uint8Array(keyBuf) },
    { name: 'sha256(str)', key: new Uint8Array(crypto.createHash('sha256').update(key).digest()) },
    { name: 'sha256(bytes)', key: new Uint8Array(crypto.createHash('sha256').update(keyBuf).digest()) },
  ];
  
  for (const { name, key: derivedKey } of keyVariants) {
    try {
      // ChaCha20 with 12-byte nonce (IETF variant)
      const cipher = chacha20(derivedKey, new Uint8Array(nonce));
      const decrypted = cipher.decrypt(new Uint8Array(ciphertext));
      
      const str = Buffer.from(decrypted).toString('utf8');
      if (str.startsWith('{') && str.includes('source')) {
        console.log(`*** MATCH: ChaCha20 + ${name} ***`);
        console.log('Decrypted:', str.slice(0, 300));
        return { algorithm: 'chacha20', keyDerivation: name };
      } else {
        console.log(`${name}: decrypted but not valid JSON`);
        console.log('  First 50 chars:', str.slice(0, 50));
      }
    } catch (e) {
      console.log(`${name}: ${e.message}`);
    }
  }
  
  // Try with different counter values
  console.log('\n=== Try different counter values ===\n');
  
  for (const { name, key: derivedKey } of keyVariants) {
    for (let counter = 0; counter <= 2; counter++) {
      try {
        const cipher = chacha20(derivedKey, new Uint8Array(nonce), counter);
        const decrypted = cipher.decrypt(new Uint8Array(ciphertext));
        
        const str = Buffer.from(decrypted).toString('utf8');
        if (str.startsWith('{') && str.includes('source')) {
          console.log(`*** MATCH: ChaCha20 + ${name} + counter=${counter} ***`);
          console.log('Decrypted:', str.slice(0, 300));
          return;
        }
      } catch (e) {}
    }
  }
  
  // Extract keystream for analysis
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('\n=== Keystream analysis ===');
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  // Generate ChaCha20 keystream and compare
  for (const { name, key: derivedKey } of keyVariants) {
    try {
      const cipher = chacha20(derivedKey, new Uint8Array(nonce));
      const zeros = new Uint8Array(ciphertext.length);
      const generatedKeystream = cipher.encrypt(zeros);
      
      // Compare first 32 bytes
      const matches = Buffer.from(generatedKeystream.subarray(0, 32)).equals(keystream.subarray(0, 32));
      console.log(`${name} keystream match: ${matches}`);
      
      if (!matches) {
        console.log(`  Generated: ${Buffer.from(generatedKeystream.subarray(0, 32)).toString('hex')}`);
      }
    } catch (e) {
      console.log(`${name}: ${e.message}`);
    }
  }
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
