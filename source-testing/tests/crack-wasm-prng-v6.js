/**
 * Crack WASM PRNG - V6
 * 
 * New approach: The WASM uses AES-CTR with a custom counter generation.
 * The counter blocks are completely random per-request.
 * 
 * Key insight: The encrypted response is 395 bytes, decrypted is 200 bytes.
 * That's 195 extra bytes! This is way more than just a 16-byte nonce.
 * 
 * Possible structure:
 * - The response might be double-encoded (base64 inside base64)
 * - There might be a MAC/authentication tag
 * - The nonce might be larger than 16 bytes
 * 
 * Let's analyze the exact byte structure.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeExactStructure() {
  console.log('=== Analyzing Exact Encrypted Structure ===\n');
  
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
  
  // Get multiple samples with the same key
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
  
  // Analyze each sample
  const keyBuf = Buffer.from(testKey, 'hex');
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const encrypted = Buffer.from(sample.encrypted, 'base64');
    const decrypted = Buffer.from(sample.decrypted);
    
    console.log(`\n=== Sample ${i + 1} ===`);
    console.log(`Encrypted (base64) length: ${sample.encrypted.length}`);
    console.log(`Encrypted (bytes) length: ${encrypted.length}`);
    console.log(`Decrypted length: ${decrypted.length}`);
    console.log(`Overhead: ${encrypted.length - decrypted.length} bytes`);
    
    // The overhead should tell us about the structure
    // Common structures:
    // - 16 byte nonce + ciphertext = 16 byte overhead
    // - 12 byte nonce + ciphertext + 16 byte tag (GCM) = 28 byte overhead
    // - 16 byte nonce + ciphertext + 32 byte HMAC = 48 byte overhead
    
    // Let's check if the decrypted text is the same across samples
    console.log(`Decrypted: ${sample.decrypted.substring(0, 80)}...`);
  }
  
  // Check if all decrypted texts are the same
  const allSameDecrypted = samples.every(s => s.decrypted === samples[0].decrypted);
  console.log(`\nAll decrypted texts identical: ${allSameDecrypted}`);
  
  // Now let's try to understand the encryption by looking at the relationship
  // between encrypted and decrypted data
  console.log('\n=== Analyzing Encryption Relationship ===\n');
  
  const sample = samples[0];
  const encrypted = Buffer.from(sample.encrypted, 'base64');
  const decrypted = Buffer.from(sample.decrypted);
  
  // The overhead is significant - let's see if there's a pattern
  const overhead = encrypted.length - decrypted.length;
  console.log(`Overhead: ${overhead} bytes`);
  
  // Check if overhead is consistent across samples
  const overheads = samples.map(s => {
    const enc = Buffer.from(s.encrypted, 'base64');
    const dec = Buffer.from(s.decrypted);
    return enc.length - dec.length;
  });
  console.log(`Overheads: ${overheads.join(', ')}`);
  
  // If overhead varies, it might be due to padding or variable-length fields
  
  // Let's try to find the nonce by looking at what makes the encryption deterministic
  // If we use the same key and get different ciphertexts, the nonce must be random
  // and embedded in the response
  
  console.log('\n=== Trying to Extract Nonce ===\n');
  
  // The nonce is likely at the beginning or end of the encrypted data
  // Let's try different positions
  
  for (const sample of samples) {
    const encrypted = Buffer.from(sample.encrypted, 'base64');
    const decrypted = Buffer.from(sample.decrypted);
    
    // Try nonce at different positions
    for (let nonceSize of [12, 16, 24, 32]) {
      // Nonce at start
      const nonceStart = encrypted.subarray(0, nonceSize);
      const ciphertextStart = encrypted.subarray(nonceSize);
      
      // Nonce at end
      const nonceEnd = encrypted.subarray(-nonceSize);
      const ciphertextEnd = encrypted.subarray(0, -nonceSize);
      
      // Try AES-CTR with nonce at start
      if (nonceSize === 16) {
        try {
          const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, nonceStart);
          const testDecrypted = decipher.update(ciphertextStart);
          const testStr = testDecrypted.toString('utf8');
          
          if (testStr.startsWith('{') || testStr.startsWith('"')) {
            console.log(`*** Nonce at start (${nonceSize} bytes) might work! ***`);
            console.log(`  Result: ${testStr.substring(0, 50)}...`);
          }
        } catch (e) {}
        
        try {
          const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, nonceEnd);
          const testDecrypted = decipher.update(ciphertextEnd);
          const testStr = testDecrypted.toString('utf8');
          
          if (testStr.startsWith('{') || testStr.startsWith('"')) {
            console.log(`*** Nonce at end (${nonceSize} bytes) might work! ***`);
            console.log(`  Result: ${testStr.substring(0, 50)}...`);
          }
        } catch (e) {}
      }
    }
  }
  
  // Let's also check if the response is double-encoded
  console.log('\n=== Checking for Double Encoding ===\n');
  
  const firstSample = samples[0];
  const encryptedB64 = firstSample.encrypted;
  
  // Check if it's valid base64
  console.log(`Is valid base64: ${/^[A-Za-z0-9+/]+=*$/.test(encryptedB64)}`);
  
  // Decode once
  const decoded1 = Buffer.from(encryptedB64, 'base64');
  console.log(`After 1st decode: ${decoded1.length} bytes`);
  
  // Check if the decoded data is also base64
  const decoded1Str = decoded1.toString('utf8');
  if (/^[A-Za-z0-9+/]+=*$/.test(decoded1Str)) {
    console.log('First decode is also base64!');
    const decoded2 = Buffer.from(decoded1Str, 'base64');
    console.log(`After 2nd decode: ${decoded2.length} bytes`);
  }
  
  // Print hex dump of first 64 bytes
  console.log('\n=== Hex Dump of Encrypted Data ===\n');
  console.log('First 64 bytes:');
  for (let i = 0; i < 64 && i < decoded1.length; i += 16) {
    const hex = decoded1.subarray(i, Math.min(i + 16, decoded1.length)).toString('hex');
    const ascii = decoded1.subarray(i, Math.min(i + 16, decoded1.length)).toString('utf8').replace(/[^\x20-\x7e]/g, '.');
    console.log(`  ${i.toString(16).padStart(4, '0')}: ${hex.padEnd(32)} ${ascii}`);
  }
}

analyzeExactStructure().catch(console.error);
