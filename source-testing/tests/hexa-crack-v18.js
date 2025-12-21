/**
 * Crack Hexa Encryption v18 - Fetch and analyze enc-dec.app
 */

const crypto = require('crypto');

async function analyzeEncDecApp() {
  console.log('=== Analyzing enc-dec.app ===\n');
  
  // Fetch the main page
  const response = await fetch('https://enc-dec.app/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  
  const html = await response.text();
  console.log('Page length:', html.length);
  
  // Look for script tags
  const scriptMatches = html.match(/<script[^>]*src="([^"]+)"[^>]*>/g) || [];
  console.log('\nScript tags found:', scriptMatches.length);
  scriptMatches.forEach(s => console.log('  ', s));
  
  // Look for inline scripts
  const inlineScripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
  console.log('\nInline scripts:', inlineScripts.length);
  
  // Extract JS file URLs
  const jsUrls = [];
  for (const match of scriptMatches) {
    const srcMatch = match.match(/src="([^"]+)"/);
    if (srcMatch) {
      let url = srcMatch[1];
      if (url.startsWith('/')) {
        url = 'https://enc-dec.app' + url;
      } else if (!url.startsWith('http')) {
        url = 'https://enc-dec.app/' + url;
      }
      jsUrls.push(url);
    }
  }
  
  console.log('\nJS URLs to fetch:');
  jsUrls.forEach(u => console.log('  ', u));
  
  // Fetch each JS file and look for crypto-related code
  for (const url of jsUrls.slice(0, 5)) { // Limit to first 5
    try {
      console.log(`\n--- Fetching ${url} ---`);
      const jsResponse = await fetch(url);
      const js = await jsResponse.text();
      console.log('Length:', js.length);
      
      // Look for crypto-related keywords
      const keywords = ['decrypt', 'encrypt', 'chacha', 'aes', 'secretbox', 'sodium', 'nacl', 'crypto', 'hexa'];
      for (const kw of keywords) {
        const regex = new RegExp(kw, 'gi');
        const matches = js.match(regex);
        if (matches && matches.length > 0) {
          console.log(`  Found "${kw}": ${matches.length} times`);
          
          // Find context around the keyword
          const idx = js.toLowerCase().indexOf(kw.toLowerCase());
          if (idx !== -1) {
            const context = js.substring(Math.max(0, idx - 50), Math.min(js.length, idx + 100));
            console.log(`    Context: ...${context.replace(/\n/g, ' ').slice(0, 100)}...`);
          }
        }
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

async function crackHexa() {
  console.log('=== Cracking Hexa Encryption v18 ===\n');
  
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  // Verify with enc-dec.app
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
  
  // Extract keystream
  const keystream = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    keystream[i] = ciphertext[i] ^ expectedBytes[i];
  }
  
  console.log('Nonce:', nonce.toString('hex'));
  console.log('Keystream[0:32]:', keystream.subarray(0, 32).toString('hex'));
  
  const keyBuf = Buffer.from(key, 'hex');
  
  // Try ChaCha20 with the exact Node.js format
  console.log('\n=== ChaCha20 with Node.js format ===');
  
  // Node's chacha20 expects 16-byte IV: 4-byte counter (LE) + 12-byte nonce
  const ivFormats = [
    { name: 'counter(0)+nonce', iv: Buffer.concat([Buffer.from([0,0,0,0]), nonce]) },
    { name: 'counter(1)+nonce', iv: Buffer.concat([Buffer.from([1,0,0,0]), nonce]) },
    { name: 'nonce+counter(0)', iv: Buffer.concat([nonce, Buffer.from([0,0,0,0])]) },
    { name: 'nonce+counter(1)', iv: Buffer.concat([nonce, Buffer.from([1,0,0,0])]) },
  ];
  
  const keyFormats = [
    { name: 'raw', key: keyBuf },
    { name: 'sha256(str)', key: crypto.createHash('sha256').update(key).digest() },
    { name: 'sha256(bytes)', key: crypto.createHash('sha256').update(keyBuf).digest() },
  ];
  
  for (const { name: ivName, iv } of ivFormats) {
    for (const { name: keyName, key: derivedKey } of keyFormats) {
      try {
        const cipher = crypto.createCipheriv('chacha20', derivedKey, iv);
        const testKeystream = cipher.update(Buffer.alloc(ciphertext.length));
        
        if (testKeystream.subarray(0, 32).equals(keystream.subarray(0, 32))) {
          console.log(`*** MATCH: chacha20 + ${keyName} + ${ivName} ***`);
          
          const decrypted = Buffer.alloc(ciphertext.length);
          for (let i = 0; i < ciphertext.length; i++) {
            decrypted[i] = ciphertext[i] ^ testKeystream[i];
          }
          console.log('Decrypted:', decrypted.toString('utf8').slice(0, 200));
          return;
        }
      } catch (e) {
        // console.log(`${keyName} + ${ivName}: ${e.message}`);
      }
    }
  }
  
  console.log('No ChaCha20 match.');
  
  // Analyze enc-dec.app
  await analyzeEncDecApp();
}

crackHexa().catch(console.error);
