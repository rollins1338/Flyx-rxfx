/**
 * Crack WASM - Comprehensive Key Derivation
 * 
 * Try every possible combination of:
 * - Embedded key
 * - API key (hex bytes)
 * - API key (string)
 * - Prefix segments
 * - Various hash/HMAC combinations
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const EMBEDDED_KEY = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';

async function comprehensiveTest() {
  console.log('=== Comprehensive Key Derivation Test ===\n');
  
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
      
      return { key, encrypted: encryptedData, decrypted };
    }, testKey);
    
    samples.push(result);
    await new Promise(r => setTimeout(r, 300));
  }
  
  await browser.close();
  
  const embeddedKeyBuf = Buffer.from(EMBEDDED_KEY, 'hex');
  
  // Process samples
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const apiKeyBuf = Buffer.from(sample.key, 'hex');
    const apiKeyStr = sample.key;
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
    
    samples[i].apiKeyBuf = apiKeyBuf;
    samples[i].apiKeyStr = apiKeyStr;
    samples[i].prefix = prefix;
    samples[i].ciphertext = ciphertext;
    samples[i].keystream = keystream;
    samples[i].overhead = overhead;
  }
  
  console.log(`Collected ${samples.length} samples\n`);
  
  // Generate all possible keys
  function generateKeys(sample) {
    const { apiKeyBuf, apiKeyStr, prefix } = sample;
    const keys = [];
    
    // Direct keys
    keys.push({ name: 'embedded', key: embeddedKeyBuf });
    keys.push({ name: 'api_hex', key: apiKeyBuf });
    keys.push({ name: 'sha256(api_str)', key: crypto.createHash('sha256').update(apiKeyStr).digest() });
    keys.push({ name: 'sha256(api_hex)', key: crypto.createHash('sha256').update(apiKeyBuf).digest() });
    keys.push({ name: 'sha256(embedded)', key: crypto.createHash('sha256').update(embeddedKeyBuf).digest() });
    
    // HMAC combinations
    keys.push({ name: 'hmac(embedded,api_hex)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(apiKeyBuf).digest() });
    keys.push({ name: 'hmac(api_hex,embedded)', key: crypto.createHmac('sha256', apiKeyBuf).update(embeddedKeyBuf).digest() });
    keys.push({ name: 'hmac(embedded,api_str)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(apiKeyStr).digest() });
    keys.push({ name: 'hmac(api_str,embedded)', key: crypto.createHmac('sha256', Buffer.from(apiKeyStr)).update(embeddedKeyBuf).digest() });
    
    // XOR combinations
    const xorKey = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xorKey[i] = embeddedKeyBuf[i] ^ apiKeyBuf[i];
    }
    keys.push({ name: 'xor(embedded,api_hex)', key: xorKey });
    
    // Prefix-based keys
    keys.push({ name: 'sha256(prefix)', key: crypto.createHash('sha256').update(prefix).digest() });
    keys.push({ name: 'hmac(embedded,prefix)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(prefix).digest() });
    keys.push({ name: 'hmac(api_hex,prefix)', key: crypto.createHmac('sha256', apiKeyBuf).update(prefix).digest() });
    keys.push({ name: 'hmac(prefix,api_hex)', key: crypto.createHmac('sha256', prefix).update(apiKeyBuf).digest() });
    
    // Double hash
    keys.push({ name: 'sha256(sha256(api_str))', key: crypto.createHash('sha256').update(crypto.createHash('sha256').update(apiKeyStr).digest()).digest() });
    
    // Concatenation hashes
    keys.push({ name: 'sha256(embedded+api_hex)', key: crypto.createHash('sha256').update(Buffer.concat([embeddedKeyBuf, apiKeyBuf])).digest() });
    keys.push({ name: 'sha256(api_hex+embedded)', key: crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, embeddedKeyBuf])).digest() });
    keys.push({ name: 'sha256(api_str+embedded)', key: crypto.createHash('sha256').update(Buffer.concat([Buffer.from(apiKeyStr), embeddedKeyBuf])).digest() });
    
    return keys;
  }
  
  // Generate all possible IVs
  function generateIVs(sample) {
    const { prefix, apiKeyBuf } = sample;
    const ivs = [];
    
    // Prefix positions
    for (let pos = 0; pos <= sample.overhead - 16; pos += 4) {
      ivs.push({ name: `prefix[${pos}:${pos+16}]`, iv: prefix.subarray(pos, pos + 16) });
    }
    
    // Derived IVs
    ivs.push({ name: 'embedded[0:16]', iv: embeddedKeyBuf.subarray(0, 16) });
    ivs.push({ name: 'embedded[16:32]', iv: embeddedKeyBuf.subarray(16, 32) });
    ivs.push({ name: 'api_hex[0:16]', iv: apiKeyBuf.subarray(0, 16) });
    ivs.push({ name: 'api_hex[16:32]', iv: apiKeyBuf.subarray(16, 32) });
    ivs.push({ name: 'sha256(api_str)[0:16]', iv: crypto.createHash('sha256').update(sample.apiKeyStr).digest().subarray(0, 16) });
    ivs.push({ name: 'sha256(prefix)[0:16]', iv: crypto.createHash('sha256').update(prefix).digest().subarray(0, 16) });
    
    // XOR IVs
    const xorIV = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      xorIV[i] = prefix[i] ^ apiKeyBuf[i];
    }
    ivs.push({ name: 'xor(prefix[0:16],api_hex[0:16])', iv: xorIV });
    
    const xorIV2 = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      xorIV2[i] = prefix[i] ^ embeddedKeyBuf[i];
    }
    ivs.push({ name: 'xor(prefix[0:16],embedded[0:16])', iv: xorIV2 });
    
    return ivs;
  }
  
  // Test all combinations
  console.log('Testing all key/IV combinations...\n');
  
  let tested = 0;
  let found = false;
  
  for (const sample of samples) {
    const keys = generateKeys(sample);
    const ivs = generateIVs(sample);
    
    for (const { name: keyName, key } of keys) {
      if (key.length !== 32) continue;
      
      for (const { name: ivName, iv } of ivs) {
        if (iv.length !== 16) continue;
        
        tested++;
        
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
          const zeros = Buffer.alloc(sample.keystream.length);
          const testKeystream = cipher.update(zeros);
          
          if (testKeystream.subarray(0, 16).equals(sample.keystream.subarray(0, 16))) {
            console.log(`*** MATCH! ***`);
            console.log(`  Key: ${keyName}`);
            console.log(`  IV: ${ivName}`);
            console.log(`  Key value: ${key.toString('hex')}`);
            console.log(`  IV value: ${iv.toString('hex')}`);
            found = true;
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }
  
  console.log(`\nTested ${tested} combinations`);
  
  if (!found) {
    console.log('\nNo matches found. The encryption might use:');
    console.log('1. A more complex key derivation (PBKDF2, scrypt, etc.)');
    console.log('2. Multiple rounds of hashing');
    console.log('3. A completely custom algorithm');
    console.log('4. The IV might be derived differently for each block');
    
    // Let's check if the keystream blocks are related
    console.log('\n=== Keystream Block Analysis ===\n');
    
    const sample = samples[0];
    const numBlocks = Math.ceil(sample.keystream.length / 16);
    
    console.log(`Keystream has ${numBlocks} blocks:`);
    for (let i = 0; i < numBlocks; i++) {
      const start = i * 16;
      const end = Math.min(start + 16, sample.keystream.length);
      const block = sample.keystream.subarray(start, end);
      console.log(`  Block ${i}: ${block.toString('hex')}`);
    }
    
    // Derive counter blocks
    console.log('\n=== Counter Block Analysis ===\n');
    
    const apiKeyBuf = sample.apiKeyBuf;
    
    for (let i = 0; i < numBlocks; i++) {
      const start = i * 16;
      const end = Math.min(start + 16, sample.keystream.length);
      const keystreamBlock = sample.keystream.subarray(start, end);
      
      if (keystreamBlock.length < 16) continue;
      
      // Counter block = AES-ECB-decrypt(key, keystream_block)
      const decipher = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
      decipher.setAutoPadding(false);
      const counterBlock = decipher.update(keystreamBlock);
      
      console.log(`  Counter ${i}: ${counterBlock.toString('hex')}`);
    }
    
    // Check if counter blocks follow any pattern
    console.log('\n=== Counter Block Pattern Check ===\n');
    
    // Try with embedded key
    console.log('Using embedded key:');
    for (let i = 0; i < Math.min(numBlocks, 5); i++) {
      const start = i * 16;
      const keystreamBlock = sample.keystream.subarray(start, start + 16);
      
      if (keystreamBlock.length < 16) continue;
      
      const decipher = crypto.createDecipheriv('aes-256-ecb', embeddedKeyBuf, null);
      decipher.setAutoPadding(false);
      const counterBlock = decipher.update(keystreamBlock);
      
      console.log(`  Counter ${i}: ${counterBlock.toString('hex')}`);
    }
  }
}

comprehensiveTest().catch(console.error);
