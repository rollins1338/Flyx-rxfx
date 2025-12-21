/**
 * Crack Hexa Encryption v34 - Brute force key derivation patterns
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v34 ===\n');
  
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const keyBuf = Buffer.from(key, 'hex');
  const keyStr = Buffer.from(key, 'utf8');
  
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
  
  const actualKeystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    actualKeystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:32]:', actualKeystream.subarray(0, 32).toString('hex'));
  
  // Generate all possible key derivations
  const keyDerivations = [];
  
  // Basic keys
  keyDerivations.push({ name: 'keyBuf', key: keyBuf });
  keyDerivations.push({ name: 'keyStr[:32]', key: keyStr.subarray(0, 32) });
  
  // SHA256 variants
  keyDerivations.push({ name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() });
  keyDerivations.push({ name: 'sha256(keyStr)', key: crypto.createHash('sha256').update(keyStr).digest() });
  keyDerivations.push({ name: 'sha256(key)', key: crypto.createHash('sha256').update(key).digest() });
  
  // With nonce
  keyDerivations.push({ name: 'sha256(keyBuf||nonce)', key: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest() });
  keyDerivations.push({ name: 'sha256(nonce||keyBuf)', key: crypto.createHash('sha256').update(Buffer.concat([nonce, keyBuf])).digest() });
  keyDerivations.push({ name: 'sha256(keyStr||nonce)', key: crypto.createHash('sha256').update(Buffer.concat([keyStr, nonce])).digest() });
  
  // HMAC variants
  keyDerivations.push({ name: 'hmac(keyBuf,nonce)', key: crypto.createHmac('sha256', keyBuf).update(nonce).digest() });
  keyDerivations.push({ name: 'hmac(nonce,keyBuf)', key: crypto.createHmac('sha256', nonce).update(keyBuf).digest() });
  keyDerivations.push({ name: 'hmac(keyStr,nonce)', key: crypto.createHmac('sha256', keyStr).update(nonce).digest() });
  
  // XOR variants
  const nonceRepeated = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) nonceRepeated[i] = nonce[i % 12];
  keyDerivations.push({ name: 'keyBuf^nonce', key: xorBuffers(keyBuf, nonceRepeated) });
  
  // Double hash
  keyDerivations.push({ name: 'sha256(sha256(keyBuf))', key: crypto.createHash('sha256').update(crypto.createHash('sha256').update(keyBuf).digest()).digest() });
  
  // HKDF
  try {
    keyDerivations.push({ name: 'hkdf(keyBuf,nonce)', key: Buffer.from(crypto.hkdfSync('sha256', keyBuf, nonce, '', 32)) });
    keyDerivations.push({ name: 'hkdf(keyBuf,"",nonce)', key: Buffer.from(crypto.hkdfSync('sha256', keyBuf, '', nonce, 32)) });
  } catch (e) {}
  
  // Generate all possible IV derivations
  const ivDerivations = [];
  
  ivDerivations.push({ name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) });
  ivDerivations.push({ name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) });
  ivDerivations.push({ name: 'nonce||0001', iv: Buffer.concat([nonce, Buffer.from([0,0,0,1])]) });
  ivDerivations.push({ name: '0001||nonce', iv: Buffer.concat([Buffer.from([0,0,0,1]), nonce]) });
  ivDerivations.push({ name: 'sha256(nonce)[:16]', iv: crypto.createHash('sha256').update(nonce).digest().subarray(0, 16) });
  ivDerivations.push({ name: 'md5(nonce)', iv: crypto.createHash('md5').update(nonce).digest() });
  ivDerivations.push({ name: 'md5(keyBuf||nonce)', iv: crypto.createHash('md5').update(Buffer.concat([keyBuf, nonce])).digest() });
  ivDerivations.push({ name: 'zeros', iv: Buffer.alloc(16) });
  ivDerivations.push({ name: 'sha256(keyBuf)[:16]', iv: crypto.createHash('sha256').update(keyBuf).digest().subarray(0, 16) });
  
  console.log(`\nTesting ${keyDerivations.length} key derivations x ${ivDerivations.length} IV derivations = ${keyDerivations.length * ivDerivations.length} combinations\n`);
  
  // Test all combinations
  for (const { name: keyName, key: derivedKey } of keyDerivations) {
    for (const { name: ivName, iv } of ivDerivations) {
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
        const testKeystream = cipher.update(Buffer.alloc(ciphertext.length));
        
        if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
          console.log(`*** MATCH: AES-256-CTR + ${keyName} + ${ivName} ***`);
          
          // Verify full decryption
          const decrypted = Buffer.alloc(ciphertext.length);
          for (let i = 0; i < ciphertext.length; i++) {
            decrypted[i] = ciphertext[i] ^ testKeystream[i];
          }
          console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
          return { keyDerivation: keyName, ivDerivation: ivName };
        }
      } catch (e) {}
    }
  }
  
  // Try ChaCha20 with all key derivations
  console.log('\n=== ChaCha20 Combinations ===\n');
  
  for (const { name: keyName, key: derivedKey } of keyDerivations) {
    // ChaCha20 needs 16-byte IV (4-byte counter + 12-byte nonce)
    const ivs = [
      { name: '0||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
      { name: '1||nonce', iv: Buffer.concat([Buffer.from([1,0,0,0]), nonce]) },
      { name: 'nonce||0', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
    ];
    
    for (const { name: ivName, iv } of ivs) {
      try {
        const cipher = crypto.createCipheriv('chacha20', derivedKey, iv);
        const testKeystream = cipher.update(Buffer.alloc(ciphertext.length));
        
        if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
          console.log(`*** MATCH: ChaCha20 + ${keyName} + ${ivName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  
  console.log('No match found.');
}

function xorBuffers(a, b) {
  const result = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i % b.length];
  }
  return result;
}

crackHexa().catch(console.error);
