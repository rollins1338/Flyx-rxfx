/**
 * Crack Hexa Encryption v29 - Deep keystream correlation analysis
 * Try to find the relationship between key, nonce, and keystream
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v29 ===\n');
  
  // Collect multiple samples with the same key to analyze patterns
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const keyBuf = Buffer.from(key, 'hex');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  // Collect samples
  const samples = [];
  
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
    
    samples.push({ nonce, keystream, ciphertext });
    console.log(`Sample ${i + 1}: nonce=${nonce.toString('hex')}`);
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Analyze the relationship between nonce and keystream
  console.log('\n=== Keystream Analysis ===\n');
  
  // For each sample, try to find how the keystream is derived
  for (let i = 0; i < samples.length; i++) {
    const { nonce, keystream } = samples[i];
    
    console.log(`\nSample ${i + 1}:`);
    console.log('Nonce:', nonce.toString('hex'));
    console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
    
    // Try various combinations of key and nonce
    const combinations = [
      // Simple concatenations
      { name: 'key||nonce', data: Buffer.concat([keyBuf, nonce]) },
      { name: 'nonce||key', data: Buffer.concat([nonce, keyBuf]) },
      { name: 'key XOR nonce (repeated)', data: xorBuffers(keyBuf, repeatBuffer(nonce, 32)) },
      
      // Hash combinations
      { name: 'SHA256(key||nonce)', data: crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce])).digest() },
      { name: 'SHA256(nonce||key)', data: crypto.createHash('sha256').update(Buffer.concat([nonce, keyBuf])).digest() },
      { name: 'HMAC-SHA256(key, nonce)', data: crypto.createHmac('sha256', keyBuf).update(nonce).digest() },
      { name: 'HMAC-SHA256(nonce, key)', data: crypto.createHmac('sha256', nonce).update(keyBuf).digest() },
      
      // Double hash
      { name: 'SHA256(SHA256(key)||nonce)', data: crypto.createHash('sha256').update(Buffer.concat([crypto.createHash('sha256').update(keyBuf).digest(), nonce])).digest() },
    ];
    
    for (const { name, data } of combinations) {
      // Check if first 32 bytes of keystream match
      if (data.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: ${name} ***`);
      }
      
      // Check if XOR with key gives keystream
      const xored = xorBuffers(data.subarray(0, 32), keyBuf);
      if (xored.equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: ${name} XOR key ***`);
      }
    }
  }
  
  // Try to find if there's a counter-based pattern
  console.log('\n=== Counter-based Analysis ===\n');
  
  const { nonce, keystream } = samples[0];
  
  // Check if keystream blocks have a pattern
  const blockSize = 32; // SHA256 output size
  for (let block = 0; block < 3; block++) {
    const blockData = keystream.subarray(block * blockSize, (block + 1) * blockSize);
    console.log(`Block ${block}: ${blockData.toString('hex')}`);
    
    // Try to derive this block
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32LE(block);
    
    const derivations = [
      crypto.createHash('sha256').update(Buffer.concat([keyBuf, nonce, counterBuf])).digest(),
      crypto.createHash('sha256').update(Buffer.concat([nonce, keyBuf, counterBuf])).digest(),
      crypto.createHash('sha256').update(Buffer.concat([counterBuf, keyBuf, nonce])).digest(),
      crypto.createHmac('sha256', keyBuf).update(Buffer.concat([nonce, counterBuf])).digest(),
    ];
    
    for (let j = 0; j < derivations.length; j++) {
      if (derivations[j].equals(blockData)) {
        console.log(`  Block ${block} matches derivation ${j}!`);
      }
    }
  }
  
  // Try AES in different modes with various key/IV combinations
  console.log('\n=== AES Exhaustive Search ===\n');
  
  const aesKeyDerivations = [
    { name: 'raw', key: keyBuf },
    { name: 'SHA256(key)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'SHA256(keyStr)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'HMAC(key,nonce)', key: crypto.createHmac('sha256', keyBuf).update(nonce).digest() },
    { name: 'HMAC(nonce,key)', key: crypto.createHmac('sha256', nonce).update(keyBuf).digest() },
  ];
  
  const ivDerivations = [
    { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
    { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
    { name: 'SHA256(nonce)[:16]', iv: crypto.createHash('sha256').update(nonce).digest().subarray(0, 16) },
    { name: 'MD5(nonce)', iv: crypto.createHash('md5').update(nonce).digest() },
    { name: 'MD5(key||nonce)', iv: crypto.createHash('md5').update(Buffer.concat([keyBuf, nonce])).digest() },
    { name: 'zeros', iv: Buffer.alloc(16) },
  ];
  
  for (const { name: keyName, key: aesKey } of aesKeyDerivations) {
    for (const { name: ivName, iv } of ivDerivations) {
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', aesKey, iv);
        const testKeystream = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: AES-CTR + ${keyName} + ${ivName} ***`);
          
          // Verify decryption
          const decrypted = Buffer.alloc(samples[0].ciphertext.length);
          for (let j = 0; j < decrypted.length; j++) {
            decrypted[j] = samples[0].ciphertext[j] ^ testKeystream[j];
          }
          console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
          return { algorithm: 'aes-256-ctr', keyDerivation: keyName, ivDerivation: ivName };
        }
      } catch (e) {}
    }
  }
  
  console.log('No match found yet. Continuing...');
}

function xorBuffers(a, b) {
  const result = Buffer.alloc(Math.min(a.length, b.length));
  for (let i = 0; i < result.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

function repeatBuffer(buf, targetLength) {
  const result = Buffer.alloc(targetLength);
  for (let i = 0; i < targetLength; i++) {
    result[i] = buf[i % buf.length];
  }
  return result;
}

crackHexa().catch(console.error);
