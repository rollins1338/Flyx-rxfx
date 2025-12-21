/**
 * Analyze Flixer.sh Encryption Pattern
 * 
 * The WASM uses:
 * - aes-0.8.4 (AES encryption)
 * - ctr-0.9.2 (CTR mode)
 * - hmac-0.12.1 (HMAC)
 * - base64-0.21.7 (Base64 encoding)
 * 
 * Let's analyze the actual encryption by comparing:
 * 1. Same content, different keys -> different ciphertext (confirms key is used)
 * 2. Same key, same content -> same ciphertext (confirms deterministic)
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
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function analyzeEncryption() {
  console.log('=== Analyzing Flixer.sh Encryption Pattern ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  
  // Test 1: Same key, multiple requests
  console.log('Test 1: Same key, multiple requests');
  const key1 = crypto.randomBytes(32).toString('hex');
  console.log(`Key: ${key1.substring(0, 20)}...`);
  
  const responses1 = [];
  for (let i = 0; i < 3; i++) {
    const res = await makeRequest(testPath, key1, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
    responses1.push(res.data);
    console.log(`  Request ${i + 1}: ${res.data.substring(0, 30)}... (len: ${res.data.length})`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Check if responses are the same
  const allSame = responses1.every(r => r === responses1[0]);
  console.log(`  All responses identical: ${allSame}`);
  
  // Test 2: Different keys, same content
  console.log('\nTest 2: Different keys, same content');
  const keys = [
    crypto.randomBytes(32).toString('hex'),
    crypto.randomBytes(32).toString('hex'),
    crypto.randomBytes(32).toString('hex'),
  ];
  
  const responses2 = [];
  for (const key of keys) {
    const res = await makeRequest(testPath, key, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
    responses2.push({ key: key.substring(0, 20), data: res.data });
    console.log(`  Key ${key.substring(0, 10)}...: ${res.data.substring(0, 30)}...`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Check if responses are different
  const allDifferent = responses2[0].data !== responses2[1].data && responses2[1].data !== responses2[2].data;
  console.log(`  All responses different: ${allDifferent}`);
  
  // Test 3: Analyze the ciphertext structure
  console.log('\nTest 3: Analyzing ciphertext structure');
  const sampleData = Buffer.from(responses2[0].data, 'base64');
  console.log(`  Base64 decoded length: ${sampleData.length} bytes`);
  console.log(`  First 16 bytes (potential IV): ${sampleData.slice(0, 16).toString('hex')}`);
  console.log(`  Bytes 16-32: ${sampleData.slice(16, 32).toString('hex')}`);
  
  // Test 4: Check if the key affects the response
  console.log('\nTest 4: Key influence analysis');
  
  // The server might be using the key to encrypt the response
  // Or the response might be encrypted with a static key
  // Let's check by XORing responses with different keys
  
  const data1 = Buffer.from(responses2[0].data, 'base64');
  const data2 = Buffer.from(responses2[1].data, 'base64');
  
  // XOR the first 32 bytes
  const xored = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xored[i] = data1[i] ^ data2[i];
  }
  console.log(`  XOR of first 32 bytes: ${xored.toString('hex')}`);
  
  // If the XOR result matches the XOR of the keys, the key is used directly
  const key1Buf = Buffer.from(keys[0], 'hex');
  const key2Buf = Buffer.from(keys[1], 'hex');
  const keyXor = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    keyXor[i] = key1Buf[i] ^ key2Buf[i];
  }
  console.log(`  XOR of keys: ${keyXor.toString('hex')}`);
  console.log(`  Keys match XOR: ${xored.equals(keyXor)}`);
  
  // Test 5: Check response headers for clues
  console.log('\nTest 5: Response headers');
  const res = await makeRequest(testPath, keys[0], { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  console.log('  Headers:', JSON.stringify(res.headers, null, 2));
  
  console.log('\n=== Analysis Complete ===');
  
  // Conclusion
  console.log('\nConclusion:');
  if (allDifferent) {
    console.log('- The response IS encrypted with the client key (or derived from it)');
    console.log('- Each key produces different ciphertext for the same content');
    console.log('- The WASM decrypts using the same key it generated');
  } else {
    console.log('- The response is encrypted with a STATIC server key');
    console.log('- The client key is only for authentication, not decryption');
    console.log('- We need to find the static decryption key');
  }
}

analyzeEncryption().catch(console.error);
