/**
 * Crack Hexa Encryption v8 - Try CryptoJS patterns and more
 */

const crypto = require('crypto');
const nacl = require('tweetnacl');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v8 ===\n');
  
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
  console.log('Expected:', JSON.stringify(decResult.result).slice(0, 100));
  
  const encBytes = Buffer.from(encrypted, 'base64');
  console.log('Encrypted bytes:', encBytes.length);
  console.log('First 32 bytes:', encBytes.subarray(0, 32).toString('hex'));
  
  // CryptoJS AES default format: Salted__ (8 bytes) + salt (8 bytes) + ciphertext
  console.log('\n=== Check for CryptoJS format ===');
  const saltedPrefix = encBytes.subarray(0, 8).toString('utf8');
  console.log('First 8 bytes as string:', JSON.stringify(saltedPrefix));
  
  if (saltedPrefix === 'Salted__') {
    console.log('CryptoJS format detected!');
    const salt = encBytes.subarray(8, 16);
    const ciphertext = encBytes.subarray(16);
    console.log('Salt:', salt.toString('hex'));
    console.log('Ciphertext length:', ciphertext.length);
    
    // Derive key and IV using EVP_BytesToKey (OpenSSL compatible)
    const keyAndIv = evpBytesToKey(key, salt, 32, 16);
    console.log('Derived key:', keyAndIv.key.toString('hex'));
    console.log('Derived IV:', keyAndIv.iv.toString('hex'));
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIv.key, keyAndIv.iv);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
      return;
    } catch (e) {
      console.log('CryptoJS decrypt failed:', e.message);
    }
  }
  
  // Try without the "Salted__" prefix check
  console.log('\n=== Try CryptoJS-style key derivation anyway ===');
  
  // Maybe salt is first 8 bytes, no prefix
  const salt = encBytes.subarray(0, 8);
  const ciphertext = encBytes.subarray(8);
  
  const keyAndIv = evpBytesToKey(key, salt, 32, 16);
  console.log('Salt:', salt.toString('hex'));
  console.log('Derived key:', keyAndIv.key.toString('hex'));
  console.log('Derived IV:', keyAndIv.iv.toString('hex'));
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyAndIv.key, keyAndIv.iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
    return;
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try with salt at different positions
  console.log('\n=== Try different salt positions ===');
  
  const saltPositions = [
    { start: 0, end: 8, name: 'bytes 0-8' },
    { start: 0, end: 16, name: 'bytes 0-16' },
    { start: 16, end: 24, name: 'bytes 16-24' },
    { start: 0, end: 32, name: 'bytes 0-32' },
  ];
  
  for (const { start, end, name } of saltPositions) {
    const salt = encBytes.subarray(start, end);
    const ciphertext = encBytes.subarray(end);
    
    // Try with different key derivation
    const derivedKey = crypto.pbkdf2Sync(key, salt, 1000, 32, 'sha256');
    const iv = crypto.pbkdf2Sync(key, salt, 1000, 16, 'sha256');
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const str = decrypted.toString('utf8');
      if (str.includes('source')) {
        console.log(`SUCCESS with salt at ${name}!`);
        console.log(str.slice(0, 200));
        return;
      }
    } catch (e) {}
  }
  
  // Try libsodium sealed box (public key encryption)
  console.log('\n=== Check if it might be sealed box ===');
  // Sealed box: ephemeral public key (32) + ciphertext + tag (16)
  // Total overhead: 48 bytes
  console.log('If sealed box: plaintext would be', encBytes.length - 48, 'bytes');
  
  // Try with the key being used as a seed for keypair
  try {
    const keyBuf = Buffer.from(key, 'hex');
    const keypair = nacl.box.keyPair.fromSecretKey(new Uint8Array(keyBuf));
    console.log('Public key:', Buffer.from(keypair.publicKey).toString('hex').slice(0, 32) + '...');
    
    // Try to open as sealed box
    // Sealed box format: ephemeral_pk (32) + box(message, ephemeral_sk, recipient_pk)
    const ephemeralPk = encBytes.subarray(0, 32);
    const boxed = encBytes.subarray(32);
    
    // This won't work directly as sealed box uses a different nonce derivation
    // But let's try standard box
    const nonce = Buffer.alloc(24); // Zero nonce
    const opened = nacl.box.open(
      new Uint8Array(boxed),
      new Uint8Array(nonce),
      new Uint8Array(ephemeralPk),
      keypair.secretKey
    );
    
    if (opened) {
      console.log('Box opened!');
      console.log(Buffer.from(opened).toString('utf8').slice(0, 200));
    }
  } catch (e) {
    console.log('Box failed:', e.message);
  }
  
  // Try AES-256-GCM with IV derived from key
  console.log('\n=== Try AES-GCM with derived IV ===');
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Maybe IV is derived from key hash
  const ivFromKey = crypto.createHash('md5').update(key).digest().subarray(0, 12);
  const tag = encBytes.subarray(-16);
  const cipherOnly = encBytes.subarray(0, -16);
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, ivFromKey);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipherOnly), decipher.final()]);
    console.log('SUCCESS with derived IV!');
    console.log(decrypted.toString('utf8').slice(0, 200));
    return;
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // Try with zero IV
  console.log('\n=== Try with zero IV ===');
  try {
    const zeroIv = Buffer.alloc(12);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, zeroIv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipherOnly), decipher.final()]);
    console.log('SUCCESS with zero IV!');
    console.log(decrypted.toString('utf8').slice(0, 200));
    return;
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  console.log('\nNo algorithm found.');
}

// EVP_BytesToKey implementation (OpenSSL/CryptoJS compatible)
function evpBytesToKey(password, salt, keyLen, ivLen) {
  const totalLen = keyLen + ivLen;
  const result = Buffer.alloc(totalLen);
  let offset = 0;
  let prev = Buffer.alloc(0);
  
  while (offset < totalLen) {
    const hash = crypto.createHash('md5');
    hash.update(prev);
    hash.update(Buffer.from(password, 'utf8'));
    if (salt) hash.update(salt);
    prev = hash.digest();
    
    const toCopy = Math.min(prev.length, totalLen - offset);
    prev.copy(result, offset, 0, toCopy);
    offset += toCopy;
  }
  
  return {
    key: result.subarray(0, keyLen),
    iv: result.subarray(keyLen, keyLen + ivLen),
  };
}

crackHexa().catch(console.error);
