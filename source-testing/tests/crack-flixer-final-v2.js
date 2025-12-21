/**
 * Crack Flixer.sh - Final V2
 * 
 * We now have a known plaintext-ciphertext-key triple from reverse engineering:
 * 
 * Key: 43c3b6ea2039a302a8112d9432d4267a249f327642c6c283e65f84106f874e88
 * Encrypted: q4BLQxjx6XXbW9sRxmdeXrm2XH9Aptkf1DV1BrwFeYwpULrxSA4U4YEWTt+TofiI/5ciJhUf9OQk4cAwOAtGRSrdgFZcZlfsZQmR23NhRE5wQ+lQjpmzYvDeWb5LYNs+GO8JdAC16k6kEObOCG7FMBnjPzuFNqWG77JHfg2f54fKXBObRPYMWdJ6Nywygc44Vq+oX+YQKQoddEQRdS80iyG0/2Dq+4DuWYDTsjn16Yq2keeYTbefznovDwYHvP9LgCG4CGtiNqfdNL88mNk8QtDka4vU6VLilfbYo+2MZI2zjTS454vEgG4T8uEjnAc7lh6D1988ua9LPKqNpOxcAJ7MeJxIvBhU8vbEQXJqvLaeONO9KRPm51ODtXmIRxoxyyIJ4/hCRVMv1WH64BaQD7zx1DeRZgsdzFrCwPQuFvORezY+tn09BowEfAOjXy5tTwCsVlByKS3QeNczw13jr72cxlKBpgbnXYEtqwzp5hNVGW0W06NiXyTmhTsMzYXiz7AthWgIy4HAq2c=
 * Decrypted: {"sources":[{"server":"foxtrot","url":""},{"server":"alpha","url":""},{"server":"bravo","url":""},{"server":"charlie","url":""},{"server":"delta","url":""},{"server":"echo","url":""}],"skipTime":null}
 * 
 * Let's analyze this to find the encryption algorithm.
 */

const crypto = require('crypto');

// Known data from reverse engineering
const testKey = '43c3b6ea2039a302a8112d9432d4267a249f327642c6c283e65f84106f874e88';
const encryptedBase64 = 'q4BLQxjx6XXbW9sRxmdeXrm2XH9Aptkf1DV1BrwFeYwpULrxSA4U4YEWTt+TofiI/5ciJhUf9OQk4cAwOAtGRSrdgFZcZlfsZQmR23NhRE5wQ+lQjpmzYvDeWb5LYNs+GO8JdAC16k6kEObOCG7FMBnjPzuFNqWG77JHfg2f54fKXBObRPYMWdJ6Nywygc44Vq+oX+YQKQoddEQRdS80iyG0/2Dq+4DuWYDTsjn16Yq2keeYTbefznovDwYHvP9LgCG4CGtiNqfdNL88mNk8QtDka4vU6VLilfbYo+2MZI2zjTS454vEgG4T8uEjnAc7lh6D1988ua9LPKqNpOxcAJ7MeJxIvBhU8vbEQXJqvLaeONO9KRPm51ODtXmIRxoxyyIJ4/hCRVMv1WH64BaQD7zx1DeRZgsdzFrCwPQuFvORezY+tn09BowEfAOjXy5tTwCsVlByKS3QeNczw13jr72cxlKBpgbnXYEtqwzp5hNVGW0W06NiXyTmhTsMzYXiz7AthWgIy4HAq2c=';
const decryptedJson = '{"sources":[{"server":"foxtrot","url":""},{"server":"alpha","url":""},{"server":"bravo","url":""},{"server":"charlie","url":""},{"server":"delta","url":""},{"server":"echo","url":""}],"skipTime":null}';

function analyzeEncryption() {
  console.log('=== Analyzing Flixer Encryption ===\n');
  
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decrypted = Buffer.from(decryptedJson);
  const keyBuf = Buffer.from(testKey, 'hex');
  
  console.log(`Key (hex): ${testKey}`);
  console.log(`Key length: ${keyBuf.length} bytes`);
  console.log(`Encrypted length: ${encrypted.length} bytes`);
  console.log(`Decrypted length: ${decrypted.length} bytes`);
  
  // Derive the keystream by XORing encrypted with decrypted
  const keystream = Buffer.alloc(Math.min(encrypted.length, decrypted.length));
  for (let i = 0; i < keystream.length; i++) {
    keystream[i] = encrypted[i] ^ decrypted[i];
  }
  
  console.log(`\nKeystream (first 64 bytes): ${keystream.subarray(0, 64).toString('hex')}`);
  console.log(`Keystream (bytes 64-128): ${keystream.subarray(64, 128).toString('hex')}`);
  
  // Check if keystream is related to the key
  console.log('\n=== Checking Key Relationships ===\n');
  
  // 1. Direct XOR with key
  const keystreamXorKey = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    keystreamXorKey[i] = keystream[i] ^ keyBuf[i];
  }
  console.log(`Keystream[0:32] XOR key: ${keystreamXorKey.toString('hex')}`);
  
  // 2. Check if keystream is AES output
  // If keystream = AES(key, nonce), then nonce = AES_decrypt(key, keystream)
  const keystreamBlock1 = keystream.subarray(0, 16);
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const nonce = decipher.update(keystreamBlock1);
    console.log(`\nDerived nonce (AES_decrypt(key, keystream[0:16])): ${nonce.toString('hex')}`);
    
    // Now try to decrypt using this nonce with standard CTR
    console.log('\n=== Testing Standard AES-CTR with Derived Nonce ===\n');
    
    const testDecrypted = Buffer.alloc(encrypted.length);
    const numBlocks = Math.ceil(encrypted.length / 16);
    
    for (let block = 0; block < numBlocks; block++) {
      const start = block * 16;
      const end = Math.min(start + 16, encrypted.length);
      
      // Counter block: nonce with last 4 bytes incremented
      const counterBlock = Buffer.from(nonce);
      const counter = counterBlock.readUInt32BE(12) + block;
      counterBlock.writeUInt32BE(counter >>> 0, 12);
      
      // Generate keystream
      const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
      cipher.setAutoPadding(false);
      const ks = cipher.update(counterBlock);
      
      // Decrypt
      for (let i = start; i < end; i++) {
        testDecrypted[i] = encrypted[i] ^ ks[i - start];
      }
    }
    
    const testText = testDecrypted.toString('utf8');
    console.log(`Standard CTR result: ${testText.substring(0, 100)}`);
    
    if (testText === decryptedJson) {
      console.log('\n*** STANDARD AES-256-CTR WORKS! ***');
      console.log(`Nonce: ${nonce.toString('hex')}`);
      return { algorithm: 'aes-256-ctr', nonce: nonce.toString('hex') };
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  // 3. Check if the nonce is embedded in the ciphertext
  console.log('\n=== Checking for Embedded Nonce ===\n');
  
  // Maybe the first 16 bytes are the nonce
  const possibleNonce = encrypted.subarray(0, 16);
  const ciphertext = encrypted.subarray(16);
  
  console.log(`Possible nonce (first 16 bytes): ${possibleNonce.toString('hex')}`);
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, possibleNonce);
    let testDecrypted = decipher.update(ciphertext);
    testDecrypted = Buffer.concat([testDecrypted, decipher.final()]);
    
    const testText = testDecrypted.toString('utf8');
    console.log(`Embedded nonce CTR result: ${testText.substring(0, 100)}`);
    
    if (testText.startsWith('{"sources"')) {
      console.log('\n*** EMBEDDED NONCE AES-256-CTR WORKS! ***');
      return { algorithm: 'aes-256-ctr', noncePosition: 'prefix-16' };
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  // 4. Analyze the keystream pattern
  console.log('\n=== Analyzing Keystream Pattern ===\n');
  
  // Check if keystream blocks are related
  const block0 = keystream.subarray(0, 16);
  const block1 = keystream.subarray(16, 32);
  const block2 = keystream.subarray(32, 48);
  
  console.log(`Block 0: ${block0.toString('hex')}`);
  console.log(`Block 1: ${block1.toString('hex')}`);
  console.log(`Block 2: ${block2.toString('hex')}`);
  
  // XOR consecutive blocks
  const diff01 = Buffer.alloc(16);
  const diff12 = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    diff01[i] = block0[i] ^ block1[i];
    diff12[i] = block1[i] ^ block2[i];
  }
  
  console.log(`\nBlock0 XOR Block1: ${diff01.toString('hex')}`);
  console.log(`Block1 XOR Block2: ${diff12.toString('hex')}`);
  
  // In standard CTR, consecutive keystream blocks should have a predictable relationship
  // because they're AES(key, nonce || counter) and AES(key, nonce || counter+1)
  
  // 5. Try to find the nonce by brute-forcing the counter position
  console.log('\n=== Brute-forcing Counter Position ===\n');
  
  // The nonce might be derived from the key
  const nonceDerivations = [
    { name: 'sha256-first16', nonce: crypto.createHash('sha256').update(keyBuf).digest().subarray(0, 16) },
    { name: 'md5', nonce: crypto.createHash('md5').update(keyBuf).digest() },
    { name: 'hmac-nonce', nonce: crypto.createHmac('sha256', keyBuf).update('nonce').digest().subarray(0, 16) },
    { name: 'hmac-iv', nonce: crypto.createHmac('sha256', keyBuf).update('iv').digest().subarray(0, 16) },
    { name: 'hmac-ctr', nonce: crypto.createHmac('sha256', keyBuf).update('ctr').digest().subarray(0, 16) },
    { name: 'key-first16', nonce: keyBuf.subarray(0, 16) },
    { name: 'key-last16', nonce: keyBuf.subarray(16, 32) },
  ];
  
  for (const nd of nonceDerivations) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, nd.nonce);
      let testDecrypted = decipher.update(encrypted);
      testDecrypted = Buffer.concat([testDecrypted, decipher.final()]);
      
      const testText = testDecrypted.toString('utf8');
      
      if (testText === decryptedJson) {
        console.log(`*** SUCCESS: ${nd.name} ***`);
        console.log(`Nonce: ${nd.nonce.toString('hex')}`);
        return { algorithm: 'aes-256-ctr', nonceDerivation: nd.name, nonce: nd.nonce.toString('hex') };
      }
    } catch (e) {
      // Ignore
    }
  }
  
  console.log('No simple nonce derivation worked');
  
  return null;
}

// Run analysis
const result = analyzeEncryption();

if (result) {
  console.log('\n=== SOLUTION FOUND ===');
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('\n=== No simple solution found ===');
  console.log('The encryption might use a more complex scheme.');
}
