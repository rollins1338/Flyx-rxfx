/**
 * Crack Flixer.sh - Pure JavaScript Implementation
 * 
 * Goal: Replicate the WASM encryption without any browser/puppeteer
 * 
 * From analysis:
 * - Key: 64 hex chars (32 bytes) - AES-256 key
 * - Encryption: AES-256-CTR (found ctr-0.9.2 in WASM)
 * - Signature: HMAC-SHA256
 * - Headers needed:
 *   - X-Api-Key: The 64-char hex key
 *   - X-Request-Timestamp: Unix timestamp in seconds
 *   - X-Request-Nonce: Random 22-char base64 string
 *   - X-Request-Signature: HMAC-SHA256 signature
 *   - X-Client-Fingerprint: Short fingerprint string
 *   - bW90aGFmYWth: "1" (base64 for "mothafaka")
 */

const crypto = require('crypto');
const https = require('https');

// Constants
const API_BASE = 'https://plsdontscrapemelove.flixer.sh';

// Generate a random nonce (22 chars, base64-like)
function generateNonce() {
  const bytes = crypto.randomBytes(16);
  return bytes.toString('base64').replace(/[/+=]/g, '').substring(0, 22);
}

// Generate a fake but consistent client fingerprint
function generateFingerprint() {
  // The fingerprint is a short hash of browser properties
  // We'll generate a consistent fake one
  const fakeProps = '1920x1080:24:Mozilla/5.0:Win32:en-US:-360:FP';
  let hash = 0;
  for (let i = 0; i < fakeProps.length; i++) {
    hash = ((hash << 5) - hash) + fakeProps.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Generate HMAC-SHA256 signature
async function generateSignature(key, timestamp, nonce, path) {
  const message = `${key}:${timestamp}:${nonce}:${path}`;
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(message);
  return hmac.digest('base64');
}

// Try different key generation approaches
function generatePossibleKeys() {
  const keys = [];
  
  // Approach 1: Random 32-byte key
  keys.push(crypto.randomBytes(32).toString('hex'));
  
  // Approach 2: Hash of fake fingerprint data
  const fingerprintData = '1920x1080:24:Mozilla/5.0 (Windows NT 10.0; Win64; x64):Win32:en-US:-360';
  keys.push(crypto.createHash('sha256').update(fingerprintData).digest('hex'));
  
  // Approach 3: Known working key from Puppeteer session (for testing)
  keys.push('da2b9cf46c75fbe3f6ab564e0358eb24b8bb8a3cbaf8c9f7847f476d74adb2bb');
  keys.push('1ebc33c95982f87e3c85da685752e13268c6d826898f8511da8ea2c5029397de');
  
  return keys;
}

// Make authenticated request to Flixer API
async function makeFlixerRequest(path, key, extraHeaders = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const fingerprint = generateFingerprint();
  const signature = await generateSignature(key, timestamp, nonce, path);
  
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
    'bW90aGFmYWth': '1', // "mothafaka" in base64
    ...extraHeaders,
  };
  
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;
    console.log(`\nRequesting: ${url}`);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    }).on('error', reject);
  });
}

// Try to decrypt the response using AES-256-CTR
function tryDecrypt(encryptedData, key) {
  try {
    // The encrypted data is base64 encoded
    const encrypted = Buffer.from(encryptedData, 'base64');
    
    // Try different IV extraction methods
    // Method 1: First 16 bytes are IV
    if (encrypted.length > 16) {
      const iv = encrypted.slice(0, 16);
      const ciphertext = encrypted.slice(16);
      
      try {
        const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(key, 'hex'), iv);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        const result = decrypted.toString('utf8');
        
        // Check if it looks like valid JSON
        if (result.includes('{') || result.includes('[')) {
          return { method: 'aes-256-ctr-iv-prefix', result };
        }
      } catch (e) {}
    }
    
    // Method 2: Zero IV
    try {
      const iv = Buffer.alloc(16, 0);
      const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(key, 'hex'), iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      const result = decrypted.toString('utf8');
      
      if (result.includes('{') || result.includes('[')) {
        return { method: 'aes-256-ctr-zero-iv', result };
      }
    } catch (e) {}
    
    // Method 3: Try CBC mode
    if (encrypted.length > 16) {
      const iv = encrypted.slice(0, 16);
      const ciphertext = encrypted.slice(16);
      
      try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
        decipher.setAutoPadding(true);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        const result = decrypted.toString('utf8');
        
        if (result.includes('{') || result.includes('[')) {
          return { method: 'aes-256-cbc', result };
        }
      } catch (e) {}
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

async function testFlixerAPI() {
  console.log('=== Testing Flixer.sh API with Pure JavaScript ===\n');
  
  const keys = generatePossibleKeys();
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  
  for (const key of keys) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing with key: ${key.substring(0, 20)}...`);
    
    try {
      // First, get server time
      const timeRes = await makeFlixerRequest(`/api/time?t=${Date.now()}`, key);
      console.log(`Time API response: ${timeRes.status}`);
      if (timeRes.status === 200) {
        console.log(`Server time: ${timeRes.data}`);
      }
      
      // Then try the images endpoint
      const imagesRes = await makeFlixerRequest(testPath, key);
      console.log(`\nImages API response: ${imagesRes.status}`);
      console.log(`Response length: ${imagesRes.data.length}`);
      console.log(`Response preview: ${imagesRes.data.substring(0, 100)}`);
      
      if (imagesRes.status === 200 && imagesRes.data.length > 0) {
        console.log('\n*** GOT RESPONSE! Trying to decrypt... ***');
        
        // Try to decrypt with the key
        const decrypted = tryDecrypt(imagesRes.data, key);
        if (decrypted) {
          console.log(`\n*** DECRYPTION SUCCESS (${decrypted.method})! ***`);
          console.log(decrypted.result.substring(0, 500));
        } else {
          console.log('Decryption failed with all methods');
          
          // Try with different keys derived from the response
          console.log('\nTrying alternative decryption approaches...');
        }
      }
      
      // Try with X-Server header for specific server
      const serverRes = await makeFlixerRequest(testPath, key, {
        'X-Only-Sources': '1',
        'X-Server': 'alpha',
      });
      console.log(`\nServer-specific response: ${serverRes.status}`);
      console.log(`Response length: ${serverRes.data.length}`);
      
      if (serverRes.status === 200) {
        const decrypted = tryDecrypt(serverRes.data, key);
        if (decrypted) {
          console.log(`\n*** SERVER DECRYPTION SUCCESS! ***`);
          console.log(decrypted.result.substring(0, 500));
        }
      }
      
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
  
  console.log('\n=== Test Complete ===');
}

testFlixerAPI().catch(console.error);
