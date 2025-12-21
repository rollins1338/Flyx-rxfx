/**
 * Crack Flixer.sh - Final V3
 * 
 * The first 16 bytes decrypt correctly with standard AES-CTR.
 * Subsequent blocks fail, meaning the counter increment is non-standard.
 * 
 * Let's analyze the counter blocks to find the pattern.
 */

const crypto = require('crypto');

// Known data from reverse engineering
const testKey = '43c3b6ea2039a302a8112d9432d4267a249f327642c6c283e65f84106f874e88';
const encryptedBase64 = 'q4BLQxjx6XXbW9sRxmdeXrm2XH9Aptkf1DV1BrwFeYwpULrxSA4U4YEWTt+TofiI/5ciJhUf9OQk4cAwOAtGRSrdgFZcZlfsZQmR23NhRE5wQ+lQjpmzYvDeWb5LYNs+GO8JdAC16k6kEObOCG7FMBnjPzuFNqWG77JHfg2f54fKXBObRPYMWdJ6Nywygc44Vq+oX+YQKQoddEQRdS80iyG0/2Dq+4DuWYDTsjn16Yq2keeYTbefznovDwYHvP9LgCG4CGtiNqfdNL88mNk8QtDka4vU6VLilfbYo+2MZI2zjTS454vEgG4T8uEjnAc7lh6D1988ua9LPKqNpOxcAJ7MeJxIvBhU8vbEQXJqvLaeONO9KRPm51ODtXmIRxoxyyIJ4/hCRVMv1WH64BaQD7zx1DeRZgsdzFrCwPQuFvORezY+tn09BowEfAOjXy5tTwCsVlByKS3QeNczw13jr72cxlKBpgbnXYEtqwzp5hNVGW0W06NiXyTmhTsMzYXiz7AthWgIy4HAq2c=';
const decryptedJson = '{"sources":[{"server":"foxtrot","url":""},{"server":"alpha","url":""},{"server":"bravo","url":""},{"server":"charlie","url":""},{"server":"delta","url":""},{"server":"echo","url":""}],"skipTime":null}';

function analyzeCounterBlocks() {
  console.log('=== Analyzing Counter Blocks ===\n');
  
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decrypted = Buffer.from(decryptedJson);
  const keyBuf = Buffer.from(testKey, 'hex');
  
  // Derive keystream
  const keystream = Buffer.alloc(Math.min(encrypted.length, decrypted.length));
  for (let i = 0; i < keystream.length; i++) {
    keystream[i] = encrypted[i] ^ decrypted[i];
  }
  
  // For each 16-byte block, derive the counter block
  // keystream_block = AES_encrypt(key, counter_block)
  // counter_block = AES_decrypt(key, keystream_block)
  
  const numBlocks = Math.floor(keystream.length / 16);
  const counterBlocks = [];
  
  console.log('Counter blocks (derived from keystream):\n');
  
  for (let block = 0; block < numBlocks; block++) {
    const keystreamBlock = keystream.subarray(block * 16, (block + 1) * 16);
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(keystreamBlock);
    
    counterBlocks.push(counterBlock);
    
    console.log(`Block ${block}: ${counterBlock.toString('hex')}`);
  }
  
  // Analyze the relationship between counter blocks
  console.log('\n=== Counter Block Relationships ===\n');
  
  // XOR consecutive counter blocks
  for (let i = 1; i < counterBlocks.length; i++) {
    const diff = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      diff[j] = counterBlocks[i][j] ^ counterBlocks[i-1][j];
    }
    console.log(`Block ${i-1} XOR Block ${i}: ${diff.toString('hex')}`);
  }
  
  // Check if counter blocks follow a pattern
  console.log('\n=== Checking Counter Patterns ===\n');
  
  // In standard CTR, counter_n = nonce || n (big-endian)
  // Let's check if the last 4 bytes are incrementing
  
  console.log('Last 4 bytes of each counter block:');
  for (let i = 0; i < counterBlocks.length; i++) {
    const last4 = counterBlocks[i].subarray(12, 16);
    const value = last4.readUInt32BE(0);
    console.log(`Block ${i}: ${last4.toString('hex')} (decimal: ${value})`);
  }
  
  // Check if the first 12 bytes are constant (nonce)
  console.log('\nFirst 12 bytes of each counter block:');
  for (let i = 0; i < counterBlocks.length; i++) {
    const first12 = counterBlocks[i].subarray(0, 12);
    console.log(`Block ${i}: ${first12.toString('hex')}`);
  }
  
  // Check if counter blocks are related to the key
  console.log('\n=== Checking Key Relationships ===\n');
  
  for (let i = 0; i < counterBlocks.length; i++) {
    const xorWithKey = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      xorWithKey[j] = counterBlocks[i][j] ^ keyBuf[j];
    }
    console.log(`Block ${i} XOR key[0:16]: ${xorWithKey.toString('hex')}`);
  }
  
  // Maybe the counter is XORed with something derived from the key
  console.log('\n=== Trying to Find Counter Pattern ===\n');
  
  // If counter_n = base_nonce XOR f(n), let's find f(n)
  const baseNonce = counterBlocks[0];
  
  for (let i = 1; i < counterBlocks.length; i++) {
    const diff = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      diff[j] = counterBlocks[i][j] ^ baseNonce[j];
    }
    console.log(`Counter ${i} XOR Counter 0: ${diff.toString('hex')}`);
    
    // Check if this is related to i
    const expectedDiff = Buffer.alloc(16, 0);
    expectedDiff.writeUInt32BE(i, 12);
    console.log(`Expected (standard CTR): ${expectedDiff.toString('hex')}`);
    console.log(`Match: ${diff.equals(expectedDiff)}`);
    console.log();
  }
  
  return counterBlocks;
}

function tryCustomCounterModes() {
  console.log('\n=== Trying Custom Counter Modes ===\n');
  
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const keyBuf = Buffer.from(testKey, 'hex');
  
  // Get the base nonce from the first keystream block
  const decrypted = Buffer.from(decryptedJson);
  const keystreamBlock0 = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    keystreamBlock0[i] = encrypted[i] ^ decrypted[i];
  }
  
  const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
  decipher.setAutoPadding(false);
  const baseNonce = decipher.update(keystreamBlock0);
  
  console.log(`Base nonce: ${baseNonce.toString('hex')}`);
  
  // Try different counter increment patterns
  const patterns = [
    // Standard: increment last 4 bytes
    { name: 'standard-be32', increment: (nonce, n) => {
      const counter = Buffer.from(nonce);
      const val = counter.readUInt32BE(12) + n;
      counter.writeUInt32BE(val >>> 0, 12);
      return counter;
    }},
    // Little-endian counter
    { name: 'le32', increment: (nonce, n) => {
      const counter = Buffer.from(nonce);
      const val = counter.readUInt32LE(12) + n;
      counter.writeUInt32LE(val >>> 0, 12);
      return counter;
    }},
    // XOR with block number
    { name: 'xor-last-byte', increment: (nonce, n) => {
      const counter = Buffer.from(nonce);
      counter[15] ^= n;
      return counter;
    }},
    // XOR with block number at different positions
    { name: 'xor-byte-12', increment: (nonce, n) => {
      const counter = Buffer.from(nonce);
      counter[12] ^= n;
      return counter;
    }},
    // Full 128-bit increment
    { name: 'full-128', increment: (nonce, n) => {
      const counter = Buffer.from(nonce);
      let carry = n;
      for (let i = 15; i >= 0 && carry > 0; i--) {
        const sum = counter[i] + carry;
        counter[i] = sum & 0xFF;
        carry = sum >> 8;
      }
      return counter;
    }},
    // Counter in first 4 bytes
    { name: 'be32-first', increment: (nonce, n) => {
      const counter = Buffer.from(nonce);
      const val = counter.readUInt32BE(0) + n;
      counter.writeUInt32BE(val >>> 0, 0);
      return counter;
    }},
  ];
  
  for (const pattern of patterns) {
    const testDecrypted = Buffer.alloc(encrypted.length);
    const numBlocks = Math.ceil(encrypted.length / 16);
    
    for (let block = 0; block < numBlocks; block++) {
      const start = block * 16;
      const end = Math.min(start + 16, encrypted.length);
      
      const counterBlock = pattern.increment(baseNonce, block);
      
      const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
      cipher.setAutoPadding(false);
      const keystream = cipher.update(counterBlock);
      
      for (let i = start; i < end; i++) {
        testDecrypted[i] = encrypted[i] ^ keystream[i - start];
      }
    }
    
    const testText = testDecrypted.toString('utf8');
    
    // Count printable characters
    let printable = 0;
    for (let i = 0; i < testText.length; i++) {
      const c = testText.charCodeAt(i);
      if ((c >= 32 && c < 127) || c === 10 || c === 13) printable++;
    }
    
    console.log(`${pattern.name}: ${printable}/${testText.length} printable`);
    
    if (testText === decryptedJson) {
      console.log(`\n*** SUCCESS: ${pattern.name} ***`);
      console.log(testText);
      return pattern.name;
    }
    
    if (printable > testText.length * 0.8) {
      console.log(`  Result: ${testText.substring(0, 100)}`);
    }
  }
  
  return null;
}

// Run analysis
const counterBlocks = analyzeCounterBlocks();
const result = tryCustomCounterModes();

if (result) {
  console.log(`\n=== SOLUTION: ${result} ===`);
}
