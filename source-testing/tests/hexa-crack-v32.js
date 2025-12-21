/**
 * Crack Hexa Encryption v32 - Try ChaCha20 with different implementations
 */

const crypto = require('crypto');

// Manual ChaCha20 implementation
function chacha20Quarter(state, a, b, c, d) {
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = rotl32(state[d] ^ state[a], 16);
  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = rotl32(state[b] ^ state[c], 12);
  state[a] = (state[a] + state[b]) >>> 0;
  state[d] = rotl32(state[d] ^ state[a], 8);
  state[c] = (state[c] + state[d]) >>> 0;
  state[b] = rotl32(state[b] ^ state[c], 7);
}

function rotl32(v, n) {
  return ((v << n) | (v >>> (32 - n))) >>> 0;
}

function chacha20Block(key, nonce, counter) {
  // Initialize state
  const state = new Uint32Array(16);
  
  // Constants "expand 32-byte k"
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  
  // Key (8 words)
  const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
  for (let i = 0; i < 8; i++) {
    state[4 + i] = keyView.getUint32(i * 4, true);
  }
  
  // Counter (1 word)
  state[12] = counter;
  
  // Nonce (3 words)
  const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
  for (let i = 0; i < 3; i++) {
    state[13 + i] = nonceView.getUint32(i * 4, true);
  }
  
  // Copy initial state
  const working = new Uint32Array(state);
  
  // 20 rounds (10 double rounds)
  for (let i = 0; i < 10; i++) {
    // Column rounds
    chacha20Quarter(working, 0, 4, 8, 12);
    chacha20Quarter(working, 1, 5, 9, 13);
    chacha20Quarter(working, 2, 6, 10, 14);
    chacha20Quarter(working, 3, 7, 11, 15);
    // Diagonal rounds
    chacha20Quarter(working, 0, 5, 10, 15);
    chacha20Quarter(working, 1, 6, 11, 12);
    chacha20Quarter(working, 2, 7, 8, 13);
    chacha20Quarter(working, 3, 4, 9, 14);
  }
  
  // Add initial state
  for (let i = 0; i < 16; i++) {
    working[i] = (working[i] + state[i]) >>> 0;
  }
  
  // Convert to bytes
  const output = Buffer.alloc(64);
  const outputView = new DataView(output.buffer);
  for (let i = 0; i < 16; i++) {
    outputView.setUint32(i * 4, working[i], true);
  }
  
  return output;
}

function chacha20Keystream(key, nonce, length) {
  const result = Buffer.alloc(length);
  let offset = 0;
  let counter = 0;
  
  while (offset < length) {
    const block = chacha20Block(key, nonce, counter);
    const toCopy = Math.min(64, length - offset);
    block.copy(result, offset, 0, toCopy);
    offset += toCopy;
    counter++;
  }
  
  return result;
}

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v32 ===\n');
  
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
  
  const actualKeystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    actualKeystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Actual keystream[0:64]:', actualKeystream.subarray(0, 64).toString('hex'));
  
  // Try manual ChaCha20 implementation
  console.log('\n=== Manual ChaCha20 ===\n');
  
  const keyVariants = [
    { name: 'raw', key: new Uint8Array(keyBuf) },
    { name: 'sha256(keyStr)', key: new Uint8Array(crypto.createHash('sha256').update(key).digest()) },
    { name: 'sha256(keyBuf)', key: new Uint8Array(crypto.createHash('sha256').update(keyBuf).digest()) },
  ];
  
  for (const { name, key: derivedKey } of keyVariants) {
    const testKeystream = chacha20Keystream(derivedKey, new Uint8Array(nonce), ciphertext.length);
    
    console.log(`${name}:`);
    console.log(`  Generated: ${testKeystream.subarray(0, 32).toString('hex')}`);
    console.log(`  Actual:    ${actualKeystream.subarray(0, 32).toString('hex')}`);
    
    if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
      console.log(`*** MATCH: Manual ChaCha20 + ${name} ***`);
      return;
    }
  }
  
  // Try with different nonce positions in the state
  console.log('\n=== Different Nonce Positions ===\n');
  
  // Some implementations put counter after nonce
  function chacha20BlockAlt(key, nonce, counter) {
    const state = new Uint32Array(16);
    
    state[0] = 0x61707865;
    state[1] = 0x3320646e;
    state[2] = 0x79622d32;
    state[3] = 0x6b206574;
    
    const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
    for (let i = 0; i < 8; i++) {
      state[4 + i] = keyView.getUint32(i * 4, true);
    }
    
    // Nonce first, then counter
    const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
    for (let i = 0; i < 3; i++) {
      state[12 + i] = nonceView.getUint32(i * 4, true);
    }
    state[15] = counter;
    
    const working = new Uint32Array(state);
    
    for (let i = 0; i < 10; i++) {
      chacha20Quarter(working, 0, 4, 8, 12);
      chacha20Quarter(working, 1, 5, 9, 13);
      chacha20Quarter(working, 2, 6, 10, 14);
      chacha20Quarter(working, 3, 7, 11, 15);
      chacha20Quarter(working, 0, 5, 10, 15);
      chacha20Quarter(working, 1, 6, 11, 12);
      chacha20Quarter(working, 2, 7, 8, 13);
      chacha20Quarter(working, 3, 4, 9, 14);
    }
    
    for (let i = 0; i < 16; i++) {
      working[i] = (working[i] + state[i]) >>> 0;
    }
    
    const output = Buffer.alloc(64);
    const outputView = new DataView(output.buffer);
    for (let i = 0; i < 16; i++) {
      outputView.setUint32(i * 4, working[i], true);
    }
    
    return output;
  }
  
  function chacha20KeystreamAlt(key, nonce, length) {
    const result = Buffer.alloc(length);
    let offset = 0;
    let counter = 0;
    
    while (offset < length) {
      const block = chacha20BlockAlt(key, nonce, counter);
      const toCopy = Math.min(64, length - offset);
      block.copy(result, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    return result;
  }
  
  for (const { name, key: derivedKey } of keyVariants) {
    const testKeystream = chacha20KeystreamAlt(derivedKey, new Uint8Array(nonce), ciphertext.length);
    
    if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
      console.log(`*** MATCH: ChaCha20 Alt + ${name} ***`);
      return;
    }
  }
  
  // Try with big-endian
  console.log('\n=== Big Endian ===\n');
  
  function chacha20BlockBE(key, nonce, counter) {
    const state = new Uint32Array(16);
    
    state[0] = 0x61707865;
    state[1] = 0x3320646e;
    state[2] = 0x79622d32;
    state[3] = 0x6b206574;
    
    const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
    for (let i = 0; i < 8; i++) {
      state[4 + i] = keyView.getUint32(i * 4, false); // Big endian
    }
    
    state[12] = counter;
    
    const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
    for (let i = 0; i < 3; i++) {
      state[13 + i] = nonceView.getUint32(i * 4, false); // Big endian
    }
    
    const working = new Uint32Array(state);
    
    for (let i = 0; i < 10; i++) {
      chacha20Quarter(working, 0, 4, 8, 12);
      chacha20Quarter(working, 1, 5, 9, 13);
      chacha20Quarter(working, 2, 6, 10, 14);
      chacha20Quarter(working, 3, 7, 11, 15);
      chacha20Quarter(working, 0, 5, 10, 15);
      chacha20Quarter(working, 1, 6, 11, 12);
      chacha20Quarter(working, 2, 7, 8, 13);
      chacha20Quarter(working, 3, 4, 9, 14);
    }
    
    for (let i = 0; i < 16; i++) {
      working[i] = (working[i] + state[i]) >>> 0;
    }
    
    const output = Buffer.alloc(64);
    const outputView = new DataView(output.buffer);
    for (let i = 0; i < 16; i++) {
      outputView.setUint32(i * 4, working[i], false); // Big endian
    }
    
    return output;
  }
  
  function chacha20KeystreamBE(key, nonce, length) {
    const result = Buffer.alloc(length);
    let offset = 0;
    let counter = 0;
    
    while (offset < length) {
      const block = chacha20BlockBE(key, nonce, counter);
      const toCopy = Math.min(64, length - offset);
      block.copy(result, offset, 0, toCopy);
      offset += toCopy;
      counter++;
    }
    
    return result;
  }
  
  for (const { name, key: derivedKey } of keyVariants) {
    const testKeystream = chacha20KeystreamBE(derivedKey, new Uint8Array(nonce), ciphertext.length);
    
    if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
      console.log(`*** MATCH: ChaCha20 BE + ${name} ***`);
      return;
    }
  }
  
  console.log('No match found.');
}

crackHexa().catch(console.error);
