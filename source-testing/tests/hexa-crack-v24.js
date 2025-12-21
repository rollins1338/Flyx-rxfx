/**
 * Crack Hexa Encryption v24 - Compare keystreams in detail
 */

const crypto = require('crypto');

async function crackHexa() {
  const chacha = await import('@noble/ciphers/chacha.js');
  
  console.log('=== Cracking Hexa Encryption v24 ===\n');
  
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
  
  // Verify with enc-dec.app
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  const decResult = await decResponse.json();
  const expectedStr = JSON.stringify(decResult.result);
  
  const encBytes = Buffer.from(encrypted, 'base64');
  const expectedBytes = Buffer.from(expectedStr, 'utf8');
  
  const nonce = new Uint8Array(encBytes.subarray(0, 12));
  const ciphertext = new Uint8Array(encBytes.subarray(12));
  
  console.log('Nonce:', Buffer.from(nonce).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Extract actual keystream
  const actualKeystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    actualKeystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Actual keystream[0:32]:', actualKeystream.subarray(0, 32).toString('hex'));
  
  // Generate ChaCha20 keystream and compare
  console.log('\n=== Comparing keystreams ===\n');
  
  const keyVariants = [
    { name: 'raw', key: new Uint8Array(keyBuf) },
    { name: 'sha256(str)', key: new Uint8Array(crypto.createHash('sha256').update(key).digest()) },
    { name: 'sha256(bytes)', key: new Uint8Array(crypto.createHash('sha256').update(keyBuf).digest()) },
  ];
  
  for (const { name, key: derivedKey } of keyVariants) {
    // Generate keystream by XORing zeros
    const zeros = new Uint8Array(ciphertext.length);
    const encrypted = chacha.chacha20(derivedKey, nonce, zeros);
    const generatedKeystream = Buffer.from(encrypted);
    
    console.log(`${name}:`);
    console.log(`  Generated: ${generatedKeystream.subarray(0, 32).toString('hex')}`);
    console.log(`  Actual:    ${actualKeystream.subarray(0, 32).toString('hex')}`);
    console.log(`  Match: ${generatedKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))}`);
    
    // Check if there's a constant XOR difference
    const diff = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      diff[i] = generatedKeystream[i] ^ actualKeystream[i];
    }
    console.log(`  XOR diff: ${diff.toString('hex')}`);
    console.log();
  }
  
  // Try XChaCha20 with 24-byte nonce
  console.log('=== XChaCha20 ===\n');
  
  for (const { name, key: derivedKey } of keyVariants) {
    const nonce24 = new Uint8Array(24);
    nonce.forEach((b, i) => nonce24[i] = b);
    
    const zeros = new Uint8Array(ciphertext.length);
    const encrypted = chacha.xchacha20(derivedKey, nonce24, zeros);
    const generatedKeystream = Buffer.from(encrypted);
    
    console.log(`${name}:`);
    console.log(`  Generated: ${generatedKeystream.subarray(0, 32).toString('hex')}`);
    console.log(`  Match: ${generatedKeystream.subarray(0, 32).equals(actualKeystream.subarray(0, 32))}`);
  }
  
  // Maybe the nonce is at a different position or the structure is different
  console.log('\n=== Try different structures ===\n');
  
  // Maybe: ciphertext + nonce (nonce at end)
  const nonceAtEnd = new Uint8Array(encBytes.subarray(-12));
  const ciphertextNoNonce = new Uint8Array(encBytes.subarray(0, -12));
  
  console.log('If nonce at end:');
  console.log('  Nonce:', Buffer.from(nonceAtEnd).toString('hex'));
  console.log('  Ciphertext length:', ciphertextNoNonce.length);
  
  if (ciphertextNoNonce.length === expectedBytes.length) {
    const keystreamAlt = Buffer.alloc(ciphertextNoNonce.length);
    for (let i = 0; i < ciphertextNoNonce.length; i++) {
      keystreamAlt[i] = ciphertextNoNonce[i] ^ expectedBytes[i];
    }
    
    for (const { name, key: derivedKey } of keyVariants) {
      const zeros = new Uint8Array(ciphertextNoNonce.length);
      const encrypted = chacha.chacha20(derivedKey, nonceAtEnd, zeros);
      const generatedKeystream = Buffer.from(encrypted);
      
      if (generatedKeystream.subarray(0, 32).equals(keystreamAlt.subarray(0, 32))) {
        console.log(`*** MATCH with nonce at end: ${name} ***`);
        
        const decrypted = chacha.chacha20(derivedKey, nonceAtEnd, ciphertextNoNonce);
        console.log('Decrypted:', Buffer.from(decrypted).toString('utf8').slice(0, 200));
        return;
      }
    }
  }
  
  console.log('\nNo match found.');
}

crackHexa().catch(console.error);
