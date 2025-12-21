/**
 * Crack Flixer.sh - V5
 * 
 * Key findings:
 * - Responses differ each time (random IV)
 * - The IV must be embedded in the ciphertext
 * - Common patterns: IV || ciphertext or ciphertext || IV
 * 
 * Let's try extracting IV from different positions
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
 * Try all possible IV positions and key derivations
 */
async function bruteForceIvPosition() {
  console.log('=== Brute Force IV Position ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes`);
  console.log(`Data hex (first 64): ${data.subarray(0, 64).toString('hex')}`);
  console.log(`Data hex (last 32): ${data.subarray(-32).toString('hex')}`);
  
  // Key derivations to try
  const keys = [
    { name: 'direct', key: apiKeyBuf },
    { name: 'sha256', key: crypto.createHash('sha256').update(apiKeyBuf).digest() },
    { name: 'sha256-hex', key: crypto.createHash('sha256').update(apiKey).digest() },
  ];
  
  // IV positions to try
  const ivPositions = [
    { name: 'first-16', getIv: (d) => d.subarray(0, 16), getData: (d) => d.subarray(16) },
    { name: 'last-16', getIv: (d) => d.subarray(-16), getData: (d) => d.subarray(0, -16) },
    { name: 'first-12+zeros', getIv: (d) => Buffer.concat([d.subarray(0, 12), Buffer.alloc(4, 0)]), getData: (d) => d.subarray(12) },
    { name: 'zeros', getIv: () => Buffer.alloc(16, 0), getData: (d) => d },
  ];
  
  for (const keyDeriv of keys) {
    for (const ivPos of ivPositions) {
      try {
        const iv = ivPos.getIv(data);
        const ciphertext = ivPos.getData(data);
        
        const decipher = crypto.createDecipheriv('aes-256-ctr', keyDeriv.key, iv);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const text = decrypted.toString('utf8');
        
        if (text.startsWith('{') && text.includes('sources')) {
          console.log(`\n*** SUCCESS: key=${keyDeriv.name}, iv=${ivPos.name} ***`);
          console.log(`Decrypted: ${text.substring(0, 500)}`);
          return { keyDeriv, ivPos };
        }
        
        // Also check for partial success
        if (text.match(/^[\x20-\x7E]{20,}/)) {
          console.log(`\nPartial (key=${keyDeriv.name}, iv=${ivPos.name}): ${text.substring(0, 100)}`);
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  return null;
}

/**
 * The server might XOR the plaintext with the API key before AES encryption
 * Let's try: plaintext = AES_decrypt(ciphertext) XOR api_key
 */
async function tryXorAfterAes() {
  console.log('\n=== Try XOR After AES ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Try: IV is first 16 bytes, then AES-CTR decrypt, then XOR with key
  const iv = data.subarray(0, 16);
  const ciphertext = data.subarray(16);
  
  const keys = [
    { name: 'sha256', key: crypto.createHash('sha256').update(apiKeyBuf).digest() },
    { name: 'direct', key: apiKeyBuf },
  ];
  
  for (const keyDeriv of keys) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', keyDeriv.key, iv);
      let intermediate = decipher.update(ciphertext);
      intermediate = Buffer.concat([intermediate, decipher.final()]);
      
      // XOR with API key
      const decrypted = Buffer.alloc(intermediate.length);
      for (let i = 0; i < intermediate.length; i++) {
        decrypted[i] = intermediate[i] ^ apiKeyBuf[i % 32];
      }
      
      const text = decrypted.toString('utf8');
      if (text.startsWith('{')) {
        console.log(`*** SUCCESS (XOR after AES): key=${keyDeriv.name} ***`);
        console.log(`Decrypted: ${text.substring(0, 500)}`);
        return true;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  return false;
}

/**
 * Maybe the encryption uses a static key and the API key is just for auth
 * Let's try common static keys
 */
async function tryStaticKeys() {
  console.log('\n=== Try Static Keys ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  
  // Common static keys to try
  const staticKeys = [
    'flixer.sh',
    'plsdontscrapemelove',
    'tmdb-poster-utils',
    'img_data',
    'process_img_data',
    'flixer',
    'poster',
    'sources',
  ];
  
  for (const staticKey of staticKeys) {
    const key = crypto.createHash('sha256').update(staticKey).digest();
    
    // Try with IV from data
    const iv = data.subarray(0, 16);
    const ciphertext = data.subarray(16);
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', key, iv);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      const text = decrypted.toString('utf8');
      if (text.startsWith('{')) {
        console.log(`*** SUCCESS (static key): "${staticKey}" ***`);
        console.log(`Decrypted: ${text.substring(0, 500)}`);
        return staticKey;
      }
    } catch (e) {
      // Ignore
    }
    
    // Try with zero IV
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', key, Buffer.alloc(16, 0));
      let decrypted = decipher.update(data);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      const text = decrypted.toString('utf8');
      if (text.startsWith('{')) {
        console.log(`*** SUCCESS (static key, zero IV): "${staticKey}" ***`);
        console.log(`Decrypted: ${text.substring(0, 500)}`);
        return staticKey;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  return null;
}

/**
 * Analyze the structure of the encrypted data more carefully
 */
async function analyzeDataStructure() {
  console.log('\n=== Analyze Data Structure ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  
  // Make multiple requests with the same key
  const apiKey = crypto.randomBytes(32).toString('hex');
  console.log(`API Key: ${apiKey}\n`);
  
  const responses = [];
  for (let i = 0; i < 3; i++) {
    const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
    responses.push(Buffer.from(res.data, 'base64'));
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('Response lengths:', responses.map(r => r.length));
  
  // Find common bytes (might be part of the structure, not random IV)
  const minLen = Math.min(...responses.map(r => r.length));
  const commonBytes = [];
  
  for (let i = 0; i < minLen; i++) {
    const allSame = responses.every(r => r[i] === responses[0][i]);
    if (allSame) {
      commonBytes.push({ pos: i, byte: responses[0][i] });
    }
  }
  
  console.log(`\nCommon bytes across all responses: ${commonBytes.length}`);
  if (commonBytes.length > 0 && commonBytes.length < 50) {
    console.log('Positions:', commonBytes.map(b => b.pos).join(', '));
  }
  
  // The non-common bytes are likely the random IV
  // Let's see where the randomness is
  const diffPositions = [];
  for (let i = 0; i < minLen; i++) {
    const allSame = responses.every(r => r[i] === responses[0][i]);
    if (!allSame) {
      diffPositions.push(i);
    }
  }
  
  console.log(`\nDifferent byte positions: ${diffPositions.length}`);
  if (diffPositions.length > 0) {
    console.log(`First diff at: ${diffPositions[0]}`);
    console.log(`Last diff at: ${diffPositions[diffPositions.length - 1]}`);
    
    // Check if diffs are contiguous (suggesting IV location)
    const isContiguous = diffPositions.every((pos, i) => i === 0 || pos === diffPositions[i-1] + 1);
    console.log(`Diffs are contiguous: ${isContiguous}`);
    
    if (isContiguous) {
      console.log(`\nRandom IV appears to be at bytes ${diffPositions[0]}-${diffPositions[diffPositions.length - 1]}`);
      console.log(`IV length: ${diffPositions.length} bytes`);
    }
  }
}

/**
 * The encryption might use the API key directly as the keystream (simple XOR)
 * But with a random IV XORed first
 */
async function trySimpleXorWithIv() {
  console.log('\n=== Try Simple XOR with IV ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Maybe: ciphertext = plaintext XOR expand(api_key) XOR random_iv
  // And the random_iv is prepended
  
  // Try: first 16 bytes are IV, rest is ciphertext
  // plaintext = ciphertext XOR expand(api_key)
  
  const iv = data.subarray(0, 16);
  const ciphertext = data.subarray(16);
  
  // Expand key to ciphertext length
  const expandedKey = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    expandedKey[i] = apiKeyBuf[i % 32];
  }
  
  // XOR ciphertext with expanded key
  const decrypted = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    decrypted[i] = ciphertext[i] ^ expandedKey[i];
  }
  
  const text = decrypted.toString('utf8');
  console.log(`Simple XOR result: ${text.substring(0, 200)}`);
  
  if (text.startsWith('{')) {
    console.log('\n*** SUCCESS: Simple XOR with key ***');
    return true;
  }
  
  // Try with SHA256 of key
  const keyHash = crypto.createHash('sha256').update(apiKeyBuf).digest();
  const expandedHash = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    expandedHash[i] = keyHash[i % 32];
  }
  
  const decrypted2 = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    decrypted2[i] = ciphertext[i] ^ expandedHash[i];
  }
  
  const text2 = decrypted2.toString('utf8');
  console.log(`SHA256 XOR result: ${text2.substring(0, 200)}`);
  
  return false;
}

async function main() {
  await analyzeDataStructure();
  await bruteForceIvPosition();
  await tryXorAfterAes();
  await tryStaticKeys();
  await trySimpleXorWithIv();
}

main().catch(console.error);
