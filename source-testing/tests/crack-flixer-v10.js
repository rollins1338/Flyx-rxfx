/**
 * Crack Flixer.sh - V10
 * 
 * Let's take a step back and think about this differently.
 * 
 * The WASM has two functions:
 * 1. get_img_key() - generates the API key from browser fingerprint
 * 2. process_img_data(encrypted_data, api_key) - decrypts the response
 * 
 * The server encrypts with a key derived from the client's API key.
 * The client decrypts with the same derivation.
 * 
 * Since we can generate ANY valid API key (the server accepts any 64-hex key),
 * we just need to figure out the key derivation.
 * 
 * Let's try to use the WASM directly by mocking the browser APIs it needs.
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

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
 * The WASM uses these browser APIs (from the imports):
 * - navigator.userAgent
 * - navigator.platform
 * - navigator.language
 * - screen.width, screen.height, screen.colorDepth
 * - Date.getTimezoneOffset()
 * - localStorage.getItem/setItem
 * - document.createElement('canvas')
 * - canvas.getContext('2d')
 * - ctx.fillText, ctx.font, ctx.textBaseline
 * - canvas.toDataURL()
 * - Math.random()
 * - performance.now()
 * 
 * The key generation likely hashes these values together.
 * Let's try to replicate this in Node.js.
 */
function generateBrowserFingerprint() {
  // Simulate browser fingerprint components
  const components = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'Win32',
    language: 'en-US',
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    timezoneOffset: -360,  // CST
  };
  
  // Create a fingerprint string
  const fpString = `${components.screenWidth}x${components.screenHeight}:${components.colorDepth}:${components.userAgent}:${components.platform}:${components.language}:${components.timezoneOffset}`;
  
  // Hash it
  const hash = crypto.createHash('sha256').update(fpString).digest('hex');
  
  return hash;
}

/**
 * Try different key derivation methods based on what the WASM might do
 */
async function tryKeyDerivations() {
  console.log('=== Try Key Derivations Based on WASM Analysis ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes\n`);
  
  // The WASM uses HMAC (hmac-0.12.1)
  // Common patterns:
  // 1. HMAC(key, data) for authentication
  // 2. HKDF for key derivation
  
  // Let's try HKDF-like derivation
  const derivations = [
    // HKDF-Extract: PRK = HMAC(salt, IKM)
    // HKDF-Expand: OKM = HMAC(PRK, info || 0x01)
    {
      name: 'hkdf-sha256',
      derive: (key) => {
        const salt = Buffer.alloc(32, 0);  // Zero salt
        const prk = crypto.createHmac('sha256', salt).update(key).digest();
        const okm = crypto.createHmac('sha256', prk).update(Buffer.from([0x01])).digest();
        return okm;
      }
    },
    {
      name: 'hkdf-sha256-flixer-salt',
      derive: (key) => {
        const salt = crypto.createHash('sha256').update('flixer').digest();
        const prk = crypto.createHmac('sha256', salt).update(key).digest();
        const okm = crypto.createHmac('sha256', prk).update(Buffer.from([0x01])).digest();
        return okm;
      }
    },
    {
      name: 'double-sha256',
      derive: (key) => {
        return crypto.createHash('sha256').update(
          crypto.createHash('sha256').update(key).digest()
        ).digest();
      }
    },
    {
      name: 'hmac-sha256-self',
      derive: (key) => {
        return crypto.createHmac('sha256', key).update(key).digest();
      }
    },
    {
      name: 'sha256-reverse',
      derive: (key) => {
        const reversed = Buffer.from(key).reverse();
        return crypto.createHash('sha256').update(reversed).digest();
      }
    },
  ];
  
  // IV derivations
  const ivDerivations = [
    { name: 'zeros', derive: () => Buffer.alloc(16, 0) },
    { name: 'first-16-data', derive: () => data.subarray(0, 16) },
    { name: 'sha256-key-first16', derive: (key) => crypto.createHash('sha256').update(key).digest().subarray(0, 16) },
  ];
  
  for (const keyDeriv of derivations) {
    const derivedKey = keyDeriv.derive(apiKeyBuf);
    
    for (const ivDeriv of ivDerivations) {
      const iv = ivDeriv.derive(derivedKey);
      
      try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', derivedKey, iv);
        let decrypted = decipher.update(data);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const text = decrypted.toString('utf8');
        
        if (text.startsWith('{') && text.includes('sources')) {
          console.log(`*** SUCCESS: ${keyDeriv.name} / ${ivDeriv.name} ***`);
          console.log(text);
          return { keyDeriv: keyDeriv.name, ivDeriv: ivDeriv.name };
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  console.log('No derivation worked\n');
  return null;
}

/**
 * The encryption might use a nonce that's sent with the response
 * Let's check if there's a pattern in the base64 encoding
 */
async function analyzeBase64Structure() {
  console.log('=== Analyze Base64 Structure ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  
  console.log(`Raw response length: ${res.data.length} chars`);
  console.log(`Raw response (first 100): ${res.data.substring(0, 100)}`);
  
  // Check if it's valid base64
  const decoded = Buffer.from(res.data, 'base64');
  console.log(`Decoded length: ${decoded.length} bytes`);
  
  // Check if the response might be double-encoded
  try {
    const doubleDecoded = Buffer.from(decoded.toString('utf8'), 'base64');
    console.log(`Double decoded length: ${doubleDecoded.length} bytes`);
    console.log(`Double decoded (first 50): ${doubleDecoded.toString('hex').substring(0, 100)}`);
  } catch (e) {
    console.log('Not double base64 encoded');
  }
  
  // Check if the response might be URL-safe base64
  const urlSafe = res.data.replace(/-/g, '+').replace(/_/g, '/');
  if (urlSafe !== res.data) {
    console.log('Response uses URL-safe base64');
    const urlDecoded = Buffer.from(urlSafe, 'base64');
    console.log(`URL-safe decoded length: ${urlDecoded.length} bytes`);
  }
}

/**
 * Let's try to understand the exact encryption by looking at the response structure
 * The WASM returns a Promise<any>, which suggests it might return a parsed JSON object
 * This means the decryption produces valid JSON
 */
async function bruteForceWithKnownStructure() {
  console.log('\n=== Brute Force with Known Structure ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data: ${data.length} bytes`);
  
  // We know the output structure from WASM analysis:
  // { sources: [{ server: string, url: string }], skipTime: { startTime: number, endTime: number } | null }
  
  // The plaintext likely starts with: {"sources":[{"server":"alpha","url":"
  // Let's use this to derive the keystream and work backwards
  
  const knownStart = '{"sources":[{"server":"alpha","url":"https://';
  const knownBuf = Buffer.from(knownStart);
  
  // XOR to get keystream
  const keystream = Buffer.alloc(knownBuf.length);
  for (let i = 0; i < knownBuf.length; i++) {
    keystream[i] = data[i] ^ knownBuf[i];
  }
  
  console.log(`\nKnown plaintext (${knownBuf.length} bytes): "${knownStart}"`);
  console.log(`Derived keystream: ${keystream.toString('hex')}`);
  
  // The keystream should be AES output
  // In CTR mode: keystream = AES(key, nonce || counter)
  // Let's try to find what nonce produces this keystream
  
  // For the first block (16 bytes), we have:
  // keystream[0:16] = AES_encrypt(key, nonce)
  // So: nonce = AES_decrypt(key, keystream[0:16])
  
  const keystreamBlock1 = keystream.subarray(0, 16);
  
  // Try different key derivations
  const keyOptions = [
    { name: 'direct', key: apiKeyBuf },
    { name: 'sha256', key: crypto.createHash('sha256').update(apiKeyBuf).digest() },
    { name: 'sha256-hex', key: crypto.createHash('sha256').update(apiKey).digest() },
    { name: 'hmac-empty', key: crypto.createHmac('sha256', apiKeyBuf).update('').digest() },
  ];
  
  for (const keyOpt of keyOptions) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyOpt.key, null);
      decipher.setAutoPadding(false);
      const nonce = decipher.update(keystreamBlock1);
      
      console.log(`\nKey: ${keyOpt.name}`);
      console.log(`Derived nonce: ${nonce.toString('hex')}`);
      
      // Now try to decrypt the full message using this nonce
      // Standard CTR: increment last 4 bytes for each block
      const fullDecrypted = Buffer.alloc(data.length);
      const numBlocks = Math.ceil(data.length / 16);
      
      for (let block = 0; block < numBlocks; block++) {
        const counterBlock = Buffer.from(nonce);
        // Increment counter (big-endian, last 4 bytes)
        const counter = counterBlock.readUInt32BE(12) + block;
        counterBlock.writeUInt32BE(counter >>> 0, 12);
        
        // Generate keystream block
        const cipher = crypto.createCipheriv('aes-256-ecb', keyOpt.key, null);
        cipher.setAutoPadding(false);
        const ks = cipher.update(counterBlock);
        
        // XOR with ciphertext
        const start = block * 16;
        const end = Math.min(start + 16, data.length);
        for (let i = start; i < end; i++) {
          fullDecrypted[i] = data[i] ^ ks[i - start];
        }
      }
      
      const text = fullDecrypted.toString('utf8');
      console.log(`Decrypted (first 100): ${text.substring(0, 100)}`);
      
      // Check if it's valid JSON
      if (text.startsWith('{"sources":[{"server":"alpha"')) {
        console.log('\n*** FULL SUCCESS! ***');
        console.log(text);
        
        try {
          const json = JSON.parse(text);
          console.log('\nParsed JSON:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('(Not valid JSON, but close!)');
        }
        
        return { keyOpt: keyOpt.name, nonce: nonce.toString('hex') };
      }
    } catch (e) {
      console.log(`Error with ${keyOpt.name}: ${e.message}`);
    }
  }
  
  return null;
}

async function main() {
  await analyzeBase64Structure();
  await tryKeyDerivations();
  await bruteForceWithKnownStructure();
}

main().catch(console.error);
