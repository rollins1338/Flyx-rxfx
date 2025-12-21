/**
 * Crack Hexa Encryption v27 - Statistical analysis of keystream
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v27 ===\n');
  
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
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream length:', keystream.length);
  console.log('Keystream[0:64]:', keystream.subarray(0, 64).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Check if keystream has 64-byte blocks (ChaCha20 block size)
  console.log('\n=== Block analysis (64-byte blocks for ChaCha20) ===');
  
  for (let blockNum = 0; blockNum < 3; blockNum++) {
    const start = blockNum * 64;
    const end = Math.min(start + 64, keystream.length);
    console.log(`Block ${blockNum}: ${keystream.subarray(start, end).toString('hex')}`);
  }
  
  // Check if keystream has 16-byte blocks (AES block size)
  console.log('\n=== Block analysis (16-byte blocks for AES) ===');
  
  for (let blockNum = 0; blockNum < 5; blockNum++) {
    const start = blockNum * 16;
    const end = Math.min(start + 16, keystream.length);
    console.log(`Block ${blockNum}: ${keystream.subarray(start, end).toString('hex')}`);
  }
  
  // Try to find if there's a relationship between blocks
  console.log('\n=== Inter-block XOR analysis ===');
  
  // XOR consecutive 16-byte blocks
  for (let i = 0; i < 4; i++) {
    const block1 = keystream.subarray(i * 16, (i + 1) * 16);
    const block2 = keystream.subarray((i + 1) * 16, (i + 2) * 16);
    
    const xor = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      xor[j] = block1[j] ^ block2[j];
    }
    console.log(`Block ${i} XOR Block ${i + 1}: ${xor.toString('hex')}`);
  }
  
  // Maybe the algorithm is using the key directly in some way
  console.log('\n=== Key relationship analysis ===');
  
  // Check if any part of keystream equals key
  for (let offset = 0; offset < keystream.length - 32; offset++) {
    if (keystream.subarray(offset, offset + 32).equals(keyBuf)) {
      console.log(`Key found at offset ${offset}!`);
    }
  }
  
  // Check if keystream XOR key gives a pattern
  const xorWithKey = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    xorWithKey[i] = keystream[i] ^ keyBuf[i % 32];
  }
  console.log('Keystream[0:64] XOR key (repeated):', xorWithKey.toString('hex'));
  
  // Maybe the encryption uses a simple XOR with a hash chain
  console.log('\n=== Try hash-based keystream ===');
  
  // Generate keystream using SHA256 chain
  function sha256Chain(seed, length) {
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
  
  const seeds = [
    { name: 'key', seed: keyBuf },
    { name: 'key+nonce', seed: Buffer.concat([keyBuf, nonce]) },
    { name: 'nonce+key', seed: Buffer.concat([nonce, keyBuf]) },
    { name: 'sha256(key)', seed: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'sha256(key+nonce)', seed: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest() },
    { name: 'hmac(key,nonce)', seed: crypto.createHmac('sha256', keyBuf).update(nonce).digest() },
  ];
  
  for (const { name, seed } of seeds) {
    const generated = sha256Chain(seed, keystream.length);
    
    if (generated.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: SHA256 chain with ${name} ***`);
      return;
    }
  }
  
  // Try counter-based hash
  console.log('\n=== Try counter-based hash ===');
  
  function counterHash(key, nonce, length) {
    const result = Buffer.alloc(length);
    let offset = 0;
    let counter = 0;
    
    while (offset < length) {
      const counterBuf = Buffer.alloc(8);
      counterBuf.writeBigUInt64LE(BigInt(counter));
      
      const block = crypto.createHash('sha256')
        .update(key)
        .update(nonce)
        .update(counterBuf)
        .digest();
      
      const toCopy = Math.min(32, length - offset);
      block.copy(result, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    return result;
  }
  
  const counterGenerated = counterHash(keyBuf, nonce, keystream.length);
  if (counterGenerated.subarray(0, 32).equals(keystream.subarray(0, 32))) {
    console.log('*** MATCH: Counter-based SHA256 ***');
    return;
  }
  
  console.log('No match found.');
  
  // Print summary
  console.log('\n=== Summary ===');
  console.log('The encryption uses:');
  console.log('- 12-byte nonce (random per request)');
  console.log('- Stream cipher (XOR-based, no auth tag)');
  console.log('- 32-byte key (from hex string)');
  console.log('- Unknown keystream generation algorithm');
}

crackHexa().catch(console.error);
