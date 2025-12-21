/**
 * Crack WASM - Hunt for the Nonce
 * 
 * The CTR mode needs a nonce/IV. Let's try to find it by:
 * 1. Analyzing the prefix structure more carefully
 * 2. Testing if any part of the prefix, when used as nonce, produces correct keystream
 * 3. Testing various transformations of the prefix
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function huntNonce() {
  console.log('=== Hunt for the Nonce ===\n');
  
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
  
  // Collect multiple samples
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
        key: key,
        encrypted: encryptedData,
        decrypted: decrypted,
      };
    }, testKey);
    
    samples.push(result);
    await new Promise(r => setTimeout(r, 300));
  }
  
  await browser.close();
  
  console.log(`Collected ${samples.length} samples\n`);
  
  // Analyze each sample
  for (let sampleIdx = 0; sampleIdx < samples.length; sampleIdx++) {
    const sample = samples[sampleIdx];
    const keyBuf = Buffer.from(sample.key, 'hex');
    const encrypted = Buffer.from(sample.encrypted, 'base64');
    const decrypted = Buffer.from(sample.decrypted);
    
    const overhead = encrypted.length - decrypted.length;
    const prefix = encrypted.slice(0, overhead);
    const ciphertext = encrypted.slice(overhead);
    
    // Derive keystream
    const keystream = Buffer.alloc(decrypted.length);
    for (let i = 0; i < decrypted.length; i++) {
      keystream[i] = ciphertext[i] ^ decrypted[i];
    }
    
    // Derive first counter block
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock0 = decipher.update(keystream.slice(0, 16));
    
    console.log(`\n=== Sample ${sampleIdx + 1} ===`);
    console.log(`Key: ${sample.key}`);
    console.log(`Counter block 0: ${counterBlock0.toString('hex')}`);
    console.log(`Prefix (first 64 bytes): ${prefix.slice(0, 64).toString('hex')}`);
    
    // Try every possible 16-byte nonce position with various counter start values
    console.log('\nTrying all nonce positions...');
    
    let found = false;
    
    // Try with the raw key
    for (let noncePos = 0; noncePos <= overhead - 16 && !found; noncePos++) {
      const nonce = prefix.slice(noncePos, noncePos + 16);
      
      // Try as direct IV
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', keyBuf, nonce);
        const zeros = Buffer.alloc(16);
        const expectedKeystream = cipher.update(zeros);
        
        if (expectedKeystream.equals(keystream.slice(0, 16))) {
          console.log(`*** FOUND! Nonce at position ${noncePos} with raw key ***`);
          found = true;
        }
      } catch (e) {}
      
      // Try with 12-byte nonce + 4-byte counter
      if (!found && noncePos <= overhead - 12) {
        const nonce12 = prefix.slice(noncePos, noncePos + 12);
        
        for (let counter = 0; counter <= 10 && !found; counter++) {
          const iv = Buffer.alloc(16);
          nonce12.copy(iv, 0);
          iv.writeUInt32BE(counter, 12);
          
          try {
            const cipher = crypto.createCipheriv('aes-256-ctr', keyBuf, iv);
            const zeros = Buffer.alloc(16);
            const expectedKeystream = cipher.update(zeros);
            
            if (expectedKeystream.equals(keystream.slice(0, 16))) {
              console.log(`*** FOUND! 12-byte nonce at position ${noncePos}, counter=${counter} ***`);
              found = true;
            }
          } catch (e) {}
        }
      }
    }
    
    // Try with derived keys
    if (!found) {
      const derivedKeys = [
        { name: 'SHA256(key)', key: crypto.createHash('sha256').update(keyBuf).digest() },
        { name: 'SHA256(hex_key)', key: crypto.createHash('sha256').update(sample.key).digest() },
        { name: 'HMAC(key, prefix[0:16])', key: crypto.createHmac('sha256', keyBuf).update(prefix.slice(0, 16)).digest() },
        { name: 'HMAC(key, prefix[0:32])', key: crypto.createHmac('sha256', keyBuf).update(prefix.slice(0, 32)).digest() },
      ];
      
      for (const dk of derivedKeys) {
        if (found) break;
        
        for (let noncePos = 0; noncePos <= overhead - 16 && !found; noncePos++) {
          const nonce = prefix.slice(noncePos, noncePos + 16);
          
          try {
            const cipher = crypto.createCipheriv('aes-256-ctr', dk.key, nonce);
            const zeros = Buffer.alloc(16);
            const expectedKeystream = cipher.update(zeros);
            
            if (expectedKeystream.equals(keystream.slice(0, 16))) {
              console.log(`*** FOUND! Nonce at position ${noncePos} with ${dk.name} ***`);
              found = true;
            }
          } catch (e) {}
        }
      }
    }
    
    // Try XOR combinations
    if (!found) {
      console.log('Trying XOR combinations...');
      
      for (let pos1 = 0; pos1 <= overhead - 16 && !found; pos1 += 4) {
        for (let pos2 = pos1 + 16; pos2 <= overhead - 16 && !found; pos2 += 4) {
          const seg1 = prefix.slice(pos1, pos1 + 16);
          const seg2 = prefix.slice(pos2, pos2 + 16);
          
          // XOR two segments to get nonce
          const xored = Buffer.alloc(16);
          for (let j = 0; j < 16; j++) {
            xored[j] = seg1[j] ^ seg2[j];
          }
          
          try {
            const cipher = crypto.createCipheriv('aes-256-ctr', keyBuf, xored);
            const zeros = Buffer.alloc(16);
            const expectedKeystream = cipher.update(zeros);
            
            if (expectedKeystream.equals(keystream.slice(0, 16))) {
              console.log(`*** FOUND! Nonce = prefix[${pos1}:${pos1+16}] XOR prefix[${pos2}:${pos2+16}] ***`);
              found = true;
            }
          } catch (e) {}
        }
      }
    }
    
    // Try AES operations on prefix segments
    if (!found) {
      console.log('Trying AES operations on prefix...');
      
      for (let pos = 0; pos <= overhead - 16 && !found; pos += 4) {
        const segment = prefix.slice(pos, pos + 16);
        
        // AES encrypt segment to get nonce
        const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
        cipher.setAutoPadding(false);
        const encSegment = cipher.update(segment);
        
        try {
          const ctrCipher = crypto.createCipheriv('aes-256-ctr', keyBuf, encSegment);
          const zeros = Buffer.alloc(16);
          const expectedKeystream = ctrCipher.update(zeros);
          
          if (expectedKeystream.equals(keystream.slice(0, 16))) {
            console.log(`*** FOUND! Nonce = AES(key, prefix[${pos}:${pos+16}]) ***`);
            found = true;
          }
        } catch (e) {}
        
        // AES decrypt segment to get nonce
        const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
        decipher.setAutoPadding(false);
        const decSegment = decipher.update(segment);
        
        try {
          const ctrCipher = crypto.createCipheriv('aes-256-ctr', keyBuf, decSegment);
          const zeros = Buffer.alloc(16);
          const expectedKeystream = ctrCipher.update(zeros);
          
          if (expectedKeystream.equals(keystream.slice(0, 16))) {
            console.log(`*** FOUND! Nonce = AES_DEC(key, prefix[${pos}:${pos+16}]) ***`);
            found = true;
          }
        } catch (e) {}
      }
    }
    
    if (!found) {
      console.log('No nonce found with standard approaches.');
    }
  }
}

huntNonce().catch(console.error);
