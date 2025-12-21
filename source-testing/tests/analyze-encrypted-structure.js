/**
 * Analyze Encrypted Response Structure
 * 
 * The server and client must agree on the counter blocks.
 * Since Math.random() isn't used during decryption, the nonce must be:
 * 1. Embedded in the encrypted response (prefix or suffix)
 * 2. Derived deterministically from the API key
 * 
 * Let's analyze the structure of the encrypted response.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeEncryptedStructure() {
  console.log('=== Analyzing Encrypted Response Structure ===\n');
  
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
  
  // Capture multiple encrypted responses with the SAME key
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Using key: ${testKey}\n`);
  
  const responses = [];
  
  for (let i = 0; i < 3; i++) {
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
      
      // Decrypt
      const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
      
      return {
        encrypted: encryptedData,
        decrypted: JSON.stringify(decrypted),
      };
    }, testKey);
    
    responses.push(result);
    console.log(`Response ${i + 1}: ${result.encrypted.substring(0, 40)}...`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  await browser.close();
  
  // Analyze the responses
  console.log('\n=== Analyzing Response Structure ===\n');
  
  const keyBuf = Buffer.from(testKey, 'hex');
  
  for (let i = 0; i < responses.length; i++) {
    const encrypted = Buffer.from(responses[i].encrypted, 'base64');
    const decrypted = Buffer.from(responses[i].decrypted);
    
    console.log(`Response ${i + 1}:`);
    console.log(`  Encrypted length: ${encrypted.length} bytes`);
    console.log(`  Decrypted length: ${decrypted.length} bytes`);
    console.log(`  Difference: ${encrypted.length - decrypted.length} bytes`);
    
    // Check if there's a prefix (IV/nonce)
    console.log(`  First 32 bytes (hex): ${encrypted.subarray(0, 32).toString('hex')}`);
    console.log(`  Last 32 bytes (hex): ${encrypted.subarray(-32).toString('hex')}`);
    
    // Derive keystream from known plaintext
    const keystream = Buffer.alloc(Math.min(encrypted.length, decrypted.length));
    for (let j = 0; j < keystream.length; j++) {
      keystream[j] = encrypted[j] ^ decrypted[j];
    }
    
    // Derive counter block 0
    const keystreamBlock0 = keystream.subarray(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counter0 = decipher.update(keystreamBlock0);
    
    console.log(`  Counter block 0: ${counter0.toString('hex')}`);
    
    // Check if counter0 appears in the encrypted data
    const counter0Hex = counter0.toString('hex');
    const encryptedHex = encrypted.toString('hex');
    
    // Check various positions
    console.log(`  Counter0 == First 16 bytes: ${encrypted.subarray(0, 16).toString('hex') === counter0Hex}`);
    console.log(`  Counter0 == Last 16 bytes: ${encrypted.subarray(-16).toString('hex') === counter0Hex}`);
    
    // Check if it's XORed with something
    const xorFirst16 = Buffer.alloc(16);
    const xorLast16 = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      xorFirst16[j] = encrypted[j] ^ counter0[j];
      xorLast16[j] = encrypted[encrypted.length - 16 + j] ^ counter0[j];
    }
    console.log(`  First 16 XOR Counter0: ${xorFirst16.toString('hex')}`);
    console.log(`  Last 16 XOR Counter0: ${xorLast16.toString('hex')}`);
    
    console.log();
  }
  
  // Check if responses with same key have same counter blocks
  console.log('=== Comparing Counter Blocks Across Responses ===\n');
  
  const counterBlocks = [];
  for (let i = 0; i < responses.length; i++) {
    const encrypted = Buffer.from(responses[i].encrypted, 'base64');
    const decrypted = Buffer.from(responses[i].decrypted);
    
    const keystream = Buffer.alloc(Math.min(encrypted.length, decrypted.length));
    for (let j = 0; j < keystream.length; j++) {
      keystream[j] = encrypted[j] ^ decrypted[j];
    }
    
    const keystreamBlock0 = keystream.subarray(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const counter0 = decipher.update(keystreamBlock0);
    
    counterBlocks.push(counter0);
  }
  
  console.log('Counter block 0 for each response:');
  counterBlocks.forEach((cb, i) => console.log(`  Response ${i + 1}: ${cb.toString('hex')}`));
  
  const allSame = counterBlocks.every(cb => cb.equals(counterBlocks[0]));
  console.log(`\nAll counter blocks identical: ${allSame}`);
  
  if (!allSame) {
    console.log('\nCounter blocks differ between requests with same key!');
    console.log('This means the nonce is generated per-request on the server.');
    console.log('The nonce MUST be embedded in the response somehow.');
  }
}

analyzeEncryptedStructure().catch(console.error);
