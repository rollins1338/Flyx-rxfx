/**
 * Crack WASM - Conclusion and Summary
 * 
 * After extensive analysis, here's what we know about Flixer's encryption:
 * 
 * 1. ENCRYPTION SCHEME:
 *    - Uses AES-256-CTR mode (confirmed from WASM crates: aes-0.10.4, ctr-0.9.2)
 *    - Authentication via HMAC (hmac-0.12.1 crate)
 *    - Modifying ANY byte causes decryption to fail (authenticated encryption)
 * 
 * 2. RESPONSE STRUCTURE:
 *    - Total: 395 bytes (base64 decoded)
 *    - Prefix/overhead: 195 bytes
 *    - Ciphertext: 200 bytes (same as plaintext length)
 *    - Decrypted: 200 bytes JSON
 * 
 * 3. COUNTER BLOCK GENERATION:
 *    - Counter blocks are COMPLETELY RANDOM for each request
 *    - They do NOT follow standard AES-CTR increment pattern
 *    - No correlation found between:
 *      - Counter blocks and API key
 *      - Counter blocks and prefix data
 *      - Counter blocks across different requests
 *    - The WASM uses a custom PRNG to generate counter blocks
 * 
 * 4. WHAT WE TRIED (ALL FAILED):
 *    - Standard AES-256-CTR with various IV positions
 *    - AES-256-GCM, AES-256-CBC, ChaCha20-Poly1305
 *    - SHA256/HMAC-based counter derivation
 *    - HKDF, PBKDF2 key derivation
 *    - Hash chains, HMAC-DRBG style PRNG
 *    - XOR with key, per-block key derivation
 *    - Counter blocks XORed with prefix data
 *    - AES-based PRNG (state = AES(key, state))
 *    - Memory analysis during decryption
 *    - Running WASM directly in Node.js
 * 
 * 5. CONCLUSION:
 *    The encryption cannot be cracked without:
 *    a) Fully disassembling and understanding the WASM binary
 *    b) Reverse-engineering the custom PRNG algorithm
 *    c) Running the WASM in a browser context (Puppeteer)
 * 
 *    Option (c) is NOT suitable for production because:
 *    - Puppeteer is slow and resource-intensive
 *    - It requires a full browser instance
 *    - It's not scalable for a streaming service
 * 
 * 6. RECOMMENDATION:
 *    - Mark Flixer as "disabled" in the provider list
 *    - Focus on other providers that don't use WASM encryption
 *    - If Flixer is critical, consider using a headless browser
 *      service (like Browserless) as a fallback
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function demonstrateDecryption() {
  console.log('=== Flixer Decryption Demonstration ===\n');
  console.log('This demonstrates that decryption ONLY works with the WASM in a browser.\n');
  
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
  
  console.log('API Key:', testKey);
  console.log('\nEncrypted (base64):', result.encrypted.substring(0, 80) + '...');
  console.log('\nDecrypted JSON:', result.decrypted);
  
  // Parse and show the sources
  try {
    const data = JSON.parse(result.decrypted);
    console.log('\nParsed sources:');
    if (data.sources) {
      for (const source of data.sources) {
        console.log(`  - ${source.server}: ${source.url || '(empty)'}`);
      }
    }
  } catch (e) {
    console.log('Failed to parse JSON:', e.message);
  }
  
  console.log('\n=== Summary ===');
  console.log('');
  console.log('The decryption works in the browser because the WASM module');
  console.log('has access to browser APIs and can generate the correct');
  console.log('counter blocks using its internal PRNG.');
  console.log('');
  console.log('Without reverse-engineering the WASM PRNG algorithm,');
  console.log('we cannot replicate this decryption in Node.js.');
  console.log('');
  console.log('STATUS: Flixer provider should remain DISABLED');
}

demonstrateDecryption().catch(console.error);
