/**
 * Crack Hexa Encryption v13 - Try XOR-based decryption with 12-byte overhead
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v13 ===\n');
  
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
  
  // With 12-byte overhead, maybe it's:
  // - 12-byte nonce + ciphertext (no auth tag)
  // - Or some custom format
  
  // Let's try to find the XOR key by comparing known plaintext
  console.log('\n=== XOR Analysis ===');
  
  // If we assume the first 12 bytes are nonce, the rest is XOR'd ciphertext
  const nonce = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Ciphertext length:', ciphertext.length);
  console.log('Expected plaintext length:', expectedBytes.length);
  
  // They should be the same length for XOR
  if (ciphertext.length === expectedBytes.length) {
    console.log('\nLengths match! Extracting XOR keystream...');
    
    const keystream = Buffer.alloc(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      keystream[i] = ciphertext[i] ^ expectedBytes[i];
    }
    
    console.log('First 64 bytes of keystream:', keystream.subarray(0, 64).toString('hex'));
    
    // Check if keystream is derived from key
    const keyBuf = Buffer.from(key, 'hex');
    
    // Check if keystream starts with key repeated
    let matchesRepeatedKey = true;
    for (let i = 0; i < Math.min(32, keystream.length); i++) {
      if (keystream[i] !== keyBuf[i % 32]) {
        matchesRepeatedKey = false;
        break;
      }
    }
    console.log('Keystream matches repeated key:', matchesRepeatedKey);
    
    // Check if keystream is SHA256 chain
    let sha256Chain = keyBuf;
    let matchesSha256Chain = true;
    for (let i = 0; i < Math.min(32, keystream.length); i++) {
      if (keystream[i] !== sha256Chain[i]) {
        matchesSha256Chain = false;
        break;
      }
    }
    console.log('Keystream matches SHA256 of key:', matchesSha256Chain);
    
    // Try to find pattern in keystream
    console.log('\n=== Keystream pattern analysis ===');
    
    // Check if it's AES-CTR output
    // Generate AES-CTR keystream with nonce
    const iv = Buffer.alloc(16);
    nonce.copy(iv, 0);
    
    const aesKeystream = crypto.createCipheriv('aes-256-ctr', keyBuf, iv).update(Buffer.alloc(ciphertext.length));
    
    let aesMatch = true;
    for (let i = 0; i < Math.min(64, keystream.length); i++) {
      if (keystream[i] !== aesKeystream[i]) {
        aesMatch = false;
        break;
      }
    }
    console.log('Keystream matches AES-CTR(key, nonce):', aesMatch);
    
    // Try with SHA256(key) as AES key
    const sha256Key = crypto.createHash('sha256').update(key).digest();
    const aesKeystream2 = crypto.createCipheriv('aes-256-ctr', sha256Key, iv).update(Buffer.alloc(ciphertext.length));
    
    let aesMatch2 = true;
    for (let i = 0; i < Math.min(64, keystream.length); i++) {
      if (keystream[i] !== aesKeystream2[i]) {
        aesMatch2 = false;
        break;
      }
    }
    console.log('Keystream matches AES-CTR(SHA256(key), nonce):', aesMatch2);
    
    // Try with SHA256(key bytes) as AES key
    const sha256Key3 = crypto.createHash('sha256').update(keyBuf).digest();
    const aesKeystream3 = crypto.createCipheriv('aes-256-ctr', sha256Key3, iv).update(Buffer.alloc(ciphertext.length));
    
    let aesMatch3 = true;
    for (let i = 0; i < Math.min(64, keystream.length); i++) {
      if (keystream[i] !== aesKeystream3[i]) {
        aesMatch3 = false;
        break;
      }
    }
    console.log('Keystream matches AES-CTR(SHA256(keyBytes), nonce):', aesMatch3);
    
    // Try ChaCha20
    console.log('\n=== Try ChaCha20 keystream ===');
    
    // ChaCha20 needs 16-byte nonce in Node
    const chachaIv = Buffer.alloc(16);
    nonce.copy(chachaIv, 4); // ChaCha20 counter is first 4 bytes
    
    try {
      const chachaKeystream = crypto.createCipheriv('chacha20', keyBuf, chachaIv).update(Buffer.alloc(ciphertext.length));
      
      let chachaMatch = true;
      for (let i = 0; i < Math.min(64, keystream.length); i++) {
        if (keystream[i] !== chachaKeystream[i]) {
          chachaMatch = false;
          break;
        }
      }
      console.log('Keystream matches ChaCha20(key, nonce):', chachaMatch);
    } catch (e) {
      console.log('ChaCha20 error:', e.message);
    }
    
    // Maybe the nonce is used differently
    console.log('\n=== Try different nonce positions ===');
    
    // Try with nonce at different positions in IV
    for (let offset = 0; offset <= 4; offset++) {
      const testIv = Buffer.alloc(16);
      nonce.copy(testIv, offset);
      
      try {
        const testKeystream = crypto.createCipheriv('aes-256-ctr', keyBuf, testIv).update(Buffer.alloc(ciphertext.length));
        
        let matches = true;
        for (let i = 0; i < Math.min(32, keystream.length); i++) {
          if (keystream[i] !== testKeystream[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          console.log(`AES-CTR matches with nonce at offset ${offset}!`);
        }
      } catch (e) {}
    }
  }
  
  console.log('\nAnalysis complete.');
}

crackHexa().catch(console.error);
