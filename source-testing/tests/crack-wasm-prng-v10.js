/**
 * Crack WASM PRNG - V10
 * 
 * Key finding: Modifying ANY byte causes decryption to fail!
 * This means the encryption uses authentication (integrity check).
 * 
 * Possible schemes:
 * 1. AES-GCM (12-byte nonce + ciphertext + 16-byte tag)
 * 2. ChaCha20-Poly1305 (12-byte nonce + ciphertext + 16-byte tag)
 * 3. AES-CTR + HMAC (encrypt-then-MAC)
 * 
 * The WASM crates mentioned: aes-0.10.4, ctr-0.9.2
 * This suggests AES-CTR, not AES-GCM.
 * 
 * So it's likely: AES-CTR + some MAC
 * 
 * Structure might be:
 * [nonce (16 bytes)] [ciphertext (200 bytes)] [MAC (32 bytes)] = 248 bytes
 * But we have 395 bytes, so there's more...
 * 
 * Let's try to understand the exact structure.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeAuthenticatedEncryption() {
  console.log('=== Analyzing Authenticated Encryption ===\n');
  
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
  
  // Get multiple samples with the same key to see what varies
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Using key: ${testKey}\n`);
  
  const samples = [];
  for (let i = 0; i < 3; i++) {
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
    
    samples.push(result);
    await new Promise(r => setTimeout(r, 300));
  }
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  
  // Analyze the structure
  console.log('=== Sample Analysis ===\n');
  
  for (let i = 0; i < samples.length; i++) {
    const encrypted = Buffer.from(samples[i].encrypted, 'base64');
    const decrypted = Buffer.from(samples[i].decrypted);
    
    console.log(`Sample ${i + 1}:`);
    console.log(`  Encrypted: ${encrypted.length} bytes`);
    console.log(`  Decrypted: ${decrypted.length} bytes`);
    console.log(`  Overhead: ${encrypted.length - decrypted.length} bytes`);
    
    // Print first and last 32 bytes
    console.log(`  First 32: ${encrypted.subarray(0, 32).toString('hex')}`);
    console.log(`  Last 32: ${encrypted.subarray(-32).toString('hex')}`);
    console.log();
  }
  
  // Compare samples to find what's constant vs random
  console.log('=== Comparing Samples ===\n');
  
  const enc0 = Buffer.from(samples[0].encrypted, 'base64');
  const enc1 = Buffer.from(samples[1].encrypted, 'base64');
  const enc2 = Buffer.from(samples[2].encrypted, 'base64');
  
  // Find bytes that are the same across all samples
  const sameBytes = [];
  for (let i = 0; i < Math.min(enc0.length, enc1.length, enc2.length); i++) {
    if (enc0[i] === enc1[i] && enc1[i] === enc2[i]) {
      sameBytes.push(i);
    }
  }
  
  console.log(`Bytes that are the same across all samples: ${sameBytes.length}`);
  if (sameBytes.length > 0 && sameBytes.length < 50) {
    console.log(`Positions: ${sameBytes.join(', ')}`);
  }
  
  // The overhead is 195 bytes. Let's think about what this could be:
  // - 16 byte nonce
  // - 32 byte HMAC
  // - ??? 147 bytes of something else
  
  // Wait, maybe the plaintext is compressed!
  // Let's check if the decrypted data could be compressed
  
  console.log('\n=== Compression Analysis ===\n');
  
  const dec0 = Buffer.from(samples[0].decrypted);
  const compressed = require('zlib').deflateSync(dec0);
  console.log(`Original plaintext: ${dec0.length} bytes`);
  console.log(`Compressed: ${compressed.length} bytes`);
  
  // If compressed + overhead = encrypted, then:
  // overhead = encrypted - compressed
  const enc0Len = enc0.length;
  const compressedOverhead = enc0Len - compressed.length;
  console.log(`Overhead if compressed: ${compressedOverhead} bytes`);
  
  // That would be: 395 - 97 = 298 bytes of overhead
  // Still too much for just nonce + MAC
  
  // Let's try a different approach: maybe the response contains additional data
  // that we're not seeing in the decrypted output
  
  console.log('\n=== Trying Different Decryption Approaches ===\n');
  
  // Try AES-GCM with different nonce sizes
  for (const nonceSize of [12, 16]) {
    const tagSize = 16;
    
    if (enc0.length < nonceSize + tagSize) continue;
    
    // Structure: [nonce][ciphertext][tag]
    const nonce = enc0.subarray(0, nonceSize);
    const tag = enc0.subarray(-tagSize);
    const ciphertext = enc0.subarray(nonceSize, -tagSize);
    
    console.log(`AES-GCM with ${nonceSize}-byte nonce:`);
    console.log(`  Nonce: ${nonce.toString('hex')}`);
    console.log(`  Tag: ${tag.toString('hex')}`);
    console.log(`  Ciphertext: ${ciphertext.length} bytes`);
    
    try {
      const decipher = crypto.createDecipheriv(`aes-256-gcm`, keyBuf, nonce);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      console.log(`  *** SUCCESS! ***`);
      console.log(`  Decrypted: ${decrypted.toString('utf8').substring(0, 80)}...`);
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
    
    // Also try with tag at the beginning
    const tag2 = enc0.subarray(0, tagSize);
    const nonce2 = enc0.subarray(tagSize, tagSize + nonceSize);
    const ciphertext2 = enc0.subarray(tagSize + nonceSize);
    
    console.log(`AES-GCM with tag first, ${nonceSize}-byte nonce:`);
    
    try {
      const decipher = crypto.createDecipheriv(`aes-256-gcm`, keyBuf, nonce2);
      decipher.setAuthTag(tag2);
      const decrypted = Buffer.concat([decipher.update(ciphertext2), decipher.final()]);
      console.log(`  *** SUCCESS! ***`);
      console.log(`  Decrypted: ${decrypted.toString('utf8').substring(0, 80)}...`);
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
  }
  
  // Try ChaCha20-Poly1305
  console.log('\nChaCha20-Poly1305:');
  const chachaNonce = enc0.subarray(0, 12);
  const chachaTag = enc0.subarray(-16);
  const chachaCiphertext = enc0.subarray(12, -16);
  
  try {
    const decipher = crypto.createDecipheriv('chacha20-poly1305', keyBuf, chachaNonce, { authTagLength: 16 });
    decipher.setAuthTag(chachaTag);
    const decrypted = Buffer.concat([decipher.update(chachaCiphertext), decipher.final()]);
    console.log(`  *** SUCCESS! ***`);
    console.log(`  Decrypted: ${decrypted.toString('utf8').substring(0, 80)}...`);
  } catch (e) {
    console.log(`  Failed: ${e.message}`);
  }
}

analyzeAuthenticatedEncryption().catch(console.error);
