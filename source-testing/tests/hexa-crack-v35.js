/**
 * Crack Hexa Encryption v35 - Statistical analysis + more algorithms
 * 
 * New approaches:
 * 1. Analyze keystream for patterns
 * 2. Test RC4 with various key derivations
 * 3. Test custom PRNG-based ciphers
 * 4. Test AES-CFB, AES-OFB modes
 * 5. Test with key as string vs bytes
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v35 ===\n');
  
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
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:64]:', actualKeystream.subarray(0, 64).toString('hex'));
  console.log('Ciphertext length:', ciphertext.length);
  
  // Statistical analysis of keystream
  console.log('\n=== Keystream Statistical Analysis ===');
  analyzeKeystream(actualKeystream);
  
  // Test RC4 with various keys
  console.log('\n=== Testing RC4 ===');
  const rc4Keys = [
    { name: 'keyBuf', key: keyBuf },
    { name: 'keyStr', key: keyStr },
    { name: 'key', key: Buffer.from(key) },
    { name: 'nonce||keyBuf', key: Buffer.concat([nonce, keyBuf]) },
    { name: 'keyBuf||nonce', key: Buffer.concat([keyBuf, nonce]) },
    { name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'sha256(keyStr)', key: crypto.createHash('sha256').update(keyStr).digest() },
    { name: 'sha256(nonce||keyBuf)', key: crypto.createHash('sha256').update(Buffer.concat([nonce, keyBuf])).digest() },
    { name: 'sha256(keyBuf||nonce)', key: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest() },
  ];
  
  for (const { name, key: rc4Key } of rc4Keys) {
    const keystream = rc4(rc4Key, ciphertext.length);
    if (keystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
      console.log(`*** RC4 MATCH: ${name} ***`);
      return;
    }
    
    // Try dropping first N bytes (RC4-drop)
    for (const drop of [256, 512, 768, 1024, 3072]) {
      const droppedKeystream = rc4(rc4Key, ciphertext.length + drop).subarray(drop);
      if (droppedKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
        console.log(`*** RC4-drop${drop} MATCH: ${name} ***`);
        return;
      }
    }
  }
  console.log('RC4: No match');
  
  // Test AES-CFB and AES-OFB
  console.log('\n=== Testing AES-CFB/OFB ===');
  const keyDerivations = [
    { name: 'keyBuf', key: keyBuf },
    { name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'sha256(keyStr)', key: crypto.createHash('sha256').update(keyStr).digest() },
    { name: 'sha256(nonce||keyBuf)', key: crypto.createHash('sha256').update(Buffer.concat([nonce, keyBuf])).digest() },
  ];
  
  const ivDerivations = [
    { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
    { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
    { name: 'sha256(nonce)[:16]', iv: crypto.createHash('sha256').update(nonce).digest().subarray(0, 16) },
    { name: 'md5(nonce)', iv: crypto.createHash('md5').update(nonce).digest() },
    { name: 'zeros', iv: Buffer.alloc(16) },
  ];
  
  for (const mode of ['aes-256-cfb', 'aes-256-ofb', 'aes-256-cfb8', 'aes-256-cfb1']) {
    for (const { name: keyName, key: derivedKey } of keyDerivations) {
      for (const { name: ivName, iv } of ivDerivations) {
        try {
          const cipher = crypto.createCipheriv(mode, derivedKey, iv);
          const testKeystream = cipher.update(Buffer.alloc(ciphertext.length));
          
          if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
            console.log(`*** MATCH: ${mode} + ${keyName} + ${ivName} ***`);
            return;
          }
        } catch (e) {}
      }
    }
  }
  console.log('AES-CFB/OFB: No match');
  
  // Test with key as UTF-8 string (64 chars)
  console.log('\n=== Testing with key as UTF-8 string ===');
  const keyUtf8 = Buffer.from(key, 'utf8'); // 64 bytes
  
  for (const mode of ['aes-256-ctr', 'aes-256-cfb', 'aes-256-ofb']) {
    for (const { name: ivName, iv } of ivDerivations) {
      try {
        // Use first 32 bytes of UTF-8 key
        const cipher = crypto.createCipheriv(mode, keyUtf8.subarray(0, 32), iv);
        const testKeystream = cipher.update(Buffer.alloc(ciphertext.length));
        
        if (testKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))) {
          console.log(`*** MATCH: ${mode} + keyUtf8[:32] + ${ivName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('UTF-8 key: No match');
  
  // Test custom PRNG-based keystream
  console.log('\n=== Testing Custom PRNG ===');
  testCustomPRNG(keyBuf, nonce, actualKeystream);
  
  console.log('\nNo match found.');
}

function rc4(key, length) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  const output = Buffer.alloc(length);
  let i = 0;
  j = 0;
  for (let k = 0; k < length; k++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    output[k] = S[(S[i] + S[j]) & 0xff];
  }
  
  return output;
}

function analyzeKeystream(keystream) {
  // Check for repeating patterns
  const first32 = keystream.subarray(0, 32);
  
  // Check byte distribution
  const counts = new Array(256).fill(0);
  for (let i = 0; i < keystream.length; i++) {
    counts[keystream[i]]++;
  }
  
  const expected = keystream.length / 256;
  let chiSquare = 0;
  for (let i = 0; i < 256; i++) {
    chiSquare += Math.pow(counts[i] - expected, 2) / expected;
  }
  console.log('Chi-square:', chiSquare.toFixed(2), '(expected ~255 for random)');
  
  // Check for sequential patterns
  let ascending = 0, descending = 0;
  for (let i = 1; i < keystream.length; i++) {
    if (keystream[i] > keystream[i-1]) ascending++;
    if (keystream[i] < keystream[i-1]) descending++;
  }
  console.log('Ascending pairs:', ascending, 'Descending:', descending);
  
  // Check for XOR patterns with position
  console.log('\nFirst 16 bytes XOR with position:');
  for (let i = 0; i < 16; i++) {
    console.log(`  [${i}]: ${keystream[i].toString(16).padStart(2, '0')} ^ ${i} = ${(keystream[i] ^ i).toString(16).padStart(2, '0')}`);
  }
}

function testCustomPRNG(key, nonce, actualKeystream) {
  // Test mulberry32 PRNG
  const seeds = [
    { name: 'key[0:4] LE', seed: key.readUInt32LE(0) },
    { name: 'key[0:4] BE', seed: key.readUInt32BE(0) },
    { name: 'nonce[0:4] LE', seed: nonce.readUInt32LE(0) },
    { name: 'nonce[0:4] BE', seed: nonce.readUInt32BE(0) },
    { name: 'key[0:4]^nonce[0:4]', seed: key.readUInt32LE(0) ^ nonce.readUInt32LE(0) },
  ];
  
  for (const { name, seed } of seeds) {
    const keystream = mulberry32Keystream(seed, actualKeystream.length);
    if (keystream.subarray(0, 16).equals(actualKeystream.subarray(0, 16))) {
      console.log(`*** Mulberry32 MATCH: ${name} ***`);
      return;
    }
  }
  console.log('Custom PRNG: No match');
}

function mulberry32Keystream(seed, length) {
  const output = Buffer.alloc(length);
  let state = seed >>> 0;
  
  for (let i = 0; i < length; i++) {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    output[i] = ((t ^ (t >>> 14)) >>> 0) & 0xff;
  }
  
  return output;
}

crackHexa().catch(console.error);
