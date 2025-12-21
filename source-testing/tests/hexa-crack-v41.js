/**
 * Crack Hexa Encryption v41 - Download and analyze flixer.su scripts
 */

const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');

async function downloadAndAnalyze() {
  console.log('=== Downloading Flixer.su Scripts ===\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const scripts = new Map();
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.endsWith('.js') || url.includes('.js?')) {
      try {
        const content = await response.text();
        const filename = url.split('/').pop().split('?')[0];
        scripts.set(filename, { url, content });
      } catch (e) {}
    }
  });
  
  try {
    await page.goto('https://flixer.su/', { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    console.log('Timeout, continuing...');
  }
  
  await browser.close();
  
  // Find the main bundle with crypto code
  for (const [filename, { content }] of scripts) {
    if (content.includes('encrypt') && content.includes('nonce')) {
      console.log(`\nAnalyzing ${filename}...`);
      
      // Search for crypto-related patterns
      const patterns = [
        /function\s+\w*[eE]ncrypt\w*\s*\([^)]*\)\s*\{[^}]{0,500}\}/g,
        /function\s+\w*[dD]ecrypt\w*\s*\([^)]*\)\s*\{[^}]{0,500}\}/g,
        /\w+\s*=\s*new\s+Uint8Array\([^)]+\)/g,
        /chacha|salsa|aes|cipher/gi,
        /nonce\s*[=:]/gi,
        /keystream/gi,
      ];
      
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          console.log(`\nPattern ${pattern.source}:`);
          for (const match of matches.slice(0, 3)) {
            console.log(`  ${match.slice(0, 150)}...`);
          }
        }
      }
      
      // Look for XOR operations in context
      const xorMatches = [];
      const xorRegex = /\^/g;
      let match;
      while ((match = xorRegex.exec(content)) !== null) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(content.length, match.index + 50);
        const context = content.slice(start, end).replace(/\s+/g, ' ');
        if (context.includes('Uint8Array') || context.includes('buffer') || context.includes('[')) {
          xorMatches.push(context);
        }
      }
      
      if (xorMatches.length > 0) {
        console.log(`\nXOR operations with arrays (${xorMatches.length} found):`);
        for (const ctx of xorMatches.slice(0, 5)) {
          console.log(`  ${ctx}`);
        }
      }
    }
  }
  
  // Now let's try a different approach - test if the encryption might be using
  // a simple counter-mode with a custom block function
  console.log('\n\n=== Testing Custom Counter Mode ===\n');
  await testCustomCounterMode();
}

async function testCustomCounterMode() {
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const keyBuf = Buffer.from(key, 'hex');
  
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
  console.log('Keystream[0:64]:', keystream.subarray(0, 64).toString('hex'));
  
  // Check if keystream blocks are related to AES encryption of counter
  console.log('\n--- Checking AES-ECB of counter blocks ---');
  
  const keyVariants = [
    { name: 'keyBuf', key: keyBuf },
    { name: 'sha256(keyBuf)', key: crypto.createHash('sha256').update(keyBuf).digest() },
    { name: 'sha256(key)', key: crypto.createHash('sha256').update(key).digest() },
  ];
  
  for (const { name: keyName, key: derivedKey } of keyVariants) {
    // Generate counter blocks and encrypt with AES-ECB
    const testKeystream = Buffer.alloc(keystream.length);
    
    for (let block = 0; block * 16 < keystream.length; block++) {
      // Try different counter constructions
      const counterBlocks = [
        // nonce || counter (big-endian)
        (() => {
          const b = Buffer.alloc(16);
          nonce.copy(b, 0);
          b.writeUInt32BE(block, 12);
          return b;
        })(),
        // nonce || counter (little-endian)
        (() => {
          const b = Buffer.alloc(16);
          nonce.copy(b, 0);
          b.writeUInt32LE(block, 12);
          return b;
        })(),
        // counter || nonce
        (() => {
          const b = Buffer.alloc(16);
          b.writeUInt32BE(block, 0);
          nonce.copy(b, 4);
          return b;
        })(),
      ];
      
      for (const counterBlock of counterBlocks) {
        try {
          const cipher = crypto.createCipheriv('aes-256-ecb', derivedKey, null);
          cipher.setAutoPadding(false);
          const encBlock = cipher.update(counterBlock);
          
          const offset = block * 16;
          const toCopy = Math.min(16, keystream.length - offset);
          
          if (encBlock.subarray(0, toCopy).equals(keystream.subarray(offset, offset + toCopy))) {
            if (block === 0) {
              console.log(`First block matches! Testing full keystream...`);
              // Generate full keystream
              let fullMatch = true;
              for (let b = 0; b * 16 < keystream.length && fullMatch; b++) {
                const cb = Buffer.alloc(16);
                if (counterBlocks === counterBlocks[0]) {
                  nonce.copy(cb, 0);
                  cb.writeUInt32BE(b, 12);
                }
                const c = crypto.createCipheriv('aes-256-ecb', derivedKey, null);
                c.setAutoPadding(false);
                const eb = c.update(cb);
                const off = b * 16;
                const tc = Math.min(16, keystream.length - off);
                if (!eb.subarray(0, tc).equals(keystream.subarray(off, off + tc))) {
                  fullMatch = false;
                }
              }
              if (fullMatch) {
                console.log(`*** FULL MATCH: AES-ECB counter mode + ${keyName} ***`);
                return;
              }
            }
          }
        } catch (e) {}
      }
    }
  }
  console.log('AES-ECB counter: No match');
  
  // Test if it's using a different nonce interpretation
  console.log('\n--- Testing Different Nonce Interpretations ---');
  
  // What if the 12-byte "nonce" is actually something else?
  // Like: 8-byte nonce + 4-byte counter
  const nonce8 = nonce.subarray(0, 8);
  const counter4 = nonce.subarray(8, 12);
  console.log('Nonce8:', nonce8.toString('hex'));
  console.log('Counter4:', counter4.toString('hex'));
  console.log('Counter4 as LE:', counter4.readUInt32LE(0));
  console.log('Counter4 as BE:', counter4.readUInt32BE(0));
  
  // Test ChaCha20 with 8-byte nonce (original ChaCha20, not IETF)
  console.log('\n--- Testing Original ChaCha20 (8-byte nonce) ---');
  
  try {
    const { salsa20 } = await import('@noble/ciphers/salsa.js');
    
    for (const { name: keyName, key: derivedKey } of keyVariants) {
      try {
        const cipher = salsa20(new Uint8Array(derivedKey), new Uint8Array(nonce8));
        const zeros = new Uint8Array(keystream.length);
        const testKs = cipher.encrypt(zeros);
        
        if (Buffer.from(testKs.subarray(0, 32)).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: Salsa20 (8-byte nonce) + ${keyName} ***`);
          return;
        }
      } catch (e) {}
    }
    console.log('Salsa20 (8-byte): No match');
  } catch (e) {
    console.log('Noble ciphers not available');
  }
  
  console.log('\nNo match found.');
}

downloadAndAnalyze().catch(console.error);
