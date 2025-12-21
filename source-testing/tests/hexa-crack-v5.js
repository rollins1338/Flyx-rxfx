/**
 * Crack Hexa Encryption v5 - Try NaCl secretbox and other algorithms
 */

const crypto = require('crypto');
const nacl = require('tweetnacl');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v5 ===\n');
  
  // Generate a known key
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key (hex):', key);
  
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
  
  console.log('Encrypted base64 length:', encrypted.length);
  
  // Decrypt using enc-dec.app to get expected result
  console.log('\nDecrypting via enc-dec.app...');
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  
  const decResult = await decResponse.json();
  const expectedDecrypted = JSON.stringify(decResult.result);
  console.log('Expected decrypted:', expectedDecrypted.slice(0, 150));
  
  const keyBuf = Buffer.from(key, 'hex');
  const encBytes = Buffer.from(encrypted, 'base64');
  
  console.log('\n=== Data Analysis ===');
  console.log('Key bytes:', keyBuf.length);
  console.log('Encrypted bytes:', encBytes.length);
  
  // Try NaCl secretbox (XSalsa20-Poly1305) - 24-byte nonce
  console.log('\n--- NaCl secretbox (XSalsa20-Poly1305) ---');
  
  // Format: nonce (24) + ciphertext+tag
  try {
    const nonce = encBytes.subarray(0, 24);
    const ciphertext = encBytes.subarray(24);
    
    console.log('Nonce (24 bytes):', nonce.toString('hex'));
    console.log('Ciphertext length:', ciphertext.length);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(keyBuf)
    );
    
    if (decrypted) {
      const decStr = Buffer.from(decrypted).toString('utf8');
      console.log('SUCCESS! Decrypted:', decStr.slice(0, 300));
      return { algorithm: 'nacl-secretbox', noncePosition: 'start' };
    } else {
      console.log('Failed: Authentication failed');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try with nonce at end
  console.log('\n--- NaCl secretbox (nonce at end) ---');
  try {
    const nonce = encBytes.subarray(-24);
    const ciphertext = encBytes.subarray(0, -24);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(keyBuf)
    );
    
    if (decrypted) {
      const decStr = Buffer.from(decrypted).toString('utf8');
      console.log('SUCCESS! Decrypted:', decStr.slice(0, 300));
      return { algorithm: 'nacl-secretbox', noncePosition: 'end' };
    } else {
      console.log('Failed: Authentication failed');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try with derived key (SHA256 of hex string)
  console.log('\n--- NaCl secretbox with SHA256(key) ---');
  try {
    const derivedKey = crypto.createHash('sha256').update(key).digest();
    const nonce = encBytes.subarray(0, 24);
    const ciphertext = encBytes.subarray(24);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(derivedKey)
    );
    
    if (decrypted) {
      const decStr = Buffer.from(decrypted).toString('utf8');
      console.log('SUCCESS! Decrypted:', decStr.slice(0, 300));
      return { algorithm: 'nacl-secretbox', keyDerivation: 'sha256' };
    } else {
      console.log('Failed: Authentication failed');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try NaCl box (public key crypto) - unlikely but check
  console.log('\n--- Checking if it might be NaCl box ---');
  // Box uses 24-byte nonce + 16-byte overhead
  console.log('If box: overhead = 16, so plaintext would be', encBytes.length - 24 - 16);
  
  // Try different nonce sizes
  console.log('\n--- Try different nonce/tag configurations ---');
  
  const configs = [
    { nonceSize: 24, tagSize: 16, name: 'nonce24+tag16' },
    { nonceSize: 12, tagSize: 16, name: 'nonce12+tag16' },
    { nonceSize: 16, tagSize: 16, name: 'nonce16+tag16' },
    { nonceSize: 8, tagSize: 16, name: 'nonce8+tag16' },
  ];
  
  for (const { nonceSize, tagSize, name } of configs) {
    // Try: nonce + ciphertext + tag
    try {
      const nonce = encBytes.subarray(0, nonceSize);
      const tag = encBytes.subarray(-tagSize);
      const ciphertext = encBytes.subarray(nonceSize, -tagSize);
      
      // Try AES-GCM with this config
      if (nonceSize <= 16) {
        const paddedNonce = Buffer.alloc(12);
        nonce.copy(paddedNonce, 0, 0, Math.min(nonceSize, 12));
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, paddedNonce);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        const decStr = decrypted.toString('utf8');
        if (decStr.includes('source')) {
          console.log(`${name} AES-GCM: SUCCESS!`);
          console.log(decStr.slice(0, 200));
        }
      }
    } catch (e) {
      // Silent fail
    }
    
    // Try: tag + nonce + ciphertext
    try {
      const tag = encBytes.subarray(0, tagSize);
      const nonce = encBytes.subarray(tagSize, tagSize + nonceSize);
      const ciphertext = encBytes.subarray(tagSize + nonceSize);
      
      if (nonceSize <= 16) {
        const paddedNonce = Buffer.alloc(12);
        nonce.copy(paddedNonce, 0, 0, Math.min(nonceSize, 12));
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, paddedNonce);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        const decStr = decrypted.toString('utf8');
        if (decStr.includes('source')) {
          console.log(`${name} (tag first) AES-GCM: SUCCESS!`);
          console.log(decStr.slice(0, 200));
        }
      }
    } catch (e) {
      // Silent fail
    }
  }
  
  // Try with key as UTF-8 bytes instead of hex-decoded
  console.log('\n--- Try key as UTF-8 string (64 bytes) ---');
  try {
    const keyUtf8 = Buffer.from(key, 'utf8'); // 64 bytes
    const keyTrunc = keyUtf8.subarray(0, 32); // First 32 bytes
    
    const nonce = encBytes.subarray(0, 24);
    const ciphertext = encBytes.subarray(24);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(keyTrunc)
    );
    
    if (decrypted) {
      const decStr = Buffer.from(decrypted).toString('utf8');
      console.log('SUCCESS with UTF-8 key! Decrypted:', decStr.slice(0, 300));
    } else {
      console.log('Failed: Authentication failed');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try SHA256 of UTF-8 key
  console.log('\n--- Try SHA256(key as UTF-8) ---');
  try {
    const keyUtf8 = Buffer.from(key, 'utf8');
    const derivedKey = crypto.createHash('sha256').update(keyUtf8).digest();
    
    const nonce = encBytes.subarray(0, 24);
    const ciphertext = encBytes.subarray(24);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(derivedKey)
    );
    
    if (decrypted) {
      const decStr = Buffer.from(decrypted).toString('utf8');
      console.log('SUCCESS! Decrypted:', decStr.slice(0, 300));
    } else {
      console.log('Failed: Authentication failed');
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  console.log('\nNo algorithm found yet. Need more analysis.');
}

crackHexa().catch(console.error);
