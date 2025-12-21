/**
 * Crack Flixer.sh - V3
 * 
 * Based on WASM analysis:
 * - Uses cipher-0.4.4 (stream cipher interface)
 * - Uses ctr-0.9.2 (CTR mode, specifically ctr32 flavor)
 * - Uses aes-0.8.4 (AES-256)
 * - Uses hmac-0.12.1 (HMAC for key derivation?)
 * - Uses base64-0.21.7 (Base64 decoding)
 * 
 * Output structure:
 * - ProcessedImageData { sources, skipTime }
 * - FormattedSource { server, url }
 * - SkipTime { startTime, endTime }
 * 
 * Error codes: E56, E57, E58 (decryption errors)
 */

const crypto = require('crypto');
const https = require('https');

const API_BASE = 'https://plsdontscrapemelove.flixer.sh';

// Generate request parameters
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
 * AES-256-CTR decryption with various IV/key derivation methods
 */
function tryAesCtrDecrypt(encryptedBase64, apiKey) {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const keyHex = apiKey; // 64 hex chars = 32 bytes
  const keyBuffer = Buffer.from(keyHex, 'hex');
  
  console.log(`\nEncrypted data: ${encrypted.length} bytes`);
  console.log(`First 32 bytes: ${encrypted.subarray(0, 32).toString('hex')}`);
  console.log(`Key: ${keyHex.substring(0, 32)}...`);
  
  const results = [];
  
  // CTR mode in Rust's ctr crate uses a 16-byte nonce/IV
  // The ctr32 flavor uses a 32-bit counter in the last 4 bytes
  
  // Method 1: IV is first 16 bytes of encrypted data
  const ivMethods = [
    { name: 'iv-prefix-16', iv: encrypted.subarray(0, 16), data: encrypted.subarray(16) },
    { name: 'iv-zero', iv: Buffer.alloc(16, 0), data: encrypted },
    { name: 'iv-from-key-first16', iv: keyBuffer.subarray(0, 16), data: encrypted },
    { name: 'iv-from-key-last16', iv: keyBuffer.subarray(16, 32), data: encrypted },
    { name: 'iv-sha256-key-first16', iv: crypto.createHash('sha256').update(keyBuffer).digest().subarray(0, 16), data: encrypted },
  ];
  
  // Key derivation methods
  const keyMethods = [
    { name: 'key-direct', key: keyBuffer },
    { name: 'key-sha256', key: crypto.createHash('sha256').update(keyBuffer).digest() },
    { name: 'key-sha256-hex', key: crypto.createHash('sha256').update(keyHex).digest() },
    { name: 'key-hmac-flixer', key: crypto.createHmac('sha256', 'flixer').update(keyBuffer).digest() },
    { name: 'key-hmac-key-flixer', key: crypto.createHmac('sha256', keyBuffer).update('flixer').digest() },
    { name: 'key-hmac-key-empty', key: crypto.createHmac('sha256', keyBuffer).update('').digest() },
  ];
  
  for (const ivMethod of ivMethods) {
    for (const keyMethod of keyMethods) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', keyMethod.key, ivMethod.iv);
        let decrypted = decipher.update(ivMethod.data);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const text = decrypted.toString('utf8');
        
        // Check if it looks like valid JSON or contains expected fields
        if (text.includes('{') && (text.includes('sources') || text.includes('url') || text.includes('server'))) {
          results.push({
            method: `${keyMethod.name}/${ivMethod.name}`,
            text: text.substring(0, 500),
            success: true,
          });
        } else if (text.match(/^[\x20-\x7E\n\r\t]+$/)) {
          // Printable ASCII
          results.push({
            method: `${keyMethod.name}/${ivMethod.name}`,
            text: text.substring(0, 200),
            success: false,
            note: 'printable but not JSON',
          });
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }
  
  return results;
}

/**
 * Try XOR-based decryption (simpler than AES)
 */
function tryXorDecrypt(encryptedBase64, apiKey) {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const keyBuffer = Buffer.from(apiKey, 'hex');
  
  const results = [];
  
  // Simple XOR with key
  const xored = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    xored[i] = encrypted[i] ^ keyBuffer[i % keyBuffer.length];
  }
  
  const text = xored.toString('utf8');
  if (text.includes('{') || text.match(/^[\x20-\x7E]+$/)) {
    results.push({ method: 'xor-key', text: text.substring(0, 200) });
  }
  
  // XOR with SHA256 of key
  const keyHash = crypto.createHash('sha256').update(keyBuffer).digest();
  const xored2 = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    xored2[i] = encrypted[i] ^ keyHash[i % keyHash.length];
  }
  
  const text2 = xored2.toString('utf8');
  if (text2.includes('{') || text2.match(/^[\x20-\x7E]+$/)) {
    results.push({ method: 'xor-sha256-key', text: text2.substring(0, 200) });
  }
  
  return results;
}

/**
 * Analyze the relationship between key and ciphertext
 */
async function analyzeKeyInfluence() {
  console.log('=== Analyzing Key Influence on Ciphertext ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  
  // Make requests with different keys
  const keys = [];
  const responses = [];
  
  for (let i = 0; i < 3; i++) {
    const key = crypto.randomBytes(32).toString('hex');
    keys.push(key);
    
    const res = await makeRequest(testPath, key, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
    responses.push(res.data);
    
    console.log(`Key ${i + 1}: ${key.substring(0, 16)}...`);
    console.log(`Response: ${res.data.substring(0, 40)}... (${res.data.length} chars)`);
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Decode and compare
  const decoded = responses.map(r => Buffer.from(r, 'base64'));
  
  console.log('\nDecoded lengths:', decoded.map(d => d.length));
  
  // XOR first two responses
  const minLen = Math.min(decoded[0].length, decoded[1].length);
  const xor01 = Buffer.alloc(minLen);
  for (let i = 0; i < minLen; i++) {
    xor01[i] = decoded[0][i] ^ decoded[1][i];
  }
  
  // XOR the keys
  const key0 = Buffer.from(keys[0], 'hex');
  const key1 = Buffer.from(keys[1], 'hex');
  const keyXor = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    keyXor[i] = key0[i] ^ key1[i];
  }
  
  console.log('\nXOR of responses (first 64 bytes):', xor01.subarray(0, 64).toString('hex'));
  console.log('XOR of keys:', keyXor.toString('hex'));
  
  // Check if XOR of responses matches XOR of keys (repeated)
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (xor01[i] === keyXor[i % 32]) matches++;
  }
  console.log(`\nKey XOR match rate: ${matches}/${minLen} (${(matches/minLen*100).toFixed(1)}%)`);
  
  // If the match rate is high, the encryption is: ciphertext = plaintext XOR key (repeated)
  // If not, there's additional transformation
  
  return { keys, responses, decoded };
}

/**
 * Try to find the plaintext by assuming CTR mode with known structure
 */
async function tryKnownPlaintextAttack() {
  console.log('\n=== Known Plaintext Attack ===\n');
  
  // We know the plaintext structure:
  // {"sources":[{"server":"alpha","url":"https://..."}],"skipTime":null}
  
  // The beginning should be: {"sources":[{"server":"
  const knownPrefix = '{"sources":[{"server":"';
  const knownPrefixBuf = Buffer.from(knownPrefix);
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const key = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, key, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const encrypted = Buffer.from(res.data, 'base64');
  
  console.log(`Key: ${key}`);
  console.log(`Encrypted (first 64 bytes): ${encrypted.subarray(0, 64).toString('hex')}`);
  
  // XOR encrypted with known plaintext to get keystream
  const keystream = Buffer.alloc(knownPrefixBuf.length);
  for (let i = 0; i < knownPrefixBuf.length; i++) {
    keystream[i] = encrypted[i] ^ knownPrefixBuf[i];
  }
  
  console.log(`\nKnown plaintext: "${knownPrefix}"`);
  console.log(`Derived keystream (first ${keystream.length} bytes): ${keystream.toString('hex')}`);
  
  // The keystream should be AES-CTR(key, IV, counter)
  // Let's see if the keystream matches any pattern
  
  // Try to decrypt the rest using this keystream pattern
  // In CTR mode, keystream = AES(key, IV || counter)
  // If we know the keystream, we can XOR to get plaintext
  
  // But we only have partial keystream. Let's try to extend it.
  // In AES-CTR, each 16-byte block uses a different counter value
  
  // First, let's verify our assumption by checking if the keystream
  // is related to the API key
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Check if keystream XOR key gives something meaningful
  const keystreamXorKey = Buffer.alloc(keystream.length);
  for (let i = 0; i < keystream.length; i++) {
    keystreamXorKey[i] = keystream[i] ^ keyBuf[i % 32];
  }
  console.log(`Keystream XOR key: ${keystreamXorKey.toString('hex')}`);
  
  // Try decrypting with the derived keystream extended
  // Assuming the keystream repeats every 32 bytes (key length)
  const decrypted = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keystream[i % keystream.length];
  }
  console.log(`\nDecrypted (assuming keystream repeats): ${decrypted.toString('utf8').substring(0, 200)}`);
}

/**
 * Main test function
 */
async function main() {
  console.log('=== Flixer.sh Decryption Cracker V3 ===\n');
  
  // First, analyze how the key influences the ciphertext
  const analysis = await analyzeKeyInfluence();
  
  // Try known plaintext attack
  await tryKnownPlaintextAttack();
  
  // Try various decryption methods
  console.log('\n=== Trying Decryption Methods ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const key = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, key, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  
  if (res.status === 200) {
    console.log(`Got encrypted response: ${res.data.length} chars`);
    
    const aesResults = tryAesCtrDecrypt(res.data, key);
    if (aesResults.length > 0) {
      console.log('\n*** AES-CTR Decryption Results ***');
      aesResults.forEach(r => {
        console.log(`\nMethod: ${r.method}`);
        console.log(`Success: ${r.success}`);
        console.log(`Text: ${r.text}`);
      });
    } else {
      console.log('No AES-CTR decryption succeeded');
    }
    
    const xorResults = tryXorDecrypt(res.data, key);
    if (xorResults.length > 0) {
      console.log('\n*** XOR Decryption Results ***');
      xorResults.forEach(r => {
        console.log(`\nMethod: ${r.method}`);
        console.log(`Text: ${r.text}`);
      });
    }
  }
}

main().catch(console.error);
