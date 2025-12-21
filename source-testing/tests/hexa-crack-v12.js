/**
 * Crack Hexa Encryption v12 - Analyze the actual decrypted content size
 */

const crypto = require('crypto');
const _sodium = require('libsodium-wrappers');

async function crackHexa() {
  await _sodium.ready;
  const sodium = _sodium;
  
  console.log('=== Cracking Hexa Encryption v12 ===\n');
  
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
  
  // The result is an object, not a string
  console.log('Result type:', typeof decResult.result);
  console.log('Result keys:', Object.keys(decResult.result));
  
  // Get the actual decrypted string (before JSON parsing)
  const expectedObj = decResult.result;
  const expectedStr = JSON.stringify(expectedObj);
  
  console.log('Expected as JSON string:', expectedStr.slice(0, 150));
  console.log('Expected JSON string length:', expectedStr.length);
  
  // The actual decrypted bytes would be the JSON string
  const expectedBytes = Buffer.from(expectedStr, 'utf8');
  console.log('Expected bytes:', expectedBytes.length);
  
  const encBytes = Buffer.from(encrypted, 'base64');
  console.log('\nEncrypted bytes:', encBytes.length);
  
  // Calculate overhead
  const overhead = encBytes.length - expectedBytes.length;
  console.log('Overhead:', overhead, 'bytes');
  
  // Common overheads:
  // - XSalsa20-Poly1305: 24 (nonce) + 16 (tag) = 40
  // - XChaCha20-Poly1305: 24 (nonce) + 16 (tag) = 40
  // - ChaCha20-Poly1305: 12 (nonce) + 16 (tag) = 28
  // - AES-GCM: 12 (nonce) + 16 (tag) = 28
  // - AES-CBC: 16 (IV) + padding (1-16) = 17-32
  
  console.log('\nPossible algorithms based on overhead:');
  if (overhead === 40) console.log('  - XSalsa20-Poly1305 or XChaCha20-Poly1305');
  if (overhead === 28) console.log('  - ChaCha20-Poly1305 or AES-GCM');
  if (overhead >= 17 && overhead <= 32) console.log('  - AES-CBC with PKCS7 padding');
  if (overhead === 16) console.log('  - AES-CTR with IV or just tag');
  
  // But wait - the decrypted result might not be exactly the JSON string
  // Let me check if there's any transformation
  
  console.log('\n=== Checking if decrypted content differs ===');
  
  // Maybe the decrypted content is minified JSON?
  const minified = JSON.stringify(expectedObj);
  console.log('Minified JSON length:', minified.length);
  
  // Or maybe it has extra whitespace?
  const pretty = JSON.stringify(expectedObj, null, 2);
  console.log('Pretty JSON length:', pretty.length);
  
  // Calculate what the plaintext size should be for each algorithm
  console.log('\n=== Expected plaintext sizes ===');
  console.log('If nonce=24, tag=16:', encBytes.length - 40);
  console.log('If nonce=12, tag=16:', encBytes.length - 28);
  console.log('If nonce=16, tag=16:', encBytes.length - 32);
  console.log('If IV=16 only:', encBytes.length - 16);
  
  // The minified JSON is 1306 bytes, encrypted is 1318 bytes
  // 1318 - 1306 = 12 bytes overhead
  // This could be just a 12-byte nonce with no auth tag (stream cipher)
  
  console.log('\n=== Overhead is only 12 bytes! ===');
  console.log('This suggests a stream cipher with 12-byte nonce and NO auth tag');
  console.log('Trying AES-CTR and ChaCha20 without auth...\n');
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Try AES-256-CTR with 12-byte nonce (padded to 16)
  console.log('--- AES-256-CTR ---');
  try {
    const nonce = encBytes.subarray(0, 12);
    const ciphertext = encBytes.subarray(12);
    
    // Pad nonce to 16 bytes for CTR
    const iv = Buffer.alloc(16);
    nonce.copy(iv, 0);
    
    const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
    const decrypted = decipher.update(ciphertext);
    const str = decrypted.toString('utf8');
    
    if (str.startsWith('{') && str.includes('source')) {
      console.log('SUCCESS with AES-256-CTR!');
      console.log(str.slice(0, 300));
      return;
    } else {
      console.log('Result:', str.slice(0, 100));
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try with different key derivations
  const keyDerivations = [
    { name: 'raw', key: keyBuf },
    { name: 'sha256(hex-string)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(hex-bytes)', key: crypto.createHash('sha256').update(keyBuf).digest() },
  ];
  
  for (const { name, key: derivedKey } of keyDerivations) {
    // AES-CTR with 12-byte nonce
    try {
      const nonce = encBytes.subarray(0, 12);
      const ciphertext = encBytes.subarray(12);
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      
      const decipher = crypto.createDecipheriv('aes-256-ctr', derivedKey, iv);
      const decrypted = decipher.update(ciphertext);
      const str = decrypted.toString('utf8');
      
      if (str.startsWith('{') && str.includes('source')) {
        console.log(`SUCCESS with AES-256-CTR + ${name}!`);
        console.log(str.slice(0, 300));
        return;
      }
    } catch (e) {}
    
    // AES-CTR with 16-byte nonce
    try {
      const iv = encBytes.subarray(0, 16);
      const ciphertext = encBytes.subarray(16);
      
      const decipher = crypto.createDecipheriv('aes-256-ctr', derivedKey, iv);
      const decrypted = decipher.update(ciphertext);
      const str = decrypted.toString('utf8');
      
      if (str.startsWith('{') && str.includes('source')) {
        console.log(`SUCCESS with AES-256-CTR (16-byte IV) + ${name}!`);
        console.log(str.slice(0, 300));
        return;
      }
    } catch (e) {}
  }
  
  // Try ChaCha20 (no auth tag)
  console.log('\n--- ChaCha20 (no auth) ---');
  for (const { name, key: derivedKey } of keyDerivations) {
    try {
      const nonce = encBytes.subarray(0, 12);
      const ciphertext = encBytes.subarray(12);
      
      // Node's chacha20 requires 16-byte nonce
      const iv = Buffer.alloc(16);
      nonce.copy(iv, 0);
      
      const decipher = crypto.createDecipheriv('chacha20', derivedKey, iv);
      const decrypted = decipher.update(ciphertext);
      const str = decrypted.toString('utf8');
      
      if (str.startsWith('{') && str.includes('source')) {
        console.log(`SUCCESS with ChaCha20 + ${name}!`);
        console.log(str.slice(0, 300));
        return;
      }
    } catch (e) {
      console.log(`${name}: ${e.message}`);
    }
  }
  
  console.log('\nNo algorithm found.');
}

crackHexa().catch(console.error);
