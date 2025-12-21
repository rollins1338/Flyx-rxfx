/**
 * Crack Flixer.sh - Pure JavaScript Implementation V2
 * 
 * Key insight: The response is encrypted with a DIFFERENT key than the request key.
 * The WASM process_img_data function takes (encrypted_data, api_key) and decrypts it.
 * 
 * This means the decryption key is derived from the api_key somehow.
 * Let's analyze the WASM to understand the key derivation.
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://plsdontscrapemelove.flixer.sh';

// Generate a random nonce
function generateNonce() {
  const bytes = crypto.randomBytes(16);
  return bytes.toString('base64').replace(/[/+=]/g, '').substring(0, 22);
}

// Generate fingerprint
function generateFingerprint() {
  const fakeProps = '1920x1080:24:Mozilla/5.0:Win32:en-US:-360:FP';
  let hash = 0;
  for (let i = 0; i < fakeProps.length; i++) {
    hash = ((hash << 5) - hash) + fakeProps.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Generate HMAC-SHA256 signature
function generateSignature(key, timestamp, nonce, path) {
  const message = `${key}:${timestamp}:${nonce}:${path}`;
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(message);
  return hmac.digest('base64');
}

// Make authenticated request
function makeRequest(urlPath, key, extraHeaders = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const fingerprint = generateFingerprint();
  const signature = generateSignature(key, timestamp, nonce, urlPath);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/plain',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://flixer.sh',
    'Referer': 'https://flixer.sh/',
    'X-Api-Key': key,
    'X-Request-Timestamp': timestamp.toString(),
    'X-Request-Nonce': nonce,
    'X-Request-Signature': signature,
    'X-Client-Fingerprint': fingerprint,
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

// Try various decryption methods
function tryDecrypt(encryptedBase64, key) {
  const results = [];
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const keyBuffer = Buffer.from(key, 'hex');
  
  // The WASM uses AES-256-CTR based on the Rust crates found
  // Let's try different approaches to derive the actual decryption key
  
  const keyDerivations = [
    // 1. Use key directly
    { name: 'direct', key: keyBuffer },
    // 2. SHA256 of key
    { name: 'sha256(key)', key: crypto.createHash('sha256').update(keyBuffer).digest() },
    // 3. First 32 bytes of SHA512
    { name: 'sha512(key)[0:32]', key: crypto.createHash('sha512').update(keyBuffer).digest().slice(0, 32) },
    // 4. HKDF-like derivation
    { name: 'hkdf-like', key: crypto.createHmac('sha256', keyBuffer).update('flixer').digest() },
    // 5. Double SHA256
    { name: 'sha256(sha256(key))', key: crypto.createHash('sha256').update(crypto.createHash('sha256').update(keyBuffer).digest()).digest() },
  ];
  
  const ivMethods = [
    // 1. First 16 bytes of encrypted data
    { name: 'prefix-16', getIV: (enc) => enc.slice(0, 16), getData: (enc) => enc.slice(16) },
    // 2. Zero IV
    { name: 'zero', getIV: () => Buffer.alloc(16, 0), getData: (enc) => enc },
    // 3. Counter starting at 0
    { name: 'counter-0', getIV: () => Buffer.alloc(16, 0), getData: (enc) => enc },
    // 4. First 12 bytes + counter (GCM-like)
    { name: 'nonce-12', getIV: (enc) => Buffer.concat([enc.slice(0, 12), Buffer.alloc(4, 0)]), getData: (enc) => enc.slice(12) },
  ];
  
  const modes = ['aes-256-ctr', 'aes-256-cbc', 'aes-256-gcm'];
  
  for (const keyDeriv of keyDerivations) {
    for (const ivMethod of ivMethods) {
      for (const mode of modes) {
        try {
          const iv = ivMethod.getIV(encrypted);
          const data = ivMethod.getData(encrypted);
          
          if (mode === 'aes-256-gcm') {
            // GCM needs auth tag
            if (data.length < 16) continue;
            const authTag = data.slice(-16);
            const ciphertext = data.slice(0, -16);
            
            const decipher = crypto.createDecipheriv(mode, keyDeriv.key, iv.slice(0, 12));
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(ciphertext);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            const result = decrypted.toString('utf8');
            
            if (result.includes('{') || result.includes('http') || result.includes('url')) {
              results.push({ method: `${mode}/${keyDeriv.name}/${ivMethod.name}`, result });
            }
          } else {
            const decipher = crypto.createDecipheriv(mode, keyDeriv.key, iv);
            if (mode === 'aes-256-cbc') {
              decipher.setAutoPadding(true);
            }
            let decrypted = decipher.update(data);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            const result = decrypted.toString('utf8');
            
            if (result.includes('{') || result.includes('http') || result.includes('url') || result.includes('sources')) {
              results.push({ method: `${mode}/${keyDeriv.name}/${ivMethod.name}`, result });
            }
          }
        } catch (e) {
          // Ignore decryption errors
        }
      }
    }
  }
  
  return results;
}

// Analyze the WASM to understand the decryption
async function analyzeWasmDecryption() {
  console.log('=== Analyzing WASM Decryption Logic ===\n');
  
  // Read the JS wrapper
  const jsPath = path.join(__dirname, 'flixer_img_data.js');
  if (!fs.existsSync(jsPath)) {
    console.log('WASM JS wrapper not found. Run crack-flixer-wasm.js first.');
    return;
  }
  
  const jsWrapper = fs.readFileSync(jsPath, 'utf8');
  
  // Look for the process_img_data implementation details
  console.log('Looking for decryption clues in JS wrapper...\n');
  
  // The function signature is: process_img_data(encrypted_data, api_key)
  // It passes both to WASM, so the decryption happens inside WASM
  
  // Let's look at what the WASM exports and imports
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  // Search for interesting strings in the data section
  console.log('Searching for decryption-related strings in WASM...\n');
  
  const wasmString = wasmBuffer.toString('latin1');
  
  // Look for error messages that might give clues
  const errorPatterns = [
    /E\d+/g,  // Error codes like E56, E57, E58
    /decrypt/gi,
    /invalid/gi,
    /key/gi,
  ];
  
  // Extract the data section strings
  const strings = [];
  let currentString = '';
  for (let i = 0; i < wasmBuffer.length; i++) {
    const char = wasmBuffer[i];
    if (char >= 32 && char < 127) {
      currentString += String.fromCharCode(char);
    } else {
      if (currentString.length >= 3) {
        strings.push(currentString);
      }
      currentString = '';
    }
  }
  
  // Find error-related strings
  const errorStrings = strings.filter(s => 
    s.match(/E\d{1,2}/) || 
    s.includes('error') || 
    s.includes('invalid') ||
    s.includes('decrypt') ||
    s.includes('key')
  );
  
  console.log('Error-related strings found:');
  [...new Set(errorStrings)].slice(0, 30).forEach(s => console.log(`  - ${s}`));
  
  // The key insight from earlier analysis:
  // - E56, E57, E58 are decryption errors
  // - The WASM uses aes-0.8.4 and ctr-0.9.2 (AES-CTR mode)
  // - The key is 64 hex chars (32 bytes = AES-256)
  
  console.log('\n\nKey findings:');
  console.log('- Encryption: AES-256-CTR');
  console.log('- Key length: 32 bytes (64 hex chars)');
  console.log('- The api_key is used directly or with minimal transformation');
}

async function testWithRealData() {
  console.log('\n=== Testing Decryption with Real API Data ===\n');
  
  // Use a random key (the server accepts any valid key)
  const key = crypto.randomBytes(32).toString('hex');
  console.log(`Using key: ${key}\n`);
  
  // Get encrypted data from the API
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  
  // First request to get server list
  console.log('1. Fetching server list...');
  const listRes = await makeRequest(testPath, key);
  console.log(`   Status: ${listRes.status}, Length: ${listRes.data.length}`);
  
  if (listRes.status !== 200) {
    console.log('   Failed to get response');
    return;
  }
  
  console.log(`   Encrypted data: ${listRes.data.substring(0, 50)}...`);
  
  // Try to decrypt
  console.log('\n2. Attempting decryption...');
  const decryptResults = tryDecrypt(listRes.data, key);
  
  if (decryptResults.length > 0) {
    console.log('\n*** DECRYPTION SUCCESS! ***');
    decryptResults.forEach(r => {
      console.log(`\nMethod: ${r.method}`);
      console.log(`Result: ${r.result.substring(0, 500)}`);
    });
  } else {
    console.log('   All decryption attempts failed');
    
    // The decryption key might be derived differently
    // Let's try using the key as a password for PBKDF2
    console.log('\n3. Trying PBKDF2 key derivation...');
    
    const salts = ['flixer', 'tmdb', 'image', 'poster', ''];
    const iterations = [1, 100, 1000, 10000];
    
    for (const salt of salts) {
      for (const iter of iterations) {
        try {
          const derivedKey = crypto.pbkdf2Sync(key, salt, iter, 32, 'sha256');
          const encrypted = Buffer.from(listRes.data, 'base64');
          
          // Try CTR with zero IV
          const iv = Buffer.alloc(16, 0);
          const decipher = crypto.createDecipheriv('aes-256-ctr', derivedKey, iv);
          let decrypted = decipher.update(encrypted);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          const result = decrypted.toString('utf8');
          
          if (result.includes('{') || result.includes('http')) {
            console.log(`\n*** PBKDF2 SUCCESS (salt=${salt}, iter=${iter})! ***`);
            console.log(result.substring(0, 500));
          }
        } catch (e) {}
      }
    }
  }
  
  // Also try the server-specific endpoint
  console.log('\n4. Fetching server-specific data (alpha)...');
  const serverRes = await makeRequest(testPath, key, {
    'X-Only-Sources': '1',
    'X-Server': 'alpha',
  });
  console.log(`   Status: ${serverRes.status}, Length: ${serverRes.data.length}`);
  
  if (serverRes.status === 200) {
    console.log(`   Encrypted data: ${serverRes.data.substring(0, 50)}...`);
    
    const serverDecrypt = tryDecrypt(serverRes.data, key);
    if (serverDecrypt.length > 0) {
      console.log('\n*** SERVER DECRYPTION SUCCESS! ***');
      serverDecrypt.forEach(r => {
        console.log(`\nMethod: ${r.method}`);
        console.log(`Result: ${r.result.substring(0, 500)}`);
      });
    }
  }
}

async function main() {
  await analyzeWasmDecryption();
  await testWithRealData();
}

main().catch(console.error);
