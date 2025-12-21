/**
 * Crack Hexa Encryption v37 - Noble ciphers + XChaCha20 + Salsa20
 * 
 * Using @noble/ciphers for more algorithm variants
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v37 - Noble Ciphers ===\n');
  
  // Dynamic import for ESM module - correct paths
  const { salsa20, xsalsa20 } = await import('@noble/ciphers/salsa.js');
  const { chacha20, xchacha20, chacha20poly1305, xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');
  
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
  
  console.log('Nonce (12 bytes):', nonce.toString('hex'));
  console.log('Keystream[0:32]:', actualKeystream.subarray(0, 32).toString('hex'));
  
  // Key derivations to test
  const keyDerivations = [
    { name: 'keyBuf', key: new Uint8Array(keyBuf) },
    { name: 'sha256(keyBuf)', key: new Uint8Array(crypto.createHash('sha256').update(keyBuf).digest()) },
    { name: 'sha256(keyStr)', key: new Uint8Array(crypto.createHash('sha256').update(keyStr).digest()) },
    { name: 'sha256(key||nonce)', key: new Uint8Array(crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest()) },
    { name: 'sha256(nonce||key)', key: new Uint8Array(crypto.createHash('sha256').update(Buffer.concat([nonce, keyBuf])).digest()) },
    { name: 'hmac(key,nonce)', key: new Uint8Array(crypto.createHmac('sha256', keyBuf).update(nonce).digest()) },
    { name: 'hmac(nonce,key)', key: new Uint8Array(crypto.createHmac('sha256', nonce).update(keyBuf).digest()) },
    { name: 'keyStr[:32]', key: new Uint8Array(keyStr.subarray(0, 32)) },
  ];
  
  // Test ChaCha20 (12-byte nonce)
  console.log('\n=== Testing ChaCha20 (Noble) ===');
  for (const { name, key: derivedKey } of keyDerivations) {
    try {
      const cipher = chacha20(derivedKey, new Uint8Array(nonce));
      const zeros = new Uint8Array(ciphertext.length);
      const testKs = cipher.encrypt(zeros);
      
      if (Buffer.from(testKs.subarray(0, 32)).equals(actualKeystream.subarray(0, 32))) {
        console.log(`*** MATCH: ChaCha20 + ${name} ***`);
        return;
      }
    } catch (e) {
      // console.log(`ChaCha20 + ${name}: ${e.message}`);
    }
  }
  console.log('ChaCha20: No match');
  
  // Test XChaCha20 (24-byte nonce - need to pad our 12-byte nonce)
  console.log('\n=== Testing XChaCha20 (Noble) ===');
  const nonce24Variants = [
    { name: 'nonce||zeros', nonce: Buffer.concat([nonce, Buffer.alloc(12)]) },
    { name: 'zeros||nonce', nonce: Buffer.concat([Buffer.alloc(12), nonce]) },
    { name: 'nonce||nonce', nonce: Buffer.concat([nonce, nonce]) },
    { name: 'sha256(nonce)[:24]', nonce: crypto.createHash('sha256').update(nonce).digest().subarray(0, 24) },
  ];
  
  for (const { name: keyName, key: derivedKey } of keyDerivations) {
    for (const { name: nonceName, nonce: nonce24 } of nonce24Variants) {
      try {
        const cipher = xchacha20(derivedKey, new Uint8Array(nonce24));
        const zeros = new Uint8Array(ciphertext.length);
        const testKs = cipher.encrypt(zeros);
        
        if (Buffer.from(testKs.subarray(0, 32)).equals(actualKeystream.subarray(0, 32))) {
          console.log(`*** MATCH: XChaCha20 + ${keyName} + ${nonceName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('XChaCha20: No match');
  
  // Test Salsa20 (8-byte nonce - need to truncate)
  console.log('\n=== Testing Salsa20 (Noble) ===');
  const nonce8Variants = [
    { name: 'nonce[:8]', nonce: nonce.subarray(0, 8) },
    { name: 'nonce[4:12]', nonce: nonce.subarray(4, 12) },
    { name: 'sha256(nonce)[:8]', nonce: crypto.createHash('sha256').update(nonce).digest().subarray(0, 8) },
  ];
  
  for (const { name: keyName, key: derivedKey } of keyDerivations) {
    for (const { name: nonceName, nonce: nonce8 } of nonce8Variants) {
      try {
        const cipher = salsa20(derivedKey, new Uint8Array(nonce8));
        const zeros = new Uint8Array(ciphertext.length);
        const testKs = cipher.encrypt(zeros);
        
        if (Buffer.from(testKs.subarray(0, 32)).equals(actualKeystream.subarray(0, 32))) {
          console.log(`*** MATCH: Salsa20 + ${keyName} + ${nonceName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('Salsa20: No match');
  
  // Test XSalsa20 (24-byte nonce)
  console.log('\n=== Testing XSalsa20 (Noble) ===');
  for (const { name: keyName, key: derivedKey } of keyDerivations) {
    for (const { name: nonceName, nonce: nonce24 } of nonce24Variants) {
      try {
        const cipher = xsalsa20(derivedKey, new Uint8Array(nonce24));
        const zeros = new Uint8Array(ciphertext.length);
        const testKs = cipher.encrypt(zeros);
        
        if (Buffer.from(testKs.subarray(0, 32)).equals(actualKeystream.subarray(0, 32))) {
          console.log(`*** MATCH: XSalsa20 + ${keyName} + ${nonceName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('XSalsa20: No match');
  
  // Test with counter starting at different values
  console.log('\n=== Testing with Different Initial Counters ===');
  for (const { name: keyName, key: derivedKey } of keyDerivations.slice(0, 3)) {
    for (const counter of [0, 1, 2, 0x80000000, 0xffffffff]) {
      try {
        const cipher = chacha20(derivedKey, new Uint8Array(nonce), counter);
        const zeros = new Uint8Array(ciphertext.length);
        const testKs = cipher.encrypt(zeros);
        
        if (Buffer.from(testKs.subarray(0, 32)).equals(actualKeystream.subarray(0, 32))) {
          console.log(`*** MATCH: ChaCha20 + ${keyName} + counter=${counter} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('Counter variants: No match');
  
  // Test tweetnacl secretbox (XSalsa20-Poly1305)
  console.log('\n=== Testing TweetNaCl SecretBox ===');
  const nacl = require('tweetnacl');
  
  for (const { name: keyName, key: derivedKey } of keyDerivations) {
    for (const { name: nonceName, nonce: nonce24 } of nonce24Variants) {
      try {
        // secretbox adds 16-byte auth tag, so we need to account for that
        // Try decrypting with fake auth tag
        const fakeAuthTag = Buffer.alloc(16);
        const withTag = Buffer.concat([fakeAuthTag, ciphertext]);
        
        const result = nacl.secretbox.open(new Uint8Array(withTag), new Uint8Array(nonce24), derivedKey);
        if (result && Buffer.from(result).toString('utf8').startsWith('{')) {
          console.log(`*** MATCH: NaCl SecretBox + ${keyName} + ${nonceName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('TweetNaCl: No match');
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
