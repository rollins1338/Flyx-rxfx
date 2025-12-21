/**
 * Crack Flixer.sh - V8
 * 
 * The first 16 bytes decrypt correctly, but subsequent blocks fail.
 * This suggests either:
 * 1. The IV/counter changes in a non-standard way
 * 2. The key changes for each block
 * 3. There's additional transformation after AES
 * 
 * Let's analyze block by block
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
 * Analyze each block separately
 */
async function analyzeBlocks() {
  console.log('=== Analyze Blocks ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes`);
  console.log(`Number of 16-byte blocks: ${Math.ceil(data.length / 16)}\n`);
  
  // Expected plaintext structure (we know the format)
  // {"sources":[{"server":"alpha","url":"https://p.10014.workers.dev/cloudspark91.live/file2/..."}],"skipTime":null}
  
  // Let's build expected plaintext for first few blocks
  const expectedStart = '{"sources":[{"server":"alpha","url":"https://p.10014.workers.dev/cloudspark91.live/file2/';
  
  // Derive keystream for each block using known plaintext
  const numBlocks = Math.ceil(data.length / 16);
  const keystreamBlocks = [];
  
  for (let block = 0; block < Math.min(numBlocks, 6); block++) {
    const start = block * 16;
    const end = Math.min(start + 16, data.length);
    const ciphertextBlock = data.subarray(start, end);
    
    // Get expected plaintext for this block
    const plaintextBlock = Buffer.from(expectedStart.substring(start, end).padEnd(16, '\x00'));
    
    // Derive keystream
    const keystreamBlock = Buffer.alloc(16);
    for (let i = 0; i < ciphertextBlock.length; i++) {
      keystreamBlock[i] = ciphertextBlock[i] ^ plaintextBlock[i];
    }
    
    keystreamBlocks.push(keystreamBlock);
    
    console.log(`Block ${block}:`);
    console.log(`  Ciphertext: ${ciphertextBlock.toString('hex')}`);
    console.log(`  Expected:   "${expectedStart.substring(start, end)}"`);
    console.log(`  Keystream:  ${keystreamBlock.toString('hex')}`);
    
    // Try to find what counter block produces this keystream
    // keystream = AES_encrypt(key, counter_block)
    // counter_block = AES_decrypt(key, keystream)
    const decipher = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(keystreamBlock);
    console.log(`  Counter:    ${counterBlock.toString('hex')}`);
    console.log();
  }
  
  // Analyze the counter blocks to find the pattern
  console.log('=== Counter Block Analysis ===\n');
  
  if (keystreamBlocks.length >= 2) {
    // XOR consecutive counter blocks to see the increment pattern
    for (let i = 1; i < keystreamBlocks.length; i++) {
      const decipher1 = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
      decipher1.setAutoPadding(false);
      const counter1 = decipher1.update(keystreamBlocks[i - 1]);
      
      const decipher2 = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
      decipher2.setAutoPadding(false);
      const counter2 = decipher2.update(keystreamBlocks[i]);
      
      const diff = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) {
        diff[j] = counter2[j] ^ counter1[j];
      }
      
      console.log(`Counter diff (block ${i-1} -> ${i}): ${diff.toString('hex')}`);
    }
  }
}

/**
 * Maybe the encryption uses a different key for each block
 * Key derivation: block_key = HMAC(api_key, block_number)
 */
async function tryPerBlockKeyDerivation() {
  console.log('\n=== Try Per-Block Key Derivation ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Try: each block uses a different key derived from api_key and block number
  const numBlocks = Math.ceil(data.length / 16);
  const decrypted = Buffer.alloc(data.length);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, data.length);
    const ciphertextBlock = data.subarray(start, end);
    
    // Derive key for this block
    const blockKey = crypto.createHmac('sha256', apiKeyBuf).update(Buffer.from([block])).digest();
    
    // Decrypt with zero IV (single block)
    const cipher = crypto.createCipheriv('aes-256-ecb', blockKey, null);
    cipher.setAutoPadding(false);
    const keystream = cipher.update(Buffer.alloc(16, 0));
    
    for (let i = 0; i < ciphertextBlock.length; i++) {
      decrypted[start + i] = ciphertextBlock[i] ^ keystream[i];
    }
  }
  
  const text = decrypted.toString('utf8');
  console.log(`Per-block key result: ${text.substring(0, 100)}`);
  
  if (text.startsWith('{')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text);
    return true;
  }
  
  return false;
}

/**
 * Maybe the IV is XORed with the block number
 */
async function tryXorIvWithBlockNumber() {
  console.log('\n=== Try XOR IV with Block Number ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Derive base IV from first block
  const knownPlaintext = '{"sources":[{"se';
  const knownBuf = Buffer.from(knownPlaintext);
  
  const keystreamBlock1 = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    keystreamBlock1[i] = data[i] ^ knownBuf[i];
  }
  
  const decipher = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
  decipher.setAutoPadding(false);
  const baseIv = decipher.update(keystreamBlock1);
  
  console.log(`Base IV: ${baseIv.toString('hex')}`);
  
  // Try decrypting with IV XORed with block number
  const numBlocks = Math.ceil(data.length / 16);
  const decrypted = Buffer.alloc(data.length);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, data.length);
    const ciphertextBlock = data.subarray(start, end);
    
    // XOR IV with block number (try different positions)
    const iv = Buffer.from(baseIv);
    
    // Try XOR at last byte
    iv[15] ^= block;
    
    // Generate keystream
    const cipher = crypto.createCipheriv('aes-256-ecb', apiKeyBuf, null);
    cipher.setAutoPadding(false);
    const keystream = cipher.update(iv);
    
    for (let i = 0; i < ciphertextBlock.length; i++) {
      decrypted[start + i] = ciphertextBlock[i] ^ keystream[i];
    }
  }
  
  const text = decrypted.toString('utf8');
  console.log(`XOR IV result: ${text.substring(0, 100)}`);
  
  if (text.startsWith('{"sources":[{"server":"alpha"')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text);
    return true;
  }
  
  // Try XOR at last 4 bytes (big-endian counter)
  const decrypted2 = Buffer.alloc(data.length);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, data.length);
    const ciphertextBlock = data.subarray(start, end);
    
    const iv = Buffer.from(baseIv);
    // Add block number to last 4 bytes as big-endian
    const counter = iv.readUInt32BE(12) + block;
    iv.writeUInt32BE(counter >>> 0, 12);
    
    const cipher = crypto.createCipheriv('aes-256-ecb', apiKeyBuf, null);
    cipher.setAutoPadding(false);
    const keystream = cipher.update(iv);
    
    for (let i = 0; i < ciphertextBlock.length; i++) {
      decrypted2[start + i] = ciphertextBlock[i] ^ keystream[i];
    }
  }
  
  const text2 = decrypted2.toString('utf8');
  console.log(`Add counter result: ${text2.substring(0, 100)}`);
  
  if (text2.startsWith('{"sources":[{"server":"alpha"')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text2);
    return true;
  }
  
  return false;
}

/**
 * The issue might be that we're using the wrong known plaintext
 * Let's try to figure out the exact plaintext format
 */
async function tryDifferentPlaintextFormats() {
  console.log('\n=== Try Different Plaintext Formats ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Different possible plaintext formats
  const formats = [
    '{"sources":[{"server":"alpha","url":"',
    '{"sources":[{"url":"https://',
    '{"poster_sources":{"alpha":{"url":"',
    '{"alpha":{"url":"https://',
  ];
  
  for (const format of formats) {
    console.log(`\nTrying format: "${format.substring(0, 30)}..."`);
    
    // Use first 16 bytes to derive IV
    const knownBuf = Buffer.from(format.substring(0, 16));
    
    const keystreamBlock1 = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      keystreamBlock1[i] = data[i] ^ knownBuf[i];
    }
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
    decipher.setAutoPadding(false);
    const baseIv = decipher.update(keystreamBlock1);
    
    // Decrypt with standard CTR (add counter to last 4 bytes)
    const numBlocks = Math.ceil(data.length / 16);
    const decrypted = Buffer.alloc(data.length);
    
    for (let block = 0; block < numBlocks; block++) {
      const start = block * 16;
      const end = Math.min(start + 16, data.length);
      const ciphertextBlock = data.subarray(start, end);
      
      const iv = Buffer.from(baseIv);
      const counter = iv.readUInt32BE(12) + block;
      iv.writeUInt32BE(counter >>> 0, 12);
      
      const cipher = crypto.createCipheriv('aes-256-ecb', apiKeyBuf, null);
      cipher.setAutoPadding(false);
      const keystream = cipher.update(iv);
      
      for (let i = 0; i < ciphertextBlock.length; i++) {
        decrypted[start + i] = ciphertextBlock[i] ^ keystream[i];
      }
    }
    
    const text = decrypted.toString('utf8');
    
    // Count printable characters
    let printable = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if ((c >= 32 && c < 127) || c === 10 || c === 13 || c === 9) {
        printable++;
      }
    }
    
    console.log(`Printable: ${printable}/${text.length}`);
    console.log(`Result: ${text.substring(0, 80)}`);
    
    if (printable > text.length * 0.9) {
      console.log('\n*** HIGH SUCCESS RATE! ***');
      console.log(text);
    }
  }
}

async function main() {
  await analyzeBlocks();
  await tryPerBlockKeyDerivation();
  await tryXorIvWithBlockNumber();
  await tryDifferentPlaintextFormats();
}

main().catch(console.error);
