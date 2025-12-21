/**
 * Crack WASM - Try ChaCha20 and Other Stream Ciphers
 * 
 * The WASM might not be using AES at all. Let's try:
 * - ChaCha20
 * - ChaCha20-Poly1305
 * - XChaCha20
 * - Salsa20
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const EMBEDDED_KEY = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';

async function tryOtherCiphers() {
  console.log('=== Try Other Stream Ciphers ===\n');
  
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
  
  const apiKeyStr = testKey;
  const apiKeyBuf = Buffer.from(testKey, 'hex');
  const embeddedKeyBuf = Buffer.from(EMBEDDED_KEY, 'hex');
  
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
  console.log(`Prefix: ${prefix.toString('hex')}`);
  console.log(`Keystream: ${keystream.toString('hex')}\n`);
  
  // Try ChaCha20-Poly1305
  console.log('=== Testing ChaCha20-Poly1305 ===\n');
  
  // ChaCha20-Poly1305 uses 12-byte nonce and 16-byte tag
  // Structure might be: [nonce 12] [tag 16] [other] = 28 + 167 = 195
  
  const keys = [
    { name: 'api_hex', key: apiKeyBuf },
    { name: 'api_str_sha256', key: crypto.createHash('sha256').update(apiKeyStr).digest() },
    { name: 'embedded', key: embeddedKeyBuf },
    { name: 'hmac(embedded,api_hex)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(apiKeyBuf).digest() },
    { name: 'hmac(api_hex,embedded)', key: crypto.createHmac('sha256', apiKeyBuf).update(embeddedKeyBuf).digest() },
  ];
  
  // Try different nonce positions
  for (const { name, key } of keys) {
    for (let nonceStart = 0; nonceStart <= overhead - 12; nonceStart++) {
      const nonce = prefix.subarray(nonceStart, nonceStart + 12);
      
      try {
        const decipher = crypto.createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
        
        // Try different tag positions
        for (let tagStart = 0; tagStart <= overhead - 16; tagStart++) {
          if (tagStart === nonceStart) continue;
          
          const tag = prefix.subarray(tagStart, tagStart + 16);
          decipher.setAuthTag(tag);
          
          try {
            const decrypted = decipher.update(ciphertext);
            const final = decipher.final();
            console.log(`*** MATCH! ChaCha20-Poly1305 ***`);
            console.log(`  Key: ${name}`);
            console.log(`  Nonce at: ${nonceStart}`);
            console.log(`  Tag at: ${tagStart}`);
          } catch (e) {
            // Auth failed, continue
          }
        }
      } catch (e) {
        // Cipher creation failed
      }
    }
  }
  
  // Try AES-GCM
  console.log('\n=== Testing AES-256-GCM ===\n');
  
  // AES-GCM uses 12-byte nonce and 16-byte tag
  for (const { name, key } of keys) {
    for (let nonceStart = 0; nonceStart <= overhead - 12; nonceStart++) {
      const nonce = prefix.subarray(nonceStart, nonceStart + 12);
      
      // Try different tag positions
      for (let tagStart = 0; tagStart <= overhead - 16; tagStart++) {
        if (Math.abs(tagStart - nonceStart) < 12) continue;
        
        const tag = prefix.subarray(tagStart, tagStart + 16);
        
        try {
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
          decipher.setAuthTag(tag);
          
          const decrypted = decipher.update(ciphertext);
          const final = decipher.final();
          console.log(`*** MATCH! AES-256-GCM ***`);
          console.log(`  Key: ${name}`);
          console.log(`  Nonce at: ${nonceStart}`);
          console.log(`  Tag at: ${tagStart}`);
        } catch (e) {
          // Auth failed, continue
        }
      }
    }
  }
  
  // Try plain ChaCha20 (no auth)
  console.log('\n=== Testing Plain ChaCha20 ===\n');
  
  for (const { name, key } of keys) {
    // ChaCha20 uses 16-byte nonce in Node.js
    for (let nonceStart = 0; nonceStart <= overhead - 16; nonceStart++) {
      const nonce = prefix.subarray(nonceStart, nonceStart + 16);
      
      try {
        const cipher = crypto.createCipheriv('chacha20', key, nonce);
        const zeros = Buffer.alloc(keystream.length);
        const testKeystream = cipher.update(zeros);
        
        if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
          console.log(`*** MATCH! ChaCha20 ***`);
          console.log(`  Key: ${name}`);
          console.log(`  Nonce at: ${nonceStart}`);
        }
      } catch (e) {
        // Cipher creation failed
      }
    }
  }
  
  console.log('\nNo matches found with alternative ciphers.');
  
  // Final analysis - let's look at the WASM strings again
  console.log('\n=== WASM Crate Analysis ===\n');
  console.log('The WASM uses these Rust crates:');
  console.log('  - aes-0.8.4 (fixslice32 implementation)');
  console.log('  - ctr-0.9.2 (CTR mode)');
  console.log('  - hmac-0.12.1 (HMAC)');
  console.log('  - cipher-0.4.4 (stream cipher traits)');
  console.log('');
  console.log('This confirms AES-CTR is used, but with a custom key/IV derivation.');
  console.log('The key derivation likely involves:');
  console.log('  1. Browser fingerprint (computed once at init)');
  console.log('  2. Embedded key');
  console.log('  3. API key');
  console.log('  4. Data from the prefix');
  console.log('');
  console.log('Without reverse-engineering the WASM binary, we cannot determine');
  console.log('the exact key derivation algorithm.');
}

tryOtherCiphers().catch(console.error);
