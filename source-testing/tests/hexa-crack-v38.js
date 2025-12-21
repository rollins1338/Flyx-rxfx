/**
 * Crack Hexa Encryption v38 - Analyze enc-dec.app frontend
 * 
 * Try to find clues from the enc-dec.app website's JavaScript
 */

const puppeteer = require('puppeteer');
const crypto = require('crypto');

async function analyzeEncDecApp() {
  console.log('=== Analyzing enc-dec.app Frontend ===\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Intercept all JavaScript files
  const jsFiles = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.endsWith('.js') || url.includes('.js?')) {
      try {
        const content = await response.text();
        jsFiles.push({ url, content });
      } catch (e) {}
    }
  });
  
  await page.goto('https://enc-dec.app/', { waitUntil: 'networkidle2' });
  
  console.log(`Found ${jsFiles.length} JavaScript files\n`);
  
  // Search for encryption-related keywords
  const keywords = [
    'chacha', 'salsa', 'aes', 'cipher', 'encrypt', 'decrypt',
    'nonce', 'iv', 'key', 'hexa', 'flixer', 'xor', 'stream',
    'crypto', 'nacl', 'sodium', 'secretbox', 'poly1305'
  ];
  
  for (const { url, content } of jsFiles) {
    const filename = url.split('/').pop().split('?')[0];
    const matches = [];
    
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const found = content.match(regex);
      if (found) {
        matches.push(`${keyword}: ${found.length}`);
      }
    }
    
    if (matches.length > 0) {
      console.log(`${filename}:`);
      console.log(`  ${matches.join(', ')}`);
      
      // Look for function definitions related to hexa
      const hexaFunctions = content.match(/function\s+\w*[hH]exa\w*|[hH]exa\w*\s*[:=]\s*function|\w*[hH]exa\w*\s*\(/g);
      if (hexaFunctions) {
        console.log(`  Hexa functions: ${hexaFunctions.slice(0, 5).join(', ')}`);
      }
      
      // Look for API routes
      const apiRoutes = content.match(/['"`]\/api\/[^'"`]+['"`]/g);
      if (apiRoutes) {
        console.log(`  API routes: ${[...new Set(apiRoutes)].join(', ')}`);
      }
    }
  }
  
  // Try to find the decryption logic
  console.log('\n=== Searching for Decryption Logic ===\n');
  
  for (const { url, content } of jsFiles) {
    // Look for base64 decode + XOR patterns
    if (content.includes('atob') || content.includes('base64') || content.includes('fromCharCode')) {
      const filename = url.split('/').pop().split('?')[0];
      
      // Extract relevant code snippets
      const snippets = [];
      
      // Look for decrypt function
      const decryptMatch = content.match(/decrypt[^{]*\{[^}]{0,500}\}/gi);
      if (decryptMatch) {
        snippets.push(...decryptMatch.slice(0, 2));
      }
      
      // Look for XOR operations
      const xorMatch = content.match(/\^[^;]{0,100}/g);
      if (xorMatch && xorMatch.length > 0) {
        snippets.push(`XOR ops: ${xorMatch.length}`);
      }
      
      if (snippets.length > 0) {
        console.log(`${filename}:`);
        for (const s of snippets.slice(0, 3)) {
          console.log(`  ${s.slice(0, 200)}...`);
        }
      }
    }
  }
  
  await browser.close();
  
  // Now test the actual API with different approaches
  console.log('\n=== Testing API Behavior ===\n');
  await testApiBehavior();
}

async function testApiBehavior() {
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  // Get encrypted data
  const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  const encBytes = Buffer.from(encrypted, 'base64');
  const nonce = encBytes.subarray(0, 12);
  const ciphertext = encBytes.subarray(12);
  
  console.log('Encrypted length:', encBytes.length);
  console.log('Nonce:', nonce.toString('hex'));
  
  // Test: What happens if we send wrong key to enc-dec.app?
  console.log('\n--- Testing with wrong key ---');
  const wrongKey = crypto.randomBytes(32).toString('hex');
  const wrongDecResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key: wrongKey }),
  });
  const wrongResult = await wrongDecResponse.json();
  console.log('Wrong key result:', JSON.stringify(wrongResult).slice(0, 200));
  
  // Test: What happens if we modify the nonce?
  console.log('\n--- Testing with modified nonce ---');
  const modifiedNonce = Buffer.from(nonce);
  modifiedNonce[0] ^= 0xff; // Flip first byte
  const modifiedEnc = Buffer.concat([modifiedNonce, ciphertext]);
  const modifiedEncB64 = modifiedEnc.toString('base64');
  
  const modifiedDecResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: modifiedEncB64, key }),
  });
  const modifiedResult = await modifiedDecResponse.json();
  console.log('Modified nonce result:', JSON.stringify(modifiedResult).slice(0, 200));
  
  // Get correct decryption for comparison
  const correctDecResponse = await fetch('https://enc-dec.app/api/dec-hexa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, key }),
  });
  const correctResult = await correctDecResponse.json();
  console.log('\nCorrect result:', JSON.stringify(correctResult).slice(0, 200));
  
  // Analyze the keystream
  const expectedStr = JSON.stringify(correctResult.result);
  const expectedBytes = Buffer.from(expectedStr, 'utf8');
  
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('\nKeystream analysis:');
  console.log('First 64 bytes:', keystream.subarray(0, 64).toString('hex'));
  
  // Check if keystream has any obvious patterns
  const blocks = [];
  for (let i = 0; i < Math.min(keystream.length, 256); i += 32) {
    blocks.push(keystream.subarray(i, i + 32).toString('hex'));
  }
  console.log('\n32-byte blocks:');
  blocks.forEach((b, i) => console.log(`  Block ${i}: ${b}`));
}

analyzeEncDecApp().catch(console.error);
