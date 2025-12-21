/**
 * Crack Hexa Encryption v40 - Analyze flixer.su client code
 * 
 * The hexa.su API is used by flixer.su, so let's analyze their client code
 */

const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');

async function analyzeFlixerClient() {
  console.log('=== Analyzing Flixer.su Client Code ===\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  
  // Collect all scripts
  const scripts = [];
  
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    
    if (url.endsWith('.js') || contentType.includes('javascript')) {
      try {
        const content = await response.text();
        scripts.push({ url, content, size: content.length });
      } catch (e) {}
    }
  });
  
  // Also intercept inline scripts
  await page.setRequestInterception(true);
  page.on('request', request => request.continue());
  
  try {
    await page.goto('https://flixer.su/', { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    console.log('Page load timeout, continuing with collected scripts...');
  }
  
  console.log(`Collected ${scripts.length} scripts\n`);
  
  // Search for encryption-related code
  const searchTerms = [
    'decrypt', 'encrypt', 'cipher', 'chacha', 'salsa', 'aes',
    'nonce', 'iv', 'keystream', 'xor', 'hexa', 'themoviedb',
    'X-Api-Key', 'api-key', 'secretbox', 'nacl', 'sodium',
    'base64', 'atob', 'btoa', 'fromCharCode', 'charCodeAt'
  ];
  
  for (const { url, content, size } of scripts) {
    const filename = url.split('/').pop().split('?')[0] || 'inline';
    const matches = [];
    
    for (const term of searchTerms) {
      const regex = new RegExp(term, 'gi');
      const found = content.match(regex);
      if (found) {
        matches.push(`${term}:${found.length}`);
      }
    }
    
    if (matches.length > 3) {
      console.log(`\n${filename} (${size} bytes):`);
      console.log(`  Matches: ${matches.join(', ')}`);
      
      // Extract relevant code snippets
      if (content.includes('decrypt') || content.includes('cipher')) {
        // Find decrypt function context
        const decryptIdx = content.indexOf('decrypt');
        if (decryptIdx !== -1) {
          const snippet = content.slice(Math.max(0, decryptIdx - 100), decryptIdx + 300);
          console.log(`  Decrypt context: ...${snippet.replace(/\s+/g, ' ').slice(0, 200)}...`);
        }
      }
      
      // Look for hexa-related code
      if (content.toLowerCase().includes('hexa')) {
        const hexaIdx = content.toLowerCase().indexOf('hexa');
        const snippet = content.slice(Math.max(0, hexaIdx - 50), hexaIdx + 200);
        console.log(`  Hexa context: ...${snippet.replace(/\s+/g, ' ').slice(0, 200)}...`);
      }
    }
  }
  
  // Get page HTML and look for inline scripts
  const html = await page.content();
  const inlineScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  console.log(`\nFound ${inlineScripts.length} inline scripts`);
  
  for (const script of inlineScripts) {
    if (script.includes('decrypt') || script.includes('cipher') || script.includes('hexa')) {
      console.log('\nRelevant inline script found:');
      console.log(script.slice(0, 500));
    }
  }
  
  await browser.close();
  
  // Now let's try some more exotic approaches
  console.log('\n\n=== Testing More Exotic Approaches ===\n');
  await testExoticApproaches();
}

async function testExoticApproaches() {
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const keyBuf = Buffer.from(key, 'hex');
  const keyStr = Buffer.from(key, 'utf8');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  const decResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  const decResult = await decResponse.json();
  const expectedStr = JSON.stringify(decResult.result);
  
  const encBytes = Buffer.from(encrypted, 'base64');
  const expectedBytes = Buffer.from(expectedStr, 'utf8');
  
  const nonce = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  // Test: Maybe the key is used differently
  // What if the 64-char hex key is split into two 32-char parts?
  console.log('\n=== Testing Split Key ===');
  const keyPart1 = Buffer.from(key.slice(0, 32), 'hex'); // First 16 bytes
  const keyPart2 = Buffer.from(key.slice(32), 'hex'); // Last 16 bytes
  
  // XOR the two parts
  const keyXored = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    keyXored[i] = keyPart1[i] ^ keyPart2[i];
  }
  
  // Expand to 32 bytes
  const keyExpanded = Buffer.concat([keyXored, keyXored]);
  
  const ivVariants = [
    { name: 'nonce||0000', iv: Buffer.concat([nonce, Buffer.alloc(4)]) },
    { name: '0000||nonce', iv: Buffer.concat([Buffer.alloc(4), nonce]) },
  ];
  
  for (const { name: ivName, iv } of ivVariants) {
    try {
      const cipher = crypto.createCipheriv('aes-256-ctr', keyExpanded, iv);
      const testKs = cipher.update(Buffer.alloc(keystream.length));
      
      if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
        console.log(`*** MATCH: Split key XOR + AES-CTR + ${ivName} ***`);
        return;
      }
    } catch (e) {}
  }
  console.log('Split key: No match');
  
  // Test: What if nonce is used as part of the key?
  console.log('\n=== Testing Nonce in Key ===');
  
  // Replace part of key with nonce
  const keyWithNonce1 = Buffer.concat([nonce, keyBuf.subarray(12)]);
  const keyWithNonce2 = Buffer.concat([keyBuf.subarray(0, 20), nonce]);
  
  for (const derivedKey of [keyWithNonce1, keyWithNonce2]) {
    for (const { name: ivName, iv } of ivVariants) {
      try {
        const cipher = crypto.createCipheriv('aes-256-ctr', derivedKey, iv);
        const testKs = cipher.update(Buffer.alloc(keystream.length));
        
        if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: Nonce in key + AES-CTR + ${ivName} ***`);
          return;
        }
      } catch (e) {}
    }
  }
  console.log('Nonce in key: No match');
  
  // Test: Blake2b key derivation
  console.log('\n=== Testing Blake2b ===');
  try {
    const { blake2b } = await import('@noble/hashes/blake2b');
    
    const blake2Keys = [
      { name: 'blake2b(keyBuf)', key: blake2b(keyBuf, { dkLen: 32 }) },
      { name: 'blake2b(keyStr)', key: blake2b(keyStr, { dkLen: 32 }) },
      { name: 'blake2b(key||nonce)', key: blake2b(Buffer.concat([keyBuf, nonce]), { dkLen: 32 }) },
      { name: 'blake2b(nonce||key)', key: blake2b(Buffer.concat([nonce, keyBuf]), { dkLen: 32 }) },
    ];
    
    for (const { name: keyName, key: derivedKey } of blake2Keys) {
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.from(derivedKey), iv);
          const testKs = cipher.update(Buffer.alloc(keystream.length));
          
          if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ${keyName} + AES-CTR + ${ivName} ***`);
            return;
          }
        } catch (e) {}
      }
    }
    console.log('Blake2b: No match');
  } catch (e) {
    console.log('Blake2b not available');
  }
  
  // Test: SHA3 key derivation
  console.log('\n=== Testing SHA3 ===');
  try {
    const { sha3_256 } = await import('@noble/hashes/sha3');
    
    const sha3Keys = [
      { name: 'sha3(keyBuf)', key: sha3_256(keyBuf) },
      { name: 'sha3(keyStr)', key: sha3_256(keyStr) },
      { name: 'sha3(key||nonce)', key: sha3_256(Buffer.concat([keyBuf, nonce])) },
    ];
    
    for (const { name: keyName, key: derivedKey } of sha3Keys) {
      for (const { name: ivName, iv } of ivVariants) {
        try {
          const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.from(derivedKey), iv);
          const testKs = cipher.update(Buffer.alloc(keystream.length));
          
          if (testKs.subarray(0, 32).equals(keystream.subarray(0, 32))) {
            console.log(`*** MATCH: ${keyName} + AES-CTR + ${ivName} ***`);
            return;
          }
        } catch (e) {}
      }
    }
    console.log('SHA3: No match');
  } catch (e) {
    console.log('SHA3 not available');
  }
  
  console.log('\nNo match found.');
}

analyzeFlixerClient().catch(console.error);
