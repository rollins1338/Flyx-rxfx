/**
 * Crack Flixer.sh - V6
 * 
 * Key insight: The ENTIRE response differs each time, even with the same API key.
 * This means the server uses a random nonce/IV that affects ALL bytes.
 * 
 * In AES-CTR, the keystream is: AES(key, nonce || counter)
 * If the nonce changes, ALL keystream bytes change.
 * 
 * The nonce MUST be embedded in the response for the client to decrypt.
 * Let's find where it is.
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
 * The response format might be: nonce (12-16 bytes) || ciphertext
 * Let's try different nonce sizes
 */
async function tryDifferentNonceSizes() {
  console.log('=== Try Different Nonce Sizes ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes\n`);
  
  // Key derivations
  const keys = [
    { name: 'direct', key: apiKeyBuf },
    { name: 'sha256', key: crypto.createHash('sha256').update(apiKeyBuf).digest() },
    { name: 'sha256-hex', key: crypto.createHash('sha256').update(apiKey).digest() },
  ];
  
  // Nonce sizes to try (CTR mode typically uses 12-16 byte nonce)
  const nonceSizes = [8, 12, 16, 24, 32];
  
  for (const nonceSize of nonceSizes) {
    const nonce = data.subarray(0, nonceSize);
    const ciphertext = data.subarray(nonceSize);
    
    // For CTR mode, we need a 16-byte IV
    // If nonce is smaller, pad with zeros (counter space)
    let iv;
    if (nonceSize < 16) {
      iv = Buffer.concat([nonce, Buffer.alloc(16 - nonceSize, 0)]);
    } else if (nonceSize > 16) {
      iv = nonce.subarray(0, 16);
    } else {
      iv = nonce;
    }
    
    for (const keyDeriv of keys) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', keyDeriv.key, iv);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const text = decrypted.toString('utf8');
        
        if (text.startsWith('{') && text.includes('sources')) {
          console.log(`*** SUCCESS: nonceSize=${nonceSize}, key=${keyDeriv.name} ***`);
          console.log(`Decrypted: ${text.substring(0, 500)}`);
          return { nonceSize, keyDeriv };
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  console.log('No combination worked\n');
  return null;
}

/**
 * Maybe the encryption key is derived from BOTH the API key AND the nonce
 * Common pattern: key = HMAC(api_key, nonce)
 */
async function tryNonceBasedKeyDerivation() {
  console.log('=== Try Nonce-Based Key Derivation ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes\n`);
  
  // Try different nonce sizes
  for (const nonceSize of [12, 16, 24, 32]) {
    const nonce = data.subarray(0, nonceSize);
    const ciphertext = data.subarray(nonceSize);
    
    // Derive key from API key and nonce
    const derivedKeys = [
      { name: 'hmac(apikey, nonce)', key: crypto.createHmac('sha256', apiKeyBuf).update(nonce).digest() },
      { name: 'hmac(nonce, apikey)', key: crypto.createHmac('sha256', nonce).update(apiKeyBuf).digest() },
      { name: 'sha256(apikey+nonce)', key: crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, nonce])).digest() },
      { name: 'sha256(nonce+apikey)', key: crypto.createHash('sha256').update(Buffer.concat([nonce, apiKeyBuf])).digest() },
    ];
    
    for (const keyDeriv of derivedKeys) {
      // Try with zero IV (since nonce is used for key derivation)
      try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', keyDeriv.key, Buffer.alloc(16, 0));
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const text = decrypted.toString('utf8');
        
        if (text.startsWith('{') && text.includes('sources')) {
          console.log(`*** SUCCESS: nonceSize=${nonceSize}, ${keyDeriv.name} ***`);
          console.log(`Decrypted: ${text.substring(0, 500)}`);
          return { nonceSize, keyDeriv };
        }
      } catch (e) {
        // Ignore
      }
      
      // Try with nonce as IV too
      if (nonceSize <= 16) {
        const iv = nonceSize < 16 
          ? Buffer.concat([nonce, Buffer.alloc(16 - nonceSize, 0)])
          : nonce;
        
        try {
          const decipher = crypto.createDecipheriv('aes-256-ctr', keyDeriv.key, iv);
          let decrypted = decipher.update(ciphertext);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          
          const text = decrypted.toString('utf8');
          
          if (text.startsWith('{') && text.includes('sources')) {
            console.log(`*** SUCCESS: nonceSize=${nonceSize}, ${keyDeriv.name}, iv=nonce ***`);
            console.log(`Decrypted: ${text.substring(0, 500)}`);
            return { nonceSize, keyDeriv };
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }
  
  console.log('No combination worked\n');
  return null;
}

/**
 * Let's try a completely different approach:
 * Maybe the response is NOT AES encrypted, but uses a simpler scheme
 */
async function trySimpleSchemes() {
  console.log('=== Try Simple Encryption Schemes ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes\n`);
  
  // 1. RC4 (simple stream cipher)
  console.log('Trying RC4...');
  try {
    const rc4Decrypt = (key, data) => {
      const S = Array.from({ length: 256 }, (_, i) => i);
      let j = 0;
      
      // KSA
      for (let i = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
      }
      
      // PRGA
      const result = Buffer.alloc(data.length);
      let i = 0;
      j = 0;
      for (let k = 0; k < data.length; k++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
        result[k] = data[k] ^ S[(S[i] + S[j]) % 256];
      }
      return result;
    };
    
    const rc4Result = rc4Decrypt(apiKeyBuf, data);
    const rc4Text = rc4Result.toString('utf8');
    if (rc4Text.startsWith('{')) {
      console.log('*** RC4 SUCCESS ***');
      console.log(rc4Text.substring(0, 500));
    } else {
      console.log(`RC4 result: ${rc4Text.substring(0, 100)}`);
    }
  } catch (e) {
    console.log('RC4 failed:', e.message);
  }
  
  // 2. ChaCha20 (if available)
  console.log('\nTrying ChaCha20...');
  try {
    // ChaCha20 needs 32-byte key and 12-byte nonce
    const nonce = data.subarray(0, 12);
    const ciphertext = data.subarray(12);
    
    const decipher = crypto.createDecipheriv('chacha20', apiKeyBuf, nonce);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    const text = decrypted.toString('utf8');
    if (text.startsWith('{')) {
      console.log('*** ChaCha20 SUCCESS ***');
      console.log(text.substring(0, 500));
    }
  } catch (e) {
    console.log('ChaCha20 not available or failed:', e.message);
  }
  
  // 3. XOR with key hash repeated
  console.log('\nTrying XOR with SHA256(key)...');
  const keyHash = crypto.createHash('sha256').update(apiKeyBuf).digest();
  const xorResult = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    xorResult[i] = data[i] ^ keyHash[i % 32];
  }
  const xorText = xorResult.toString('utf8');
  if (xorText.startsWith('{')) {
    console.log('*** XOR SUCCESS ***');
    console.log(xorText.substring(0, 500));
  } else {
    console.log(`XOR result: ${xorText.substring(0, 100)}`);
  }
}

/**
 * Let's look at the WASM more carefully
 * The process_img_data function signature suggests it takes encrypted data and api_key
 * and returns a Promise<any>
 * 
 * The WASM uses hmac-0.12.1 which suggests HMAC is used somewhere
 * Maybe for key derivation: encryption_key = HMAC(api_key, something)
 */
async function analyzeWithKnownPlaintext() {
  console.log('\n=== Analyze with Known Plaintext ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // We know the plaintext starts with: {"sources":[{"server":"alpha","url":"
  const knownPlaintext = '{"sources":[{"server":"alpha","url":"https://';
  const knownBuf = Buffer.from(knownPlaintext);
  
  // Derive keystream from known plaintext
  const keystream = Buffer.alloc(knownBuf.length);
  for (let i = 0; i < knownBuf.length; i++) {
    keystream[i] = data[i] ^ knownBuf[i];
  }
  
  console.log(`Known plaintext: "${knownPlaintext}"`);
  console.log(`Keystream (first ${keystream.length} bytes): ${keystream.toString('hex')}`);
  console.log(`API key: ${apiKey}`);
  
  // Check if keystream matches any derivation of the API key
  const apiKeyHash = crypto.createHash('sha256').update(apiKeyBuf).digest();
  console.log(`SHA256(apiKey): ${apiKeyHash.toString('hex')}`);
  
  // Check if first 32 bytes of keystream match SHA256(apiKey)
  const keystreamFirst32 = keystream.subarray(0, 32);
  console.log(`Keystream first 32: ${keystreamFirst32.toString('hex')}`);
  console.log(`Match SHA256: ${keystreamFirst32.equals(apiKeyHash.subarray(0, keystreamFirst32.length))}`);
  
  // The keystream should be AES-CTR output
  // Let's see if we can find the IV by checking what IV would produce this keystream
  
  // In AES-CTR: keystream = AES(key, IV || counter)
  // First 16 bytes of keystream = AES(key, IV || 0)
  // We can try to find IV by decrypting the keystream with the key
  
  console.log('\nTrying to find IV by reverse engineering keystream...');
  
  // If keystream[0:16] = AES_encrypt(key, IV), then IV = AES_decrypt(key, keystream[0:16])
  // But this only works for ECB mode, not CTR
  
  // For CTR: keystream[0:16] = AES_encrypt(key, IV || 0)
  // So: IV || 0 = AES_decrypt(key, keystream[0:16])
  
  const keystreamBlock1 = keystream.subarray(0, 16);
  
  for (const keyDeriv of [
    { name: 'direct', key: apiKeyBuf },
    { name: 'sha256', key: apiKeyHash },
  ]) {
    try {
      // Decrypt the keystream block to get the counter block
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyDeriv.key, null);
      decipher.setAutoPadding(false);
      const counterBlock = decipher.update(keystreamBlock1);
      
      console.log(`\nKey derivation: ${keyDeriv.name}`);
      console.log(`Counter block (IV || 0): ${counterBlock.toString('hex')}`);
      
      // The counter block should be: IV (12 bytes) || counter (4 bytes, starting at 0 or 1)
      // Let's check if the last 4 bytes are 0 or 1
      const last4 = counterBlock.subarray(12, 16);
      console.log(`Last 4 bytes (counter): ${last4.toString('hex')}`);
      
      // If this looks like a valid counter, try decrypting with this IV
      const possibleIv = counterBlock; // Use full 16 bytes as IV for CTR
      
      const testDecipher = crypto.createDecipheriv('aes-256-ctr', keyDeriv.key, possibleIv);
      let testDecrypted = testDecipher.update(data);
      testDecrypted = Buffer.concat([testDecrypted, testDecipher.final()]);
      
      const testText = testDecrypted.toString('utf8');
      console.log(`Decrypted with derived IV: ${testText.substring(0, 100)}`);
      
      if (testText.startsWith('{')) {
        console.log('\n*** SUCCESS! ***');
        console.log(testText.substring(0, 500));
      }
    } catch (e) {
      console.log(`Error with ${keyDeriv.name}:`, e.message);
    }
  }
}

async function main() {
  await tryDifferentNonceSizes();
  await tryNonceBasedKeyDerivation();
  await trySimpleSchemes();
  await analyzeWithKnownPlaintext();
}

main().catch(console.error);
