/**
 * Crack WASM - Dynamic Key Analysis
 * 
 * The embedded key changes between sessions!
 * This means it's derived from the fingerprint.
 * 
 * Let's analyze how the key is generated.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function analyzeDynamicKey() {
  console.log('=== Dynamic Key Analysis ===\n');
  
  // Test 1: Fresh browser (no localStorage)
  console.log('Test 1: Fresh browser session\n');
  
  const browser1 = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page1 = await browser1.newPage();
  
  // Clear localStorage before loading
  await page1.evaluateOnNewDocument(() => {
    localStorage.clear();
  });
  
  await page1.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page1.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result1 = await page1.evaluate(() => {
    return {
      embeddedKey: window.wasmImgData.get_img_key(),
      fingerprint: localStorage.getItem('tmdb_session_id'),
    };
  });
  
  console.log(`Embedded key 1: ${result1.embeddedKey}`);
  console.log(`Fingerprint 1: ${result1.fingerprint}\n`);
  
  await browser1.close();
  
  // Test 2: Another fresh browser
  console.log('Test 2: Another fresh browser session\n');
  
  const browser2 = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page2 = await browser2.newPage();
  
  await page2.evaluateOnNewDocument(() => {
    localStorage.clear();
  });
  
  await page2.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page2.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result2 = await page2.evaluate(() => {
    return {
      embeddedKey: window.wasmImgData.get_img_key(),
      fingerprint: localStorage.getItem('tmdb_session_id'),
    };
  });
  
  console.log(`Embedded key 2: ${result2.embeddedKey}`);
  console.log(`Fingerprint 2: ${result2.fingerprint}\n`);
  
  // Test 3: Same browser, call get_img_key multiple times
  console.log('Test 3: Multiple calls in same session\n');
  
  const result3 = await page2.evaluate(() => {
    const keys = [];
    for (let i = 0; i < 5; i++) {
      keys.push(window.wasmImgData.get_img_key());
    }
    return keys;
  });
  
  console.log('Multiple calls:');
  for (let i = 0; i < result3.length; i++) {
    console.log(`  Call ${i + 1}: ${result3[i]}`);
  }
  
  const allSame = result3.every(k => k === result3[0]);
  console.log(`All same: ${allSame}\n`);
  
  // Test 4: Make a request and check if key changes
  console.log('Test 4: Key after making request\n');
  
  const testKey = crypto.randomBytes(32).toString('hex');
  
  const result4 = await page2.evaluate(async (key) => {
    const keyBefore = window.wasmImgData.get_img_key();
    
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
    
    const keyAfter = window.wasmImgData.get_img_key();
    
    return {
      keyBefore,
      keyAfter,
      encrypted: encryptedData,
      decrypted,
    };
  }, testKey);
  
  console.log(`Key before request: ${result4.keyBefore}`);
  console.log(`Key after request: ${result4.keyAfter}`);
  console.log(`Key changed: ${result4.keyBefore !== result4.keyAfter}\n`);
  
  await browser2.close();
  
  // Analysis
  console.log('=== Analysis ===\n');
  
  // The fingerprint looks like a timestamp
  const fp1 = result1.fingerprint;
  const fp2 = result2.fingerprint;
  
  if (fp1 && fp2) {
    const ts1 = parseFloat(fp1);
    const ts2 = parseFloat(fp2);
    
    console.log(`Fingerprint 1 as timestamp: ${new Date(ts1 * 1000).toISOString()}`);
    console.log(`Fingerprint 2 as timestamp: ${new Date(ts2 * 1000).toISOString()}`);
    
    // The fingerprint is likely: timestamp.random
    const [ts1Int, ts1Frac] = fp1.split('.');
    const [ts2Int, ts2Frac] = fp2.split('.');
    
    console.log(`\nFingerprint structure:`);
    console.log(`  1: ${ts1Int} . ${ts1Frac}`);
    console.log(`  2: ${ts2Int} . ${ts2Frac}`);
  }
  
  // Try to derive the embedded key from the fingerprint
  console.log('\n=== Key Derivation Attempts ===\n');
  
  const embeddedKey1 = Buffer.from(result1.embeddedKey, 'hex');
  const embeddedKey2 = Buffer.from(result2.embeddedKey, 'hex');
  
  // Try various derivations
  const derivations = [
    { name: 'sha256(fingerprint)', fn: (fp) => crypto.createHash('sha256').update(fp).digest() },
    { name: 'sha256(fingerprint as float)', fn: (fp) => crypto.createHash('sha256').update(Buffer.from(parseFloat(fp).toString())).digest() },
    { name: 'sha256(fingerprint int part)', fn: (fp) => crypto.createHash('sha256').update(fp.split('.')[0]).digest() },
  ];
  
  for (const { name, fn } of derivations) {
    if (fp1) {
      const derived1 = fn(fp1);
      const match1 = derived1.equals(embeddedKey1);
      console.log(`${name} (fp1): ${match1 ? 'MATCH!' : 'no match'}`);
      if (!match1) {
        console.log(`  Expected: ${embeddedKey1.toString('hex')}`);
        console.log(`  Got:      ${derived1.toString('hex')}`);
      }
    }
  }
  
  // The key might be derived from more than just the fingerprint
  // It might include canvas fingerprint, user agent, etc.
  console.log('\nThe embedded key is likely derived from:');
  console.log('  - Canvas fingerprint');
  console.log('  - User agent');
  console.log('  - Screen dimensions');
  console.log('  - Timezone');
  console.log('  - Language');
  console.log('  - And possibly the timestamp');
}

analyzeDynamicKey().catch(console.error);
