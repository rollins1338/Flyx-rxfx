/**
 * Crack WASM - Find PRNG Seed
 * 
 * The counter blocks are random, but they must be deterministic based on some seed.
 * The seed is likely derived from:
 * 1. The API key
 * 2. Some data in the encrypted response prefix
 * 3. A combination of both
 * 
 * Let's make multiple requests with the same key and see if the counter blocks
 * are the same when the prefix is the same.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function findPrngSeed() {
  console.log('=== Find PRNG Seed ===\n');
  
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
  
  // Use a fixed key
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
  // Make multiple requests with the same key
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
    await new Promise(r => setTimeout(r, 500));
  }
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  
  console.log('=== Analyzing Samples ===\n');
  
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
    
    // Derive first counter block
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock0 = decipher.update(keystream.slice(0, 16));
    
    return {
      prefix: prefix.toString('hex'),
      counterBlock0: counterBlock0.toString('hex'),
      keystreamFirst16: keystream.slice(0, 16).toString('hex'),
    };
  });
  
  for (let i = 0; i < analyses.length; i++) {
    console.log(`Sample ${i + 1}:`);
    console.log(`  Prefix (first 64 bytes): ${analyses[i].prefix.slice(0, 128)}`);
    console.log(`  Counter block 0: ${analyses[i].counterBlock0}`);
    console.log();
  }
  
  // Check if same prefix produces same counter block
  console.log('=== Prefix vs Counter Block Correlation ===\n');
  
  for (let i = 0; i < analyses.length; i++) {
    for (let j = i + 1; j < analyses.length; j++) {
      const samePrefix = analyses[i].prefix === analyses[j].prefix;
      const sameCounter = analyses[i].counterBlock0 === analyses[j].counterBlock0;
      console.log(`Samples ${i+1} vs ${j+1}: prefix same=${samePrefix}, counter same=${sameCounter}`);
    }
  }
  
  // Now let's try to find what part of the prefix determines the counter block
  console.log('\n=== Prefix Segment Analysis ===\n');
  
  // The prefix is 195 bytes. Let's see which segments vary between samples
  const prefixBuffers = analyses.map(a => Buffer.from(a.prefix, 'hex'));
  
  // Find segments that are the same across all samples
  const segmentSize = 16;
  for (let pos = 0; pos <= 195 - segmentSize; pos += segmentSize) {
    const segments = prefixBuffers.map(p => p.slice(pos, pos + segmentSize).toString('hex'));
    const allSame = segments.every(s => s === segments[0]);
    if (allSame) {
      console.log(`Prefix[${pos}:${pos+segmentSize}] is CONSTANT: ${segments[0]}`);
    } else {
      console.log(`Prefix[${pos}:${pos+segmentSize}] VARIES`);
    }
  }
  
  // Let's try a different approach: see if the counter block is derived from specific prefix bytes
  console.log('\n=== Testing Counter Block Derivation ===\n');
  
  const sample = analyses[0];
  const prefix = Buffer.from(sample.prefix, 'hex');
  const counterBlock0 = Buffer.from(sample.counterBlock0, 'hex');
  
  // Test various derivations
  const derivations = [];
  
  // Try SHA256 of various prefix segments
  for (let start = 0; start <= 195 - 16; start += 4) {
    for (let len = 16; len <= Math.min(64, 195 - start); len += 16) {
      const segment = prefix.slice(start, start + len);
      const hash = crypto.createHash('sha256').update(segment).digest().slice(0, 16);
      if (hash.equals(counterBlock0)) {
        console.log(`*** FOUND: Counter block 0 = SHA256(prefix[${start}:${start+len}])[0:16] ***`);
      }
      
      // Also try with key
      const hashWithKey = crypto.createHash('sha256').update(Buffer.concat([keyBuf, segment])).digest().slice(0, 16);
      if (hashWithKey.equals(counterBlock0)) {
        console.log(`*** FOUND: Counter block 0 = SHA256(key + prefix[${start}:${start+len}])[0:16] ***`);
      }
      
      const hashKeyAfter = crypto.createHash('sha256').update(Buffer.concat([segment, keyBuf])).digest().slice(0, 16);
      if (hashKeyAfter.equals(counterBlock0)) {
        console.log(`*** FOUND: Counter block 0 = SHA256(prefix[${start}:${start+len}] + key)[0:16] ***`);
      }
      
      // Try HMAC
      const hmac = crypto.createHmac('sha256', keyBuf).update(segment).digest().slice(0, 16);
      if (hmac.equals(counterBlock0)) {
        console.log(`*** FOUND: Counter block 0 = HMAC(key, prefix[${start}:${start+len}])[0:16] ***`);
      }
    }
  }
  
  // Try XOR combinations
  for (let pos = 0; pos <= 195 - 16; pos++) {
    const segment = prefix.slice(pos, pos + 16);
    
    // XOR with key
    const xorKey = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      xorKey[i] = segment[i] ^ keyBuf[i];
    }
    if (xorKey.equals(counterBlock0)) {
      console.log(`*** FOUND: Counter block 0 = prefix[${pos}:${pos+16}] XOR key[0:16] ***`);
    }
    
    // XOR with SHA256(key)
    const keyHash = crypto.createHash('sha256').update(keyBuf).digest();
    const xorKeyHash = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      xorKeyHash[i] = segment[i] ^ keyHash[i];
    }
    if (xorKeyHash.equals(counterBlock0)) {
      console.log(`*** FOUND: Counter block 0 = prefix[${pos}:${pos+16}] XOR SHA256(key)[0:16] ***`);
    }
  }
  
  // Try AES encryption of prefix segments
  for (let pos = 0; pos <= 195 - 16; pos++) {
    const segment = prefix.slice(pos, pos + 16);
    
    const cipher = crypto.createCipheriv('aes-256-ecb', keyBuf, null);
    cipher.setAutoPadding(false);
    const encrypted = cipher.update(segment);
    if (encrypted.equals(counterBlock0)) {
      console.log(`*** FOUND: Counter block 0 = AES_ECB(key, prefix[${pos}:${pos+16}]) ***`);
    }
    
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const decrypted = decipher.update(segment);
    if (decrypted.equals(counterBlock0)) {
      console.log(`*** FOUND: Counter block 0 = AES_ECB_DECRYPT(key, prefix[${pos}:${pos+16}]) ***`);
    }
  }
  
  console.log('\nNo simple derivation found.');
}

findPrngSeed().catch(console.error);
