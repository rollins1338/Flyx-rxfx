/**
 * Crack WASM - Fingerprint-Based Key Derivation
 * 
 * Based on the WASM analysis, the key derivation uses:
 * 1. Browser fingerprint (canvas, navigator, screen, timezone, etc.)
 * 2. Embedded key (45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e)
 * 3. API key
 * 4. SHA-256/HMAC for hashing
 * 
 * The fingerprint is stored in localStorage as "tmdb_session_id"
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const EMBEDDED_KEY = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';

async function testFingerprintKey() {
  console.log('=== Fingerprint-Based Key Derivation ===\n');
  
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
  
  // Get the fingerprint from localStorage
  const fingerprint = await page.evaluate(() => {
    return localStorage.getItem('tmdb_session_id');
  });
  
  console.log(`Fingerprint from localStorage: ${fingerprint}\n`);
  
  // Get the embedded key
  const embeddedKey = await page.evaluate(() => {
    return window.wasmImgData.get_img_key();
  });
  
  console.log(`Embedded key: ${embeddedKey}\n`);
  
  // Get browser info for fingerprint reconstruction
  const browserInfo = await page.evaluate(() => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      timezoneOffset: new Date().getTimezoneOffset(),
    };
  });
  
  console.log('Browser info:', browserInfo);
  
  // Make a request
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`\nAPI key: ${testKey}\n`);
  
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
    
    return { encrypted: encryptedData, decrypted };
  }, testKey);
  
  await browser.close();
  
  const apiKeyBuf = Buffer.from(testKey, 'hex');
  const embeddedKeyBuf = Buffer.from(embeddedKey, 'hex');
  const fingerprintBuf = fingerprint ? Buffer.from(fingerprint) : Buffer.alloc(0);
  
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  const overhead = encrypted.length - decrypted.length;
  const prefix = encrypted.subarray(0, overhead);
  const ciphertext = encrypted.subarray(overhead);
  
  // Derive keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  console.log(`Overhead: ${overhead} bytes`);
  console.log(`Keystream: ${keystream.length} bytes`);
  console.log(`Fingerprint length: ${fingerprintBuf.length} bytes\n`);
  
  // Try various key derivation methods using fingerprint
  console.log('=== Testing Fingerprint-Based Key Derivation ===\n');
  
  const keysToTry = [];
  
  // Direct fingerprint hash
  if (fingerprintBuf.length > 0) {
    keysToTry.push({ name: 'sha256(fingerprint)', key: crypto.createHash('sha256').update(fingerprintBuf).digest() });
    keysToTry.push({ name: 'hmac(embedded,fingerprint)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(fingerprintBuf).digest() });
    keysToTry.push({ name: 'hmac(fingerprint,embedded)', key: crypto.createHmac('sha256', fingerprintBuf).update(embeddedKeyBuf).digest() });
    keysToTry.push({ name: 'hmac(fingerprint,api_key)', key: crypto.createHmac('sha256', fingerprintBuf).update(apiKeyBuf).digest() });
    keysToTry.push({ name: 'hmac(api_key,fingerprint)', key: crypto.createHmac('sha256', apiKeyBuf).update(fingerprintBuf).digest() });
    
    // Combined
    keysToTry.push({ name: 'sha256(fingerprint+api_key)', key: crypto.createHash('sha256').update(Buffer.concat([fingerprintBuf, apiKeyBuf])).digest() });
    keysToTry.push({ name: 'sha256(api_key+fingerprint)', key: crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, fingerprintBuf])).digest() });
    keysToTry.push({ name: 'sha256(embedded+fingerprint)', key: crypto.createHash('sha256').update(Buffer.concat([embeddedKeyBuf, fingerprintBuf])).digest() });
    keysToTry.push({ name: 'sha256(fingerprint+embedded)', key: crypto.createHash('sha256').update(Buffer.concat([fingerprintBuf, embeddedKeyBuf])).digest() });
    
    // Triple combination
    keysToTry.push({ name: 'sha256(embedded+fingerprint+api_key)', key: crypto.createHash('sha256').update(Buffer.concat([embeddedKeyBuf, fingerprintBuf, apiKeyBuf])).digest() });
    keysToTry.push({ name: 'sha256(fingerprint+embedded+api_key)', key: crypto.createHash('sha256').update(Buffer.concat([fingerprintBuf, embeddedKeyBuf, apiKeyBuf])).digest() });
    keysToTry.push({ name: 'sha256(api_key+fingerprint+embedded)', key: crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, fingerprintBuf, embeddedKeyBuf])).digest() });
    
    // HMAC chains
    const hmac1 = crypto.createHmac('sha256', embeddedKeyBuf).update(fingerprintBuf).digest();
    keysToTry.push({ name: 'hmac(hmac(embedded,fingerprint),api_key)', key: crypto.createHmac('sha256', hmac1).update(apiKeyBuf).digest() });
    keysToTry.push({ name: 'hmac(api_key,hmac(embedded,fingerprint))', key: crypto.createHmac('sha256', apiKeyBuf).update(hmac1).digest() });
    
    // XOR combinations
    const fpHash = crypto.createHash('sha256').update(fingerprintBuf).digest();
    const xorKey = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xorKey[i] = fpHash[i] ^ apiKeyBuf[i];
    }
    keysToTry.push({ name: 'sha256(fingerprint) XOR api_key', key: xorKey });
    
    const xorKey2 = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xorKey2[i] = fpHash[i] ^ embeddedKeyBuf[i];
    }
    keysToTry.push({ name: 'sha256(fingerprint) XOR embedded', key: xorKey2 });
  }
  
  // Also try without fingerprint
  keysToTry.push({ name: 'api_key', key: apiKeyBuf });
  keysToTry.push({ name: 'embedded', key: embeddedKeyBuf });
  keysToTry.push({ name: 'sha256(api_key_str)', key: crypto.createHash('sha256').update(testKey).digest() });
  keysToTry.push({ name: 'hmac(embedded,api_key)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(apiKeyBuf).digest() });
  keysToTry.push({ name: 'hmac(api_key,embedded)', key: crypto.createHmac('sha256', apiKeyBuf).update(embeddedKeyBuf).digest() });
  
  // Test each key with different IV positions
  let found = false;
  
  for (const { name, key } of keysToTry) {
    if (key.length !== 32) continue;
    
    for (let ivStart = 0; ivStart <= overhead - 16; ivStart++) {
      const iv = prefix.subarray(ivStart, ivStart + 16);
      
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        const zeros = Buffer.alloc(keystream.length);
        const testKeystream = cipher.update(zeros);
        
        if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
          console.log(`*** MATCH! ***`);
          console.log(`  Key: ${name}`);
          console.log(`  IV position: ${ivStart}`);
          console.log(`  Key value: ${key.toString('hex')}`);
          console.log(`  IV value: ${iv.toString('hex')}`);
          found = true;
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  if (!found) {
    console.log('No match found with fingerprint-based derivation.');
    
    // Let's analyze the fingerprint structure
    if (fingerprint) {
      console.log('\n=== Fingerprint Analysis ===\n');
      console.log(`Fingerprint: ${fingerprint}`);
      console.log(`Length: ${fingerprint.length}`);
      
      // Check if it's hex
      if (/^[0-9a-f]+$/i.test(fingerprint)) {
        console.log('Format: Hex string');
        const fpBytes = Buffer.from(fingerprint, 'hex');
        console.log(`Decoded length: ${fpBytes.length} bytes`);
      } else if (/^[A-Za-z0-9+/=]+$/.test(fingerprint)) {
        console.log('Format: Base64');
        const fpBytes = Buffer.from(fingerprint, 'base64');
        console.log(`Decoded length: ${fpBytes.length} bytes`);
      } else {
        console.log('Format: Plain text');
      }
    }
    
    // Print the prefix structure
    console.log('\n=== Prefix Structure ===\n');
    console.log(`Total: ${overhead} bytes`);
    console.log(`Prefix[0:16]: ${prefix.subarray(0, 16).toString('hex')}`);
    console.log(`Prefix[16:32]: ${prefix.subarray(16, 32).toString('hex')}`);
    console.log(`Prefix[32:48]: ${prefix.subarray(32, 48).toString('hex')}`);
    console.log(`Prefix[163:179]: ${prefix.subarray(163, 179).toString('hex')}`);
    console.log(`Prefix[179:195]: ${prefix.subarray(179, 195).toString('hex')}`);
    
    // The last 32 bytes might be HMAC
    console.log(`\nLast 32 bytes (potential HMAC): ${prefix.subarray(163, 195).toString('hex')}`);
  }
}

testFingerprintKey().catch(console.error);
