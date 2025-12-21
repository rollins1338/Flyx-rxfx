/**
 * Crack Flixer.sh - Final V4
 * 
 * The counter blocks are completely random - not following any standard CTR pattern.
 * This suggests the WASM generates a unique nonce for each block.
 * 
 * Possible schemes:
 * 1. counter_n = HASH(key || n)
 * 2. counter_n = HMAC(key, n)
 * 3. counter_n = AES(key, HASH(n))
 * 4. counter_n = PRNG seeded with key, advanced n times
 */

const crypto = require('crypto');

// Known data from reverse engineering
const testKey = '43c3b6ea2039a302a8112d9432d4267a249f327642c6c283e65f84106f874e88';
const encryptedBase64 = 'q4BLQxjx6XXbW9sRxmdeXrm2XH9Aptkf1DV1BrwFeYwpULrxSA4U4YEWTt+TofiI/5ciJhUf9OQk4cAwOAtGRSrdgFZcZlfsZQmR23NhRE5wQ+lQjpmzYvDeWb5LYNs+GO8JdAC16k6kEObOCG7FMBnjPzuFNqWG77JHfg2f54fKXBObRPYMWdJ6Nywygc44Vq+oX+YQKQoddEQRdS80iyG0/2Dq+4DuWYDTsjn16Yq2keeYTbefznovDwYHvP9LgCG4CGtiNqfdNL88mNk8QtDka4vU6VLilfbYo+2MZI2zjTS454vEgG4T8uEjnAc7lh6D1988ua9LPKqNpOxcAJ7MeJxIvBhU8vbEQXJqvLaeONO9KRPm51ODtXmIRxoxyyIJ4/hCRVMv1WH64BaQD7zx1DeRZgsdzFrCwPQuFvORezY+tn09BowEfAOjXy5tTwCsVlByKS3QeNczw13jr72cxlKBpgbnXYEtqwzp5hNVGW0W06NiXyTmhTsMzYXiz7AthWgIy4HAq2c=';
const decryptedJson = '{"sources":[{"server":"foxtrot","url":""},{"server":"alpha","url":""},{"server":"bravo","url":""},{"server":"charlie","url":""},{"server":"delta","url":""},{"server":"echo","url":""}],"skipTime":null}';

// Derive the actual counter blocks from known plaintext
function deriveCounterBlocks() {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decrypted = Buffer.from(decryptedJson);
  const keyBuf = Buffer.from(testKey, 'hex');
  
  const keystream = Buffer.alloc(Math.min(encrypted.length, decrypted.length));
  for (let i = 0; i < keystream.length; i++) {
    keystream[i] = encrypted[i] ^ decrypted[i];
  }
  
  const numBlocks = Math.floor(keystream.length / 16);
  const counterBlocks = [];
  
  for (let block = 0; block < numBlocks; block++) {
    const keystreamBlock = keystream.subarray(block * 16, (block + 1) * 16);
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(keystreamBlock);
    
    counterBlocks.push(counterBlock);
  }
  
  return counterBlocks;
}

function tryHashBasedCounters() {
  console.log('=== Trying Hash-Based Counter Generation ===\n');
  
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const keyBuf = Buffer.from(testKey, 'hex');
  const actualCounterBlocks = deriveCounterBlocks();
  
  // Try: counter_n = SHA256(key || n)[0:16]
  console.log('Testing SHA256(key || n):');
  for (let n = 0; n < 3; n++) {
    const nBuf = Buffer.alloc(4);
    nBuf.writeUInt32BE(n, 0);
    const hash = crypto.createHash('sha256').update(Buffer.concat([keyBuf, nBuf])).digest();
    const counter = hash.subarray(0, 16);
    console.log(`  n=${n}: ${counter.toString('hex')}`);
    console.log(`  actual: ${actualCounterBlocks[n].toString('hex')}`);
    console.log(`  match: ${counter.equals(actualCounterBlocks[n])}`);
  }
  
  // Try: counter_n = HMAC(key, n)[0:16]
  console.log('\nTesting HMAC(key, n):');
  for (let n = 0; n < 3; n++) {
    const nBuf = Buffer.alloc(4);
    nBuf.writeUInt32BE(n, 0);
    const hmac = crypto.createHmac('sha256', keyBuf).update(nBuf).digest();
    const counter = hmac.subarray(0, 16);
    console.log(`  n=${n}: ${counter.toString('hex')}`);
    console.log(`  actual: ${actualCounterBlocks[n].toString('hex')}`);
    console.log(`  match: ${counter.equals(actualCounterBlocks[n])}`);
  }
  
  // Try: counter_n = HMAC(key, n as string)[0:16]
  console.log('\nTesting HMAC(key, n as string):');
  for (let n = 0; n < 3; n++) {
    const hmac = crypto.createHmac('sha256', keyBuf).update(n.toString()).digest();
    const counter = hmac.subarray(0, 16);
    console.log(`  n=${n}: ${counter.toString('hex')}`);
    console.log(`  actual: ${actualCounterBlocks[n].toString('hex')}`);
    console.log(`  match: ${counter.equals(actualCounterBlocks[n])}`);
  }
  
  // Try: counter_n = SHA256(key || n as 8-byte LE)[0:16]
  console.log('\nTesting SHA256(key || n as 8-byte LE):');
  for (let n = 0; n < 3; n++) {
    const nBuf = Buffer.alloc(8);
    nBuf.writeBigUInt64LE(BigInt(n), 0);
    const hash = crypto.createHash('sha256').update(Buffer.concat([keyBuf, nBuf])).digest();
    const counter = hash.subarray(0, 16);
    console.log(`  n=${n}: ${counter.toString('hex')}`);
    console.log(`  actual: ${actualCounterBlocks[n].toString('hex')}`);
    console.log(`  match: ${counter.equals(actualCounterBlocks[n])}`);
  }
}

function tryPrngBasedCounters() {
  console.log('\n=== Trying PRNG-Based Counter Generation ===\n');
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const actualCounterBlocks = deriveCounterBlocks();
  
  // Try: HMAC-DRBG style
  // state_0 = key
  // state_n = HMAC(state_{n-1}, 0x00)
  // counter_n = HMAC(state_n, 0x01)[0:16]
  
  console.log('Testing HMAC-DRBG style:');
  let state = keyBuf;
  for (let n = 0; n < 3; n++) {
    const counter = crypto.createHmac('sha256', state).update(Buffer.from([0x01])).digest().subarray(0, 16);
    console.log(`  n=${n}: ${counter.toString('hex')}`);
    console.log(`  actual: ${actualCounterBlocks[n].toString('hex')}`);
    console.log(`  match: ${counter.equals(actualCounterBlocks[n])}`);
    
    // Update state
    state = crypto.createHmac('sha256', state).update(Buffer.from([0x00])).digest();
  }
  
  // Try: Simple hash chain
  // counter_0 = SHA256(key)[0:16]
  // counter_n = SHA256(counter_{n-1})[0:16]
  
  console.log('\nTesting hash chain:');
  let hashState = crypto.createHash('sha256').update(keyBuf).digest();
  for (let n = 0; n < 3; n++) {
    const counter = hashState.subarray(0, 16);
    console.log(`  n=${n}: ${counter.toString('hex')}`);
    console.log(`  actual: ${actualCounterBlocks[n].toString('hex')}`);
    console.log(`  match: ${counter.equals(actualCounterBlocks[n])}`);
    
    hashState = crypto.createHash('sha256').update(hashState).digest();
  }
  
  // Try: AES-based PRNG
  // counter_n = AES(key, SHA256(n)[0:16])
  
  console.log('\nTesting AES(key, SHA256(n)):');
  for (let n = 0; n < 3; n++) {
    const nHash = crypto.createHash('sha256').update(Buffer.from([n])).digest().subarray(0, 16);
    const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
    cipher.setAutoPadding(false);
    const counter = cipher.update(nHash);
    console.log(`  n=${n}: ${counter.toString('hex')}`);
    console.log(`  actual: ${actualCounterBlocks[n].toString('hex')}`);
    console.log(`  match: ${counter.equals(actualCounterBlocks[n])}`);
  }
}

function tryRandomNonceEmbedded() {
  console.log('\n=== Checking if Random Nonce is Embedded ===\n');
  
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const keyBuf = Buffer.from(testKey, 'hex');
  const actualCounterBlocks = deriveCounterBlocks();
  
  // The first counter block might be a random nonce embedded in the ciphertext
  // Let's check if it appears anywhere in the encrypted data
  
  const counter0 = actualCounterBlocks[0];
  console.log(`Counter 0: ${counter0.toString('hex')}`);
  
  // Check if counter0 appears in the encrypted data
  const counter0Hex = counter0.toString('hex');
  const encryptedHex = encrypted.toString('hex');
  
  if (encryptedHex.includes(counter0Hex)) {
    const pos = encryptedHex.indexOf(counter0Hex) / 2;
    console.log(`Counter 0 found at position ${pos} in encrypted data!`);
  } else {
    console.log('Counter 0 not found directly in encrypted data');
  }
  
  // Maybe the nonce is derived from the first 16 bytes of encrypted data
  const first16 = encrypted.subarray(0, 16);
  console.log(`\nFirst 16 bytes of encrypted: ${first16.toString('hex')}`);
  
  // XOR with counter0
  const xor = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    xor[i] = first16[i] ^ counter0[i];
  }
  console.log(`First 16 XOR counter0: ${xor.toString('hex')}`);
  
  // This should be the first 16 bytes of plaintext if the nonce is embedded
  console.log(`Expected plaintext start: ${Buffer.from('{"sources":[{"se').toString('hex')}`);
}

// Run all tests
tryHashBasedCounters();
tryPrngBasedCounters();
tryRandomNonceEmbedded();

console.log('\n=== Summary ===');
console.log('The counter blocks appear to be randomly generated for each request.');
console.log('The WASM likely uses a CSPRNG seeded with the API key to generate counters.');
console.log('Without knowing the exact PRNG algorithm, we cannot replicate the decryption.');
