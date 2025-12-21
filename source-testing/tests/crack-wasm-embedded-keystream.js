/**
 * Crack WASM - Embedded Keystream Theory
 * 
 * New theory: The 195-byte prefix might contain the keystream itself,
 * encrypted or transformed in some way.
 * 
 * Structure hypothesis:
 * [nonce (16)] [encrypted_keystream (147)] [HMAC (32)] = 195 bytes
 * 
 * But we need 200 bytes of keystream, so maybe:
 * [nonce (16)] [seed (16)] [padding (?)] [HMAC (32)]
 * And the keystream is generated from the seed.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function testEmbeddedKeystream() {
  console.log('=== Embedded Keystream Theory ===\n');
  
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
  console.log(`Test key: ${testKey}\n`);
  
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
  
  const overhead = encrypted.length - decrypted.length;
  const prefix = encrypted.slice(0, overhead);
  const ciphertext = encrypted.slice(overhead);
  
  // Derive keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  console.log(`Overhead: ${overhead} bytes`);
  console.log(`Keystream: ${keystream.length} bytes`);
  console.log(`Prefix: ${prefix.toString('hex')}\n`);
  
  // Theory 1: Prefix contains encrypted keystream
  // Try decrypting prefix with AES-CTR using key and various IVs
  console.log('=== Theory 1: Encrypted Keystream in Prefix ===\n');
  
  // The prefix is 195 bytes. If we remove 16 bytes for nonce and 32 for HMAC,
  // we have 147 bytes. But keystream is 200 bytes.
  
  // Maybe the structure is different. Let's try:
  // [encrypted_keystream (163)] [HMAC (32)] = 195 bytes
  // And the IV is derived from the key
  
  const possibleStructures = [
    { name: 'IV from key, encrypted KS', ivSource: 'key', encStart: 0, encEnd: 163, hmacStart: 163 },
    { name: '16-byte IV, encrypted KS', ivSource: 'prefix', ivStart: 0, encStart: 16, encEnd: 163, hmacStart: 163 },
    { name: '12-byte IV, encrypted KS', ivSource: 'prefix', ivStart: 0, encStart: 12, encEnd: 163, hmacStart: 163 },
  ];
  
  for (const struct of possibleStructures) {
    console.log(`Testing: ${struct.name}`);
    
    let iv;
    if (struct.ivSource === 'key') {
      iv = crypto.createHash('sha256').update(keyBuf).digest().slice(0, 16);
    } else {
      iv = prefix.slice(struct.ivStart, struct.ivStart + 16);
    }
    
    const encryptedKS = prefix.slice(struct.encStart, struct.encEnd);
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-ctr', keyBuf, iv);
      const decryptedKS = decipher.update(encryptedKS);
      
      // Check if decrypted matches keystream
      if (decryptedKS.slice(0, 16).equals(keystream.slice(0, 16))) {
        console.log(`  *** MATCH! ***`);
      } else {
        console.log(`  No match. Decrypted: ${decryptedKS.slice(0, 16).toString('hex')}`);
        console.log(`  Expected:  ${keystream.slice(0, 16).toString('hex')}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Theory 2: Keystream is generated from a seed in the prefix
  console.log('\n=== Theory 2: Seed-based Keystream Generation ===\n');
  
  // Try using different parts of prefix as seed for PRNG
  for (let seedStart = 0; seedStart <= overhead - 32; seedStart += 16) {
    const seed = prefix.slice(seedStart, seedStart + 32);
    
    // Try SHA256 expansion
    let expanded = Buffer.alloc(0);
    let state = crypto.createHmac('sha256', keyBuf).update(seed).digest();
    
    while (expanded.length < keystream.length) {
      expanded = Buffer.concat([expanded, state]);
      state = crypto.createHmac('sha256', keyBuf).update(state).digest();
    }
    
    expanded = expanded.slice(0, keystream.length);
    
    if (expanded.slice(0, 16).equals(keystream.slice(0, 16))) {
      console.log(`*** FOUND! Seed at prefix[${seedStart}:${seedStart+32}] ***`);
    }
  }
  
  // Theory 3: The entire prefix is the keystream seed
  console.log('\n=== Theory 3: Full Prefix as Seed ===\n');
  
  // Try HKDF with full prefix as salt
  const hkdfExpanded = hkdf(keyBuf, prefix, Buffer.from(''), keystream.length);
  
  if (hkdfExpanded.slice(0, 16).equals(keystream.slice(0, 16))) {
    console.log('*** FOUND! HKDF(key, prefix, "") ***');
  } else {
    console.log(`HKDF result: ${hkdfExpanded.slice(0, 16).toString('hex')}`);
    console.log(`Expected:    ${keystream.slice(0, 16).toString('hex')}`);
  }
  
  // Theory 4: XOR-based keystream
  console.log('\n=== Theory 4: XOR-based Keystream ===\n');
  
  // Maybe keystream = prefix[A:B] XOR AES(key, prefix[C:D])
  for (let aStart = 0; aStart <= overhead - keystream.length; aStart++) {
    const prefixPart = prefix.slice(aStart, aStart + keystream.length);
    
    // XOR with repeated key
    const xored = Buffer.alloc(keystream.length);
    for (let i = 0; i < keystream.length; i++) {
      xored[i] = prefixPart[i] ^ keyBuf[i % 32];
    }
    
    if (xored.slice(0, 16).equals(keystream.slice(0, 16))) {
      console.log(`*** FOUND! Keystream = prefix[${aStart}:] XOR key ***`);
    }
  }
  
  // Theory 5: The keystream blocks are in the prefix, just reordered
  console.log('\n=== Theory 5: Reordered Keystream Blocks ===\n');
  
  // Extract 16-byte blocks from prefix
  const prefixBlocks = [];
  for (let i = 0; i <= overhead - 16; i += 16) {
    prefixBlocks.push(prefix.slice(i, i + 16));
  }
  
  // Check if any prefix block matches any keystream block
  const keystreamBlocks = [];
  for (let i = 0; i < keystream.length; i += 16) {
    keystreamBlocks.push(keystream.slice(i, Math.min(i + 16, keystream.length)));
  }
  
  for (let i = 0; i < keystreamBlocks.length; i++) {
    const ksBlock = keystreamBlocks[i];
    if (ksBlock.length < 16) continue;
    
    for (let j = 0; j < prefixBlocks.length; j++) {
      if (prefixBlocks[j].equals(ksBlock)) {
        console.log(`Keystream block ${i} = Prefix block ${j}`);
      }
      
      // Also check XOR with key
      const xored = Buffer.alloc(16);
      for (let k = 0; k < 16; k++) {
        xored[k] = prefixBlocks[j][k] ^ keyBuf[k];
      }
      if (xored.equals(ksBlock)) {
        console.log(`Keystream block ${i} = Prefix block ${j} XOR key[0:16]`);
      }
    }
  }
  
  console.log('\nNo embedded keystream pattern found.');
}

// HKDF implementation
function hkdf(ikm, salt, info, length) {
  const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
  
  const n = Math.ceil(length / 32);
  let okm = Buffer.alloc(0);
  let t = Buffer.alloc(0);
  
  for (let i = 1; i <= n; i++) {
    t = crypto.createHmac('sha256', prk)
      .update(Buffer.concat([t, info, Buffer.from([i])]))
      .digest();
    okm = Buffer.concat([okm, t]);
  }
  
  return okm.slice(0, length);
}

testEmbeddedKeystream().catch(console.error);
