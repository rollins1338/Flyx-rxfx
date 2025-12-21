/**
 * Crack WASM - Multi-Sample Analysis
 * 
 * Collect multiple encrypted/decrypted pairs and analyze patterns.
 * The key insight is that the server generates the encrypted response,
 * so the keystream must be derivable from information in the response.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function collectSamples() {
  console.log('=== Multi-Sample Analysis ===\n');
  
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
  
  const samples = [];
  
  // Collect 5 samples with different keys
  for (let i = 0; i < 5; i++) {
    const testKey = crypto.randomBytes(32).toString('hex');
    console.log(`Sample ${i + 1}: key=${testKey.slice(0, 16)}...`);
    
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
        timestamp,
        nonce,
        encrypted: encryptedData,
        decrypted: decrypted,
      };
    }, testKey);
    
    samples.push(result);
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  await browser.close();
  
  console.log('\n=== Analyzing Samples ===\n');
  
  // Analyze each sample
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const keyBuf = Buffer.from(sample.key, 'hex');
    const encrypted = Buffer.from(sample.encrypted, 'base64');
    const decrypted = Buffer.from(sample.decrypted);
    
    const overhead = encrypted.length - decrypted.length;
    const prefix = encrypted.subarray(0, overhead);
    const ciphertext = encrypted.subarray(overhead);
    
    // Derive keystream
    const keystream = Buffer.alloc(decrypted.length);
    for (let j = 0; j < decrypted.length; j++) {
      keystream[j] = ciphertext[j] ^ decrypted[j];
    }
    
    console.log(`Sample ${i + 1}:`);
    console.log(`  Overhead: ${overhead}, Ciphertext: ${ciphertext.length}, Decrypted: ${decrypted.length}`);
    console.log(`  Prefix[0:32]: ${prefix.subarray(0, 32).toString('hex')}`);
    console.log(`  Keystream[0:32]: ${keystream.subarray(0, 32).toString('hex')}`);
    
    samples[i].keyBuf = keyBuf;
    samples[i].prefix = prefix;
    samples[i].ciphertext = ciphertext;
    samples[i].keystream = keystream;
    samples[i].overhead = overhead;
  }
  
  // Look for patterns across samples
  console.log('\n=== Cross-Sample Analysis ===\n');
  
  // Check if prefix structure is consistent
  console.log('Prefix structure analysis:');
  for (let pos = 0; pos < 195; pos += 16) {
    const blocks = samples.map(s => s.prefix.subarray(pos, Math.min(pos + 16, s.prefix.length)));
    const allSame = blocks.every(b => b.equals(blocks[0]));
    if (allSame) {
      console.log(`  Prefix[${pos}:${pos+16}]: CONSTANT = ${blocks[0].toString('hex')}`);
    }
  }
  
  // Check if any prefix bytes correlate with key
  console.log('\nPrefix-Key correlation:');
  for (let pos = 0; pos < 32; pos++) {
    const correlations = samples.map(s => s.prefix[pos] ^ s.keyBuf[pos % 32]);
    const allSame = correlations.every(c => c === correlations[0]);
    if (allSame) {
      console.log(`  Prefix[${pos}] XOR Key[${pos % 32}] = constant ${correlations[0].toString(16)}`);
    }
  }
  
  // Check if keystream correlates with prefix
  console.log('\nKeystream-Prefix correlation:');
  for (let pos = 0; pos < 32; pos++) {
    for (let prefixPos = 0; prefixPos < 195; prefixPos++) {
      const correlations = samples.map(s => s.keystream[pos] ^ s.prefix[prefixPos]);
      const allSame = correlations.every(c => c === correlations[0]);
      if (allSame) {
        console.log(`  Keystream[${pos}] XOR Prefix[${prefixPos}] = constant ${correlations[0].toString(16)}`);
      }
    }
  }
  
  // Try to find if keystream = f(key, prefix) for some simple f
  console.log('\n=== Keystream Derivation Attempts ===\n');
  
  // Theory: keystream = HMAC(key, prefix)
  console.log('Testing HMAC(key, prefix):');
  for (const sample of samples) {
    const hmac = crypto.createHmac('sha256', sample.keyBuf).update(sample.prefix).digest();
    if (hmac.subarray(0, 16).equals(sample.keystream.subarray(0, 16))) {
      console.log('  MATCH!');
    }
  }
  
  // Theory: keystream = AES-CTR(key, prefix[0:16])
  console.log('\nTesting AES-CTR(key, prefix[0:16]):');
  for (const sample of samples) {
    const iv = sample.prefix.subarray(0, 16);
    const cipher = crypto.createCipheriv('aes-256-ctr', sample.keyBuf, iv);
    const zeros = Buffer.alloc(sample.keystream.length);
    const keystream = cipher.update(zeros);
    if (keystream.subarray(0, 16).equals(sample.keystream.subarray(0, 16))) {
      console.log('  MATCH!');
    }
  }
  
  // Theory: The prefix contains an encrypted nonce
  // keystream = AES-CTR(key, AES-ECB-decrypt(key, prefix[0:16]))
  console.log('\nTesting AES-CTR(key, AES-ECB-decrypt(key, prefix[0:16])):');
  for (const sample of samples) {
    const decipher = crypto.createDecipheriv('aes-256-ecb', sample.keyBuf, null);
    decipher.setAutoPadding(false);
    const decryptedIV = decipher.update(sample.prefix.subarray(0, 16));
    
    const cipher = crypto.createCipheriv('aes-256-ctr', sample.keyBuf, decryptedIV);
    const zeros = Buffer.alloc(sample.keystream.length);
    const keystream = cipher.update(zeros);
    if (keystream.subarray(0, 16).equals(sample.keystream.subarray(0, 16))) {
      console.log('  MATCH!');
    }
  }
  
  // Theory: The key is hashed before use
  console.log('\nTesting with SHA256(key):');
  for (const sample of samples) {
    const hashedKey = crypto.createHash('sha256').update(sample.keyBuf).digest();
    const iv = sample.prefix.subarray(0, 16);
    const cipher = crypto.createCipheriv('aes-256-ctr', hashedKey, iv);
    const zeros = Buffer.alloc(sample.keystream.length);
    const keystream = cipher.update(zeros);
    if (keystream.subarray(0, 16).equals(sample.keystream.subarray(0, 16))) {
      console.log('  MATCH!');
    }
  }
  
  // Theory: Key is derived from API key string (not hex)
  console.log('\nTesting with key as UTF-8 string:');
  for (const sample of samples) {
    const stringKey = crypto.createHash('sha256').update(sample.key).digest();
    const iv = sample.prefix.subarray(0, 16);
    const cipher = crypto.createCipheriv('aes-256-ctr', stringKey, iv);
    const zeros = Buffer.alloc(sample.keystream.length);
    const keystream = cipher.update(zeros);
    if (keystream.subarray(0, 16).equals(sample.keystream.subarray(0, 16))) {
      console.log('  MATCH!');
    }
  }
  
  // Theory: Different IV positions
  console.log('\nTesting different IV positions in prefix:');
  for (let ivStart = 0; ivStart <= 195 - 16; ivStart++) {
    let allMatch = true;
    for (const sample of samples) {
      const iv = sample.prefix.subarray(ivStart, ivStart + 16);
      const cipher = crypto.createCipheriv('aes-256-ctr', sample.keyBuf, iv);
      const zeros = Buffer.alloc(sample.keystream.length);
      const keystream = cipher.update(zeros);
      if (!keystream.subarray(0, 16).equals(sample.keystream.subarray(0, 16))) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      console.log(`  MATCH at IV position ${ivStart}!`);
    }
  }
  
  // Theory: IV is XORed with something
  console.log('\nTesting IV XOR key:');
  for (const sample of samples) {
    const iv = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      iv[j] = sample.prefix[j] ^ sample.keyBuf[j];
    }
    const cipher = crypto.createCipheriv('aes-256-ctr', sample.keyBuf, iv);
    const zeros = Buffer.alloc(sample.keystream.length);
    const keystream = cipher.update(zeros);
    if (keystream.subarray(0, 16).equals(sample.keystream.subarray(0, 16))) {
      console.log('  MATCH!');
    }
  }
  
  console.log('\nDone.');
}

collectSamples().catch(console.error);
