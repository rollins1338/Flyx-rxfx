/**
 * Crack WASM PRNG - V7
 * 
 * 195 bytes overhead is very unusual. Let's think about what could cause this:
 * 
 * 1. The plaintext might be compressed before encryption
 * 2. There might be additional metadata in the encrypted response
 * 3. The encryption might use a block cipher with padding
 * 
 * Let's analyze the exact relationship between encrypted and decrypted data.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const zlib = require('zlib');

puppeteer.use(StealthPlugin());

async function deepAnalysis() {
  console.log('=== Deep Analysis of Encryption ===\n');
  
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
  console.log(`Using key: ${testKey}\n`);
  
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
  
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  console.log(`Decrypted text: ${result.decrypted}`);
  
  // Check if the decrypted text could be compressed to fit
  console.log('\n=== Compression Analysis ===\n');
  
  const compressed = zlib.deflateSync(decrypted);
  console.log(`Compressed (deflate): ${compressed.length} bytes`);
  
  const gzipped = zlib.gzipSync(decrypted);
  console.log(`Compressed (gzip): ${gzipped.length} bytes`);
  
  // The encrypted data is LARGER than the plaintext, so compression isn't the answer
  // The overhead must be metadata
  
  console.log('\n=== Analyzing Overhead ===\n');
  
  // 195 bytes overhead could be:
  // - 16 byte nonce + 179 bytes of something else
  // - Multiple fields
  
  // Let's look at the structure more carefully
  // Maybe the response contains multiple parts separated by a delimiter
  
  // Check for common delimiters
  const delimiters = [0x00, 0x0a, 0x0d, 0x7c, 0x3a]; // null, newline, CR, |, :
  
  for (const delim of delimiters) {
    const parts = [];
    let start = 0;
    for (let i = 0; i < encrypted.length; i++) {
      if (encrypted[i] === delim) {
        parts.push(encrypted.subarray(start, i));
        start = i + 1;
      }
    }
    parts.push(encrypted.subarray(start));
    
    if (parts.length > 1 && parts.length < 10) {
      console.log(`Delimiter 0x${delim.toString(16)}: ${parts.length} parts`);
      parts.forEach((p, i) => console.log(`  Part ${i}: ${p.length} bytes`));
    }
  }
  
  // Let's try to find where the actual ciphertext starts
  // by XORing with known plaintext at different offsets
  
  console.log('\n=== Finding Ciphertext Offset ===\n');
  
  const knownPlaintext = '{"sources":[{"server":"';
  const knownBuf = Buffer.from(knownPlaintext);
  
  for (let offset = 0; offset <= encrypted.length - knownBuf.length; offset++) {
    // XOR encrypted[offset:] with known plaintext
    const xored = Buffer.alloc(knownBuf.length);
    for (let i = 0; i < knownBuf.length; i++) {
      xored[i] = encrypted[offset + i] ^ knownBuf[i];
    }
    
    // Check if the XOR result looks like a valid AES keystream
    // (i.e., high entropy, no obvious patterns)
    
    // Also check if the XOR result, when decrypted with AES-ECB,
    // gives us a counter block that appears in the prefix
    
    if (xored.length >= 16) {
      const keystreamBlock = xored.subarray(0, 16);
      
      try {
        const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
        decipher.setAutoPadding(false);
        const counterBlock = decipher.update(keystreamBlock);
        
        // Check if counter block appears in prefix
        const prefix = encrypted.subarray(0, offset);
        const counterHex = counterBlock.toString('hex');
        
        // Check exact match
        for (let i = 0; i <= prefix.length - 16; i++) {
          if (prefix.subarray(i, i + 16).equals(counterBlock)) {
            console.log(`*** FOUND: Counter block at offset ${offset} matches prefix at ${i}! ***`);
            console.log(`  Counter: ${counterHex}`);
          }
        }
        
        // Check if counter is derived from prefix
        if (offset >= 16) {
          const prefixPart = prefix.subarray(offset - 16, offset);
          if (prefixPart.equals(counterBlock)) {
            console.log(`*** FOUND: Counter = prefix[${offset-16}:${offset}] at offset ${offset}! ***`);
          }
        }
      } catch (e) {}
    }
  }
  
  // Let's also try to understand the structure by looking at entropy
  console.log('\n=== Entropy Analysis ===\n');
  
  // Calculate entropy of different parts
  function entropy(buf) {
    const freq = new Array(256).fill(0);
    for (const b of buf) freq[b]++;
    let h = 0;
    for (const f of freq) {
      if (f > 0) {
        const p = f / buf.length;
        h -= p * Math.log2(p);
      }
    }
    return h;
  }
  
  // Split into chunks and analyze entropy
  const chunkSize = 32;
  for (let i = 0; i < encrypted.length; i += chunkSize) {
    const chunk = encrypted.subarray(i, Math.min(i + chunkSize, encrypted.length));
    const h = entropy(chunk);
    console.log(`Bytes ${i}-${i + chunk.length}: entropy = ${h.toFixed(2)} bits`);
  }
  
  // High entropy throughout suggests the entire response is encrypted
  // Low entropy at the start/end might indicate metadata
}

deepAnalysis().catch(console.error);
