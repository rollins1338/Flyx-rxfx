/**
 * Crack WASM - Investigate get_img_key Function
 * 
 * The WASM exports a get_img_key() function. Let's see what it returns
 * and if it's related to the decryption.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function investigateGetKey() {
  console.log('=== Investigate get_img_key Function ===\n');
  
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
  
  // Call get_img_key multiple times
  const keys = await page.evaluate(async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      const key = window.wasmImgData.get_img_key();
      results.push(key);
      await new Promise(r => setTimeout(r, 100));
    }
    return results;
  });
  
  console.log('get_img_key() results:');
  for (let i = 0; i < keys.length; i++) {
    console.log(`  ${i}: ${keys[i]}`);
  }
  
  // Check if the key is the same each time
  const allSame = keys.every(k => k === keys[0]);
  console.log(`\nAll keys same: ${allSame}`);
  
  // Now let's see if this key is used in decryption
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`\nTest API key: ${testKey}`);
  
  const result = await page.evaluate(async (apiKey) => {
    const crypto = window.crypto;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': apiKey,
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
    
    // Get the internal key
    const imgKey = window.wasmImgData.get_img_key();
    
    // Try decryption with both keys
    let decryptedWithApiKey = null;
    let decryptedWithImgKey = null;
    
    try {
      decryptedWithApiKey = await window.wasmImgData.process_img_data(encryptedData, apiKey);
    } catch (e) {
      decryptedWithApiKey = `Error: ${e.message}`;
    }
    
    try {
      decryptedWithImgKey = await window.wasmImgData.process_img_data(encryptedData, imgKey);
    } catch (e) {
      decryptedWithImgKey = `Error: ${e.message}`;
    }
    
    return {
      encrypted: encryptedData,
      imgKey: imgKey,
      decryptedWithApiKey: decryptedWithApiKey,
      decryptedWithImgKey: decryptedWithImgKey,
    };
  }, testKey);
  
  console.log(`\nInternal img_key: ${result.imgKey}`);
  console.log(`\nDecrypted with API key: ${result.decryptedWithApiKey}`);
  console.log(`\nDecrypted with img_key: ${result.decryptedWithImgKey}`);
  
  // Check if img_key is related to API key
  console.log('\n=== Key Relationship Analysis ===\n');
  
  const imgKeyBuf = Buffer.from(result.imgKey, 'hex');
  const apiKeyBuf = Buffer.from(testKey, 'hex');
  
  console.log(`API key length: ${apiKeyBuf.length} bytes`);
  console.log(`img_key length: ${imgKeyBuf.length} bytes`);
  
  // Check if img_key is derived from API key
  const sha256ApiKey = crypto.createHash('sha256').update(apiKeyBuf).digest();
  console.log(`SHA256(API key): ${sha256ApiKey.toString('hex')}`);
  console.log(`img_key matches SHA256(API key): ${sha256ApiKey.equals(imgKeyBuf)}`);
  
  const hmacApiKey = crypto.createHmac('sha256', apiKeyBuf).update('key').digest();
  console.log(`HMAC(API key, "key"): ${hmacApiKey.toString('hex')}`);
  console.log(`img_key matches HMAC: ${hmacApiKey.equals(imgKeyBuf)}`);
  
  await browser.close();
}

investigateGetKey().catch(console.error);
