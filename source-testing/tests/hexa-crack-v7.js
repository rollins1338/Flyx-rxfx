/**
 * Crack Hexa Encryption v7 - Try more key derivation methods
 */

const crypto = require('crypto');
const nacl = require('tweetnacl');

// Helper to try decryption with a given key
function tryDecrypt(encBytes, keyBuf, name) {
  // NaCl secretbox (24-byte nonce at start)
  try {
    const nonce = encBytes.subarray(0, 24);
    const ciphertext = encBytes.subarray(24);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(keyBuf)
    );
    
    if (decrypted) {
      const str = Buffer.from(decrypted).toString('utf8');
      if (str.includes('source') || str.includes('{')) {
        console.log(`\n*** SUCCESS with ${name} (NaCl secretbox) ***`);
        console.log(str.slice(0, 300));
        return true;
      }
    }
  } catch (e) {}
  
  // AES-256-GCM variations
  const gcmConfigs = [
    { nonce: encBytes.subarray(0, 12), tag: encBytes.subarray(-16), cipher: encBytes.subarray(12, -16), desc: 'nonce12+cipher+tag16' },
    { nonce: encBytes.subarray(0, 16), tag: encBytes.subarray(-16), cipher: encBytes.subarray(16, -16), desc: 'nonce16+cipher+tag16' },
    { nonce: encBytes.subarray(-28, -16), tag: encBytes.subarray(-16), cipher: encBytes.subarray(0, -28), desc: 'cipher+nonce12+tag16' },
  ];
  
  for (const { nonce, tag, cipher, desc } of gcmConfigs) {
    try {
      const actualNonce = nonce.length > 12 ? nonce.subarray(0, 12) : nonce;
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, actualNonce);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);
      const str = decrypted.toString('utf8');
      if (str.includes('source') || str.includes('{')) {
        console.log(`\n*** SUCCESS with ${name} (AES-GCM ${desc}) ***`);
        console.log(str.slice(0, 300));
        return true;
      }
    } catch (e) {}
  }
  
  // ChaCha20-Poly1305
  try {
    const nonce = encBytes.subarray(0, 12);
    const tag = encBytes.subarray(-16);
    const cipher = encBytes.subarray(12, -16);
    
    const decipher = crypto.createDecipheriv('chacha20-poly1305', keyBuf, nonce, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);
    const str = decrypted.toString('utf8');
    if (str.includes('source') || str.includes('{')) {
      console.log(`\n*** SUCCESS with ${name} (ChaCha20-Poly1305) ***`);
      console.log(str.slice(0, 300));
      return true;
    }
  } catch (e) {}
  
  return false;
}

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v7 ===\n');
  
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
  
  console.log('Encrypted length:', encrypted.length);
  
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
  
  // Generate all possible key derivations
  const keyDerivations = [
    { name: 'hex-decoded', key: Buffer.from(key, 'hex') },
    { name: 'utf8-first32', key: Buffer.from(key.slice(0, 32), 'utf8') },
    { name: 'sha256-hex', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256-bytes', key: crypto.createHash('sha256').update(Buffer.from(key, 'hex')).digest() },
    { name: 'sha512-first32', key: crypto.createHash('sha512').update(key).digest().subarray(0, 32) },
    // { name: 'blake2b256', key: crypto.createHash('blake2b256').update(key).digest() }, // Not supported in all Node versions
    { name: 'pbkdf2-sha256', key: crypto.pbkdf2Sync(key, 'hexa', 1, 32, 'sha256') },
    { name: 'pbkdf2-sha256-nosalt', key: crypto.pbkdf2Sync(key, '', 1, 32, 'sha256') },
    { name: 'hkdf-sha256', key: crypto.hkdfSync('sha256', key, '', '', 32) },
    { name: 'hkdf-sha256-hexa', key: crypto.hkdfSync('sha256', key, 'hexa', '', 32) },
  ];
  
  console.log('\n=== Testing', keyDerivations.length, 'key derivations ===\n');
  
  for (const { name, key: keyBuf } of keyDerivations) {
    if (!keyBuf || keyBuf.length !== 32) continue;
    
    process.stdout.write(`Testing ${name}... `);
    if (tryDecrypt(encBytes, keyBuf, name)) {
      return;
    }
    console.log('failed');
  }
  
  // Try with nonce extracted from different positions
  console.log('\n=== Testing different nonce positions ===\n');
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Maybe nonce is at the end?
  console.log('Testing nonce at end...');
  try {
    const nonce = encBytes.subarray(-24);
    const ciphertext = encBytes.subarray(0, -24);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(keyBuf)
    );
    
    if (decrypted) {
      console.log('SUCCESS with nonce at end!');
      console.log(Buffer.from(decrypted).toString('utf8').slice(0, 200));
      return;
    }
  } catch (e) {}
  
  // Maybe there's a length prefix?
  console.log('Testing with 4-byte length prefix...');
  try {
    const dataWithoutPrefix = encBytes.subarray(4);
    const nonce = dataWithoutPrefix.subarray(0, 24);
    const ciphertext = dataWithoutPrefix.subarray(24);
    
    const decrypted = nacl.secretbox.open(
      new Uint8Array(ciphertext),
      new Uint8Array(nonce),
      new Uint8Array(keyBuf)
    );
    
    if (decrypted) {
      console.log('SUCCESS with 4-byte prefix!');
      console.log(Buffer.from(decrypted).toString('utf8').slice(0, 200));
      return;
    }
  } catch (e) {}
  
  // Try XOR-based decryption (simple stream cipher)
  console.log('\n=== Testing XOR-based ciphers ===\n');
  
  // Generate keystream from key using different methods
  const keystreamMethods = [
    { name: 'repeat-key', stream: Buffer.alloc(encBytes.length, keyBuf) },
    { name: 'sha256-chain', stream: generateSha256Chain(keyBuf, encBytes.length) },
  ];
  
  for (const { name, stream } of keystreamMethods) {
    const xored = Buffer.alloc(encBytes.length);
    for (let i = 0; i < encBytes.length; i++) {
      xored[i] = encBytes[i] ^ stream[i];
    }
    const str = xored.toString('utf8');
    if (str.includes('source') || str.startsWith('{')) {
      console.log(`SUCCESS with ${name}!`);
      console.log(str.slice(0, 200));
      return;
    }
  }
  
  console.log('\nNo algorithm found.');
}

function generateSha256Chain(seed, length) {
  const result = Buffer.alloc(length);
  let current = seed;
  let offset = 0;
  
  while (offset < length) {
    current = crypto.createHash('sha256').update(current).digest();
    const toCopy = Math.min(32, length - offset);
    current.copy(result, offset, 0, toCopy);
    offset += toCopy;
  }
  
  return result;
}

crackHexa().catch(console.error);
