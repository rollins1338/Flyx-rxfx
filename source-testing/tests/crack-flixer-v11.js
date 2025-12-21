/**
 * Crack Flixer.sh - V11
 * 
 * We consistently decrypt the first 16 bytes correctly.
 * The issue is with subsequent blocks.
 * 
 * Rust's ctr crate ctr32 flavor:
 * - Uses a 128-bit nonce/IV
 * - The last 32 bits are the counter (big-endian)
 * - Counter wraps around at 2^32
 * 
 * But our derived nonce might be wrong for block 0.
 * Let's check if the nonce is actually embedded in the data.
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
 * Try: the nonce is the first 12 bytes of the response, counter starts at 0
 */
async function tryNoncePrefix() {
  console.log('=== Try Nonce Prefix (12 bytes) ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data: ${data.length} bytes`);
  
  // Try: first 12 bytes are nonce, rest is ciphertext
  const nonce12 = data.subarray(0, 12);
  const ciphertext = data.subarray(12);
  
  console.log(`Nonce (12 bytes): ${nonce12.toString('hex')}`);
  console.log(`Ciphertext: ${ciphertext.length} bytes`);
  
  // Build 16-byte IV: nonce || counter (starting at 0 or 1)
  for (const startCounter of [0, 1, 2]) {
    const iv = Buffer.alloc(16);
    nonce12.copy(iv, 0);
    iv.writeUInt32BE(startCounter, 12);
    
    // Try with direct key
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', apiKeyBuf, iv);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      const text = decrypted.toString('utf8');
      console.log(`\nStart counter ${startCounter}: ${text.substring(0, 80)}`);
      
      if (text.startsWith('{')) {
        console.log('\n*** SUCCESS! ***');
        console.log(text);
        return true;
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
  
  return false;
}

/**
 * Try: the nonce is derived from the API key, and the response is pure ciphertext
 */
async function tryDerivedNonce() {
  console.log('\n=== Try Derived Nonce ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  
  // Derive nonce from API key
  const nonceDerivations = [
    { name: 'sha256-first12', nonce: crypto.createHash('sha256').update(apiKeyBuf).digest().subarray(0, 12) },
    { name: 'sha256-last12', nonce: crypto.createHash('sha256').update(apiKeyBuf).digest().subarray(20, 32) },
    { name: 'md5', nonce: crypto.createHash('md5').update(apiKeyBuf).digest().subarray(0, 12) },
    { name: 'hmac-nonce', nonce: crypto.createHmac('sha256', apiKeyBuf).update('nonce').digest().subarray(0, 12) },
    { name: 'key-first12', nonce: apiKeyBuf.subarray(0, 12) },
    { name: 'key-last12', nonce: apiKeyBuf.subarray(20, 32) },
  ];
  
  for (const nd of nonceDerivations) {
    const iv = Buffer.alloc(16);
    nd.nonce.copy(iv, 0);
    iv.writeUInt32BE(0, 12);  // Counter starts at 0
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', apiKeyBuf, iv);
      let decrypted = decipher.update(data);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      const text = decrypted.toString('utf8');
      
      if (text.startsWith('{')) {
        console.log(`*** SUCCESS: ${nd.name} ***`);
        console.log(text);
        return nd.name;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  console.log('No derived nonce worked');
  return null;
}

/**
 * The issue might be that the server uses a RANDOM nonce for each response
 * and embeds it somewhere in the response.
 * 
 * Let's check if the nonce might be at the END of the response.
 */
async function tryNonceSuffix() {
  console.log('\n=== Try Nonce Suffix ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data: ${data.length} bytes`);
  
  // Try: last 12 or 16 bytes are nonce
  for (const nonceSize of [12, 16]) {
    const nonce = data.subarray(-nonceSize);
    const ciphertext = data.subarray(0, -nonceSize);
    
    console.log(`\nNonce size: ${nonceSize}, Ciphertext: ${ciphertext.length} bytes`);
    
    const iv = Buffer.alloc(16);
    if (nonceSize === 12) {
      nonce.copy(iv, 0);
      iv.writeUInt32BE(0, 12);
    } else {
      nonce.copy(iv, 0);
    }
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', apiKeyBuf, iv);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      const text = decrypted.toString('utf8');
      console.log(`Result: ${text.substring(0, 80)}`);
      
      if (text.startsWith('{')) {
        console.log('\n*** SUCCESS! ***');
        console.log(text);
        return true;
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
  
  return false;
}

/**
 * Let's try a completely different approach:
 * Maybe the encryption is XOR with a keystream generated by repeatedly hashing
 */
async function tryHashChainKeystream() {
  console.log('\n=== Try Hash Chain Keystream ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Generate keystream by chaining hashes
  // keystream = H(key) || H(H(key)) || H(H(H(key))) || ...
  
  const keystream = Buffer.alloc(data.length);
  let currentHash = apiKeyBuf;
  let offset = 0;
  
  while (offset < data.length) {
    currentHash = crypto.createHash('sha256').update(currentHash).digest();
    const copyLen = Math.min(32, data.length - offset);
    currentHash.copy(keystream, offset, 0, copyLen);
    offset += copyLen;
  }
  
  const decrypted = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ keystream[i];
  }
  
  const text = decrypted.toString('utf8');
  console.log(`Hash chain result: ${text.substring(0, 100)}`);
  
  if (text.startsWith('{')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text);
    return true;
  }
  
  // Try with HMAC chain
  const keystream2 = Buffer.alloc(data.length);
  let counter = 0;
  offset = 0;
  
  while (offset < data.length) {
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigUInt64BE(BigInt(counter), 0);
    const block = crypto.createHmac('sha256', apiKeyBuf).update(counterBuf).digest();
    const copyLen = Math.min(32, data.length - offset);
    block.copy(keystream2, offset, 0, copyLen);
    offset += copyLen;
    counter++;
  }
  
  const decrypted2 = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted2[i] = data[i] ^ keystream2[i];
  }
  
  const text2 = decrypted2.toString('utf8');
  console.log(`HMAC chain result: ${text2.substring(0, 100)}`);
  
  if (text2.startsWith('{')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text2);
    return true;
  }
  
  return false;
}

/**
 * Maybe the response includes both a random nonce AND uses the API key
 * Format: random_nonce (16 bytes) || ciphertext
 * Key derivation: encryption_key = HMAC(api_key, random_nonce)
 */
async function tryNonceBasedKeyDerivation() {
  console.log('\n=== Try Nonce-Based Key Derivation ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data: ${data.length} bytes`);
  
  // Try: first 16 bytes are random nonce, used to derive encryption key
  for (const nonceSize of [12, 16, 24, 32]) {
    if (nonceSize >= data.length) continue;
    
    const randomNonce = data.subarray(0, nonceSize);
    const ciphertext = data.subarray(nonceSize);
    
    // Derive encryption key from API key and random nonce
    const derivedKey = crypto.createHmac('sha256', apiKeyBuf).update(randomNonce).digest();
    
    // Use zero IV or derived IV
    const ivOptions = [
      Buffer.alloc(16, 0),
      crypto.createHash('sha256').update(randomNonce).digest().subarray(0, 16),
      randomNonce.length >= 16 ? randomNonce.subarray(0, 16) : Buffer.concat([randomNonce, Buffer.alloc(16 - randomNonce.length)]),
    ];
    
    for (const iv of ivOptions) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', derivedKey, iv);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const text = decrypted.toString('utf8');
        
        if (text.startsWith('{') && text.includes('sources')) {
          console.log(`*** SUCCESS: nonceSize=${nonceSize} ***`);
          console.log(text);
          return { nonceSize, derivedKey: derivedKey.toString('hex') };
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  console.log('No nonce-based key derivation worked');
  return null;
}

async function main() {
  await tryNoncePrefix();
  await tryDerivedNonce();
  await tryNonceSuffix();
  await tryHashChainKeystream();
  await tryNonceBasedKeyDerivation();
}

main().catch(console.error);
