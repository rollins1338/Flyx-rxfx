/**
 * Crack WASM - State Analysis
 * 
 * The WASM must derive the decryption key from:
 * 1. The API key (passed as parameter)
 * 2. The encrypted data (contains prefix with nonce/IV)
 * 3. Possibly some internal state (fingerprint, embedded key)
 * 
 * Let's try to understand the exact relationship by:
 * 1. Analyzing the prefix structure more carefully
 * 2. Looking for HMAC verification (which would reveal the key derivation)
 * 3. Testing if modifying specific prefix bytes causes decryption to fail
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const EMBEDDED_KEY = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';

async function analyzeState() {
  console.log('=== WASM State Analysis ===\n');
  
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
  console.log(`API key: ${testKey}\n`);
  
  // Get a valid encrypted response
  const validResult = await page.evaluate(async (key) => {
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
    
    return { encrypted: encryptedData, decrypted };
  }, testKey);
  
  console.log(`Valid decryption: ${validResult.decrypted.slice(0, 50)}...\n`);
  
  // Now test which bytes in the prefix are critical for decryption
  console.log('=== Testing Prefix Byte Sensitivity ===\n');
  
  const encrypted = Buffer.from(validResult.encrypted, 'base64');
  const decrypted = Buffer.from(validResult.decrypted);
  const overhead = encrypted.length - decrypted.length;
  
  console.log(`Overhead: ${overhead} bytes`);
  console.log(`Testing which prefix bytes cause decryption failure...\n`);
  
  // Test modifying each 16-byte block of the prefix
  const blockResults = [];
  
  for (let blockStart = 0; blockStart < overhead; blockStart += 16) {
    const blockEnd = Math.min(blockStart + 16, overhead);
    
    // Create modified encrypted data
    const modified = Buffer.from(encrypted);
    modified[blockStart] ^= 0x01; // Flip one bit
    
    const modifiedBase64 = modified.toString('base64');
    
    const result = await page.evaluate(async (encData, key) => {
      try {
        const decrypted = await window.wasmImgData.process_img_data(encData, key);
        return { success: true, decrypted };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, modifiedBase64, testKey);
    
    blockResults.push({
      block: blockStart / 16,
      start: blockStart,
      end: blockEnd,
      success: result.success,
      decrypted: result.success ? result.decrypted.slice(0, 30) : null,
      error: result.error,
    });
    
    console.log(`Block ${blockStart / 16} (${blockStart}-${blockEnd}): ${result.success ? 'DECRYPTED' : 'FAILED'}`);
  }
  
  // Test modifying ciphertext
  console.log('\n=== Testing Ciphertext Modification ===\n');
  
  const ciphertextStart = overhead;
  const modified = Buffer.from(encrypted);
  modified[ciphertextStart] ^= 0x01;
  
  const cipherResult = await page.evaluate(async (encData, key) => {
    try {
      const decrypted = await window.wasmImgData.process_img_data(encData, key);
      return { success: true, decrypted };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }, modified.toString('base64'), testKey);
  
  console.log(`Ciphertext modification: ${cipherResult.success ? 'DECRYPTED (corrupted)' : 'FAILED'}`);
  if (cipherResult.success) {
    console.log(`Result: ${cipherResult.decrypted.slice(0, 50)}`);
  }
  
  // Analyze the prefix structure based on sensitivity
  console.log('\n=== Prefix Structure Analysis ===\n');
  
  const sensitiveBlocks = blockResults.filter(r => !r.success);
  const insensitiveBlocks = blockResults.filter(r => r.success);
  
  console.log(`Sensitive blocks (cause failure): ${sensitiveBlocks.map(b => b.block).join(', ')}`);
  console.log(`Insensitive blocks (still decrypt): ${insensitiveBlocks.map(b => b.block).join(', ')}`);
  
  // The sensitive blocks likely contain:
  // - HMAC (modifying causes verification failure)
  // - IV/nonce (modifying causes wrong decryption)
  
  // The insensitive blocks might contain:
  // - Padding
  // - Metadata
  
  // Let's try to identify the HMAC location
  console.log('\n=== HMAC Location Analysis ===\n');
  
  // HMAC-SHA256 is 32 bytes. If the last 32 bytes are HMAC, modifying them should fail
  // Let's test the last 32 bytes specifically
  
  const prefix = encrypted.subarray(0, overhead);
  console.log(`Prefix hex: ${prefix.toString('hex')}`);
  
  // Common structures:
  // [IV 16] [encrypted data] [HMAC 32] - total overhead would be 48 + encrypted_overhead
  // [nonce 12] [tag 16] [other] - GCM style
  
  // 195 bytes overhead could be:
  // - 16 (IV) + 147 (???) + 32 (HMAC) = 195
  // - 12 (nonce) + 16 (tag) + 167 (???) = 195
  
  // Let's check if the last 32 bytes look like HMAC
  const last32 = prefix.subarray(overhead - 32);
  console.log(`Last 32 bytes: ${last32.toString('hex')}`);
  
  // Try to verify HMAC with different keys
  const apiKeyBuf = Buffer.from(testKey, 'hex');
  const embeddedKeyBuf = Buffer.from(EMBEDDED_KEY, 'hex');
  
  const dataWithoutHmac = encrypted.subarray(0, encrypted.length - 32);
  const supposedHmac = encrypted.subarray(encrypted.length - 32);
  
  const hmacTests = [
    { name: 'HMAC(api_key, data)', hmac: crypto.createHmac('sha256', apiKeyBuf).update(dataWithoutHmac).digest() },
    { name: 'HMAC(embedded, data)', hmac: crypto.createHmac('sha256', embeddedKeyBuf).update(dataWithoutHmac).digest() },
    { name: 'HMAC(api_str, data)', hmac: crypto.createHmac('sha256', testKey).update(dataWithoutHmac).digest() },
  ];
  
  console.log('\nHMAC verification attempts:');
  for (const { name, hmac } of hmacTests) {
    const match = hmac.equals(supposedHmac);
    console.log(`  ${name}: ${match ? 'MATCH!' : 'no match'}`);
  }
  
  // Also try with just the prefix (excluding ciphertext)
  const prefixWithoutHmac = prefix.subarray(0, overhead - 32);
  
  const hmacTests2 = [
    { name: 'HMAC(api_key, prefix)', hmac: crypto.createHmac('sha256', apiKeyBuf).update(prefixWithoutHmac).digest() },
    { name: 'HMAC(embedded, prefix)', hmac: crypto.createHmac('sha256', embeddedKeyBuf).update(prefixWithoutHmac).digest() },
  ];
  
  console.log('\nHMAC on prefix only:');
  for (const { name, hmac } of hmacTests2) {
    const match = hmac.equals(last32);
    console.log(`  ${name}: ${match ? 'MATCH!' : 'no match'}`);
  }
  
  await browser.close();
  
  console.log('\nDone.');
}

analyzeState().catch(console.error);
