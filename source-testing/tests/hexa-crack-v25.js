/**
 * Crack Hexa Encryption v25 - Analyze multiple requests with same key
 */

const crypto = require('crypto');

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v25 ===\n');
  
  // Use a fixed key for multiple requests
  const key = 'a'.repeat(64);
  console.log('Key:', key);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  // Make multiple requests with the same key
  const results = [];
  
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
    
    // Extract keystream
    const keystream = Buffer.alloc(ciphertext.length);
    for (let j = 0; j < ciphertext.length; j++) {
      keystream[j] = ciphertext[j] ^ expectedBytes[j];
    }
    
    results.push({
      nonce: nonce.toString('hex'),
      keystreamFirst32: keystream.subarray(0, 32).toString('hex'),
      encLength: encBytes.length,
      plainLength: expectedBytes.length,
    });
    
    console.log(`Request ${i + 1}:`);
    console.log(`  Nonce: ${nonce.toString('hex')}`);
    console.log(`  Keystream[0:32]: ${keystream.subarray(0, 32).toString('hex')}`);
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Check if nonces are different (they should be for secure encryption)
  console.log('\n=== Analysis ===');
  const uniqueNonces = new Set(results.map(r => r.nonce));
  console.log('Unique nonces:', uniqueNonces.size, '/', results.length);
  
  // Check if keystreams are different when nonces are different
  const uniqueKeystreams = new Set(results.map(r => r.keystreamFirst32));
  console.log('Unique keystreams:', uniqueKeystreams.size, '/', results.length);
  
  // If nonces are different but keystreams have a pattern, we might find something
  
  // Let's also try to see if the keystream is related to the nonce
  console.log('\n=== Keystream-Nonce relationship ===');
  
  for (const result of results) {
    const nonceBuf = Buffer.from(result.nonce, 'hex');
    const keystreamBuf = Buffer.from(result.keystreamFirst32, 'hex');
    
    // XOR first 12 bytes of keystream with nonce
    const xorWithNonce = Buffer.alloc(12);
    for (let i = 0; i < 12; i++) {
      xorWithNonce[i] = keystreamBuf[i] ^ nonceBuf[i];
    }
    console.log(`Keystream[0:12] XOR nonce: ${xorWithNonce.toString('hex')}`);
  }
  
  // Try to find if there's a constant in the XOR
  console.log('\n=== Looking for constants ===');
  
  const keyBuf = Buffer.from(key, 'hex'); // 32 bytes of 0xaa
  console.log('Key (decoded):', keyBuf.toString('hex'));
  
  for (const result of results) {
    const keystreamBuf = Buffer.from(result.keystreamFirst32, 'hex');
    
    // XOR keystream with key
    const xorWithKey = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xorWithKey[i] = keystreamBuf[i] ^ keyBuf[i];
    }
    console.log(`Keystream XOR key: ${xorWithKey.toString('hex')}`);
  }
}

crackHexa().catch(console.error);
