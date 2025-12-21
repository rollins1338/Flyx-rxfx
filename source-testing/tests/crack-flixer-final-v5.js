/**
 * Crack Flixer.sh - Final V5
 * 
 * Key insight: The server and client must agree on the same random nonce.
 * Since the response differs each time, the nonce must be:
 * 1. Embedded in the response
 * 2. Derived from something both sides know (like timestamp + key)
 * 
 * Let's check if the nonce is derived from the request parameters.
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

function makeRequest(urlPath, key, timestamp, nonce, extraHeaders = {}) {
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
    'X-Client-Fingerprint': 'test',
    'bW90aGFmYWth': '1',
    ...extraHeaders,
  };
  
  return new Promise((resolve, reject) => {
    https.get(`${API_BASE}${urlPath}`, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function testNonceDerivation() {
  console.log('=== Testing Nonce Derivation from Request Parameters ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);
  const requestNonce = generateNonce();
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Request Nonce: ${requestNonce}`);
  
  // Make the request
  const res = await makeRequest(testPath, apiKey, timestamp, requestNonce, {
    'X-Only-Sources': '1',
    'X-Server': 'alpha',
  });
  
  const encrypted = Buffer.from(res.data, 'base64');
  const keyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`\nResponse length: ${encrypted.length} bytes`);
  console.log(`Response headers:`, res.headers);
  
  // Try to derive the encryption nonce from request parameters
  const derivations = [
    // From timestamp
    { name: 'sha256(timestamp)', nonce: crypto.createHash('sha256').update(timestamp.toString()).digest().subarray(0, 16) },
    { name: 'sha256(key+timestamp)', nonce: crypto.createHash('sha256').update(apiKey + timestamp).digest().subarray(0, 16) },
    { name: 'hmac(key, timestamp)', nonce: crypto.createHmac('sha256', keyBuf).update(timestamp.toString()).digest().subarray(0, 16) },
    
    // From request nonce
    { name: 'sha256(requestNonce)', nonce: crypto.createHash('sha256').update(requestNonce).digest().subarray(0, 16) },
    { name: 'sha256(key+requestNonce)', nonce: crypto.createHash('sha256').update(apiKey + requestNonce).digest().subarray(0, 16) },
    { name: 'hmac(key, requestNonce)', nonce: crypto.createHmac('sha256', keyBuf).update(requestNonce).digest().subarray(0, 16) },
    
    // From signature
    { name: 'sha256(signature)', nonce: (() => {
      const sig = generateSignature(apiKey, timestamp, requestNonce, testPath);
      return crypto.createHash('sha256').update(sig).digest().subarray(0, 16);
    })() },
    
    // From combined
    { name: 'sha256(key+timestamp+nonce)', nonce: crypto.createHash('sha256').update(apiKey + timestamp + requestNonce).digest().subarray(0, 16) },
    { name: 'hmac(key, timestamp+nonce)', nonce: crypto.createHmac('sha256', keyBuf).update(timestamp + ':' + requestNonce).digest().subarray(0, 16) },
  ];
  
  // Known plaintext
  const knownPlaintext = '{"sources":[{"server":"alpha","url":"';
  const knownBuf = Buffer.from(knownPlaintext.substring(0, 16));
  
  // Derive actual keystream from known plaintext
  const actualKeystream = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    actualKeystream[i] = encrypted[i] ^ knownBuf[i];
  }
  
  // Derive actual counter block
  const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
  decipher.setAutoPadding(false);
  const actualCounter = decipher.update(actualKeystream);
  
  console.log(`\nActual counter block 0: ${actualCounter.toString('hex')}`);
  
  console.log('\nTesting derivations:');
  for (const d of derivations) {
    const match = d.nonce.equals(actualCounter);
    if (match) {
      console.log(`*** MATCH: ${d.name} ***`);
      console.log(`  Nonce: ${d.nonce.toString('hex')}`);
    }
  }
  
  // Also check if the counter is in the response headers
  console.log('\nChecking response headers for nonce...');
  for (const [key, value] of Object.entries(res.headers)) {
    if (typeof value === 'string' && value.length >= 16) {
      // Try to decode as hex or base64
      try {
        const hexBuf = Buffer.from(value, 'hex');
        if (hexBuf.length >= 16 && hexBuf.subarray(0, 16).equals(actualCounter)) {
          console.log(`*** FOUND IN HEADER (hex): ${key} ***`);
        }
      } catch (e) {}
      
      try {
        const b64Buf = Buffer.from(value, 'base64');
        if (b64Buf.length >= 16 && b64Buf.subarray(0, 16).equals(actualCounter)) {
          console.log(`*** FOUND IN HEADER (base64): ${key} ***`);
        }
      } catch (e) {}
    }
  }
}

async function testMultipleRequestsSameParams() {
  console.log('\n=== Testing Multiple Requests with Same Parameters ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);
  const requestNonce = generateNonce();
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Request Nonce: ${requestNonce}`);
  
  // Make multiple requests with the SAME parameters
  const responses = [];
  for (let i = 0; i < 3; i++) {
    const res = await makeRequest(testPath, apiKey, timestamp, requestNonce, {
      'X-Only-Sources': '1',
      'X-Server': 'alpha',
    });
    responses.push(Buffer.from(res.data, 'base64'));
    console.log(`Response ${i + 1}: ${res.data.substring(0, 30)}...`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Check if responses are identical
  const allSame = responses.every(r => r.equals(responses[0]));
  console.log(`\nAll responses identical: ${allSame}`);
  
  if (allSame) {
    console.log('The encryption is deterministic based on request parameters!');
    console.log('We can derive the nonce from the request parameters.');
  } else {
    console.log('Responses differ - server uses additional randomness.');
  }
}

async function main() {
  await testNonceDerivation();
  await testMultipleRequestsSameParams();
}

main().catch(console.error);
