/**
 * Crack Flixer.sh - V7
 * 
 * BREAKTHROUGH from V6:
 * - First 16 bytes decrypt correctly with: AES_decrypt(key, keystream_block) as IV
 * - This means the IV is derived from the keystream itself
 * - But subsequent blocks fail, suggesting the counter increment is different
 * 
 * Let's figure out the exact CTR mode implementation
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
 * Custom AES-CTR implementation to test different counter modes
 */
function aesCtrDecrypt(key, iv, data, counterMode = 'be32') {
  const result = Buffer.alloc(data.length);
  const numBlocks = Math.ceil(data.length / 16);
  
  for (let block = 0; block < numBlocks; block++) {
    // Create counter block
    const counterBlock = Buffer.from(iv);
    
    // Increment counter based on mode
    if (counterMode === 'be32') {
      // Big-endian 32-bit counter in last 4 bytes
      const counter = counterBlock.readUInt32BE(12) + block;
      counterBlock.writeUInt32BE(counter >>> 0, 12);
    } else if (counterMode === 'le32') {
      // Little-endian 32-bit counter in last 4 bytes
      const counter = counterBlock.readUInt32LE(12) + block;
      counterBlock.writeUInt32LE(counter >>> 0, 12);
    } else if (counterMode === 'be64') {
      // Big-endian 64-bit counter in last 8 bytes
      const counterHi = counterBlock.readUInt32BE(8);
      const counterLo = counterBlock.readUInt32BE(12) + block;
      if (counterLo > 0xFFFFFFFF) {
        counterBlock.writeUInt32BE(counterHi + 1, 8);
      }
      counterBlock.writeUInt32BE(counterLo >>> 0, 12);
    } else if (counterMode === 'le64') {
      // Little-endian 64-bit counter in last 8 bytes
      const counterLo = counterBlock.readUInt32LE(8) + block;
      counterBlock.writeUInt32LE(counterLo >>> 0, 8);
    } else if (counterMode === 'full') {
      // Increment entire 128-bit block as big-endian
      let carry = block;
      for (let i = 15; i >= 0 && carry > 0; i--) {
        const sum = counterBlock[i] + carry;
        counterBlock[i] = sum & 0xFF;
        carry = sum >> 8;
      }
    }
    
    // Encrypt counter block to get keystream
    const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
    cipher.setAutoPadding(false);
    const keystream = cipher.update(counterBlock);
    
    // XOR with ciphertext
    const start = block * 16;
    const end = Math.min(start + 16, data.length);
    for (let i = start; i < end; i++) {
      result[i] = data[i] ^ keystream[i - start];
    }
  }
  
  return result;
}

/**
 * Derive the IV from the first keystream block
 */
async function deriveIvAndDecrypt() {
  console.log('=== Derive IV and Decrypt ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes\n`);
  
  // Known plaintext for first block
  const knownPlaintext = '{"sources":[{"se';  // Exactly 16 bytes
  const knownBuf = Buffer.from(knownPlaintext);
  
  // Derive keystream for first block
  const keystreamBlock1 = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    keystreamBlock1[i] = data[i] ^ knownBuf[i];
  }
  
  console.log(`Known plaintext: "${knownPlaintext}"`);
  console.log(`Keystream block 1: ${keystreamBlock1.toString('hex')}`);
  
  // The keystream is AES_encrypt(key, IV)
  // So IV = AES_decrypt(key, keystream)
  const decipher = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
  decipher.setAutoPadding(false);
  const derivedIv = decipher.update(keystreamBlock1);
  
  console.log(`Derived IV: ${derivedIv.toString('hex')}`);
  
  // Now try different counter modes
  const counterModes = ['be32', 'le32', 'be64', 'le64', 'full'];
  
  for (const mode of counterModes) {
    const decrypted = aesCtrDecrypt(apiKeyBuf, derivedIv, data, mode);
    const text = decrypted.toString('utf8');
    
    // Check how much decrypts correctly
    let validChars = 0;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) >= 32 && text.charCodeAt(i) < 127) {
        validChars++;
      } else if (text[i] === '\n' || text[i] === '\r' || text[i] === '\t') {
        validChars++;
      } else {
        break;
      }
    }
    
    console.log(`\nCounter mode: ${mode}`);
    console.log(`Valid chars: ${validChars}/${text.length}`);
    console.log(`Decrypted: ${text.substring(0, 100)}`);
    
    if (text.startsWith('{"sources":[{"server":"alpha"')) {
      console.log('\n*** FULL SUCCESS! ***');
      console.log(text);
      return { mode, iv: derivedIv };
    }
  }
  
  return null;
}

/**
 * Maybe the IV is embedded in the ciphertext
 * Let's try: data = IV (16 bytes) || ciphertext
 */
async function tryEmbeddedIv() {
  console.log('\n=== Try Embedded IV ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes`);
  
  // Try: first 16 bytes are IV
  const iv = data.subarray(0, 16);
  const ciphertext = data.subarray(16);
  
  console.log(`Potential IV: ${iv.toString('hex')}`);
  console.log(`Ciphertext length: ${ciphertext.length} bytes`);
  
  // Try different counter modes
  const counterModes = ['be32', 'le32', 'be64', 'le64', 'full'];
  
  for (const mode of counterModes) {
    const decrypted = aesCtrDecrypt(apiKeyBuf, iv, ciphertext, mode);
    const text = decrypted.toString('utf8');
    
    console.log(`\nCounter mode: ${mode}`);
    console.log(`Decrypted: ${text.substring(0, 100)}`);
    
    if (text.startsWith('{')) {
      console.log('\n*** SUCCESS with embedded IV! ***');
      console.log(text);
      return { mode, iv };
    }
  }
  
  // Also try with SHA256(key)
  const keyHash = crypto.createHash('sha256').update(apiKeyBuf).digest();
  
  for (const mode of counterModes) {
    const decrypted = aesCtrDecrypt(keyHash, iv, ciphertext, mode);
    const text = decrypted.toString('utf8');
    
    if (text.startsWith('{')) {
      console.log(`\n*** SUCCESS with SHA256(key), mode=${mode}! ***`);
      console.log(text);
      return { mode, iv, keyDeriv: 'sha256' };
    }
  }
  
  return null;
}

/**
 * The Rust ctr crate uses ctr32 flavor by default
 * Let's implement it exactly as Rust does
 */
async function tryRustCtr32() {
  console.log('\n=== Try Rust CTR32 Implementation ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // In Rust's ctr crate, ctr32 uses:
  // - 12-byte nonce + 4-byte big-endian counter
  // - Counter starts at 0 or 1
  
  // Try: first 12 bytes are nonce, rest is ciphertext
  for (const nonceSize of [12, 16]) {
    const nonce = data.subarray(0, nonceSize);
    const ciphertext = data.subarray(nonceSize);
    
    // Build IV: nonce || counter (starting at 0 or 1)
    for (const startCounter of [0, 1]) {
      let iv;
      if (nonceSize === 12) {
        iv = Buffer.alloc(16);
        nonce.copy(iv, 0);
        iv.writeUInt32BE(startCounter, 12);
      } else {
        iv = Buffer.from(nonce);
        // Modify last 4 bytes to be counter
        iv.writeUInt32BE(startCounter, 12);
      }
      
      // Try with direct key
      const decrypted = aesCtrDecrypt(apiKeyBuf, iv, ciphertext, 'be32');
      const text = decrypted.toString('utf8');
      
      if (text.startsWith('{')) {
        console.log(`*** SUCCESS: nonceSize=${nonceSize}, startCounter=${startCounter} ***`);
        console.log(text);
        return { nonceSize, startCounter };
      }
    }
  }
  
  console.log('Rust CTR32 approach did not work');
  return null;
}

async function main() {
  const result1 = await deriveIvAndDecrypt();
  if (result1) {
    console.log('\n=== Solution Found! ===');
    console.log(`Counter mode: ${result1.mode}`);
    console.log(`IV derivation: AES_decrypt(key, keystream_block_1)`);
    return;
  }
  
  const result2 = await tryEmbeddedIv();
  if (result2) {
    console.log('\n=== Solution Found! ===');
    console.log(`Counter mode: ${result2.mode}`);
    console.log(`IV: embedded in first 16 bytes`);
    return;
  }
  
  await tryRustCtr32();
}

main().catch(console.error);
