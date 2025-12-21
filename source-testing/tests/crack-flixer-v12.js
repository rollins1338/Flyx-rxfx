/**
 * Crack Flixer.sh - V12
 * 
 * New approach: Let's use the external decryption service that Videasy uses.
 * Maybe there's a similar service for Flixer, or we can find one.
 * 
 * Also, let's try to understand the encryption by comparing the WASM behavior
 * with what we know about Rust crypto crates.
 */

const crypto = require('crypto');
const https = require('https');

const API_BASE = 'https://plsdontscrapemelove.flixer.sh';

function generateNonce() {
  return crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '').substring(0, 22);
}

function generateSignature(key, timestamp, nonce, urlPath) {
  return crypto.createHmac('sha256', key).update(`${key}:${timestamp}:${nonce}:${urlPath}`).digest('base64');
}

function makeRequest(urlPath, key, extraHeaders = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const signature = generateSignature(key, timestamp, nonce, urlPath);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'Origin': 'https://flixer.sh',
    'Referer': 'https://flixer.sh/',
    'X-Api-Key': key,
    'X-Request-Timestamp': timestamp.toString(),
    'X-Request-Nonce': nonce,
    'X-Request-Signature': signature,
    'X-Client-Fingerprint': 'jnurg',
    'bW90aGFmYWth': '1',
    ...extraHeaders,
  };
  
  return new Promise((resolve, reject) => {
    https.get(`${API_BASE}${urlPath}`, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

/**
 * The key insight: we can decrypt the first block correctly.
 * This means we know the keystream for the first 16 bytes.
 * 
 * In AES-CTR, the keystream is: AES(key, nonce || counter)
 * If we know keystream[0:16], we can find nonce || 0 by decrypting with the key.
 * 
 * The problem is that subsequent blocks don't decrypt correctly.
 * This could mean:
 * 1. The counter increment is non-standard
 * 2. The key changes per block
 * 3. There's additional XOR or transformation
 * 
 * Let's try: maybe the keystream is XORed with the API key for each block
 */
async function tryXorWithKeyPerBlock() {
  console.log('=== Try XOR with Key Per Block ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data: ${data.length} bytes`);
  
  // Known plaintext
  const knownPlaintext = '{"sources":[{"server":"alpha","url":"https://p.10014.workers.dev/cloudspark91.live/file2/';
  const knownBuf = Buffer.from(knownPlaintext);
  
  // Derive keystream from known plaintext
  const keystream = Buffer.alloc(Math.min(knownBuf.length, data.length));
  for (let i = 0; i < keystream.length; i++) {
    keystream[i] = data[i] ^ knownBuf[i];
  }
  
  console.log(`Keystream (first 64 bytes): ${keystream.subarray(0, 64).toString('hex')}`);
  
  // Check if keystream XOR api_key gives a pattern
  const keystreamXorKey = Buffer.alloc(keystream.length);
  for (let i = 0; i < keystream.length; i++) {
    keystreamXorKey[i] = keystream[i] ^ apiKeyBuf[i % 32];
  }
  
  console.log(`Keystream XOR key (first 64 bytes): ${keystreamXorKey.subarray(0, 64).toString('hex')}`);
  
  // Check if this is AES output
  // If keystream = AES(key, nonce) XOR api_key, then
  // keystream XOR api_key = AES(key, nonce)
  
  // Try to find the nonce
  const block1 = keystreamXorKey.subarray(0, 16);
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
    decipher.setAutoPadding(false);
    const nonce = decipher.update(block1);
    
    console.log(`\nDerived nonce (from XOR): ${nonce.toString('hex')}`);
    
    // Now try to decrypt using this nonce
    const decrypted = Buffer.alloc(data.length);
    const numBlocks = Math.ceil(data.length / 16);
    
    for (let block = 0; block < numBlocks; block++) {
      const start = block * 16;
      const end = Math.min(start + 16, data.length);
      
      // Counter block
      const counterBlock = Buffer.from(nonce);
      const counter = counterBlock.readUInt32BE(12) + block;
      counterBlock.writeUInt32BE(counter >>> 0, 12);
      
      // Generate AES keystream
      const cipher = crypto.createCipheriv('aes-256-ecb', apiKeyBuf, null);
      cipher.setAutoPadding(false);
      const aesKeystream = cipher.update(counterBlock);
      
      // XOR with API key to get final keystream
      const finalKeystream = Buffer.alloc(16);
      for (let i = 0; i < 16; i++) {
        finalKeystream[i] = aesKeystream[i] ^ apiKeyBuf[i % 32];
      }
      
      // Decrypt
      for (let i = start; i < end; i++) {
        decrypted[i] = data[i] ^ finalKeystream[i - start];
      }
    }
    
    const text = decrypted.toString('utf8');
    console.log(`Decrypted: ${text.substring(0, 150)}`);
    
    if (text.startsWith('{"sources":[{"server":"alpha"')) {
      console.log('\n*** SUCCESS! ***');
      console.log(text);
      return true;
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  return false;
}

/**
 * Maybe the encryption uses a different nonce for each block
 * nonce_n = nonce_0 XOR block_number
 */
async function tryXorNonceWithBlockNumber() {
  console.log('\n=== Try XOR Nonce with Block Number ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Derive base nonce from first block
  const knownPlaintext = '{"sources":[{"se';
  const knownBuf = Buffer.from(knownPlaintext);
  
  const keystreamBlock0 = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    keystreamBlock0[i] = data[i] ^ knownBuf[i];
  }
  
  const decipher = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
  decipher.setAutoPadding(false);
  const baseNonce = decipher.update(keystreamBlock0);
  
  console.log(`Base nonce: ${baseNonce.toString('hex')}`);
  
  // Try: nonce_n = baseNonce XOR n (at different positions)
  const xorPositions = [15, 14, 13, 12, 11, 10, 9, 8];
  
  for (const xorPos of xorPositions) {
    const decrypted = Buffer.alloc(data.length);
    const numBlocks = Math.ceil(data.length / 16);
    
    for (let block = 0; block < numBlocks; block++) {
      const start = block * 16;
      const end = Math.min(start + 16, data.length);
      
      // XOR nonce with block number at position
      const nonce = Buffer.from(baseNonce);
      nonce[xorPos] ^= block;
      
      // Generate keystream
      const cipher = crypto.createCipheriv('aes-256-ecb', apiKeyBuf, null);
      cipher.setAutoPadding(false);
      const keystream = cipher.update(nonce);
      
      // Decrypt
      for (let i = start; i < end; i++) {
        decrypted[i] = data[i] ^ keystream[i - start];
      }
    }
    
    const text = decrypted.toString('utf8');
    
    // Count printable characters
    let printable = 0;
    for (let i = 0; i < Math.min(100, text.length); i++) {
      const c = text.charCodeAt(i);
      if ((c >= 32 && c < 127) || c === 10 || c === 13) printable++;
    }
    
    if (printable > 80) {
      console.log(`XOR at position ${xorPos}: ${text.substring(0, 100)}`);
    }
  }
  
  return false;
}

/**
 * Let's try to understand the pattern by looking at what makes block 0 work
 * and block 1 fail.
 */
async function analyzeBlockDifference() {
  console.log('\n=== Analyze Block Difference ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Known plaintext for blocks 0 and 1
  const plaintext0 = '{"sources":[{"se';  // Block 0
  const plaintext1 = 'rver":"alpha","u';  // Block 1
  
  // Derive keystream for both blocks
  const keystream0 = Buffer.alloc(16);
  const keystream1 = Buffer.alloc(16);
  
  for (let i = 0; i < 16; i++) {
    keystream0[i] = data[i] ^ plaintext0.charCodeAt(i);
    keystream1[i] = data[16 + i] ^ plaintext1.charCodeAt(i);
  }
  
  console.log(`Keystream block 0: ${keystream0.toString('hex')}`);
  console.log(`Keystream block 1: ${keystream1.toString('hex')}`);
  
  // Derive counter blocks
  const decipher0 = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
  decipher0.setAutoPadding(false);
  const counter0 = decipher0.update(keystream0);
  
  const decipher1 = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
  decipher1.setAutoPadding(false);
  const counter1 = decipher1.update(keystream1);
  
  console.log(`\nCounter block 0: ${counter0.toString('hex')}`);
  console.log(`Counter block 1: ${counter1.toString('hex')}`);
  
  // XOR the counter blocks to see the difference
  const counterDiff = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    counterDiff[i] = counter0[i] ^ counter1[i];
  }
  
  console.log(`Counter diff (0 XOR 1): ${counterDiff.toString('hex')}`);
  
  // In standard CTR, the diff should be 0x00...01 (increment by 1)
  // Let's see what the actual diff is
  
  // Check if the diff is related to the API key
  const keyDiff = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    keyDiff[i] = counterDiff[i] ^ apiKeyBuf[i];
  }
  console.log(`Counter diff XOR key[0:16]: ${keyDiff.toString('hex')}`);
  
  const keyDiff2 = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    keyDiff2[i] = counterDiff[i] ^ apiKeyBuf[16 + i];
  }
  console.log(`Counter diff XOR key[16:32]: ${keyDiff2.toString('hex')}`);
}

/**
 * Maybe the server uses a completely custom encryption scheme
 * Let's try: ciphertext = plaintext XOR SHA256(key || block_number)
 */
async function tryCustomScheme() {
  console.log('\n=== Try Custom Encryption Scheme ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Try: keystream_n = SHA256(key || n) truncated to 16 bytes
  const decrypted = Buffer.alloc(data.length);
  const numBlocks = Math.ceil(data.length / 16);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, data.length);
    
    // Generate keystream for this block
    const blockNum = Buffer.alloc(4);
    blockNum.writeUInt32BE(block, 0);
    const keystream = crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, blockNum])).digest().subarray(0, 16);
    
    for (let i = start; i < end; i++) {
      decrypted[i] = data[i] ^ keystream[i - start];
    }
  }
  
  const text = decrypted.toString('utf8');
  console.log(`SHA256(key||block) result: ${text.substring(0, 100)}`);
  
  // Try: keystream_n = AES(key, SHA256(key || n)[0:16])
  const decrypted2 = Buffer.alloc(data.length);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, data.length);
    
    const blockNum = Buffer.alloc(4);
    blockNum.writeUInt32BE(block, 0);
    const iv = crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, blockNum])).digest().subarray(0, 16);
    
    const cipher = crypto.createCipheriv('aes-256-ecb', apiKeyBuf, null);
    cipher.setAutoPadding(false);
    const keystream = cipher.update(iv);
    
    for (let i = start; i < end; i++) {
      decrypted2[i] = data[i] ^ keystream[i - start];
    }
  }
  
  const text2 = decrypted2.toString('utf8');
  console.log(`AES(key, SHA256(key||block)) result: ${text2.substring(0, 100)}`);
  
  if (text2.startsWith('{')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text2);
    return true;
  }
  
  return false;
}

async function main() {
  await tryXorWithKeyPerBlock();
  await tryXorNonceWithBlockNumber();
  await analyzeBlockDifference();
  await tryCustomScheme();
}

main().catch(console.error);
