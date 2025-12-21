/**
 * Crack Hexa Encryption v3 - Reverse engineer the decryption algorithm
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
  
  // Decrypt using enc-dec.app to get expected result
  console.log('\nDecrypting via enc-dec.app...');
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  
  const decResult = await decResponse.json();
  const expectedDecrypted = JSON.stringify(decResult.result);
  console.log('Expected decrypted:', expectedDecrypted.slice(0, 300));
  
  // Now try to crack it ourselves
  console.log('\n=== Trying Decryption Algorithms ===\n');
  
  const keyBuf = Buffer.from(key, 'hex');
  const encBytes = Buffer.from(encrypted, 'base64');
  
  console.log('Key bytes:', keyBuf.length);
  console.log('Encrypted bytes:', encBytes.length);
  console.log('First 32 enc bytes:', encBytes.slice(0, 32).toString('hex'));
  console.log('Last 32 enc bytes:', encBytes.slice(-32).toString('hex'));
  
  // Try AES-256-CBC with IV at start
  console.log('\n--- AES-256-CBC (IV at start) ---');
  try {
    const iv = encBytes.slice(0, 16);
    const ciphertext = encBytes.slice(16);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const decStr = decrypted.toString('utf8');
    console.log('Result:', decStr.slice(0, 200));
    
    if (decStr.includes('source') || decStr.includes('server')) {
      console.log('\n*** AES-256-CBC WORKS! ***');
      return { algorithm: 'aes-256-cbc', ivPosition: 'start' };
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try AES-256-GCM with 12-byte nonce at start, 16-byte tag at end
  console.log('\n--- AES-256-GCM (12-byte nonce, tag at end) ---');
  try {
    const nonce = encBytes.slice(0, 12);
    const tag = encBytes.slice(-16);
    const ciphertext = encBytes.slice(12, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const decStr = decrypted.toString('utf8');
    console.log('Result:', decStr.slice(0, 200));
    
    if (decStr.includes('source') || decStr.includes('server')) {
      console.log('\n*** AES-256-GCM WORKS! ***');
      return { algorithm: 'aes-256-gcm', nonceSize: 12 };
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try AES-256-GCM with 16-byte nonce
  console.log('\n--- AES-256-GCM (16-byte nonce, tag at end) ---');
  try {
    const nonce = encBytes.slice(0, 16);
    const tag = encBytes.slice(-16);
    const ciphertext = encBytes.slice(16, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const decStr = decrypted.toString('utf8');
    console.log('Result:', decStr.slice(0, 200));
    
    if (decStr.includes('source') || decStr.includes('server')) {
      console.log('\n*** AES-256-GCM (16-byte nonce) WORKS! ***');
      return { algorithm: 'aes-256-gcm', nonceSize: 16 };
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
    const decStr = decrypted.toString('utf8');
    console.log('Result:', decStr.slice(0, 200));
    
    if (decStr.includes('source') || decStr.includes('server')) {
      console.log('\n*** ChaCha20-Poly1305 WORKS! ***');
      return { algorithm: 'chacha20-poly1305' };
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try AES-256-CTR variations
  console.log('\n--- AES-256-CTR variations ---');
  const ctrConfigs = [
    { name: 'IV at start (16 bytes)', iv: encBytes.slice(0, 16), data: encBytes.slice(16) },
    { name: 'Zero IV', iv: Buffer.alloc(16), data: encBytes },
    { name: 'Key as IV', iv: keyBuf.slice(0, 16), data: encBytes },
  ];
  
  for (const { name, iv, data } of ctrConfigs) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
      const decrypted = decipher.update(data);
      const decStr = decrypted.toString('utf8');
      if (decStr.includes('source') || decStr.includes('server') || decStr.includes('"url"')) {
        console.log(`${name}: SUCCESS!`);
        console.log(`  ${decStr.slice(0, 300)}`);
        return { algorithm: 'aes-256-ctr', ivSource: name };
      }
    } catch (e) {
      console.log(`${name}: Failed - ${e.message}`);
    }
  }
  
  // Try with tag at start instead of end
  console.log('\n--- AES-256-GCM (tag at start) ---');
  try {
    const tag = encBytes.slice(0, 16);
    const nonce = encBytes.slice(16, 28);
    const ciphertext = encBytes.slice(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const decStr = decrypted.toString('utf8');
    console.log('Result:', decStr.slice(0, 200));
    
    if (decStr.includes('source') || decStr.includes('server')) {
      console.log('\n*** AES-256-GCM (tag at start) WORKS! ***');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try different byte orderings
  console.log('\n--- Different byte orderings ---');
  
  // Maybe: tag (16) + nonce (12) + ciphertext
  try {
    const tag = encBytes.slice(0, 16);
    const nonce = encBytes.slice(16, 28);
    const ciphertext = encBytes.slice(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('tag+nonce+cipher:', decrypted.toString('utf8').slice(0, 100));
  } catch (e) {}
  
  // Maybe: nonce (12) + tag (16) + ciphertext
  try {
    const nonce = encBytes.slice(0, 12);
    const tag = encBytes.slice(12, 28);
    const ciphertext = encBytes.slice(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('nonce+tag+cipher:', decrypted.toString('utf8').slice(0, 100));
  } catch (e) {}
  
  console.log('\nNo algorithm found yet. Need more analysis.');
}

crackHexa().catch(console.error);
