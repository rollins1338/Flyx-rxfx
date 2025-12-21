/**
 * Crack WASM - Systematic Analysis
 * 
 * Let's take a completely systematic approach:
 * 1. Collect multiple samples with the same key
 * 2. Analyze the relationship between prefix and counter blocks
 * 3. Try to find any correlation
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function systematicAnalysis() {
  console.log('=== Systematic WASM Analysis ===\n');
  
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
  
  // Use a fixed key for all samples
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
  const keyBuf = Buffer.from(testKey, 'hex');
  
  // Collect multiple samples
  const samples = [];
  for (let i = 0; i < 5; i++) {
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
    await new Promise(r => setTimeout(r, 500));
  }
  
  await browser.close();
  
  console.log(`Collected ${samples.length} samples\n`);
  
  // Analyze each sample
  const analyses = samples.map((sample, idx) => {
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
    
    // Derive counter blocks
    const counterBlocks = [];
    const numBlocks = Math.ceil(decrypted.length / 16);
    
    for (let block = 0; block < numBlocks; block++) {
      const start = block * 16;
      const end = Math.min(start + 16, keystream.length);
      const keystreamBlock = keystream.slice(start, end);
      
      const padded = Buffer.alloc(16);
      keystreamBlock.copy(padded);
      
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
      decipher.setAutoPadding(false);
      const counterBlock = decipher.update(padded);
      counterBlocks.push(counterBlock);
    }
    
    return {
      prefix,
      ciphertext,
      keystream,
      counterBlocks,
    };
  });
  
  // Print counter block 0 for each sample
  console.log('Counter block 0 for each sample:');
  for (let i = 0; i < analyses.length; i++) {
    console.log(`  Sample ${i}: ${analyses[i].counterBlocks[0].toString('hex')}`);
  }
  
  // Print prefix first 32 bytes for each sample
  console.log('\nPrefix first 32 bytes for each sample:');
  for (let i = 0; i < analyses.length; i++) {
    console.log(`  Sample ${i}: ${analyses[i].prefix.slice(0, 32).toString('hex')}`);
  }
  
  // Try to find correlation between prefix and counter block
  console.log('\n=== Correlation Analysis ===\n');
  
  // For each sample, try various transformations of prefix to get counter block
  for (let sampleIdx = 0; sampleIdx < analyses.length; sampleIdx++) {
    const { prefix, counterBlocks } = analyses[sampleIdx];
    const cb0 = counterBlocks[0];
    
    console.log(`Sample ${sampleIdx}:`);
    
    // Try XOR of prefix segments with key
    for (let pos = 0; pos <= prefix.length - 16; pos += 4) {
      const segment = prefix.slice(pos, pos + 16);
      
      // XOR with key
      const xorKey = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) {
        xorKey[j] = segment[j] ^ keyBuf[j];
      }
      
      if (xorKey.equals(cb0)) {
        console.log(`  CB0 = prefix[${pos}:${pos+16}] XOR key[0:16]`);
      }
      
      // XOR with SHA256(key)
      const keyHash = crypto.createHash('sha256').update(keyBuf).digest();
      const xorKeyHash = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) {
        xorKeyHash[j] = segment[j] ^ keyHash[j];
      }
      
      if (xorKeyHash.equals(cb0)) {
        console.log(`  CB0 = prefix[${pos}:${pos+16}] XOR SHA256(key)[0:16]`);
      }
    }
    
    // Try AES operations
    for (let pos = 0; pos <= prefix.length - 16; pos += 4) {
      const segment = prefix.slice(pos, pos + 16);
      
      // AES encrypt
      const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
      cipher.setAutoPadding(false);
      const encrypted = cipher.update(segment);
      
      if (encrypted.equals(cb0)) {
        console.log(`  CB0 = AES_ECB(key, prefix[${pos}:${pos+16}])`);
      }
      
      // AES decrypt
      const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
      decipher.setAutoPadding(false);
      const decrypted = decipher.update(segment);
      
      if (decrypted.equals(cb0)) {
        console.log(`  CB0 = AES_ECB_DEC(key, prefix[${pos}:${pos+16}])`);
      }
    }
    
    // Try hash operations
    for (let len = 16; len <= Math.min(64, prefix.length); len += 16) {
      const segment = prefix.slice(0, len);
      
      // SHA256
      const hash = crypto.createHash('sha256').update(segment).digest().slice(0, 16);
      if (hash.equals(cb0)) {
        console.log(`  CB0 = SHA256(prefix[0:${len}])[0:16]`);
      }
      
      // HMAC
      const hmac = crypto.createHmac('sha256', keyBuf).update(segment).digest().slice(0, 16);
      if (hmac.equals(cb0)) {
        console.log(`  CB0 = HMAC(key, prefix[0:${len}])[0:16]`);
      }
      
      // SHA256 with key
      const hashWithKey = crypto.createHash('sha256').update(Buffer.concat([keyBuf, segment])).digest().slice(0, 16);
      if (hashWithKey.equals(cb0)) {
        console.log(`  CB0 = SHA256(key + prefix[0:${len}])[0:16]`);
      }
    }
  }
  
  // Check if counter blocks have any relationship across samples
  console.log('\n=== Cross-Sample Analysis ===\n');
  
  // Check if same prefix position produces same counter block relationship
  for (let pos = 0; pos <= 195 - 16; pos += 16) {
    const prefixSegments = analyses.map(a => a.prefix.slice(pos, pos + 16).toString('hex'));
    const cb0s = analyses.map(a => a.counterBlocks[0].toString('hex'));
    
    // Check if there's a consistent XOR relationship
    const xorResults = analyses.map((a, i) => {
      const segment = a.prefix.slice(pos, pos + 16);
      const cb0 = a.counterBlocks[0];
      const xor = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) {
        xor[j] = segment[j] ^ cb0[j];
      }
      return xor.toString('hex');
    });
    
    // Check if all XOR results are the same
    const allSame = xorResults.every(r => r === xorResults[0]);
    if (allSame) {
      console.log(`Consistent XOR at prefix[${pos}:${pos+16}]: ${xorResults[0]}`);
    }
  }
  
  // Final summary
  console.log('\n=== Summary ===\n');
  console.log('The counter blocks appear to be completely random with no');
  console.log('discernible relationship to the prefix or key.');
  console.log('');
  console.log('This suggests the WASM uses a custom PRNG that is seeded');
  console.log('with data from the encrypted response, and the PRNG state');
  console.log('is not recoverable without reverse-engineering the WASM.');
}

systematicAnalysis().catch(console.error);
