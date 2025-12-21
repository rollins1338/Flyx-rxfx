/**
 * Crack Hexa Encryption v4 - Try more algorithms including NaCl/libsodium
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v4 ===\n');
  
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
  console.log('Dec response:', JSON.stringify(decResult).slice(0, 300));
  const expectedDecrypted = typeof decResult.result === 'string' ? decResult.result : JSON.stringify(decResult.result);
  console.log('Expected decrypted:', expectedDecrypted.slice(0, 200));
  
  const keyBuf = Buffer.from(key, 'hex');
  const encBytes = Buffer.from(encrypted, 'base64');
  
  console.log('\n=== Data Analysis ===');
  console.log('Key bytes:', keyBuf.length);
  console.log('Encrypted bytes:', encBytes.length);
  console.log('First 48 bytes hex:', encBytes.subarray(0, 48).toString('hex'));
  
  // Analyze structure
  console.log('\n=== Structure Analysis ===');
  console.log('Total bytes:', encBytes.length);
  console.log('If nonce=24, tag=16: ciphertext =', encBytes.length - 24 - 16);
  console.log('If nonce=12, tag=16: ciphertext =', encBytes.length - 12 - 16);
  console.log('If nonce=16, tag=16: ciphertext =', encBytes.length - 16 - 16);
  console.log('If nonce=24, no tag: ciphertext =', encBytes.length - 24);
  
  // Try XChaCha20-Poly1305 (24-byte nonce)
  console.log('\n--- XChaCha20-Poly1305 (24-byte nonce) ---');
  // Node.js doesn't have native XChaCha20, but let's try with tweetnacl pattern
  
  // Try simple XOR with key (unlikely but worth checking)
  console.log('\n--- Simple XOR with key ---');
  try {
    const xorResult = Buffer.alloc(encBytes.length);
    for (let i = 0; i < encBytes.length; i++) {
      xorResult[i] = encBytes[i] ^ keyBuf[i % keyBuf.length];
    }
    const xorStr = xorResult.toString('utf8');
    if (xorStr.includes('source') || xorStr.includes('{')) {
      console.log('XOR result:', xorStr.slice(0, 200));
    } else {
      console.log('XOR: Not valid JSON');
    }
  } catch (e) {
    console.log('XOR failed:', e.message);
  }
  
  // Try AES-256-GCM with key derived from hex string (SHA256 of key string)
  console.log('\n--- AES-256-GCM with SHA256(key string) ---');
  try {
    const derivedKey = crypto.createHash('sha256').update(key).digest();
    const nonce = encBytes.subarray(0, 12);
    const tag = encBytes.subarray(-16);
    const ciphertext = encBytes.subarray(12, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('Result:', decrypted.toString('utf8').slice(0, 200));
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try ChaCha20-Poly1305 with derived key
  console.log('\n--- ChaCha20-Poly1305 with SHA256(key string) ---');
  try {
    const derivedKey = crypto.createHash('sha256').update(key).digest();
    const nonce = encBytes.subarray(0, 12);
    const tag = encBytes.subarray(-16);
    const ciphertext = encBytes.subarray(12, -16);
    
    const decipher = crypto.createDecipheriv('chacha20-poly1305', derivedKey, nonce, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('Result:', decrypted.toString('utf8').slice(0, 200));
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try with 24-byte nonce (XChaCha20 style) - using first 24 bytes as nonce
  console.log('\n--- Trying 24-byte nonce patterns ---');
  
  // Maybe it's: nonce(24) + ciphertext + tag(16)
  try {
    const nonce24 = encBytes.subarray(0, 24);
    const tag = encBytes.subarray(-16);
    const ciphertext = encBytes.subarray(24, -16);
    console.log('24-byte nonce:', nonce24.toString('hex'));
    console.log('Ciphertext length:', ciphertext.length);
    
    // Can't use XChaCha20 directly in Node, but let's check the structure
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try AES-256-CBC with PKCS7 padding and different IV sources
  console.log('\n--- AES-256-CBC variations ---');
  const ivSources = [
    { name: 'First 16 bytes', iv: encBytes.subarray(0, 16), data: encBytes.subarray(16) },
    { name: 'SHA256(key)[:16]', iv: crypto.createHash('sha256').update(key).digest().subarray(0, 16), data: encBytes },
    { name: 'MD5(key)', iv: crypto.createHash('md5').update(key).digest(), data: encBytes },
    { name: 'Zero IV', iv: Buffer.alloc(16), data: encBytes },
  ];
  
  for (const { name, iv, data } of ivSources) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      const decStr = decrypted.toString('utf8');
      if (decStr.includes('source') || decStr.includes('"url"')) {
        console.log(`${name}: SUCCESS!`);
        console.log(`  ${decStr.slice(0, 300)}`);
      }
    } catch (e) {
      console.log(`${name}: ${e.message.slice(0, 50)}`);
    }
  }
  
  // Try RC4 (stream cipher)
  console.log('\n--- RC4 ---');
  try {
    const decipher = crypto.createDecipheriv('rc4', keyBuf, null);
    const decrypted = decipher.update(encBytes);
    const decStr = decrypted.toString('utf8');
    if (decStr.includes('source') || decStr.includes('{')) {
      console.log('RC4 result:', decStr.slice(0, 200));
    } else {
      console.log('RC4: Not valid JSON');
    }
  } catch (e) {
    console.log('RC4 failed:', e.message);
  }
  
  // Try Blowfish
  console.log('\n--- Blowfish-CBC ---');
  try {
    const iv = encBytes.subarray(0, 8);
    const data = encBytes.subarray(8);
    const decipher = crypto.createDecipheriv('bf-cbc', keyBuf.subarray(0, 16), iv);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    console.log('Blowfish result:', decrypted.toString('utf8').slice(0, 100));
  } catch (e) {
    console.log('Blowfish failed:', e.message);
  }
  
  // Check if it might be double-encoded or compressed
  console.log('\n--- Check for compression/double encoding ---');
  try {
    const zlib = require('zlib');
    // Try gzip decompress
    const gunzipped = zlib.gunzipSync(encBytes);
    console.log('Gzip decompressed:', gunzipped.length, 'bytes');
  } catch (e) {
    console.log('Not gzipped');
  }
  
  try {
    const zlib = require('zlib');
    // Try inflate
    const inflated = zlib.inflateSync(encBytes);
    console.log('Inflated:', inflated.length, 'bytes');
  } catch (e) {
    console.log('Not deflated');
  }
  
  // Check if first bytes indicate a format
  console.log('\n--- First bytes analysis ---');
  console.log('First byte:', encBytes[0], '(0x' + encBytes[0].toString(16) + ')');
  console.log('Bytes 0-3:', encBytes.subarray(0, 4).toString('hex'));
  
  // Common magic bytes:
  // 0x1f 0x8b = gzip
  // 0x78 = zlib
  // 0x50 0x4b = zip
  
  console.log('\nNo algorithm found yet.');
}

crackHexa().catch(console.error);
