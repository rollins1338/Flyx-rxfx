/**
 * Test Raw Decryption - Check what the decrypted data actually contains
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testRawDecrypt() {
  console.log('=== Testing Raw Decryption ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Navigate to Flixer
  await page.goto('https://flixer.sh/watch/tv/1396/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Test decryption
  const result = await page.evaluate(async () => {
    const apiKey = window.wasmImgData.get_img_key();
    const path = '/api/tmdb/tv/1396/season/1/episode/1/images';
    
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
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
        'Accept': 'text/plain',
      },
    });
    
    const encryptedData = await response.text();
    
    // Decrypt
    const decrypted = window.wasmImgData.process_img_data(encryptedData, apiKey);
    
    return {
      apiKey,
      encryptedLength: encryptedData.length,
      decryptedRaw: decrypted,
      decryptedType: typeof decrypted,
    };
  });
  
  console.log('API Key:', result.apiKey);
  console.log('Encrypted length:', result.encryptedLength);
  console.log('Decrypted type:', result.decryptedType);
  console.log('Decrypted raw:', result.decryptedRaw);
  
  // Try parsing
  try {
    const parsed = JSON.parse(result.decryptedRaw);
    console.log('\nParsed JSON:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('\nNot valid JSON:', e.message);
  }
  
  await browser.close();
}

testRawDecrypt().catch(console.error);
