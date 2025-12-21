/**
 * Crack Hexa Encryption v30 - Try more exotic algorithms
 * Including: Rabbit, RC4, custom XOR patterns
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v30 ===\n');
  
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const keyBuf = Buffer.from(key, 'hex');
  
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
  
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  // Try custom PRNG-based keystream
  console.log('\n=== Custom PRNG Keystreams ===\n');
  
  // Mulberry32 PRNG (common in JS)
  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  
  // Generate keystream from PRNG
  function prngKeystream(seed, length) {
    const rng = mulberry32(seed);
    const result = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      result[i] = Math.floor(rng() * 256);
    }
    return result;
  }
  
  // Try different seeds
  const seeds = [
    // Use key bytes as seed
    keyBuf.readUInt32LE(0),
    keyBuf.readUInt32BE(0),
    // Use nonce as seed
    nonce.readUInt32LE(0),
    nonce.readUInt32BE(0),
    // Combined
    keyBuf.readUInt32LE(0) ^ nonce.readUInt32LE(0),
  ];
  
  for (const seed of seeds) {
    const testKeystream = prngKeystream(seed, ciphertext.length);
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: Mulberry32 with seed ${seed} ***`);
      return;
    }
  }
  
  // Try xorshift128 PRNG
  function xorshift128(state) {
    let [x, y, z, w] = state;
    return function() {
      const t = x ^ (x << 11);
      x = y; y = z; z = w;
      w = w ^ (w >>> 19) ^ t ^ (t >>> 8);
      return (w >>> 0) / 4294967296;
    };
  }
  
  // Try with key as initial state
  const xorState = [
    keyBuf.readUInt32LE(0),
    keyBuf.readUInt32LE(4),
    keyBuf.readUInt32LE(8),
    keyBuf.readUInt32LE(12),
  ];
  
  const xorRng = xorshift128(xorState);
  const xorKeystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    xorKeystream[i] = Math.floor(xorRng() * 256);
  }
  
  if (xorKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
    console.log('*** MATCH: xorshift128 ***');
    return;
  }
  
  // Try simple byte-by-byte XOR with transformed key
  console.log('\n=== Simple XOR Patterns ===\n');
  
  // Maybe keystream = SHA256(key || nonce || counter) for each block
  function sha256CounterKeystream(key, nonce, length) {
    const result = Buffer.alloc(length);
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
      block.copy(result, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    return result;
  }
  
  // Try different orderings
  const orderings = [
    { name: 'key||nonce||counter', fn: (k, n, c) => Buffer.concat([k, n, c]) },
    { name: 'nonce||key||counter', fn: (k, n, c) => Buffer.concat([n, k, c]) },
    { name: 'counter||key||nonce', fn: (k, n, c) => Buffer.concat([c, k, n]) },
    { name: 'key||counter||nonce', fn: (k, n, c) => Buffer.concat([k, c, n]) },
    { name: 'nonce||counter||key', fn: (k, n, c) => Buffer.concat([n, c, k]) },
    { name: 'counter||nonce||key', fn: (k, n, c) => Buffer.concat([c, n, k]) },
  ];
  
  for (const { name, fn } of orderings) {
    const testKeystream = Buffer.alloc(ciphertext.length);
    let offset = 0;
    let counter = 0;
    
    while (offset < ciphertext.length) {
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32LE(counter);
      
      const input = fn(keyBuf, nonce, counterBuf);
      const block = crypto.createHash('sha256').update(input).digest();
      
      const toCopy = Math.min(32, ciphertext.length - offset);
      block.copy(testKeystream, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: SHA256(${name}) ***`);
      return;
    }
  }
  
  // Try HMAC-based counter mode
  console.log('\n=== HMAC Counter Mode ===\n');
  
  for (const { name, fn } of orderings) {
    const testKeystream = Buffer.alloc(ciphertext.length);
    let offset = 0;
    let counter = 0;
    
    while (offset < ciphertext.length) {
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32LE(counter);
      
      const input = fn(Buffer.alloc(0), nonce, counterBuf); // Just nonce and counter
      const block = crypto.createHmac('sha256', keyBuf).update(input).digest();
      
      const toCopy = Math.min(32, ciphertext.length - offset);
      block.copy(testKeystream, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: HMAC-SHA256(key, ${name}) ***`);
      return;
    }
  }
  
  // Try with 8-byte counter
  console.log('\n=== 8-byte Counter ===\n');
  
  for (let counterSize = 1; counterSize <= 8; counterSize++) {
    const testKeystream = Buffer.alloc(ciphertext.length);
    let offset = 0;
    let counter = 0n;
    
    while (offset < ciphertext.length) {
      const counterBuf = Buffer.alloc(counterSize);
      for (let i = 0; i < counterSize; i++) {
        counterBuf[i] = Number((counter >> BigInt(i * 8)) & 0xFFn);
      }
      
      const block = crypto.createHash('sha256')
        .update(keyBuf)
        .update(nonce)
        .update(counterBuf)
        .digest();
      
      const toCopy = Math.min(32, ciphertext.length - offset);
      block.copy(testKeystream, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: SHA256 with ${counterSize}-byte counter ***`);
      return;
    }
  }
  
  // Try with the key being the hex STRING (not decoded)
  console.log('\n=== Key as String ===\n');
  
  const keyStr = Buffer.from(key, 'utf8'); // 64 bytes
  
  for (const { name, fn } of orderings) {
    const testKeystream = Buffer.alloc(ciphertext.length);
    let offset = 0;
    let counter = 0;
    
    while (offset < ciphertext.length) {
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32LE(counter);
      
      const input = fn(keyStr, nonce, counterBuf);
      const block = crypto.createHash('sha256').update(input).digest();
      
      const toCopy = Math.min(32, ciphertext.length - offset);
      block.copy(testKeystream, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
      console.log(`*** MATCH: SHA256(${name}) with keyStr ***`);
      return;
    }
  }
  
  console.log('No match found.');
}

crackHexa().catch(console.error);
