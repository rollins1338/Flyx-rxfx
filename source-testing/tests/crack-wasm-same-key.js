/**
 * Crack WASM - Same Key Multiple Requests
 * 
 * Make multiple requests with the SAME API key and see if:
 * 1. The keystream is the same (would indicate deterministic encryption)
 * 2. The prefix has any constant parts
 * 3. There's any pattern we can exploit
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function testSameKey() {
  console.log('=== Same Key Multiple Requests ===\n');
  
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
  
  // Use a fixed API key for all requests
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Fixed API key: ${testKey}\n`);
  
  const samples = [];
  
  // Make 5 requests with the same key
  for (let i = 0; i < 5; i++) {
    console.log(`Request ${i + 1}...`);
    
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
    
    samples.push(result);
    await new Promise(r => setTimeout(r, 500));
  }
  
  await browser.close();
  
  // Process samples
  const apiKeyBuf = Buffer.from(testKey, 'hex');
  
  for (let i = 0; i < samples.length; i++) {
    const encrypted = Buffer.from(samples[i].encrypted, 'base64');
    const decrypted = Buffer.from(samples[i].decrypted);
    
    const overhead = encrypted.length - decrypted.length;
    const prefix = encrypted.subarray(0, overhead);
    const ciphertext = encrypted.subarray(overhead);
    
    // Derive keystream
    const keystream = Buffer.alloc(decrypted.length);
    for (let j = 0; j < decrypted.length; j++) {
      keystream[j] = ciphertext[j] ^ decrypted[j];
    }
    
    samples[i].prefix = prefix;
    samples[i].ciphertext = ciphertext;
    samples[i].keystream = keystream;
    samples[i].overhead = overhead;
  }
  
  console.log('\n=== Comparing Samples ===\n');
  
  // Check if keystrams are the same
  console.log('Keystream comparison:');
  for (let i = 1; i < samples.length; i++) {
    const same = samples[0].keystream.equals(samples[i].keystream);
    console.log(`  Sample 0 vs ${i}: ${same ? 'SAME' : 'DIFFERENT'}`);
  }
  
  // Check if prefixes are the same
  console.log('\nPrefix comparison:');
  for (let i = 1; i < samples.length; i++) {
    const same = samples[0].prefix.equals(samples[i].prefix);
    console.log(`  Sample 0 vs ${i}: ${same ? 'SAME' : 'DIFFERENT'}`);
  }
  
  // Find common bytes in prefixes
  console.log('\nCommon prefix bytes:');
  for (let pos = 0; pos < samples[0].overhead; pos++) {
    const values = samples.map(s => s.prefix[pos]);
    const allSame = values.every(v => v === values[0]);
    if (allSame) {
      console.log(`  Byte ${pos}: 0x${values[0].toString(16).padStart(2, '0')}`);
    }
  }
  
  // Find common bytes in keystrams
  console.log('\nCommon keystream bytes:');
  for (let pos = 0; pos < samples[0].keystream.length; pos++) {
    const values = samples.map(s => s.keystream[pos]);
    const allSame = values.every(v => v === values[0]);
    if (allSame) {
      console.log(`  Byte ${pos}: 0x${values[0].toString(16).padStart(2, '0')}`);
    }
  }
  
  // Show first 32 bytes of each prefix
  console.log('\nPrefix[0:32] for each sample:');
  for (let i = 0; i < samples.length; i++) {
    console.log(`  ${i}: ${samples[i].prefix.subarray(0, 32).toString('hex')}`);
  }
  
  // Show first 32 bytes of each keystream
  console.log('\nKeystream[0:32] for each sample:');
  for (let i = 0; i < samples.length; i++) {
    console.log(`  ${i}: ${samples[i].keystream.subarray(0, 32).toString('hex')}`);
  }
  
  // XOR analysis - maybe keystream = prefix XOR something
  console.log('\n=== XOR Analysis ===\n');
  
  // Check if keystream[i] = prefix[i] XOR constant
  for (let i = 0; i < samples.length; i++) {
    const xored = Buffer.alloc(Math.min(samples[i].keystream.length, samples[i].prefix.length));
    for (let j = 0; j < xored.length; j++) {
      xored[j] = samples[i].keystream[j] ^ samples[i].prefix[j];
    }
    console.log(`Sample ${i} keystream XOR prefix[0:${xored.length}]: ${xored.subarray(0, 32).toString('hex')}`);
  }
  
  // Check if the XOR results are the same across samples
  const xorResults = samples.map(s => {
    const xored = Buffer.alloc(Math.min(s.keystream.length, s.prefix.length));
    for (let j = 0; j < xored.length; j++) {
      xored[j] = s.keystream[j] ^ s.prefix[j];
    }
    return xored;
  });
  
  console.log('\nXOR result comparison:');
  for (let i = 1; i < xorResults.length; i++) {
    const same = xorResults[0].subarray(0, 32).equals(xorResults[i].subarray(0, 32));
    console.log(`  Sample 0 vs ${i}: ${same ? 'SAME' : 'DIFFERENT'}`);
  }
  
  // If XOR results are the same, we found the pattern!
  const allXorSame = xorResults.every(x => x.subarray(0, 32).equals(xorResults[0].subarray(0, 32)));
  if (allXorSame) {
    console.log('\n*** PATTERN FOUND! ***');
    console.log(`Keystream = Prefix XOR ${xorResults[0].subarray(0, 32).toString('hex')}`);
  }
}

testSameKey().catch(console.error);
