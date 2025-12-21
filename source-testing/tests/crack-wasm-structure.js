/**
 * Crack WASM - Analyze Structure
 * 
 * The encrypted response has 195 bytes of overhead.
 * Let's analyze what this overhead contains by looking at:
 * 1. Byte patterns
 * 2. Entropy analysis
 * 3. Common cryptographic structure sizes
 * 
 * Common structures:
 * - AES-GCM: 12-byte nonce + ciphertext + 16-byte tag = 28 bytes overhead
 * - AES-CTR + HMAC: 16-byte nonce + ciphertext + 32-byte HMAC = 48 bytes overhead
 * - Custom: ???
 * 
 * 195 bytes is unusual. Let's see if it's:
 * - 195 = 163 + 32 (163 bytes of something + 32-byte HMAC)
 * - 195 = 16 + 147 + 32 (16-byte nonce + 147 bytes of metadata + 32-byte HMAC)
 * - 195 = 12 + 151 + 32 (12-byte nonce + 151 bytes of metadata + 32-byte HMAC)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeStructure() {
  console.log('=== Analyze Encrypted Structure ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
  const result = await page.evaluate(async (key) => {
    const crypto = window.crypto;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${key}:${timestamp}:${nonce}:${path}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': key,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        'X-Client-Fingerprint': 'test',
        'bW90aGFmYWth': '1',
        'X-Only-Sources': '1',
        'X-Server': 'alpha',
      },
    });
    
    const encryptedData = await response.text();
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
    };
  }, testKey);
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  console.log(`Total encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Overhead: ${encrypted.length - decrypted.length} bytes\n`);
  
  const overhead = encrypted.length - decrypted.length;
  const prefix = encrypted.slice(0, overhead);
  const ciphertext = encrypted.slice(overhead);
  
  // Analyze prefix structure
  console.log('=== Prefix Structure Analysis ===\n');
  console.log(`Full prefix (${prefix.length} bytes):`);
  
  // Print in 16-byte chunks
  for (let i = 0; i < prefix.length; i += 16) {
    const chunk = prefix.slice(i, Math.min(i + 16, prefix.length));
    const hex = chunk.toString('hex');
    const ascii = chunk.toString('ascii').replace(/[^\x20-\x7e]/g, '.');
    console.log(`  ${i.toString().padStart(3, '0')}: ${hex.padEnd(32, ' ')} | ${ascii}`);
  }
  
  // Calculate entropy of different sections
  console.log('\n=== Entropy Analysis ===\n');
  
  function calculateEntropy(buffer) {
    const freq = new Array(256).fill(0);
    for (const byte of buffer) {
      freq[byte]++;
    }
    let entropy = 0;
    for (const f of freq) {
      if (f > 0) {
        const p = f / buffer.length;
        entropy -= p * Math.log2(p);
      }
    }
    return entropy;
  }
  
  console.log(`Prefix entropy: ${calculateEntropy(prefix).toFixed(4)} bits/byte`);
  console.log(`Ciphertext entropy: ${calculateEntropy(ciphertext).toFixed(4)} bits/byte`);
  
  // High entropy (close to 8) suggests random/encrypted data
  // Lower entropy might indicate structure or padding
  
  // Check for common patterns
  console.log('\n=== Pattern Detection ===\n');
  
  // Check for repeated bytes
  const byteCounts = new Array(256).fill(0);
  for (const byte of prefix) {
    byteCounts[byte]++;
  }
  const maxCount = Math.max(...byteCounts);
  const mostCommonByte = byteCounts.indexOf(maxCount);
  console.log(`Most common byte in prefix: 0x${mostCommonByte.toString(16).padStart(2, '0')} (${maxCount} times)`);
  
  // Check for null bytes (might indicate padding)
  const nullCount = byteCounts[0];
  console.log(`Null bytes in prefix: ${nullCount}`);
  
  // Check for 0xff bytes
  const ffCount = byteCounts[255];
  console.log(`0xFF bytes in prefix: ${ffCount}`);
  
  // Try to identify structure based on common sizes
  console.log('\n=== Structure Hypothesis ===\n');
  
  // Hypothesis 1: [random_nonce (N)] [encrypted_counter_blocks (M)] [HMAC (32)]
  // 195 = N + M + 32
  // If N = 16, M = 147 (not divisible by 16)
  // If N = 12, M = 151 (not divisible by 16)
  // If N = 32, M = 131 (not divisible by 16)
  
  // Hypothesis 2: [version (1)] [nonce (16)] [encrypted_metadata (?)] [HMAC (32)]
  // 195 = 1 + 16 + ? + 32 = 49 + ?
  // ? = 146 bytes
  
  // Hypothesis 3: The prefix contains encrypted counter blocks
  // If we have 13 blocks of ciphertext (200 bytes / 16 = 12.5 blocks)
  // We need 13 counter blocks = 13 * 16 = 208 bytes
  // But prefix is only 195 bytes...
  
  // Let's check if the prefix contains the counter blocks
  console.log('Checking if prefix contains counter blocks...\n');
  
  // Derive keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  // Derive counter blocks
  const counterBlocks = [];
  const numBlocks = Math.ceil(decrypted.length / 16);
  
  for (let block = 0; block < numBlocks; block++) {
    const start = block * 16;
    const end = Math.min(start + 16, keystream.length);
    const keystreamBlock = keystream.slice(start, end);
    
    const padded = Buffer.alloc(16);
    keystreamBlock.copy(padded);
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(padded);
    counterBlocks.push(counterBlock);
  }
  
  // Check if any counter block appears in the prefix
  for (let i = 0; i < counterBlocks.length; i++) {
    const cb = counterBlocks[i];
    for (let pos = 0; pos <= prefix.length - 16; pos++) {
      if (prefix.slice(pos, pos + 16).equals(cb)) {
        console.log(`Counter block ${i} found at prefix position ${pos}!`);
      }
    }
  }
  
  // Check if counter blocks are AES-encrypted versions of prefix segments
  console.log('\nChecking if counter blocks are encrypted prefix segments...\n');
  
  for (let i = 0; i < Math.min(counterBlocks.length, 3); i++) {
    const cb = counterBlocks[i];
    
    for (let pos = 0; pos <= prefix.length - 16; pos++) {
      const segment = prefix.slice(pos, pos + 16);
      
      // Check if AES(key, segment) = cb
      const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
      cipher.setAutoPadding(false);
      const encrypted = cipher.update(segment);
      
      if (encrypted.equals(cb)) {
        console.log(`Counter block ${i} = AES(key, prefix[${pos}:${pos+16}])`);
      }
    }
  }
  
  // Let's try a completely different approach: maybe the key is used differently
  console.log('\n=== Alternative Key Usage ===\n');
  
  // The API key is 64 hex chars = 32 bytes
  // But maybe the WASM uses the hex string directly (64 bytes)?
  const keyAsString = Buffer.from(testKey, 'utf8');
  console.log(`Key as UTF-8 string: ${keyAsString.length} bytes`);
  
  // Try using first 32 bytes of the hex string as key
  const keyFirst32 = keyAsString.slice(0, 32);
  console.log(`First 32 bytes of hex string: ${keyFirst32.toString('hex')}`);
  
  // Try decryption with this key
  for (let noncePos = 0; noncePos <= overhead - 16; noncePos++) {
    const nonce = prefix.slice(noncePos, noncePos + 16);
    
    try {
      const cipher = crypto.createCipheriv('aes-256-ctr', keyFirst32, nonce);
      const zeros = Buffer.alloc(16);
      const expectedKeystream = cipher.update(zeros);
      
      if (expectedKeystream.equals(keystream.slice(0, 16))) {
        console.log(`*** FOUND with hex string key! Nonce at position ${noncePos} ***`);
      }
    } catch (e) {
      // Invalid key
    }
  }
  
  // Try SHA256 of hex string
  const keyHashString = crypto.createHash('sha256').update(testKey).digest();
  console.log(`SHA256 of hex string: ${keyHashString.toString('hex')}`);
  
  for (let noncePos = 0; noncePos <= overhead - 16; noncePos++) {
    const nonce = prefix.slice(noncePos, noncePos + 16);
    
    try {
      const cipher = crypto.createCipheriv('aes-256-ctr', keyHashString, nonce);
      const zeros = Buffer.alloc(16);
      const expectedKeystream = cipher.update(zeros);
      
      if (expectedKeystream.equals(keystream.slice(0, 16))) {
        console.log(`*** FOUND with SHA256(hex_string)! Nonce at position ${noncePos} ***`);
      }
    } catch (e) {
      // Invalid key
    }
  }
  
  console.log('\nNo match found with alternative key usage.');
}

analyzeStructure().catch(console.error);
