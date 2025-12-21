/**
 * Crack Hexa Encryption v6 - Deep analysis and more algorithms
 */

const crypto = require('crypto');
const nacl = require('tweetnacl');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v6 ===\n');
  
  // Use a fixed key for reproducibility
  const key = 'a'.repeat(64); // Simple key for testing
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
  
  console.log('Encrypted base64 length:', encrypted.length);
  
  // Decrypt using enc-dec.app
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  
  const decResult = await decResponse.json();
  const expectedDecrypted = JSON.stringify(decResult.result);
  console.log('Expected decrypted:', expectedDecrypted.slice(0, 150));
  
  const encBytes = Buffer.from(encrypted, 'base64');
  console.log('\nEncrypted bytes:', encBytes.length);
  console.log('First 64 bytes:', encBytes.subarray(0, 64).toString('hex'));
  
  // Key variations to try
  const keyVariations = [
    { name: 'hex decoded (32 bytes)', key: Buffer.from(key, 'hex') },
    { name: 'utf8 first 32', key: Buffer.from(key, 'utf8').subarray(0, 32) },
    { name: 'sha256(hex)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(utf8)', key: crypto.createHash('sha256').update(Buffer.from(key, 'utf8')).digest() },
    { name: 'md5+md5', key: Buffer.concat([
      crypto.createHash('md5').update(key).digest(),
      crypto.createHash('md5').update(key + 'salt').digest()
    ]) },
  ];
  
  console.log('\n=== Testing Key Variations ===');
  
  for (const { name, key: keyBuf } of keyVariations) {
    if (!keyBuf || keyBuf.length !== 32) {
      console.log(`${name}: Invalid key length (${keyBuf?.length})`);
      continue;
    }
    
    console.log(`\n--- ${name} ---`);
    console.log('Key bytes:', keyBuf.toString('hex').slice(0, 32) + '...');
    
    // Try NaCl secretbox
    try {
      const nonce = encBytes.subarray(0, 24);
      const ciphertext = encBytes.subarray(24);
      
      const decrypted = nacl.secretbox.open(
        new Uint8Array(ciphertext),
        new Uint8Array(nonce),
        new Uint8Array(keyBuf)
      );
      
      if (decrypted) {
        console.log('NaCl secretbox SUCCESS!');
        console.log(Buffer.from(decrypted).toString('utf8').slice(0, 200));
        return;
      }
    } catch (e) {}
    
    // Try AES-256-GCM (12-byte nonce, tag at end)
    try {
      const nonce = encBytes.subarray(0, 12);
      const tag = encBytes.subarray(-16);
      const ciphertext = encBytes.subarray(12, -16);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      console.log('AES-256-GCM SUCCESS!');
      console.log(decrypted.toString('utf8').slice(0, 200));
      return;
    } catch (e) {}
    
    // Try ChaCha20-Poly1305
    try {
      const nonce = encBytes.subarray(0, 12);
      const tag = encBytes.subarray(-16);
      const ciphertext = encBytes.subarray(12, -16);
      
      const decipher = crypto.createDecipheriv('chacha20-poly1305', keyBuf, nonce, { authTagLength: 16 });
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      console.log('ChaCha20-Poly1305 SUCCESS!');
      console.log(decrypted.toString('utf8').slice(0, 200));
      return;
    } catch (e) {}
  }
  
  // Try with the key being the actual hex string bytes (not decoded)
  console.log('\n=== Try with raw hex string as key ===');
  
  // The key is 64 hex chars = 64 bytes as UTF-8
  // Maybe they use first 32 bytes of the hex string directly
  const keyStr = key;
  const keyRaw = Buffer.from(keyStr.slice(0, 32), 'utf8'); // First 32 chars as bytes
  
  console.log('Raw key (first 32 chars):', keyRaw.toString('hex'));
  
  // Try NaCl with raw key
  try {
    const nonce = encBytes.subarray(0, 24);
    const ciphertext = encBytes.subarray(24);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(keyRaw)
    );
    
    if (decrypted) {
      console.log('NaCl with raw key SUCCESS!');
      console.log(Buffer.from(decrypted).toString('utf8').slice(0, 200));
      return;
    }
  } catch (e) {}
  
  // Maybe the encryption uses a different structure
  // Let's check if there's a version byte or format indicator
  console.log('\n=== Analyze encrypted structure ===');
  console.log('Byte 0:', encBytes[0], '(0x' + encBytes[0].toString(16) + ')');
  console.log('Byte 1:', encBytes[1], '(0x' + encBytes[1].toString(16) + ')');
  console.log('Byte 2:', encBytes[2], '(0x' + encBytes[2].toString(16) + ')');
  console.log('Byte 3:', encBytes[3], '(0x' + encBytes[3].toString(16) + ')');
  
  // Check if first byte could be a version/type indicator
  const possibleVersions = [0, 1, 2, 3, 4, 5];
  if (possibleVersions.includes(encBytes[0])) {
    console.log('\nFirst byte might be version indicator!');
    console.log('Trying with data starting at byte 1...');
    
    const dataWithoutVersion = encBytes.subarray(1);
    const keyBuf = Buffer.from(key, 'hex');
    
    // Try NaCl
    try {
      const nonce = dataWithoutVersion.subarray(0, 24);
      const ciphertext = dataWithoutVersion.subarray(24);
      
      const decrypted = nacl.secretbox.open(
        new Uint8Array(ciphertext),
        new Uint8Array(nonce),
        new Uint8Array(keyBuf)
      );
      
      if (decrypted) {
        console.log('NaCl (skip version byte) SUCCESS!');
        console.log(Buffer.from(decrypted).toString('utf8').slice(0, 200));
        return;
      }
    } catch (e) {}
  }
  
  // Try fetching with different keys to see if the nonce changes
  console.log('\n=== Fetch with different key to compare ===');
  const key2 = 'b'.repeat(64);
  const headers2 = { ...headers, 'X-Api-Key': key2 };
  
  const encResponse2 = await fetch(url, { headers: headers2 });
  const encrypted2 = await encResponse2.text();
  const encBytes2 = Buffer.from(encrypted2, 'base64');
  
  console.log('Key1 first 24 bytes:', encBytes.subarray(0, 24).toString('hex'));
  console.log('Key2 first 24 bytes:', encBytes2.subarray(0, 24).toString('hex'));
  
  if (encBytes.subarray(0, 24).equals(encBytes2.subarray(0, 24))) {
    console.log('Nonces are SAME - nonce is not random per request');
  } else {
    console.log('Nonces are DIFFERENT - nonce is random per request');
  }
  
  console.log('\nNo algorithm found yet.');
}

crackHexa().catch(console.error);
