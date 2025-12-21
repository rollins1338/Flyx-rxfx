/**
 * Crack Hexa Encryption v2 - Reverse engineer the decryption algorithm
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption ===\n');
  
  // Generate a known key
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  // Fetch encrypted data
  const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
  console.log('Fetching:', url);
  
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  console.log('Encrypted length:', encrypted.length);
  console.log('Encrypted:', encrypted.slice(0, 100));
  
  // Decrypt using enc-dec.app to get expected result
  console.log('\nDecrypting via enc-dec.app...');
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  
  const decResult = await decResponse.json();
  console.log('Dec API response:', JSON.stringify(decResult).slice(0, 200));
  
  const expectedDecrypted = decResult.result;
  console.log('Expected decrypted:', expectedDecrypted?.slice(0, 200));
  
  // Now try to crack it ourselves
  console.log('\n=== Trying Decryption Algorithms ===\n');
  
  const keyBuf = Buffer.from(key, 'hex');
  const encBytes = Buffer.from(encrypted, 'base64');
  
  console.log('Key bytes:', keyBuf.length);
  console.log('Encrypted bytes:', encBytes.length);
  console.log('First 32 enc bytes:', encBytes.slice(0, 32).toString('hex'));
  
  // Common patterns:
  // 1. IV (16 bytes) + ciphertext
  // 2. Nonce (12 bytes) + ciphertext + tag (16 bytes)
  // 3. Salt + IV + ciphertext
  
  // Try AES-256-CBC with IV at start
  console.log('\n--- AES-256-CBC ---');
  try {
    const iv = encBytes.slice(0, 16);
    const ciphertext = encBytes.slice(16);
    console.log('IV:', iv.toString('hex'));
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
    
    if (expectedDecrypted && decrypted.toString('utf8').includes('source')) {
      console.log('\n*** AES-256-CBC WORKS! ***');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try AES-256-GCM with nonce at start, tag at end
  console.log('\n--- AES-256-GCM (12-byte nonce, 16-byte tag) ---');
  try {
    const nonce = encBytes.slice(0, 12);
    const tag = encBytes.slice(-16);
    const ciphertext = encBytes.slice(12, -16);
    console.log('Nonce:', nonce.toString('hex'));
    console.log('Tag:', tag.toString('hex'));
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
    
    if (decrypted.toString('utf8').includes('source')) {
      console.log('\n*** AES-256-GCM WORKS! ***');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try AES-256-GCM with 16-byte nonce
  console.log('\n--- AES-256-GCM (16-byte nonce, 16-byte tag) ---');
  try {
    const nonce = encBytes.slice(0, 16);
    const tag = encBytes.slice(-16);
    const ciphertext = encBytes.slice(16, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
    
    if (decrypted.toString('utf8').includes('source')) {
      console.log('\n*** AES-256-GCM (16-byte nonce) WORKS! ***');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try ChaCha20-Poly1305
  console.log('\n--- ChaCha20-Poly1305 ---');
  try {
    const nonce = encBytes.slice(0, 12);
    const tag = encBytes.slice(-16);
    const ciphertext = encBytes.slice(12, -16);
    
    const decipher = crypto.createDecipheriv('chacha20-poly1305', keyBuf, nonce, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
    
    if (decrypted.toString('utf8').includes('source')) {
      console.log('\n*** ChaCha20-Poly1305 WORKS! ***');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try XChaCha20-Poly1305 (24-byte nonce)
  console.log('\n--- XChaCha20-Poly1305 (if available) ---');
  try {
    const nonce = encBytes.slice(0, 24);
    const tag = encBytes.slice(-16);
    const ciphertext = encBytes.slice(24, -16);
    
    // Node.js doesn't have xchacha20-poly1305 built-in
    console.log('Not available in Node.js crypto');
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try simple XOR with key
  console.log('\n--- Simple XOR ---');
  try {
    const decrypted = Buffer.alloc(encBytes.length);
    for (let i = 0; i < encBytes.length; i++) {
      decrypted[i] = encBytes[i] ^ keyBuf[i % keyBuf.length];
    }
    const decStr = decrypted.toString('utf8');
    if (decStr.includes('source') || decStr.includes('{')) {
      console.log('Decrypted:', decStr.slice(0, 200));
      console.log('\n*** Simple XOR WORKS! ***');
    } else {
      console.log('Not valid output');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try AES-256-CTR with different IV positions
  console.log('\n--- AES-256-CTR variations ---');
  const ctrConfigs = [
    { name: 'IV at start (16 bytes)', iv: encBytes.slice(0, 16), data: encBytes.slice(16) },
    { name: 'IV at end (16 bytes)', iv: encBytes.slice(-16), data: encBytes.slice(0, -16) },
    { name: 'Zero IV', iv: Buffer.alloc(16), data: encBytes },
    { name: 'Key as IV', iv: keyBuf.slice(0, 16), data: encBytes },
  ];
  
  for (const { name, iv, data } of ctrConfigs) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
      const decrypted = decipher.update(data);
      const decStr = decrypted.toString('utf8');
      if (decStr.includes('source') || decStr.includes('url') || decStr.includes('"server"')) {
        console.log(`${name}: SUCCESS!`);
        console.log(`  ${decStr.slice(0, 300)}`);
      }
    } catch (e) {
      console.log(`${name}: Failed - ${e.message}`);
    }
  }
}

crackHexa().catch(console.error);
