/**
 * Working Solution - Use Puppeteer to Execute WASM
 * 
 * Since we can't easily reverse engineer the exact key derivation algorithm,
 * the practical solution is to use Puppeteer to execute the WASM in a browser
 * context and get the decrypted data.
 * 
 * This script demonstrates a working approach that:
 * 1. Loads the WASM in a browser
 * 2. Gets the session key
 * 3. Makes API requests with proper authentication
 * 4. Decrypts the responses using the WASM
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function workingSolution() {
  console.log('=== Working Solution - Flixer WASM Decryption ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Navigate to Flixer
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM to be ready
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  console.log('WASM loaded and ready!\n');
  
  // Get the session key
  const sessionKey = await page.evaluate(() => window.wasmImgData.get_img_key());
  console.log(`Session key: ${sessionKey}`);
  
  // Make an API request and decrypt the response
  const result = await page.evaluate(async () => {
    const apiKey = window.wasmImgData.get_img_key();
    
    // Generate request authentication
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    // Make the request
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
    
    if (!response.ok) {
      return { error: `HTTP ${response.status}`, body: await response.text() };
    }
    
    const encryptedData = await response.text();
    
    // Decrypt using WASM
    try {
      const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
      return {
        success: true,
        encryptedLength: encryptedData.length,
        decrypted: decrypted,
      };
    } catch (e) {
      return {
        error: e.message,
        encryptedLength: encryptedData.length,
        encryptedPreview: encryptedData.slice(0, 100),
      };
    }
  });
  
  console.log('\n=== API Request Result ===\n');
  
  if (result.success) {
    console.log('Decryption successful!');
    console.log(`Encrypted length: ${result.encryptedLength}`);
    console.log(`Decrypted data: ${result.decrypted}`);
    
    // Parse the decrypted JSON
    try {
      const parsed = JSON.parse(result.decrypted);
      console.log('\nParsed response:');
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse as JSON');
    }
  } else {
    console.log(`Error: ${result.error}`);
    if (result.body) console.log(`Body: ${result.body}`);
    if (result.encryptedPreview) console.log(`Encrypted preview: ${result.encryptedPreview}`);
  }
  
  // Now let's try to get a specific server source
  console.log('\n=== Fetching Server Source ===\n');
  
  const sourceResult = await page.evaluate(async () => {
    const apiKey = window.wasmImgData.get_img_key();
    
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/[/+=]/g, '').substring(0, 22);
    
    const path = '/api/tmdb/tv/106379/season/1/episode/1/images';
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    
    // Request with X-Only-Sources and X-Server headers
    const response = await fetch(`https://plsdontscrapemelove.flixer.sh${path}`, {
      headers: {
        'X-Api-Key': apiKey,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        'X-Client-Fingerprint': 'test',
        'bW90aGFmYWth': '1',
        'Accept': 'text/plain',
        'X-Only-Sources': '1',
        'X-Server': 'alpha',
      },
    });
    
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    
    const encryptedData = await response.text();
    
    try {
      const decrypted = await window.wasmImgData.process_img_data(encryptedData, apiKey);
      return {
        success: true,
        decrypted: decrypted,
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  if (sourceResult.success) {
    console.log('Source decryption successful!');
    console.log(`Decrypted: ${sourceResult.decrypted}`);
    
    try {
      const parsed = JSON.parse(sourceResult.decrypted);
      console.log('\nParsed source:');
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse as JSON');
    }
  } else {
    console.log(`Error: ${sourceResult.error}`);
  }
  
  await browser.close();
  
  console.log('\n=== Summary ===\n');
  console.log('The Flixer WASM encryption can be bypassed by:');
  console.log('1. Loading the WASM in a browser context (Puppeteer)');
  console.log('2. Using the get_img_key() function to get the session key');
  console.log('3. Making authenticated API requests');
  console.log('4. Using process_img_data() to decrypt responses');
  console.log('\nThis approach works but requires a browser instance.');
  console.log('For production use, consider:');
  console.log('- Running a headless browser service');
  console.log('- Caching decrypted results');
  console.log('- Rate limiting to avoid detection');
}

workingSolution().catch(console.error);
