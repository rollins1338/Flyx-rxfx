/**
 * Crack WASM - Final Attempt
 * 
 * Let's try to understand the exact encryption by:
 * 1. Looking at the relationship between encrypted and decrypted data
 * 2. Using known plaintext attack
 * 3. Trying to find the nonce position
 * 
 * Key observations:
 * - Encrypted: 395 bytes
 * - Decrypted: 200 bytes  
 * - Overhead: 195 bytes
 * - Uses AES-CTR + some MAC
 * - Counter blocks are random per-request
 * - Modifying any byte fails decryption (authentication)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function finalCrackAttempt() {
  console.log('=== Final Crack Attempt ===\n');
  
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
  console.log(`Using key: ${testKey}\n`);
  
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
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Decrypted text: ${result.decrypted}`);
  
  // The overhead is 195 bytes
  // Let's think about this more carefully:
  // 
  // If the structure is [nonce (N)] [ciphertext (C)] [mac (M)]:
  // N + C + M = 395
  // C = 200 (same as plaintext for CTR mode)
  // N + M = 195
  //
  // Common combinations:
  // - N=16, M=32: 16 + 32 = 48 (not 195)
  // - N=16, M=64: 16 + 64 = 80 (not 195)
  //
  // So there must be additional data!
  //
  // Maybe the structure is:
  // [nonce (16)] [ciphertext (200)] [padding (?)] [mac (32)]
  // 16 + 200 + ? + 32 = 395
  // ? = 147 bytes of padding/metadata
  //
  // Or maybe the ciphertext includes additional encrypted metadata?
  
  console.log('\n=== Trying to Find Ciphertext Position ===\n');
  
  // Use known plaintext attack
  // We know the decrypted text starts with '{"sources":'
  const knownPlaintext = '{"sources":[{"server":"';
  const knownBuf = Buffer.from(knownPlaintext);
  
  // For each possible ciphertext start position, XOR with known plaintext
  // and see if we get a valid keystream
  
  for (let offset = 0; offset <= encrypted.length - decrypted.length; offset++) {
    // XOR encrypted[offset:] with known plaintext to get keystream
    const keystream = Buffer.alloc(knownBuf.length);
    for (let i = 0; i < knownBuf.length; i++) {
      keystream[i] = encrypted[offset + i] ^ knownBuf[i];
    }
    
    // Derive counter block from keystream
    if (keystream.length >= 16) {
      const keystreamBlock = keystream.subarray(0, 16);
      
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
      decipher.setAutoPadding(false);
      const counterBlock = decipher.update(keystreamBlock);
      
      // Now try to decrypt the entire ciphertext using this counter block as IV
      try {
        const ciphertext = encrypted.subarray(offset, offset + decrypted.length);
        const testDecipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, counterBlock);
        const testDecrypted = testDecipher.update(ciphertext);
        const testStr = testDecrypted.toString('utf8');
        
        // Check if it matches the known decrypted text
        if (testStr === result.decrypted) {
          console.log(`*** FOUND EXACT MATCH at offset ${offset}! ***`);
          console.log(`  Counter block (IV): ${counterBlock.toString('hex')}`);
          console.log(`  Ciphertext starts at byte ${offset}`);
          console.log(`  Ciphertext ends at byte ${offset + decrypted.length}`);
          console.log(`  Prefix (nonce?): ${encrypted.subarray(0, offset).toString('hex')}`);
          console.log(`  Suffix (mac?): ${encrypted.subarray(offset + decrypted.length).toString('hex')}`);
          
          // Now we know the structure!
          // Let's verify by checking if the counter block is in the prefix
          const prefix = encrypted.subarray(0, offset);
          const counterHex = counterBlock.toString('hex');
          
          for (let i = 0; i <= prefix.length - 16; i++) {
            if (prefix.subarray(i, i + 16).equals(counterBlock)) {
              console.log(`\n  Counter block found in prefix at position ${i}!`);
            }
          }
          
          // Check if counter block is derived from prefix
          if (offset >= 16) {
            const prefixPart = prefix.subarray(0, 16);
            
            // Try XOR with key
            const xorKey = Buffer.alloc(16);
            for (let j = 0; j < 16; j++) {
              xorKey[j] = prefixPart[j] ^ keyBuf[j];
            }
            if (xorKey.equals(counterBlock)) {
              console.log(`\n  Counter = prefix[0:16] XOR key[0:16]`);
            }
            
            // Try AES encrypt
            const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
            cipher.setAutoPadding(false);
            const encPrefix = cipher.update(prefixPart);
            if (encPrefix.equals(counterBlock)) {
              console.log(`\n  Counter = AES(key, prefix[0:16])`);
            }
            
            // Try SHA256
            const hashPrefix = crypto.createHash('sha256').update(prefix).digest().subarray(0, 16);
            if (hashPrefix.equals(counterBlock)) {
              console.log(`\n  Counter = SHA256(prefix)[0:16]`);
            }
            
            // Try HMAC
            const hmacPrefix = crypto.createHmac('sha256', keyBuf).update(prefix).digest().subarray(0, 16);
            if (hmacPrefix.equals(counterBlock)) {
              console.log(`\n  Counter = HMAC(key, prefix)[0:16]`);
            }
          }
          
          break;
        } else if (testStr.startsWith('{') && testStr.includes('sources')) {
          console.log(`Partial match at offset ${offset}:`);
          console.log(`  Expected: ${result.decrypted.substring(0, 50)}...`);
          console.log(`  Got: ${testStr.substring(0, 50)}...`);
        }
      } catch (e) {
        // Ignore errors
      }
    }
  }
}

finalCrackAttempt().catch(console.error);
