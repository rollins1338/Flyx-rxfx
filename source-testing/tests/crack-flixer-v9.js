/**
 * Crack Flixer.sh - V9
 * 
 * Key insight: Counter blocks are completely random between blocks!
 * This is NOT standard AES-CTR.
 * 
 * Possibilities:
 * 1. Each block has its own random IV embedded
 * 2. The encryption is not AES-CTR at all
 * 3. There's a custom key schedule
 * 
 * Let's try: maybe the data format is:
 * [IV1 (16 bytes)][Ciphertext1 (16 bytes)][IV2 (16 bytes)][Ciphertext2 (16 bytes)]...
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
 * Try interleaved IV/ciphertext format
 */
async function tryInterleavedFormat() {
  console.log('=== Try Interleaved IV/Ciphertext Format ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Data length: ${data.length} bytes\n`);
  
  // Format: [IV (16)][CT (16)][IV (16)][CT (16)]...
  // Each pair is 32 bytes
  const pairSize = 32;
  const numPairs = Math.floor(data.length / pairSize);
  const decrypted = Buffer.alloc(numPairs * 16);
  
  for (let i = 0; i < numPairs; i++) {
    const iv = data.subarray(i * pairSize, i * pairSize + 16);
    const ct = data.subarray(i * pairSize + 16, i * pairSize + 32);
    
    // Decrypt single block
    const decipher = crypto.createDecipheriv('aes-256-ctr', apiKeyBuf, iv);
    const pt = decipher.update(ct);
    pt.copy(decrypted, i * 16);
  }
  
  const text = decrypted.toString('utf8');
  console.log(`Interleaved result: ${text.substring(0, 100)}`);
  
  if (text.startsWith('{')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text);
    return true;
  }
  
  return false;
}

/**
 * Maybe it's CBC mode, not CTR
 */
async function tryCbcMode() {
  console.log('\n=== Try CBC Mode ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Try: first 16 bytes are IV, rest is ciphertext
  const iv = data.subarray(0, 16);
  const ciphertext = data.subarray(16);
  
  // Pad ciphertext to multiple of 16
  const paddedLen = Math.ceil(ciphertext.length / 16) * 16;
  const paddedCt = Buffer.alloc(paddedLen);
  ciphertext.copy(paddedCt);
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', apiKeyBuf, iv);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(paddedCt);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    const text = decrypted.toString('utf8');
    console.log(`CBC result: ${text.substring(0, 100)}`);
    
    if (text.startsWith('{')) {
      console.log('\n*** SUCCESS! ***');
      console.log(text);
      return true;
    }
  } catch (e) {
    console.log(`CBC error: ${e.message}`);
  }
  
  // Try with SHA256(key)
  const keyHash = crypto.createHash('sha256').update(apiKeyBuf).digest();
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, iv);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(paddedCt);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    const text = decrypted.toString('utf8');
    console.log(`CBC (SHA256 key) result: ${text.substring(0, 100)}`);
    
    if (text.startsWith('{')) {
      console.log('\n*** SUCCESS! ***');
      console.log(text);
      return true;
    }
  } catch (e) {
    console.log(`CBC (SHA256 key) error: ${e.message}`);
  }
  
  return false;
}

/**
 * Maybe the keystream is generated differently
 * Let's try: keystream = SHA256(key || block_number)
 */
async function trySha256Keystream() {
  console.log('\n=== Try SHA256 Keystream ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Try: keystream for block N = SHA256(key || N)
  const numBlocks = Math.ceil(data.length / 32);  // SHA256 produces 32 bytes
  const decrypted = Buffer.alloc(data.length);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 32;
    const end = Math.min(start + 32, data.length);
    
    // Generate keystream
    const blockNum = Buffer.alloc(4);
    blockNum.writeUInt32BE(block, 0);
    const keystream = crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, blockNum])).digest();
    
    for (let i = start; i < end; i++) {
      decrypted[i] = data[i] ^ keystream[i - start];
    }
  }
  
  const text = decrypted.toString('utf8');
  console.log(`SHA256 keystream result: ${text.substring(0, 100)}`);
  
  if (text.startsWith('{')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text);
    return true;
  }
  
  // Try with 16-byte blocks
  const numBlocks16 = Math.ceil(data.length / 16);
  const decrypted16 = Buffer.alloc(data.length);
  
  for (let block = 0; block < numBlocks16; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, data.length);
    
    const blockNum = Buffer.alloc(4);
    blockNum.writeUInt32BE(block, 0);
    const keystream = crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, blockNum])).digest().subarray(0, 16);
    
    for (let i = start; i < end; i++) {
      decrypted16[i] = data[i] ^ keystream[i - start];
    }
  }
  
  const text16 = decrypted16.toString('utf8');
  console.log(`SHA256 keystream (16-byte blocks) result: ${text16.substring(0, 100)}`);
  
  if (text16.startsWith('{')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text16);
    return true;
  }
  
  return false;
}

/**
 * Let's go back to basics and check if the data might have a header
 */
async function analyzeDataHeader() {
  console.log('\n=== Analyze Data Header ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  
  // Make multiple requests to see what's constant
  const responses = [];
  for (let i = 0; i < 3; i++) {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
    responses.push({
      key: apiKey,
      data: Buffer.from(res.data, 'base64'),
    });
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('Response lengths:', responses.map(r => r.data.length));
  
  // All responses should be the same length if the plaintext is the same
  // The difference in bytes tells us about the encryption scheme
  
  // Check byte-by-byte variance
  const minLen = Math.min(...responses.map(r => r.data.length));
  const variance = [];
  
  for (let i = 0; i < minLen; i++) {
    const bytes = responses.map(r => r.data[i]);
    const allSame = bytes.every(b => b === bytes[0]);
    variance.push(allSame ? 0 : 1);
  }
  
  const constantBytes = variance.filter(v => v === 0).length;
  console.log(`Constant bytes: ${constantBytes}/${minLen}`);
  
  // Find runs of constant bytes (might indicate header structure)
  let runs = [];
  let currentRun = { start: 0, constant: variance[0] === 0, length: 1 };
  
  for (let i = 1; i < variance.length; i++) {
    const isConstant = variance[i] === 0;
    if (isConstant === currentRun.constant) {
      currentRun.length++;
    } else {
      runs.push(currentRun);
      currentRun = { start: i, constant: isConstant, length: 1 };
    }
  }
  runs.push(currentRun);
  
  console.log('\nByte runs:');
  runs.slice(0, 10).forEach(r => {
    console.log(`  ${r.start}-${r.start + r.length - 1}: ${r.constant ? 'constant' : 'variable'} (${r.length} bytes)`);
  });
}

/**
 * Maybe the encryption uses the API key as a seed for a PRNG
 */
async function tryPrngKeystream() {
  console.log('\n=== Try PRNG Keystream ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  const data = Buffer.from(res.data, 'base64');
  const apiKeyBuf = Buffer.from(apiKey, 'hex');
  
  // Use API key as seed for a simple PRNG (like the one in the WASM might use)
  // Try: keystream = HMAC-DRBG or similar
  
  // Simple approach: keystream = HMAC(key, 0) || HMAC(key, 1) || ...
  const keystream = Buffer.alloc(data.length);
  let offset = 0;
  let counter = 0;
  
  while (offset < data.length) {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(counter, 0);
    const block = crypto.createHmac('sha256', apiKeyBuf).update(counterBuf).digest();
    
    const copyLen = Math.min(32, data.length - offset);
    block.copy(keystream, offset, 0, copyLen);
    offset += copyLen;
    counter++;
  }
  
  const decrypted = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ keystream[i];
  }
  
  const text = decrypted.toString('utf8');
  console.log(`HMAC PRNG result: ${text.substring(0, 100)}`);
  
  if (text.startsWith('{')) {
    console.log('\n*** SUCCESS! ***');
    console.log(text);
    return true;
  }
  
  return false;
}

async function main() {
  await analyzeDataHeader();
  await tryInterleavedFormat();
  await tryCbcMode();
  await trySha256Keystream();
  await tryPrngKeystream();
}

main().catch(console.error);
