/**
 * Crack WASM - Prefix Analysis
 * 
 * The 195-byte prefix must contain all information needed to decrypt.
 * Let's analyze it more carefully.
 * 
 * Possible structures:
 * 1. [nonce 12] [hmac 32] [encrypted_key_material 151]
 * 2. [hmac 32] [nonce 12] [encrypted_key_material 151]
 * 3. [encrypted_nonces 195] - all counter nonces pre-computed
 * 4. [seed 32] [hmac 32] [padding 131]
 * 
 * Key insight: 195 bytes overhead for 200 bytes plaintext
 * 200 bytes = 13 blocks of 16 bytes (with 8 bytes partial)
 * 13 * 12 = 156 bytes if storing 12-byte nonces per block
 * 13 * 16 = 208 bytes if storing full counter blocks
 * 
 * Wait... 195 - 32 (HMAC) = 163 bytes
 * 163 / 13 blocks = 12.5 bytes per block
 * 
 * Or: 195 - 32 (HMAC) - 12 (base nonce) = 151 bytes
 * This doesn't divide evenly either.
 * 
 * Let me try a different approach: maybe the prefix contains
 * the PRNG seed and the keystream is generated from it.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzePrefix() {
  console.log('=== Prefix Analysis ===\n');
  
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
    await new Promise(r => setTimeout(r, 300));
  }
  
  await browser.close();
  
  const keyBuf = Buffer.from(testKey, 'hex');
  
  // Analyze each sample
  console.log('=== Sample Analysis ===\n');
  
  const prefixes = [];
  const keystreamBlocks = [];
  
  for (let i = 0; i < samples.length; i++) {
    const encrypted = Buffer.from(samples[i].encrypted, 'base64');
    const decrypted = Buffer.from(samples[i].decrypted);
    const overhead = encrypted.length - decrypted.length;
    const prefix = encrypted.subarray(0, overhead);
    
    prefixes.push(prefix);
    
    // Derive keystream
    const keystream = Buffer.alloc(decrypted.length);
    for (let j = 0; j < decrypted.length; j++) {
      keystream[j] = encrypted[overhead + j] ^ decrypted[j];
    }
    
    // Get first keystream block
    keystreamBlocks.push(keystream.subarray(0, 16));
    
    console.log(`Sample ${i}:`);
    console.log(`  Prefix[0:32]: ${prefix.subarray(0, 32).toString('hex')}`);
    console.log(`  Keystream[0:16]: ${keystream.subarray(0, 16).toString('hex')}`);
  }
  
  // Check if prefixes have any common structure
  console.log('\n=== Prefix Comparison ===\n');
  
  // XOR prefixes to find constant parts
  const xorResult = Buffer.alloc(prefixes[0].length);
  for (let i = 0; i < prefixes[0].length; i++) {
    let allSame = true;
    const firstByte = prefixes[0][i];
    for (let j = 1; j < prefixes.length; j++) {
      if (prefixes[j][i] !== firstByte) {
        allSame = false;
        break;
      }
    }
    xorResult[i] = allSame ? 0xFF : 0x00;
  }
  
  // Count constant bytes
  let constantCount = 0;
  for (let i = 0; i < xorResult.length; i++) {
    if (xorResult[i] === 0xFF) constantCount++;
  }
  console.log(`Constant bytes in prefix: ${constantCount} / ${prefixes[0].length}`);
  
  // Show which positions are constant
  const constantPositions = [];
  for (let i = 0; i < xorResult.length; i++) {
    if (xorResult[i] === 0xFF) constantPositions.push(i);
  }
  if (constantPositions.length > 0 && constantPositions.length < 50) {
    console.log(`Constant positions: ${constantPositions.join(', ')}`);
  }
  
  // Check if keystream blocks have any relationship to prefix
  console.log('\n=== Keystream-Prefix Relationship ===\n');
  
  for (let i = 0; i < samples.length; i++) {
    const prefix = prefixes[i];
    const ksBlock = keystreamBlocks[i];
    
    // Check if keystream block XOR with any 16-byte prefix segment gives a constant
    for (let pos = 0; pos <= prefix.length - 16; pos++) {
      const prefixSegment = prefix.subarray(pos, pos + 16);
      const xored = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) {
        xored[j] = ksBlock[j] ^ prefixSegment[j];
      }
      
      // Check if this XOR result is the same across all samples
      if (i === 0) {
        // Store for comparison
        if (!global.xorResults) global.xorResults = {};
        global.xorResults[pos] = xored;
      } else {
        const expected = global.xorResults[pos];
        if (expected && xored.equals(expected)) {
          console.log(`Position ${pos}: XOR result is constant across samples!`);
          console.log(`  XOR result: ${xored.toString('hex')}`);
        }
      }
    }
  }
  
  // Try: Maybe the keystream is AES-CTR with nonce from prefix
  console.log('\n=== Testing AES-CTR with Prefix Nonces ===\n');
  
  for (let noncePos = 0; noncePos <= 64; noncePos++) {
    const nonce = prefixes[0].subarray(noncePos, noncePos + 12);
    
    // Create IV with counter = 0
    const iv = Buffer.alloc(16);
    nonce.copy(iv, 0);
    iv.writeUInt32BE(0, 12);
    
    // Generate keystream with AES-CTR
    const cipher = crypto.createCipheriv('aes-256-ctr', keyBuf, iv);
    const zeros = Buffer.alloc(16);
    const expectedKeystream = cipher.update(zeros);
    
    // Check if it matches
    if (expectedKeystream.equals(keystreamBlocks[0])) {
      console.log(`*** FOUND! Nonce at position ${noncePos} ***`);
      console.log(`Nonce: ${nonce.toString('hex')}`);
      break;
    }
  }
  
  // Try: Maybe the nonce is derived from prefix via hash
  console.log('\n=== Testing Derived Nonces ===\n');
  
  // SHA256(prefix[0:32])[0:12]
  const hash1 = crypto.createHash('sha256').update(prefixes[0].subarray(0, 32)).digest();
  const nonce1 = hash1.subarray(0, 12);
  let iv1 = Buffer.alloc(16);
  nonce1.copy(iv1, 0);
  let cipher1 = crypto.createCipheriv('aes-256-ctr', keyBuf, iv1);
  let ks1 = cipher1.update(Buffer.alloc(16));
  console.log(`SHA256(prefix[0:32])[0:12] as nonce:`);
  console.log(`  Expected: ${keystreamBlocks[0].toString('hex')}`);
  console.log(`  Got:      ${ks1.toString('hex')}`);
  console.log(`  Match: ${ks1.equals(keystreamBlocks[0])}`);
  
  // HMAC(key, prefix[0:32])[0:12]
  const hmac1 = crypto.createHmac('sha256', keyBuf).update(prefixes[0].subarray(0, 32)).digest();
  const nonce2 = hmac1.subarray(0, 12);
  let iv2 = Buffer.alloc(16);
  nonce2.copy(iv2, 0);
  let cipher2 = crypto.createCipheriv('aes-256-ctr', keyBuf, iv2);
  let ks2 = cipher2.update(Buffer.alloc(16));
  console.log(`\nHMAC(key, prefix[0:32])[0:12] as nonce:`);
  console.log(`  Expected: ${keystreamBlocks[0].toString('hex')}`);
  console.log(`  Got:      ${ks2.toString('hex')}`);
  console.log(`  Match: ${ks2.equals(keystreamBlocks[0])}`);
  
  // Try: prefix[0:12] directly as nonce
  const nonce3 = prefixes[0].subarray(0, 12);
  let iv3 = Buffer.alloc(16);
  nonce3.copy(iv3, 0);
  let cipher3 = crypto.createCipheriv('aes-256-ctr', keyBuf, iv3);
  let ks3 = cipher3.update(Buffer.alloc(16));
  console.log(`\nprefix[0:12] as nonce:`);
  console.log(`  Expected: ${keystreamBlocks[0].toString('hex')}`);
  console.log(`  Got:      ${ks3.toString('hex')}`);
  console.log(`  Match: ${ks3.equals(keystreamBlocks[0])}`);
  
  // Try: Maybe the entire keystream is stored in the prefix (encrypted)
  console.log('\n=== Testing Encrypted Keystream in Prefix ===\n');
  
  // If keystream is AES-ECB encrypted and stored in prefix
  const encrypted0 = Buffer.from(samples[0].encrypted, 'base64');
  const decrypted0 = Buffer.from(samples[0].decrypted);
  const overhead0 = encrypted0.length - decrypted0.length;
  
  // The prefix might contain: [HMAC 32] [encrypted_keystream]
  // encrypted_keystream = AES-ECB(key, keystream)
  // So keystream = AES-ECB-decrypt(key, prefix[32:])
  
  const possibleEncryptedKs = prefixes[0].subarray(32);
  console.log(`Prefix after first 32 bytes: ${possibleEncryptedKs.length} bytes`);
  
  // Decrypt it with AES-ECB
  if (possibleEncryptedKs.length >= 16) {
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    
    // Decrypt first 16 bytes
    const decryptedKs = decipher.update(possibleEncryptedKs.subarray(0, 16));
    console.log(`AES-ECB-decrypt(prefix[32:48]):`);
    console.log(`  Result:   ${decryptedKs.toString('hex')}`);
    console.log(`  Expected: ${keystreamBlocks[0].toString('hex')}`);
    console.log(`  Match: ${decryptedKs.equals(keystreamBlocks[0])}`);
  }
  
  // Try: Maybe the keystream IS the prefix (after some offset)
  console.log('\n=== Testing Keystream = Prefix ===\n');
  
  const fullKeystream = Buffer.alloc(decrypted0.length);
  for (let j = 0; j < decrypted0.length; j++) {
    fullKeystream[j] = encrypted0[overhead0 + j] ^ decrypted0[j];
  }
  
  // Check if keystream matches any part of prefix
  for (let offset = 0; offset <= overhead0 - fullKeystream.length; offset++) {
    const prefixSlice = prefixes[0].subarray(offset, offset + fullKeystream.length);
    if (prefixSlice.equals(fullKeystream)) {
      console.log(`*** Keystream found at prefix offset ${offset}! ***`);
    }
  }
  
  // Check if keystream XOR prefix gives something meaningful
  console.log('\n=== Keystream XOR Prefix Analysis ===\n');
  
  // XOR keystream with prefix starting at various offsets
  for (let offset = 0; offset <= 64; offset += 16) {
    if (offset + 16 > overhead0) break;
    
    const prefixBlock = prefixes[0].subarray(offset, offset + 16);
    const xored = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      xored[j] = keystreamBlocks[0][j] ^ prefixBlock[j];
    }
    
    console.log(`Keystream[0:16] XOR prefix[${offset}:${offset+16}]: ${xored.toString('hex')}`);
    
    // Check if this is a valid AES counter block (decrypt with ECB)
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counterBlock = decipher.update(xored);
    console.log(`  -> AES-ECB-decrypt: ${counterBlock.toString('hex')}`);
  }
}

analyzePrefix().catch(console.error);
