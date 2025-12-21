/**
 * Crack WASM - Stream Cipher Analysis
 * 
 * The counter blocks are completely random, which suggests the WASM might be using:
 * 1. A custom stream cipher
 * 2. AES in OFB mode (where output is fed back as input)
 * 3. A PRNG-based keystream generator
 * 
 * Let's analyze the keystream itself to find patterns.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeStreamCipher() {
  console.log('=== Stream Cipher Analysis ===\n');
  
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
  
  // Collect multiple samples with the same key
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
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
  
  // Analyze each sample
  const analyses = samples.map(sample => {
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
    
    return { prefix, ciphertext, keystream, decrypted };
  });
  
  console.log('=== Keystream Comparison ===\n');
  
  // Compare keystreams between samples
  for (let i = 0; i < analyses.length; i++) {
    console.log(`Sample ${i + 1} keystream (first 64 bytes): ${analyses[i].keystream.slice(0, 64).toString('hex')}`);
  }
  
  // Check if keystreams are the same (they shouldn't be if nonce is random)
  const ks0 = analyses[0].keystream;
  const ks1 = analyses[1].keystream;
  
  let sameBytes = 0;
  for (let i = 0; i < Math.min(ks0.length, ks1.length); i++) {
    if (ks0[i] === ks1[i]) sameBytes++;
  }
  console.log(`\nSame bytes between sample 0 and 1: ${sameBytes} / ${Math.min(ks0.length, ks1.length)}`);
  
  // Analyze keystream entropy
  console.log('\n=== Keystream Entropy ===\n');
  
  for (let i = 0; i < analyses.length; i++) {
    const ks = analyses[i].keystream;
    const freq = new Array(256).fill(0);
    for (const byte of ks) {
      freq[byte]++;
    }
    
    let entropy = 0;
    for (const f of freq) {
      if (f > 0) {
        const p = f / ks.length;
        entropy -= p * Math.log2(p);
      }
    }
    
    console.log(`Sample ${i + 1} entropy: ${entropy.toFixed(4)} bits/byte (max 8.0)`);
  }
  
  // Try to find the keystream generation pattern
  console.log('\n=== Keystream Generation Analysis ===\n');
  
  const sample = analyses[0];
  const prefix = sample.prefix;
  const keystream = sample.keystream;
  
  // Maybe keystream = AES-OFB(key, prefix[0:16])
  console.log('Testing AES-OFB...');
  
  for (let ivPos = 0; ivPos <= prefix.length - 16; ivPos++) {
    const iv = prefix.slice(ivPos, ivPos + 16);
    
    try {
      const cipher = crypto.createCipheriv('aes-256-ofb', keyBuf, iv);
      const zeros = Buffer.alloc(keystream.length);
      const expectedKeystream = cipher.update(zeros);
      
      if (expectedKeystream.slice(0, 16).equals(keystream.slice(0, 16))) {
        console.log(`*** FOUND! AES-OFB with IV at prefix[${ivPos}:${ivPos+16}] ***`);
      }
    } catch (e) {}
  }
  
  // Maybe keystream = AES-CFB(key, prefix[0:16])
  console.log('Testing AES-CFB...');
  
  for (let ivPos = 0; ivPos <= prefix.length - 16; ivPos++) {
    const iv = prefix.slice(ivPos, ivPos + 16);
    
    try {
      const cipher = crypto.createCipheriv('aes-256-cfb', keyBuf, iv);
      const zeros = Buffer.alloc(keystream.length);
      const expectedKeystream = cipher.update(zeros);
      
      if (expectedKeystream.slice(0, 16).equals(keystream.slice(0, 16))) {
        console.log(`*** FOUND! AES-CFB with IV at prefix[${ivPos}:${ivPos+16}] ***`);
      }
    } catch (e) {}
  }
  
  // Maybe the keystream is directly in the prefix (XORed with something)
  console.log('\nTesting if keystream is in prefix...');
  
  // Check if prefix contains keystream XOR key
  for (let pos = 0; pos <= prefix.length - keystream.length; pos++) {
    const prefixSegment = prefix.slice(pos, pos + keystream.length);
    
    // XOR with key (repeated)
    const xored = Buffer.alloc(keystream.length);
    for (let i = 0; i < keystream.length; i++) {
      xored[i] = prefixSegment[i] ^ keyBuf[i % 32];
    }
    
    if (xored.equals(keystream)) {
      console.log(`*** FOUND! Keystream = prefix[${pos}:] XOR key (repeated) ***`);
    }
  }
  
  // Maybe the keystream is generated by HMAC-DRBG
  console.log('\nTesting HMAC-DRBG...');
  
  // HMAC-DRBG: K = HMAC(K, V || 0x00 || seed), V = HMAC(K, V)
  for (let seedPos = 0; seedPos <= prefix.length - 32; seedPos += 16) {
    const seed = prefix.slice(seedPos, seedPos + 32);
    
    // Initialize
    let K = Buffer.alloc(32, 0);
    let V = Buffer.alloc(32, 1);
    
    // Update with seed
    K = crypto.createHmac('sha256', K).update(Buffer.concat([V, Buffer.from([0]), seed])).digest();
    V = crypto.createHmac('sha256', K).update(V).digest();
    K = crypto.createHmac('sha256', K).update(Buffer.concat([V, Buffer.from([1]), seed])).digest();
    V = crypto.createHmac('sha256', K).update(V).digest();
    
    // Generate
    let output = Buffer.alloc(0);
    while (output.length < 16) {
      V = crypto.createHmac('sha256', K).update(V).digest();
      output = Buffer.concat([output, V]);
    }
    
    if (output.slice(0, 16).equals(keystream.slice(0, 16))) {
      console.log(`*** FOUND! HMAC-DRBG with seed at prefix[${seedPos}:${seedPos+32}] ***`);
    }
  }
  
  // Maybe the keystream is generated by ChaCha20
  console.log('\nTesting ChaCha20...');
  
  for (let noncePos = 0; noncePos <= prefix.length - 12; noncePos++) {
    const nonce = prefix.slice(noncePos, noncePos + 12);
    
    try {
      const cipher = crypto.createCipheriv('chacha20', keyBuf, Buffer.concat([Buffer.alloc(4), nonce]));
      const zeros = Buffer.alloc(keystream.length);
      const expectedKeystream = cipher.update(zeros);
      
      if (expectedKeystream.slice(0, 16).equals(keystream.slice(0, 16))) {
        console.log(`*** FOUND! ChaCha20 with nonce at prefix[${noncePos}:${noncePos+12}] ***`);
      }
    } catch (e) {}
  }
  
  console.log('\nNo standard stream cipher pattern found.');
}

analyzeStreamCipher().catch(console.error);
