/**
 * Crack Hexa Encryption v36 - Multi-sample analysis with same key
 * 
 * Strategy:
 * 1. Make multiple requests with SAME key to see how nonce affects keystream
 * 2. Test if keystream = f(key, nonce) or f(key) with nonce as IV
 * 3. Try Rabbit, Sosemanuk, HC-128 style constructions
 * 4. Test counter-mode with nonce as initial counter
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v36 - Multi-sample Analysis ===\n');
  
  // Use a fixed key for multiple requests
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Fixed Key:', key);
  
  const keyBuf = Buffer.from(key, 'hex');
  const keyStr = Buffer.from(key, 'utf8');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  // Collect multiple samples with same key
  const samples = [];
  console.log('\nCollecting 3 samples with same key...\n');
  
  for (let i = 0; i < 3; i++) {
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
    
    const keystream = Buffer.alloc(ciphertext.length);
    for (let j = 0; j < ciphertext.length; j++) {
      keystream[j] = ciphertext[j] ^ expectedBytes[j];
    }
    
    samples.push({ nonce, ciphertext, keystream, expectedStr });
    console.log(`Sample ${i + 1}:`);
    console.log(`  Nonce: ${nonce.toString('hex')}`);
    console.log(`  Keystream[0:32]: ${keystream.subarray(0, 32).toString('hex')}`);
    
    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }
  
  // Analyze relationship between nonce and keystream
  console.log('\n=== Analyzing Nonce-Keystream Relationship ===\n');
  
  // Check if keystreams are different (they should be if nonce matters)
  const ks1 = samples[0].keystream.subarray(0, 32);
  const ks2 = samples[1].keystream.subarray(0, 32);
  const ks3 = samples[2].keystream.subarray(0, 32);
  
  console.log('Keystreams identical?', ks1.equals(ks2) && ks2.equals(ks3) ? 'YES (nonce ignored)' : 'NO (nonce affects keystream)');
  
  // XOR keystreams to find patterns
  const xor12 = xorBuffers(ks1, ks2);
  const xor13 = xorBuffers(ks1, ks3);
  console.log('KS1 XOR KS2:', xor12.toString('hex'));
  console.log('KS1 XOR KS3:', xor13.toString('hex'));
  
  // Test: Is keystream = AES-CTR(key, nonce as counter)?
  console.log('\n=== Testing AES-CTR with nonce as counter ===\n');
  
  for (const sample of samples) {
    const { nonce, keystream: actualKs } = sample;
    
    // Try nonce as big-endian counter
    const counterBE = Buffer.alloc(16);
    nonce.copy(counterBE, 4); // Put 12-byte nonce at end
    
    // Try nonce as little-endian counter  
    const counterLE = Buffer.alloc(16);
    nonce.copy(counterLE, 0); // Put 12-byte nonce at start
    
    const ivVariants = [
      { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
      { name: 'nonce||0001BE', iv: Buffer.concat([nonce, Buffer.from([0,0,0,1])]) },
      { name: 'nonce||0001LE', iv: Buffer.concat([nonce, Buffer.from([1,0,0,0])]) },
      { name: '0001BE||nonce', iv: Buffer.concat([Buffer.from([0,0,0,1]), nonce]) },
      { name: '0001LE||nonce', iv: Buffer.concat([Buffer.from([1,0,0,0]), nonce]) },
    ];
    
    const keyVariants = [
      { name: 'keyBuf', key: keyBuf },
      { name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() },
      { name: 'sha256(keyStr)', key: crypto.createHash('sha256').update(keyStr).digest() },
      { name: 'sha256(key||nonce)', key: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest() },
      { name: 'sha256(nonce||key)', key: crypto.createHash('sha256').update(Buffer.concat([nonce, keyBuf])).digest() },
      { name: 'hmac(key,nonce)', key: crypto.createHmac('sha256', keyBuf).update(nonce).digest() },
      { name: 'hmac(nonce,key)', key: crypto.createHmac('sha256', nonce).update(keyBuf).digest() },
    ];
    
    for (const { name: keyName, key: derivedKey } of keyVariants) {
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
          const testKs = cipher.update(Buffer.alloc(actualKs.length));
          
          if (testKs.subarray(0, 32).equals(actualKs.subarray(0, 32))) {
            console.log(`*** MATCH: AES-256-CTR + ${keyName} + ${ivName} ***`);
            console.log(`Nonce: ${nonce.toString('hex')}`);
            return { algorithm: 'aes-256-ctr', keyDerivation: keyName, ivDerivation: ivName };
          }
        } catch (e) {}
      }
    }
  }
  console.log('AES-CTR: No match');
  
  // Test ChaCha20 with various constructions
  console.log('\n=== Testing ChaCha20 Variants ===\n');
  
  for (const sample of samples) {
    const { nonce, keystream: actualKs } = sample;
    
    const keyVariants = [
      { name: 'keyBuf', key: keyBuf },
      { name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() },
      { name: 'sha256(keyStr)', key: crypto.createHash('sha256').update(keyStr).digest() },
      { name: 'sha256(key||nonce)', key: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest() },
      { name: 'hmac(key,nonce)', key: crypto.createHmac('sha256', keyBuf).update(nonce).digest() },
    ];
    
    // ChaCha20 needs 16-byte IV: 4-byte counter + 12-byte nonce
    const ivVariants = [
      { name: '0||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
      { name: '1||nonce', iv: Buffer.concat([Buffer.from([1,0,0,0]), nonce]) },
      { name: 'nonce||0', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      { name: 'nonce||1', iv: Buffer.concat([nonce, Buffer.from([1,0,0,0])]) },
    ];
    
    for (const { name: keyName, key: derivedKey } of keyVariants) {
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('chacha20', derivedKey, iv);
          const testKs = cipher.update(Buffer.alloc(actualKs.length));
          
          if (testKs.subarray(0, 32).equals(actualKs.subarray(0, 32))) {
            console.log(`*** MATCH: ChaCha20 + ${keyName} + ${ivName} ***`);
            return { algorithm: 'chacha20', keyDerivation: keyName, ivDerivation: ivName };
          }
        } catch (e) {}
      }
    }
  }
  console.log('ChaCha20: No match');
  
  // Test custom hash-based keystream generation
  console.log('\n=== Testing Hash-Based Keystream ===\n');
  
  for (const sample of samples) {
    const { nonce, keystream: actualKs } = sample;
    
    // Test: keystream = SHA256(key || nonce || counter) for each block
    const hashBasedKs = generateHashKeystream(keyBuf, nonce, actualKs.length);
    if (hashBasedKs.subarray(0, 32).equals(actualKs.subarray(0, 32))) {
      console.log('*** MATCH: Hash-based keystream (SHA256) ***');
      return;
    }
    
    // Test: keystream = HMAC(key, nonce || counter)
    const hmacBasedKs = generateHmacKeystream(keyBuf, nonce, actualKs.length);
    if (hmacBasedKs.subarray(0, 32).equals(actualKs.subarray(0, 32))) {
      console.log('*** MATCH: HMAC-based keystream ***');
      return;
    }
  }
  console.log('Hash-based: No match');
  
  // Test with key derived from both key and nonce using HKDF
  console.log('\n=== Testing HKDF-derived Keys ===\n');
  
  for (const sample of samples) {
    const { nonce, keystream: actualKs } = sample;
    
    const hkdfVariants = [
      { name: 'hkdf(key,nonce,"")', key: Buffer.from(crypto.hkdfSync('sha256', keyBuf, nonce, '', 32)) },
      { name: 'hkdf(key,"",nonce)', key: Buffer.from(crypto.hkdfSync('sha256', keyBuf, '', nonce, 32)) },
      { name: 'hkdf(key,nonce,"hexa")', key: Buffer.from(crypto.hkdfSync('sha256', keyBuf, nonce, 'hexa', 32)) },
      { name: 'hkdf(keyStr,nonce,"")', key: Buffer.from(crypto.hkdfSync('sha256', keyStr, nonce, '', 32)) },
    ];
    
    const ivVariants = [
      { name: 'zeros', iv: Buffer.alloc(16) },
      { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
      { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
    ];
    
    for (const { name: keyName, key: derivedKey } of hkdfVariants) {
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
          const testKs = cipher.update(Buffer.alloc(actualKs.length));
          
          if (testKs.subarray(0, 32).equals(actualKs.subarray(0, 32))) {
            console.log(`*** MATCH: AES-256-CTR + ${keyName} + ${ivName} ***`);
            return;
          }
        } catch (e) {}
      }
    }
  }
  console.log('HKDF: No match');
  
  console.log('\nNo match found. Continuing with more exotic tests...');
}

function xorBuffers(a, b) {
  const result = Buffer.alloc(Math.min(a.length, b.length));
  for (let i = 0; i < result.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

function generateHashKeystream(key, nonce, length) {
  const output = Buffer.alloc(length);
  let offset = 0;
  let counter = 0;
  
  while (offset < length) {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32LE(counter);
    
    const block = crypto.createHash('sha256')
      .update(key)
      .update(nonce)
      .update(counterBuf)
      .digest();
    
    const toCopy = Math.min(32, length - offset);
    block.copy(output, offset, 0, toCopy);
    offset += toCopy;
    counter++;
  }
  
  return output;
}

function generateHmacKeystream(key, nonce, length) {
  const output = Buffer.alloc(length);
  let offset = 0;
  let counter = 0;
  
  while (offset < length) {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32LE(counter);
    
    const block = crypto.createHmac('sha256', key)
      .update(nonce)
      .update(counterBuf)
      .digest();
    
    const toCopy = Math.min(32, length - offset);
    block.copy(output, offset, 0, toCopy);
    offset += toCopy;
    counter++;
  }
  
  return output;
}

crackHexa().catch(console.error);
