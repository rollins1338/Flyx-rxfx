/**
 * Crack Hexa Encryption v19 - Try tweetnacl secretbox directly
 */

const crypto = require('crypto');
const nacl = require('tweetnacl');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v19 ===\n');
  
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
  
  // The overhead is 12 bytes, but tweetnacl secretbox uses 24-byte nonce + 16-byte tag = 40 bytes overhead
  // So it's NOT standard secretbox
  
  // Maybe it's using tweetnacl.secretbox but with a different format?
  // Or maybe the "nonce" is actually something else
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Let's try to understand the structure better
  // If overhead is 12, and we know the plaintext, we can figure out what those 12 bytes are
  
  console.log('\n=== Structure analysis ===');
  console.log('First 12 bytes:', encBytes.subarray(0, 12).toString('hex'));
  console.log('Bytes 12-24:', encBytes.subarray(12, 24).toString('hex'));
  console.log('Last 16 bytes:', encBytes.subarray(-16).toString('hex'));
  
  // Maybe it's: 12-byte nonce + ciphertext (XOR only, no auth tag)
  // This would be a simple stream cipher
  
  const nonce12 = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('\nKeystream analysis:');
  console.log('First 32 bytes:', keystream.subarray(0, 32).toString('hex'));
  
  // Try to generate this keystream using various methods
  console.log('\n=== Trying to match keystream ===\n');
  
  // Method 1: XSalsa20 stream (not secretbox, just the stream cipher)
  // tweetnacl doesn't expose the raw stream, but we can try
  
  // Method 2: Use nacl.secretbox.open with a fake ciphertext to extract keystream
  // This won't work because secretbox includes authentication
  
  // Method 3: Try to find a pattern in the keystream
  
  // Let's check if the keystream is related to the key in any way
  console.log('Key bytes:', keyBuf.toString('hex'));
  console.log('SHA256(key):', crypto.createHash('sha256').update(keyBuf).digest().toString('hex'));
  
  // Check if keystream XOR key gives something meaningful
  const xorWithKey = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorWithKey[i] = keystream[i] ^ keyBuf[i];
  }
  console.log('Keystream XOR key:', xorWithKey.toString('hex'));
  
  // Maybe the encryption is using a simple XOR with a derived keystream
  // Let's try to find the derivation
  
  // Try: keystream = AES-CTR(key, nonce) but with nonce used differently
  console.log('\n=== Try AES-CTR with various IV constructions ===');
  
  // Standard: IV = nonce || counter
  // But maybe: IV = hash(nonce) or IV = hash(key || nonce)
  
  const ivDerivations = [
    { name: 'nonce+zeros', iv: Buffer.concat([nonce12, Buffer.alloc(4)]) },
    { name: 'zeros+nonce', iv: Buffer.concat([Buffer.alloc(4), nonce12]) },
    { name: 'sha256(nonce)[:16]', iv: crypto.createHash('sha256').update(nonce12).digest().subarray(0, 16) },
    { name: 'sha256(key+nonce)[:16]', iv: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce12])).digest().subarray(0, 16) },
    { name: 'sha256(nonce+key)[:16]', iv: crypto.createHash('sha256').update(Buffer.concat([nonce12, keyBuf])).digest().subarray(0, 16) },
    { name: 'md5(nonce)', iv: crypto.createHash('md5').update(nonce12).digest() },
    { name: 'md5(key+nonce)', iv: crypto.createHash('md5').update(Buffer.concat([keyBuf, nonce12])).digest() },
  ];
  
  const keyDerivations = [
    { name: 'raw', key: keyBuf },
    { name: 'sha256(keyStr)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() },
  ];
  
  for (const { name: ivName, iv } of ivDerivations) {
    for (const { name: keyName, key: derivedKey } of keyDerivations) {
      try {
        const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv).update(Buffer.alloc(ciphertext.length));
        
        if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: AES-CTR + ${keyName} + ${ivName} ***`);
          
          // Verify full decryption
          const decrypted = Buffer.alloc(ciphertext.length);
          for (let i = 0; i < ciphertext.length; i++) {
            decrypted[i] = ciphertext[i] ^ testKeystream[i];
          }
          console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
          
          // Return the algorithm details
          return {
            algorithm: 'aes-256-ctr',
            keyDerivation: keyName,
            ivDerivation: ivName,
          };
        }
      } catch (e) {}
    }
  }
  
  // Try with HKDF-derived key
  console.log('\n=== Try HKDF key derivation ===');
  
  try {
    const hkdfKey = Buffer.from(crypto.hkdfSync('sha256', keyBuf, nonce12, '', 32));
    const iv = Buffer.alloc(16);
    
    const testKeystream = crypto.createCipheriv('aes-256-ctr', hkdfKey, iv).update(Buffer.alloc(ciphertext.length));
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log('*** MATCH: AES-CTR + HKDF(key, nonce) ***');
      return;
    }
  } catch (e) {}
  
  // Try HMAC-based key derivation
  console.log('\n=== Try HMAC key derivation ===');
  
  const hmacKeys = [
    { name: 'hmac(key, nonce)', key: crypto.createHmac('sha256', keyBuf).update(nonce12).digest() },
    { name: 'hmac(nonce, key)', key: crypto.createHmac('sha256', nonce12).update(keyBuf).digest() },
    { name: 'hmac(keyStr, nonce)', key: crypto.createHmac('sha256', key).update(nonce12).digest() },
  ];
  
  for (const { name, key: derivedKey } of hmacKeys) {
    const iv = Buffer.alloc(16);
    
    try {
      const testKeystream = crypto.createCipheriv('aes-256-ctr', derivedKey, iv).update(Buffer.alloc(ciphertext.length));
      
      if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: AES-CTR + ${name} ***`);
        return;
      }
    } catch (e) {}
  }
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
