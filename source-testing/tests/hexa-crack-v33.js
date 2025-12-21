/**
 * Crack Hexa Encryption v33 - Try Salsa20 and other stream ciphers
 */

const crypto = require('crypto');

// Salsa20 implementation
function salsa20Quarter(y, a, b, c, d) {
  y[b] ^= rotl32((y[a] + y[d]) >>> 0, 7);
  y[c] ^= rotl32((y[b] + y[a]) >>> 0, 9);
  y[d] ^= rotl32((y[c] + y[b]) >>> 0, 13);
  y[a] ^= rotl32((y[d] + y[c]) >>> 0, 18);
}

function rotl32(v, n) {
  return ((v << n) | (v >>> (32 - n))) >>> 0;
}

function salsa20Block(key, nonce, counter) {
  const state = new Uint32Array(16);
  
  // Constants "expand 32-byte k"
  state[0] = 0x61707865;
  state[5] = 0x3320646e;
  state[10] = 0x79622d32;
  state[15] = 0x6b206574;
  
  // Key
  const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
  state[1] = keyView.getUint32(0, true);
  state[2] = keyView.getUint32(4, true);
  state[3] = keyView.getUint32(8, true);
  state[4] = keyView.getUint32(12, true);
  state[11] = keyView.getUint32(16, true);
  state[12] = keyView.getUint32(20, true);
  state[13] = keyView.getUint32(24, true);
  state[14] = keyView.getUint32(28, true);
  
  // Nonce and counter
  const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
  state[6] = nonceView.getUint32(0, true);
  state[7] = nonceView.getUint32(4, true);
  state[8] = counter & 0xFFFFFFFF;
  state[9] = (counter / 0x100000000) >>> 0;
  
  const working = new Uint32Array(state);
  
  // 20 rounds
  for (let i = 0; i < 10; i++) {
    // Column rounds
    salsa20Quarter(working, 0, 4, 8, 12);
    salsa20Quarter(working, 5, 9, 13, 1);
    salsa20Quarter(working, 10, 14, 2, 6);
    salsa20Quarter(working, 15, 3, 7, 11);
    // Row rounds
    salsa20Quarter(working, 0, 1, 2, 3);
    salsa20Quarter(working, 5, 6, 7, 4);
    salsa20Quarter(working, 10, 11, 8, 9);
    salsa20Quarter(working, 15, 12, 13, 14);
  }
  
  // Add initial state
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

function salsa20Keystream(key, nonce, length) {
  const result = Buffer.alloc(length);
  let offset = 0;
  let counter = 0;
  
  while (offset < length) {
    const block = salsa20Block(key, nonce, counter);
    const toCopy = Math.min(64, length - offset);
    block.copy(result, offset, 0, toCopy);
    offset += toCopy;
    counter++;
  }
  
  return result;
}

// XSalsa20 - uses HSalsa20 to derive subkey
function hsalsa20(key, nonce16) {
  const state = new Uint32Array(16);
  
  state[0] = 0x61707865;
  state[5] = 0x3320646e;
  state[10] = 0x79622d32;
  state[15] = 0x6b206574;
  
  const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
  state[1] = keyView.getUint32(0, true);
  state[2] = keyView.getUint32(4, true);
  state[3] = keyView.getUint32(8, true);
  state[4] = keyView.getUint32(12, true);
  state[11] = keyView.getUint32(16, true);
  state[12] = keyView.getUint32(20, true);
  state[13] = keyView.getUint32(24, true);
  state[14] = keyView.getUint32(28, true);
  
  const nonceView = new DataView(nonce16.buffer, nonce16.byteOffset, nonce16.byteLength);
  state[6] = nonceView.getUint32(0, true);
  state[7] = nonceView.getUint32(4, true);
  state[8] = nonceView.getUint32(8, true);
  state[9] = nonceView.getUint32(12, true);
  
  for (let i = 0; i < 10; i++) {
    salsa20Quarter(state, 0, 4, 8, 12);
    salsa20Quarter(state, 5, 9, 13, 1);
    salsa20Quarter(state, 10, 14, 2, 6);
    salsa20Quarter(state, 15, 3, 7, 11);
    salsa20Quarter(state, 0, 1, 2, 3);
    salsa20Quarter(state, 5, 6, 7, 4);
    salsa20Quarter(state, 10, 11, 8, 9);
    salsa20Quarter(state, 15, 12, 13, 14);
  }
  
  const subkey = Buffer.alloc(32);
  const subkeyView = new DataView(subkey.buffer);
  subkeyView.setUint32(0, state[0], true);
  subkeyView.setUint32(4, state[5], true);
  subkeyView.setUint32(8, state[10], true);
  subkeyView.setUint32(12, state[15], true);
  subkeyView.setUint32(16, state[6], true);
  subkeyView.setUint32(20, state[7], true);
  subkeyView.setUint32(24, state[8], true);
  subkeyView.setUint32(28, state[9], true);
  
  return new Uint8Array(subkey);
}

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v33 ===\n');
  
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
  console.log('Actual keystream[0:32]:', actualKeystream.subarray(0, 32).toString('hex'));
  
  const keyVariants = [
    { name: 'raw', key: new Uint8Array(keyBuf) },
    { name: 'sha256(keyStr)', key: new Uint8Array(crypto.createHash('sha256').update(key).digest()) },
    { name: 'sha256(keyBuf)', key: new Uint8Array(crypto.createHash('sha256').update(keyBuf).digest()) },
  ];
  
  // Try Salsa20 with 8-byte nonce
  console.log('\n=== Salsa20 (8-byte nonce) ===\n');
  
  const nonce8 = nonce.subarray(0, 8);
  
  for (const { name, key: derivedKey } of keyVariants) {
    const testKeystream = salsa20Keystream(derivedKey, new Uint8Array(nonce8), ciphertext.length);
    
    if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
      console.log(`*** MATCH: Salsa20 + ${name} ***`);
      return;
    }
  }
  
  // Try XSalsa20 with 24-byte nonce (pad our 12-byte nonce)
  console.log('\n=== XSalsa20 (24-byte nonce) ===\n');
  
  const nonce24 = Buffer.alloc(24);
  nonce.copy(nonce24, 0);
  
  for (const { name, key: derivedKey } of keyVariants) {
    // Derive subkey using HSalsa20
    const nonce16 = new Uint8Array(nonce24.subarray(0, 16));
    const subkey = hsalsa20(derivedKey, nonce16);
    
    // Use remaining 8 bytes as Salsa20 nonce
    const nonce8 = new Uint8Array(nonce24.subarray(16, 24));
    
    const testKeystream = salsa20Keystream(subkey, nonce8, ciphertext.length);
    
    if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
      console.log(`*** MATCH: XSalsa20 + ${name} ***`);
      return;
    }
  }
  
  // Try with different nonce padding
  console.log('\n=== Different Nonce Padding ===\n');
  
  const noncePaddings = [
    { name: 'nonce||zeros', nonce: Buffer.concat([nonce, Buffer.alloc(12)]) },
    { name: 'zeros||nonce', nonce: Buffer.concat([Buffer.alloc(12), nonce]) },
    { name: 'nonce||nonce', nonce: Buffer.concat([nonce, nonce]) },
  ];
  
  for (const { name: nonceName, nonce: paddedNonce } of noncePaddings) {
    for (const { name: keyName, key: derivedKey } of keyVariants) {
      const nonce16 = new Uint8Array(paddedNonce.subarray(0, 16));
      const subkey = hsalsa20(derivedKey, nonce16);
      const nonce8 = new Uint8Array(paddedNonce.subarray(16, 24));
      
      const testKeystream = salsa20Keystream(subkey, nonce8, ciphertext.length);
      
      if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
        console.log(`*** MATCH: XSalsa20 + ${keyName} + ${nonceName} ***`);
        return;
      }
    }
  }
  
  // Try simple RC4-like cipher
  console.log('\n=== RC4-like Cipher ===\n');
  
  function rc4Keystream(key, length) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key[i % key.length]) & 0xFF;
      [S[i], S[j]] = [S[j], S[i]];
    }
    
    const result = Buffer.alloc(length);
    let i = 0;
    j = 0;
    for (let k = 0; k < length; k++) {
      i = (i + 1) & 0xFF;
      j = (j + S[i]) & 0xFF;
      [S[i], S[j]] = [S[j], S[i]];
      result[k] = S[(S[i] + S[j]) & 0xFF];
    }
    
    return result;
  }
  
  // Try RC4 with different key constructions
  const rc4Keys = [
    { name: 'key', key: keyBuf },
    { name: 'key||nonce', key: Buffer.concat([keyBuf, nonce]) },
    { name: 'nonce||key', key: Buffer.concat([nonce, keyBuf]) },
    { name: 'sha256(key||nonce)', key: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest() },
  ];
  
  for (const { name, key: rc4Key } of rc4Keys) {
    const testKeystream = rc4Keystream(rc4Key, ciphertext.length);
    
    if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
      console.log(`*** MATCH: RC4 + ${name} ***`);
      return;
    }
  }
  
  console.log('No match found.');
}

crackHexa().catch(console.error);
