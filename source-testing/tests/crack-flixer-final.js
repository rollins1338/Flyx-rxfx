/**
 * Crack Flixer.sh - Final Attempt
 * 
 * Key findings:
 * 1. Server encrypts response with client's API key
 * 2. Uses AES-256-CTR mode
 * 3. Each response has different IV/nonce (first 16 bytes)
 * 
 * The decryption should be:
 * - Extract IV from first 16 bytes
 * - Use API key as AES key
 * - Decrypt remaining bytes with AES-256-CTR
 */

const crypto = require('crypto');
const https = require('https');

const API_BASE = 'https://plsdontscrapemelove.flixer.sh';

function generateNonce() {
  return crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '').substring(0, 22);
}

function generateSignature(key, timestamp, nonce, urlPath) {
  const message = `${key}:${timestamp}:${nonce}:${urlPath}`;
  return crypto.createHmac('sha256', key).update(message).digest('base64');
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

function tryDecryptAesCtr(encryptedBase64, keyHex) {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const key = Buffer.from(keyHex, 'hex');
  
  // Try different IV extraction methods
  const methods = [
    // Method 1: First 16 bytes are IV
    { name: 'iv-prefix-16', iv: encrypted.slice(0, 16), data: encrypted.slice(16) },
    // Method 2: First 12 bytes are nonce, rest is counter
    { name: 'nonce-12', iv: Buffer.concat([encrypted.slice(0, 12), Buffer.alloc(4, 0)]), data: encrypted.slice(12) },
    // Method 3: Zero IV
    { name: 'zero-iv', iv: Buffer.alloc(16, 0), data: encrypted },
    // Method 4: IV derived from key
    { name: 'key-derived-iv', iv: crypto.createHash('md5').update(key).digest(), data: encrypted },
  ];
  
  for (const method of methods) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', key, method.iv);
      let decrypted = decipher.update(method.data);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      const result = decrypted.toString('utf8');
      
      // Check if result looks like valid JSON or contains expected patterns
      if (result.includes('{') && result.includes('}') && 
          (result.includes('sources') || result.includes('url') || result.includes('server'))) {
        return { method: method.name, result };
      }
      
      // Also check for m3u8 URLs
      if (result.includes('.m3u8') || result.includes('http')) {
        return { method: method.name, result };
      }
    } catch (e) {
      // Ignore decryption errors
    }
  }
  
  return null;
}

// Try with key transformations
function tryDecryptWithKeyTransforms(encryptedBase64, keyHex) {
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  
  // Different key derivations
  const keyDerivations = [
    { name: 'direct', key: keyBuffer },
    { name: 'sha256', key: crypto.createHash('sha256').update(keyBuffer).digest() },
    { name: 'sha256-hex', key: crypto.createHash('sha256').update(keyHex).digest() },
    { name: 'md5-padded', key: Buffer.concat([crypto.createHash('md5').update(keyBuffer).digest(), crypto.createHash('md5').update(keyBuffer).digest()]) },
    { name: 'reversed', key: Buffer.from(keyBuffer).reverse() },
    { name: 'xor-const', key: Buffer.from(keyBuffer.map(b => b ^ 0x36)) },
  ];
  
  const ivMethods = [
    { name: 'prefix-16', getIv: (enc) => enc.slice(0, 16), getData: (enc) => enc.slice(16) },
    { name: 'zero', getIv: () => Buffer.alloc(16, 0), getData: (enc) => enc },
    { name: 'suffix-16', getIv: (enc) => enc.slice(-16), getData: (enc) => enc.slice(0, -16) },
  ];
  
  for (const keyDeriv of keyDerivations) {
    for (const ivMethod of ivMethods) {
      try {
        const iv = ivMethod.getIv(encrypted);
        const data = ivMethod.getData(encrypted);
        
        const decipher = crypto.createDecipheriv('aes-256-ctr', keyDeriv.key, iv);
        let decrypted = decipher.update(data);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        const result = decrypted.toString('utf8');
        
        // Check for valid JSON structure
        if ((result.startsWith('{') || result.startsWith('[')) && 
            (result.includes('url') || result.includes('sources') || result.includes('server'))) {
          return { method: `${keyDeriv.name}/${ivMethod.name}`, result };
        }
        
        // Check for m3u8 or http URLs
        if (result.includes('.m3u8') || (result.includes('http') && result.includes('://'))) {
          return { method: `${keyDeriv.name}/${ivMethod.name}`, result };
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  return null;
}

async function main() {
  console.log('=== Flixer.sh Final Decryption Attempt ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const key = crypto.randomBytes(32).toString('hex');
  
  console.log(`Using key: ${key}`);
  
  // Get encrypted response
  const res = await makeRequest(testPath, key, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  
  console.log(`\nResponse status: ${res.status}`);
  console.log(`Response length: ${res.data.length}`);
  console.log(`Encrypted (first 50): ${res.data.substring(0, 50)}...`);
  
  // Try basic decryption
  console.log('\n--- Trying basic AES-CTR decryption ---');
  let result = tryDecryptAesCtr(res.data, key);
  if (result) {
    console.log(`\n*** SUCCESS with ${result.method}! ***`);
    console.log(result.result.substring(0, 500));
    return;
  }
  
  // Try with key transformations
  console.log('\n--- Trying key transformations ---');
  result = tryDecryptWithKeyTransforms(res.data, key);
  if (result) {
    console.log(`\n*** SUCCESS with ${result.method}! ***`);
    console.log(result.result.substring(0, 500));
    return;
  }
  
  console.log('\nAll decryption attempts failed.');
  console.log('\nThe encryption might use:');
  console.log('1. A key derived from both client key AND server secret');
  console.log('2. A different algorithm than AES-CTR');
  console.log('3. Additional data in the key derivation (timestamp, nonce, etc.)');
  
  // Let's analyze the raw bytes
  console.log('\n--- Raw byte analysis ---');
  const encrypted = Buffer.from(res.data, 'base64');
  console.log(`Total bytes: ${encrypted.length}`);
  console.log(`First 32 bytes: ${encrypted.slice(0, 32).toString('hex')}`);
  console.log(`Last 32 bytes: ${encrypted.slice(-32).toString('hex')}`);
  
  // Check for patterns
  const zeros = encrypted.filter(b => b === 0).length;
  const highBytes = encrypted.filter(b => b > 127).length;
  console.log(`Zero bytes: ${zeros} (${(zeros/encrypted.length*100).toFixed(1)}%)`);
  console.log(`High bytes (>127): ${highBytes} (${(highBytes/encrypted.length*100).toFixed(1)}%)`);
}

main().catch(console.error);
