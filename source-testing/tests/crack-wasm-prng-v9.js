/**
 * Crack WASM PRNG - V9
 * 
 * New approach: Let's use the WASM itself to understand the encryption.
 * 
 * We know:
 * 1. The WASM can decrypt the data
 * 2. The encrypted data is 395 bytes, decrypted is 200 bytes
 * 3. The overhead is 195 bytes
 * 
 * Let's try to understand what the 195 bytes of overhead contain by:
 * 1. Modifying parts of the encrypted data and seeing what breaks
 * 2. Looking at the relationship between encrypted and decrypted data
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function probeEncryption() {
  console.log('=== Probing Encryption Structure ===\n');
  
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
  
  // Get a sample
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Using key: ${testKey}\n`);
  
  const sample = await page.evaluate(async (key) => {
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
  
  console.log(`Original encrypted: ${sample.encrypted.substring(0, 60)}...`);
  console.log(`Original decrypted: ${sample.decrypted.substring(0, 80)}...`);
  
  const encrypted = Buffer.from(sample.encrypted, 'base64');
  const decrypted = Buffer.from(sample.decrypted);
  
  console.log(`\nEncrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  
  // Now let's probe by modifying different parts of the encrypted data
  console.log('\n=== Probing by Modification ===\n');
  
  // Test: Flip a bit in different positions and see what happens
  const positions = [0, 16, 32, 64, 128, 195, 200, 300, 394];
  
  for (const pos of positions) {
    if (pos >= encrypted.length) continue;
    
    // Create modified encrypted data
    const modified = Buffer.from(encrypted);
    modified[pos] ^= 0x01; // Flip one bit
    const modifiedB64 = modified.toString('base64');
    
    // Try to decrypt
    const result = await page.evaluate(async (encData, key) => {
      try {
        const decrypted = await window.wasmImgData.process_img_data(encData, key);
        return { success: true, decrypted: decrypted };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, modifiedB64, testKey);
    
    if (result.success) {
      // Check if decryption changed
      const newDecrypted = result.decrypted;
      if (newDecrypted === sample.decrypted) {
        console.log(`Position ${pos}: No change in decrypted output`);
      } else {
        // Find where the change occurred
        let changePos = -1;
        for (let i = 0; i < Math.min(newDecrypted.length, sample.decrypted.length); i++) {
          if (newDecrypted[i] !== sample.decrypted[i]) {
            changePos = i;
            break;
          }
        }
        console.log(`Position ${pos}: Decrypted changed at position ${changePos}`);
        console.log(`  Original: ...${sample.decrypted.substring(Math.max(0, changePos - 5), changePos + 20)}...`);
        console.log(`  Modified: ...${newDecrypted.substring(Math.max(0, changePos - 5), changePos + 20)}...`);
      }
    } else {
      console.log(`Position ${pos}: Decryption failed - ${result.error}`);
    }
  }
  
  // Now let's try to understand the structure by looking at the relationship
  // between byte positions in encrypted and decrypted data
  
  console.log('\n=== Finding Ciphertext Start ===\n');
  
  // If the structure is [nonce][ciphertext], then modifying byte N in ciphertext
  // should affect byte N in plaintext (for CTR mode)
  
  // Let's find the offset where ciphertext starts
  for (let offset = 0; offset <= 200; offset += 16) {
    // Modify byte at offset
    const modified = Buffer.from(encrypted);
    modified[offset] ^= 0x01;
    const modifiedB64 = modified.toString('base64');
    
    const result = await page.evaluate(async (encData, key) => {
      try {
        const decrypted = await window.wasmImgData.process_img_data(encData, key);
        return { success: true, decrypted: decrypted };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, modifiedB64, testKey);
    
    if (result.success && result.decrypted !== sample.decrypted) {
      // Find where the change occurred in decrypted
      let changePos = -1;
      for (let i = 0; i < Math.min(result.decrypted.length, sample.decrypted.length); i++) {
        if (result.decrypted[i] !== sample.decrypted[i]) {
          changePos = i;
          break;
        }
      }
      
      if (changePos !== -1) {
        console.log(`Encrypted byte ${offset} -> Decrypted byte ${changePos}`);
        console.log(`  Offset difference: ${offset - changePos}`);
      }
    }
  }
  
  await browser.close();
}

probeEncryption().catch(console.error);
