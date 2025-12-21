/**
 * Crack WASM - Shared Secret Theory
 * 
 * Theory: The server and WASM share a secret key that's embedded in the WASM.
 * The API key from the client is used to derive a session key, but the actual
 * encryption uses a combination of the shared secret and session key.
 * 
 * Let's extract potential keys from the WASM and try them.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testSharedSecret() {
  console.log('=== Shared Secret Theory ===\n');
  
  // First, let's get the key from get_img_key()
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
  
  // Get the embedded key
  const embeddedKey = await page.evaluate(() => {
    return window.wasmImgData.get_img_key();
  });
  
  console.log(`Embedded key from get_img_key(): ${embeddedKey}\n`);
  
  // Now make a request and try to decrypt with the embedded key
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
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
    };
  }, testKey);
  
  await browser.close();
  
  const apiKeyBuf = Buffer.from(testKey, 'hex');
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
  console.log(`Ciphertext: ${ciphertext.length} bytes`);
  console.log(`Keystream: ${keystream.length} bytes\n`);
  
  // Try different key derivation methods with the embedded key
  console.log('=== Testing Key Derivations ===\n');
  
  const embeddedKeyBuf = Buffer.from(embeddedKey, 'hex');
  console.log(`Embedded key length: ${embeddedKeyBuf.length} bytes`);
  
  const keysToTry = [
    { name: 'Embedded key directly', key: embeddedKeyBuf },
    { name: 'SHA256(embedded)', key: crypto.createHash('sha256').update(embeddedKeyBuf).digest() },
    { name: 'SHA256(api_key)', key: crypto.createHash('sha256').update(apiKeyBuf).digest() },
    { name: 'SHA256(api_key_string)', key: crypto.createHash('sha256').update(testKey).digest() },
    { name: 'HMAC(embedded, api_key)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(apiKeyBuf).digest() },
    { name: 'HMAC(api_key, embedded)', key: crypto.createHmac('sha256', apiKeyBuf).update(embeddedKeyBuf).digest() },
    { name: 'XOR(embedded, api_key)', key: Buffer.alloc(32, 0).map((_, i) => embeddedKeyBuf[i % embeddedKeyBuf.length] ^ apiKeyBuf[i]) },
  ];
  
  // Add prefix-derived keys
  keysToTry.push({ name: 'SHA256(prefix)', key: crypto.createHash('sha256').update(prefix).digest() });
  keysToTry.push({ name: 'HMAC(embedded, prefix)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(prefix).digest() });
  keysToTry.push({ name: 'HMAC(api_key, prefix)', key: crypto.createHmac('sha256', apiKeyBuf).update(prefix).digest() });
  
  // Try each key with different IV positions
  for (const { name, key } of keysToTry) {
    if (key.length !== 32) {
      console.log(`${name}: Invalid key length ${key.length}`);
      continue;
    }
    
    // Try different IV positions
    for (let ivStart = 0; ivStart <= overhead - 16; ivStart += 16) {
      const iv = prefix.subarray(ivStart, ivStart + 16);
      
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        const zeros = Buffer.alloc(keystream.length);
        const testKeystream = cipher.update(zeros);
        
        if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
          console.log(`*** MATCH! ${name} with IV at prefix[${ivStart}:${ivStart+16}] ***`);
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }
  
  // Try with the embedded key as the IV
  console.log('\n=== Testing Embedded Key as IV ===\n');
  
  const embeddedIV = embeddedKeyBuf.subarray(0, 16);
  
  for (const { name, key } of keysToTry) {
    if (key.length !== 32) continue;
    
    try {
      const cipher = crypto.createCipheriv('aes-256-ctr', key, embeddedIV);
      const zeros = Buffer.alloc(keystream.length);
      const testKeystream = cipher.update(zeros);
      
      if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
        console.log(`*** MATCH! ${name} with embedded key as IV ***`);
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Try HKDF with various combinations
  console.log('\n=== Testing HKDF ===\n');
  
  function hkdf(ikm, salt, info, length) {
    const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
    const n = Math.ceil(length / 32);
    let okm = Buffer.alloc(0);
    let t = Buffer.alloc(0);
    for (let i = 1; i <= n; i++) {
      t = crypto.createHmac('sha256', prk)
        .update(Buffer.concat([t, info, Buffer.from([i])]))
        .digest();
      okm = Buffer.concat([okm, t]);
    }
    return okm.subarray(0, length);
  }
  
  const hkdfCombos = [
    { ikm: apiKeyBuf, salt: embeddedKeyBuf, info: Buffer.from('') },
    { ikm: embeddedKeyBuf, salt: apiKeyBuf, info: Buffer.from('') },
    { ikm: apiKeyBuf, salt: prefix.subarray(0, 32), info: Buffer.from('') },
    { ikm: prefix.subarray(0, 32), salt: apiKeyBuf, info: Buffer.from('') },
    { ikm: apiKeyBuf, salt: embeddedKeyBuf, info: prefix.subarray(0, 16) },
  ];
  
  for (const { ikm, salt, info } of hkdfCombos) {
    const derived = hkdf(ikm, salt, info, 48); // 32 bytes key + 16 bytes IV
    const key = derived.subarray(0, 32);
    const iv = derived.subarray(32, 48);
    
    try {
      const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
      const zeros = Buffer.alloc(keystream.length);
      const testKeystream = cipher.update(zeros);
      
      if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
        console.log(`*** MATCH! HKDF ***`);
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  console.log('\nNo matches found with shared secret approach.');
  
  // Print the embedded key for reference
  console.log(`\nEmbedded key: ${embeddedKey}`);
  console.log(`Prefix[0:64]: ${prefix.subarray(0, 64).toString('hex')}`);
  console.log(`Keystream[0:64]: ${keystream.subarray(0, 64).toString('hex')}`);
}

testSharedSecret().catch(console.error);
