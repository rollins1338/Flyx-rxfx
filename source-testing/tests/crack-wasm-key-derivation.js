/**
 * Crack WASM - Exhaustive Key Derivation
 * 
 * Try every possible key derivation method we can think of.
 * The key must be derived from:
 * - API key (string or hex bytes)
 * - Embedded key
 * - Possibly fingerprint data
 * 
 * And the IV must come from the prefix.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const EMBEDDED_KEY = '45bea466dbb3453ad2a1a14492f5255c7c6ad66f5235607302016b1cbd78162e';

async function exhaustiveKeyDerivation() {
  console.log('=== Exhaustive Key Derivation ===\n');
  
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
  console.log(`API key: ${testKey}\n`);
  
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
    
    return { encrypted: encryptedData, decrypted };
  }, testKey);
  
  await browser.close();
  
  const apiKeyStr = testKey;
  const apiKeyBuf = Buffer.from(testKey, 'hex');
  const embeddedKeyBuf = Buffer.from(EMBEDDED_KEY, 'hex');
  
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  const overhead = encrypted.length - decrypted.length;
  const prefix = encrypted.subarray(0, overhead);
  const ciphertext = encrypted.subarray(overhead);
  
  // Derive keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  console.log(`Overhead: ${overhead} bytes`);
  console.log(`Keystream: ${keystream.length} bytes\n`);
  
  // Generate all possible keys
  function* generateKeys() {
    // Basic keys
    yield { name: 'api_hex', key: apiKeyBuf };
    yield { name: 'api_str_sha256', key: crypto.createHash('sha256').update(apiKeyStr).digest() };
    yield { name: 'embedded', key: embeddedKeyBuf };
    
    // SHA256 combinations
    yield { name: 'sha256(api_hex)', key: crypto.createHash('sha256').update(apiKeyBuf).digest() };
    yield { name: 'sha256(embedded)', key: crypto.createHash('sha256').update(embeddedKeyBuf).digest() };
    yield { name: 'sha256(api_str+embedded)', key: crypto.createHash('sha256').update(apiKeyStr + EMBEDDED_KEY).digest() };
    yield { name: 'sha256(embedded+api_str)', key: crypto.createHash('sha256').update(EMBEDDED_KEY + apiKeyStr).digest() };
    yield { name: 'sha256(api_hex+embedded)', key: crypto.createHash('sha256').update(Buffer.concat([apiKeyBuf, embeddedKeyBuf])).digest() };
    yield { name: 'sha256(embedded+api_hex)', key: crypto.createHash('sha256').update(Buffer.concat([embeddedKeyBuf, apiKeyBuf])).digest() };
    
    // HMAC combinations
    yield { name: 'hmac(embedded,api_str)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(apiKeyStr).digest() };
    yield { name: 'hmac(api_str,embedded)', key: crypto.createHmac('sha256', apiKeyStr).update(embeddedKeyBuf).digest() };
    yield { name: 'hmac(embedded,api_hex)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(apiKeyBuf).digest() };
    yield { name: 'hmac(api_hex,embedded)', key: crypto.createHmac('sha256', apiKeyBuf).update(embeddedKeyBuf).digest() };
    
    // XOR combinations
    const xor1 = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) xor1[i] = apiKeyBuf[i] ^ embeddedKeyBuf[i];
    yield { name: 'xor(api_hex,embedded)', key: xor1 };
    
    // Double hash
    yield { name: 'sha256(sha256(api_str))', key: crypto.createHash('sha256').update(crypto.createHash('sha256').update(apiKeyStr).digest()).digest() };
    yield { name: 'sha256(sha256(api_hex))', key: crypto.createHash('sha256').update(crypto.createHash('sha256').update(apiKeyBuf).digest()).digest() };
    
    // MD5 (some systems use it)
    yield { name: 'md5(api_str)+md5(embedded)', key: Buffer.concat([crypto.createHash('md5').update(apiKeyStr).digest(), crypto.createHash('md5').update(EMBEDDED_KEY).digest()]) };
    
    // Prefix-based keys
    yield { name: 'sha256(prefix)', key: crypto.createHash('sha256').update(prefix).digest() };
    yield { name: 'hmac(embedded,prefix)', key: crypto.createHmac('sha256', embeddedKeyBuf).update(prefix).digest() };
    yield { name: 'hmac(api_hex,prefix)', key: crypto.createHmac('sha256', apiKeyBuf).update(prefix).digest() };
    yield { name: 'hmac(api_str,prefix)', key: crypto.createHmac('sha256', apiKeyStr).update(prefix).digest() };
    
    // HKDF-like derivations
    for (const info of ['', 'aes', 'key', 'enc', 'decrypt']) {
      const prk = crypto.createHmac('sha256', embeddedKeyBuf).update(apiKeyBuf).digest();
      const okm = crypto.createHmac('sha256', prk).update(Buffer.concat([Buffer.from(info), Buffer.from([1])])).digest();
      yield { name: `hkdf(embedded,api_hex,"${info}")`, key: okm };
    }
    
    // Try with prefix segments as salt
    for (let i = 0; i < overhead - 32; i += 16) {
      const salt = prefix.subarray(i, i + 32);
      yield { name: `hmac(prefix[${i}:${i+32}],api_hex)`, key: crypto.createHmac('sha256', salt).update(apiKeyBuf).digest() };
      yield { name: `hmac(api_hex,prefix[${i}:${i+32}])`, key: crypto.createHmac('sha256', apiKeyBuf).update(salt).digest() };
    }
  }
  
  // Generate all possible IVs
  function* generateIVs() {
    // Prefix positions
    for (let i = 0; i <= overhead - 16; i++) {
      yield { name: `prefix[${i}:${i+16}]`, iv: prefix.subarray(i, i + 16) };
    }
    
    // Derived IVs
    yield { name: 'embedded[0:16]', iv: embeddedKeyBuf.subarray(0, 16) };
    yield { name: 'embedded[16:32]', iv: embeddedKeyBuf.subarray(16, 32) };
    yield { name: 'api_hex[0:16]', iv: apiKeyBuf.subarray(0, 16) };
    yield { name: 'api_hex[16:32]', iv: apiKeyBuf.subarray(16, 32) };
    yield { name: 'sha256(api_str)[0:16]', iv: crypto.createHash('sha256').update(apiKeyStr).digest().subarray(0, 16) };
    yield { name: 'sha256(prefix)[0:16]', iv: crypto.createHash('sha256').update(prefix).digest().subarray(0, 16) };
    yield { name: 'zeros', iv: Buffer.alloc(16, 0) };
    
    // XOR IVs
    for (let i = 0; i <= overhead - 16; i += 16) {
      const xorIV = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) xorIV[j] = prefix[i + j] ^ apiKeyBuf[j];
      yield { name: `xor(prefix[${i}:${i+16}],api_hex[0:16])`, iv: xorIV };
      
      const xorIV2 = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) xorIV2[j] = prefix[i + j] ^ embeddedKeyBuf[j];
      yield { name: `xor(prefix[${i}:${i+16}],embedded[0:16])`, iv: xorIV2 };
    }
  }
  
  console.log('Testing all key/IV combinations...\n');
  
  let tested = 0;
  let found = false;
  
  for (const { name: keyName, key } of generateKeys()) {
    if (key.length !== 32) continue;
    
    for (const { name: ivName, iv } of generateIVs()) {
      if (iv.length !== 16) continue;
      
      tested++;
      
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
        const zeros = Buffer.alloc(keystream.length);
        const testKeystream = cipher.update(zeros);
        
        if (testKeystream.subarray(0, 16).equals(keystream.subarray(0, 16))) {
          console.log(`*** MATCH! ***`);
          console.log(`  Key: ${keyName} = ${key.toString('hex')}`);
          console.log(`  IV: ${ivName} = ${iv.toString('hex')}`);
          found = true;
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  console.log(`\nTested ${tested} combinations`);
  
  if (!found) {
    console.log('\nNo match found. The encryption might use:');
    console.log('1. A completely custom key derivation');
    console.log('2. Browser fingerprint data');
    console.log('3. Per-block IV generation (not standard CTR)');
    
    // Let's try to understand the counter block structure
    console.log('\n=== Counter Block Analysis ===\n');
    
    // Derive counter blocks using the API key
    const counterBlocks = [];
    for (let i = 0; i < Math.ceil(keystream.length / 16); i++) {
      const start = i * 16;
      const end = Math.min(start + 16, keystream.length);
      const ksBlock = keystream.subarray(start, end);
      
      if (ksBlock.length < 16) continue;
      
      const decipher = crypto.createDecipheriv('aes-256-ecb', apiKeyBuf, null);
      decipher.setAutoPadding(false);
      const counterBlock = decipher.update(ksBlock);
      counterBlocks.push(counterBlock);
    }
    
    console.log('Counter blocks (derived with api_hex):');
    for (let i = 0; i < counterBlocks.length; i++) {
      console.log(`  ${i}: ${counterBlocks[i].toString('hex')}`);
    }
    
    // Check if counter blocks are in the prefix
    console.log('\nSearching for counter blocks in prefix...');
    for (let i = 0; i < counterBlocks.length; i++) {
      const cb = counterBlocks[i];
      for (let j = 0; j <= overhead - 16; j++) {
        if (prefix.subarray(j, j + 16).equals(cb)) {
          console.log(`  Counter block ${i} found at prefix[${j}:${j+16}]`);
        }
      }
    }
    
    // Check if counter blocks XOR prefix equals something constant
    console.log('\nCounter block XOR prefix analysis...');
    for (let i = 0; i < Math.min(counterBlocks.length, 5); i++) {
      const cb = counterBlocks[i];
      for (let j = 0; j <= overhead - 16; j += 16) {
        const prefixBlock = prefix.subarray(j, j + 16);
        const xored = Buffer.alloc(16);
        for (let k = 0; k < 16; k++) xored[k] = cb[k] ^ prefixBlock[k];
        console.log(`  CB${i} XOR prefix[${j}:${j+16}] = ${xored.toString('hex')}`);
      }
    }
  }
}

exhaustiveKeyDerivation().catch(console.error);
