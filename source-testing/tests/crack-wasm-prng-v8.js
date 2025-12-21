/**
 * Crack WASM PRNG - V8
 * 
 * Found: The encrypted data has a null byte delimiter!
 * - Part 0: 252 bytes (before null)
 * - Part 1: 142 bytes (after null)
 * 
 * This suggests a structure like:
 * [encrypted_data (252 bytes)] [0x00] [metadata (142 bytes)]
 * 
 * Or maybe:
 * [nonce + ciphertext] [0x00] [signature/mac]
 * 
 * Let's investigate!
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeNullDelimitedStructure() {
  console.log('=== Analyzing Null-Delimited Structure ===\n');
  
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
  
  // Get multiple samples
  const samples = [];
  for (let i = 0; i < 3; i++) {
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
        key,
        encrypted: encryptedData,
        decrypted: decrypted,
      };
    }, testKey);
    
    samples.push(result);
    await new Promise(r => setTimeout(r, 300));
  }
  
  await browser.close();
  
  // Analyze each sample
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const keyBuf = Buffer.from(sample.key, 'hex');
    const encrypted = Buffer.from(sample.encrypted, 'base64');
    const decrypted = Buffer.from(sample.decrypted);
    
    console.log(`\n=== Sample ${i + 1} ===`);
    console.log(`Key: ${sample.key.substring(0, 32)}...`);
    
    // Find null byte
    const nullIndex = encrypted.indexOf(0x00);
    console.log(`Null byte at index: ${nullIndex}`);
    
    if (nullIndex !== -1) {
      const part1 = encrypted.subarray(0, nullIndex);
      const part2 = encrypted.subarray(nullIndex + 1);
      
      console.log(`Part 1 (before null): ${part1.length} bytes`);
      console.log(`Part 2 (after null): ${part2.length} bytes`);
      console.log(`Decrypted: ${decrypted.length} bytes`);
      
      // Part 1 is likely: nonce (16 bytes) + ciphertext (236 bytes) = 252 bytes
      // But decrypted is 200 bytes, so ciphertext should be 200 bytes
      // That means: 252 - 200 = 52 bytes of overhead in part 1
      
      console.log(`\nPart 1 overhead: ${part1.length - decrypted.length} bytes`);
      
      // Let's try different nonce positions
      console.log('\n--- Trying different nonce positions ---');
      
      for (let nonceSize of [16, 32, 48, 52]) {
        if (part1.length < nonceSize + decrypted.length) continue;
        
        const nonce = part1.subarray(0, nonceSize);
        const ciphertext = part1.subarray(nonceSize);
        
        console.log(`\nNonce size: ${nonceSize}, Ciphertext: ${ciphertext.length} bytes`);
        
        // Try standard AES-CTR with 16-byte nonce
        if (nonceSize === 16) {
          try {
            const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, nonce);
            const testDecrypted = decipher.update(ciphertext);
            const testStr = testDecrypted.toString('utf8');
            
            if (testStr.startsWith('{') || testStr.includes('sources')) {
              console.log(`  *** SUCCESS with standard AES-256-CTR! ***`);
              console.log(`  Result: ${testStr.substring(0, 80)}...`);
            } else {
              console.log(`  Result (first 40 chars): ${testStr.substring(0, 40)}`);
            }
          } catch (e) {
            console.log(`  Error: ${e.message}`);
          }
        }
        
        // Try with nonce derived from the first bytes
        if (nonceSize >= 16) {
          const iv = nonce.subarray(0, 16);
          try {
            const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
            const testDecrypted = decipher.update(ciphertext);
            const testStr = testDecrypted.toString('utf8');
            
            if (testStr.startsWith('{') || testStr.includes('sources')) {
              console.log(`  *** SUCCESS with first 16 bytes as IV! ***`);
              console.log(`  Result: ${testStr.substring(0, 80)}...`);
            }
          } catch (e) {}
        }
      }
      
      // Let's also check Part 2
      console.log('\n--- Analyzing Part 2 ---');
      console.log(`Part 2 hex: ${part2.subarray(0, 32).toString('hex')}...`);
      
      // Part 2 might be a signature or MAC
      // Check if it's related to the key
      const part2Hash = crypto.createHash('sha256').update(part2).digest();
      console.log(`SHA256(Part2): ${part2Hash.toString('hex').substring(0, 32)}...`);
      
      // Check if Part 2 is HMAC of Part 1
      const hmacPart1 = crypto.createHmac('sha256', keyBuf).update(part1).digest();
      console.log(`HMAC(key, Part1): ${hmacPart1.toString('hex').substring(0, 32)}...`);
      
      // XOR Part 2 with known plaintext to see if it's encrypted
      const knownPlaintext = '{"sources":[{"server":"';
      const xored = Buffer.alloc(Math.min(part2.length, knownPlaintext.length));
      for (let j = 0; j < xored.length; j++) {
        xored[j] = part2[j] ^ knownPlaintext.charCodeAt(j);
      }
      console.log(`Part2 XOR plaintext: ${xored.toString('hex')}`);
    }
  }
}

analyzeNullDelimitedStructure().catch(console.error);
