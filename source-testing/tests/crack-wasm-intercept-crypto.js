/**
 * Crack WASM - Intercept Crypto Operations
 * 
 * The WASM might use Web Crypto API internally. Let's intercept all crypto operations.
 * Also intercept Math.random and other potential sources of randomness.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptCrypto() {
  console.log('=== Intercept Crypto Operations ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept console logs
  page.on('console', msg => {
    if (msg.text().startsWith('[INTERCEPT]')) {
      console.log(msg.text());
    }
  });
  
  // Inject interceptors before page loads
  await page.evaluateOnNewDocument(() => {
    window.__cryptoLogs = [];
    window.__randomLogs = [];
    
    // Intercept Math.random
    const originalRandom = Math.random;
    Math.random = function() {
      const result = originalRandom.call(Math);
      window.__randomLogs.push(result);
      return result;
    };
    
    // Intercept crypto.getRandomValues
    const originalGetRandomValues = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = function(array) {
      const result = originalGetRandomValues(array);
      window.__cryptoLogs.push({
        type: 'getRandomValues',
        length: array.length,
        data: Array.from(array).slice(0, 32)
      });
      return result;
    };
    
    // Intercept SubtleCrypto operations
    const originalImportKey = crypto.subtle.importKey.bind(crypto.subtle);
    crypto.subtle.importKey = async function(...args) {
      const result = await originalImportKey(...args);
      window.__cryptoLogs.push({
        type: 'importKey',
        format: args[0],
        algorithm: args[2],
      });
      return result;
    };
    
    const originalEncrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    crypto.subtle.encrypt = async function(...args) {
      const result = await originalEncrypt(...args);
      window.__cryptoLogs.push({
        type: 'encrypt',
        algorithm: args[0],
        dataLength: args[2].byteLength,
        resultLength: result.byteLength,
      });
      return result;
    };
    
    const originalDecrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    crypto.subtle.decrypt = async function(...args) {
      const result = await originalDecrypt(...args);
      window.__cryptoLogs.push({
        type: 'decrypt',
        algorithm: args[0],
        dataLength: args[2].byteLength,
        resultLength: result.byteLength,
      });
      return result;
    };
    
    const originalSign = crypto.subtle.sign.bind(crypto.subtle);
    crypto.subtle.sign = async function(...args) {
      const result = await originalSign(...args);
      window.__cryptoLogs.push({
        type: 'sign',
        algorithm: args[0],
        dataLength: args[2].byteLength,
      });
      return result;
    };
    
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async function(...args) {
      const result = await originalDigest(...args);
      window.__cryptoLogs.push({
        type: 'digest',
        algorithm: args[0],
        dataLength: args[1].byteLength,
        resultLength: result.byteLength,
      });
      return result;
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Clear logs before our test
  await page.evaluate(() => {
    window.__cryptoLogs = [];
    window.__randomLogs = [];
  });
  
  const testKey = crypto.randomBytes(32).toString('hex');
  console.log(`Test key: ${testKey}\n`);
  
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
    
    // Clear logs before WASM call
    window.__cryptoLogs = [];
    window.__randomLogs = [];
    
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
    
    // Clear logs again right before WASM decryption
    window.__cryptoLogs = [];
    window.__randomLogs = [];
    
    const decrypted = await window.wasmImgData.process_img_data(encryptedData, key);
    
    return {
      encrypted: encryptedData,
      decrypted: decrypted,
      cryptoLogs: window.__cryptoLogs,
      randomLogs: window.__randomLogs,
    };
  }, testKey);
  
  await browser.close();
  
  console.log('=== Crypto Operations During WASM Decryption ===\n');
  console.log(`Crypto operations: ${result.cryptoLogs.length}`);
  for (const log of result.cryptoLogs) {
    console.log(`  ${JSON.stringify(log)}`);
  }
  
  console.log(`\nMath.random calls: ${result.randomLogs.length}`);
  if (result.randomLogs.length > 0) {
    console.log(`  First 10: ${result.randomLogs.slice(0, 10).join(', ')}`);
  }
  
  // Analyze the encrypted data
  const keyBuf = Buffer.from(testKey, 'hex');
  const encrypted = Buffer.from(result.encrypted, 'base64');
  const decrypted = Buffer.from(result.decrypted);
  
  const overhead = encrypted.length - decrypted.length;
  const prefix = encrypted.subarray(0, overhead);
  const ciphertext = encrypted.subarray(overhead);
  
  console.log(`\n=== Data Analysis ===`);
  console.log(`Encrypted: ${encrypted.length} bytes`);
  console.log(`Overhead: ${overhead} bytes`);
  console.log(`Ciphertext: ${ciphertext.length} bytes`);
  console.log(`Decrypted: ${decrypted.length} bytes`);
  
  // Derive keystream
  const keystream = Buffer.alloc(decrypted.length);
  for (let i = 0; i < decrypted.length; i++) {
    keystream[i] = ciphertext[i] ^ decrypted[i];
  }
  
  console.log(`\nPrefix: ${prefix.toString('hex')}`);
  console.log(`\nKeystream: ${keystream.toString('hex')}`);
  console.log(`\nDecrypted: ${result.decrypted}`);
}

interceptCrypto().catch(console.error);
