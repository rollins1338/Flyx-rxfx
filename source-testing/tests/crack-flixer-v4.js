/**
 * Crack Flixer.sh - V4
 * 
 * Key insight from V3: Known plaintext attack partially works!
 * The first 23 bytes decrypt correctly with XOR keystream.
 * 
 * AES-CTR generates keystream in 16-byte blocks:
 * keystream = AES(key, IV || counter_0) || AES(key, IV || counter_1) || ...
 * 
 * We need to figure out:
 * 1. What is the IV?
 * 2. How is the key derived from the API key?
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
 * Generate AES-CTR keystream
 */
function generateAesCtrKeystream(key, iv, length) {
  // Create a buffer of zeros to encrypt (CTR mode XORs plaintext with keystream)
  const zeros = Buffer.alloc(length, 0);
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
  return cipher.update(zeros);
}

/**
 * Try to find the correct key/IV combination
 */
async function findKeyIvCombination() {
  console.log('=== Finding Key/IV Combination ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const encrypted = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Encrypted length: ${encrypted.length} bytes`);
  
  // Known plaintext - the response should start with this
  const knownPlaintext = '{"sources":[{"server":"alpha","url":"https://';
  const knownBuf = Buffer.from(knownPlaintext);
  
  // Derive the keystream from known plaintext
  const derivedKeystream = Buffer.alloc(knownBuf.length);
  for (let i = 0; i < knownBuf.length; i++) {
    derivedKeystream[i] = encrypted[i] ^ knownBuf[i];
  }
  
  console.log(`\nKnown plaintext: "${knownPlaintext}"`);
  console.log(`Derived keystream (${derivedKeystream.length} bytes): ${derivedKeystream.toString('hex')}`);
  
  // Now try to find what key/IV produces this keystream
  // The keystream should be: AES(key, IV || 0) || AES(key, IV || 1) || ...
  
  // First 16 bytes of keystream = AES(key, IV || 0)
  const firstBlock = derivedKeystream.subarray(0, 16);
  const secondBlockPartial = derivedKeystream.subarray(16, 32);
  
  console.log(`\nFirst keystream block (16 bytes): ${firstBlock.toString('hex')}`);
  console.log(`Second keystream block partial: ${secondBlockPartial.toString('hex')}`);
  
  // Try different key derivations
  const keyDerivations = [
    { name: 'direct', key: apiKeyBuf },
    { name: 'sha256', key: crypto.createHash('sha256').update(apiKeyBuf).digest() },
    { name: 'sha256-hex', key: crypto.createHash('sha256').update(apiKey).digest() },
    { name: 'md5-doubled', key: Buffer.concat([crypto.createHash('md5').update(apiKeyBuf).digest(), crypto.createHash('md5').update(apiKeyBuf).digest()]) },
  ];
  
  // Try different IV derivations
  const ivDerivations = [
    { name: 'zeros', iv: Buffer.alloc(16, 0) },
    { name: 'key-first16', iv: apiKeyBuf.subarray(0, 16) },
    { name: 'key-last16', iv: apiKeyBuf.subarray(16, 32) },
    { name: 'sha256-key-first16', iv: crypto.createHash('sha256').update(apiKeyBuf).digest().subarray(0, 16) },
    { name: 'md5-key', iv: crypto.createHash('md5').update(apiKeyBuf).digest() },
    { name: 'md5-hex', iv: crypto.createHash('md5').update(apiKey).digest() },
  ];
  
  console.log('\n=== Testing Key/IV Combinations ===\n');
  
  for (const keyDeriv of keyDerivations) {
    for (const ivDeriv of ivDerivations) {
      try {
        const keystream = generateAesCtrKeystream(keyDeriv.key, ivDeriv.iv, encrypted.length);
        
        // Decrypt
        const decrypted = Buffer.alloc(encrypted.length);
        for (let i = 0; i < encrypted.length; i++) {
          decrypted[i] = encrypted[i] ^ keystream[i];
        }
        
        const text = decrypted.toString('utf8');
        
        // Check if it starts with expected JSON
        if (text.startsWith('{"sources"')) {
          console.log(`\n*** SUCCESS: ${keyDeriv.name} / ${ivDeriv.name} ***`);
          console.log(`Decrypted: ${text.substring(0, 300)}`);
          
          // Try to parse as JSON
          try {
            const json = JSON.parse(text);
            console.log('\nParsed JSON:', JSON.stringify(json, null, 2).substring(0, 500));
          } catch (e) {
            console.log('(Not valid JSON yet)');
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }
  
  // Also try: maybe the IV is embedded in the ciphertext
  console.log('\n=== Testing IV from Ciphertext ===\n');
  
  // Maybe first 16 bytes are IV
  const possibleIv = encrypted.subarray(0, 16);
  const ciphertext = encrypted.subarray(16);
  
  for (const keyDeriv of keyDerivations) {
    try {
      const keystream = generateAesCtrKeystream(keyDeriv.key, possibleIv, ciphertext.length);
      
      const decrypted = Buffer.alloc(ciphertext.length);
      for (let i = 0; i < ciphertext.length; i++) {
        decrypted[i] = ciphertext[i] ^ keystream[i];
      }
      
      const text = decrypted.toString('utf8');
      
      if (text.startsWith('{"') || text.includes('"sources"')) {
        console.log(`\n*** IV-PREFIX SUCCESS: ${keyDeriv.name} ***`);
        console.log(`Decrypted: ${text.substring(0, 300)}`);
      }
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Analyze multiple requests to find patterns
 */
async function analyzeMultipleRequests() {
  console.log('\n=== Analyzing Multiple Requests ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  
  // Use the SAME key for multiple requests
  const apiKey = crypto.randomBytes(32).toString('hex');
  console.log(`Using fixed API key: ${apiKey}\n`);
  
  const responses = [];
  for (let i = 0; i < 3; i++) {
    const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
    responses.push(Buffer.from(res.data, 'base64'));
    console.log(`Request ${i + 1}: ${res.data.substring(0, 40)}...`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Check if responses are identical (deterministic encryption)
  const allSame = responses.every(r => r.equals(responses[0]));
  console.log(`\nAll responses identical: ${allSame}`);
  
  if (!allSame) {
    // If not identical, there's randomness (maybe random IV)
    console.log('Responses differ - encryption uses random IV');
    
    // XOR first two responses to see the difference
    const xor = Buffer.alloc(Math.min(responses[0].length, responses[1].length));
    for (let i = 0; i < xor.length; i++) {
      xor[i] = responses[0][i] ^ responses[1][i];
    }
    console.log(`XOR of responses: ${xor.subarray(0, 64).toString('hex')}`);
  } else {
    console.log('Responses are identical - encryption is deterministic');
    console.log('This means IV is derived from the API key');
  }
}

/**
 * Try HMAC-based key derivation (common in Rust crypto)
 */
async function tryHmacKeyDerivation() {
  console.log('\n=== Trying HMAC Key Derivation ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const encrypted = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  
  // HMAC-based key derivation patterns
  const hmacDerivations = [
    // HMAC(key, "enc") for encryption key
    { name: 'hmac-enc', key: crypto.createHmac('sha256', apiKeyBuf).update('enc').digest() },
    { name: 'hmac-key', key: crypto.createHmac('sha256', apiKeyBuf).update('key').digest() },
    { name: 'hmac-aes', key: crypto.createHmac('sha256', apiKeyBuf).update('aes').digest() },
    { name: 'hmac-decrypt', key: crypto.createHmac('sha256', apiKeyBuf).update('decrypt').digest() },
    { name: 'hmac-empty', key: crypto.createHmac('sha256', apiKeyBuf).update('').digest() },
    // HMAC with key as message
    { name: 'hmac-rev-enc', key: crypto.createHmac('sha256', 'enc').update(apiKeyBuf).digest() },
    { name: 'hmac-rev-key', key: crypto.createHmac('sha256', 'key').update(apiKeyBuf).digest() },
  ];
  
  const ivDerivations = [
    { name: 'zeros', iv: Buffer.alloc(16, 0) },
    { name: 'hmac-iv', iv: crypto.createHmac('sha256', apiKeyBuf).update('iv').digest().subarray(0, 16) },
    { name: 'hmac-nonce', iv: crypto.createHmac('sha256', apiKeyBuf).update('nonce').digest().subarray(0, 16) },
    { name: 'key-first16', iv: apiKeyBuf.subarray(0, 16) },
  ];
  
  for (const keyDeriv of hmacDerivations) {
    for (const ivDeriv of ivDerivations) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', keyDeriv.key, ivDeriv.iv);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const text = decrypted.toString('utf8');
        
        if (text.startsWith('{"sources"') || text.startsWith('{"poster_sources"')) {
          console.log(`\n*** SUCCESS: ${keyDeriv.name} / ${ivDeriv.name} ***`);
          console.log(`Decrypted: ${text.substring(0, 500)}`);
          return { key: keyDeriv, iv: ivDeriv };
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  console.log('No HMAC derivation worked');
  return null;
}

async function main() {
  await analyzeMultipleRequests();
  await findKeyIvCombination();
  await tryHmacKeyDerivation();
}

main().catch(console.error);
