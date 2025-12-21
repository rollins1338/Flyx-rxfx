/**
 * PRNG Analysis - Check if the key derivation uses a PRNG seeded with fingerprint
 * 
 * The WASM might be using:
 * 1. SHA256 to seed a PRNG
 * 2. PRNG to generate the key
 * 
 * Or it might be using HKDF (HMAC-based Key Derivation Function)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function prngAnalysis() {
  console.log('=== PRNG/HKDF Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__canvasData = null;
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
      }
      return result;
    };
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    return {
      key,
      sessionId,
      canvasBase64,
      fingerprint: {
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await browser.close();
  
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  const fp = data.fingerprint;
  const canvasBase64 = data.canvasBase64;
  const [timestamp, random] = data.sessionId.split('.');
  
  // The fingerprint string from memory
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  
  console.log(`\nFP String (131 chars): ${fpString}`);
  
  // 1. Try HKDF
  console.log('\n=== Testing HKDF ===\n');
  
  const hkdfSalts = ['', 'flixer', 'tmdb', 'image', 'key', timestamp, random, data.sessionId];
  const hkdfInfos = ['', 'key', 'image', 'flixer', 'tmdb', 'session'];
  
  for (const salt of hkdfSalts) {
    for (const info of hkdfInfos) {
      try {
        const key = crypto.hkdfSync('sha256', fpString, salt, info, 32);
        if (Buffer.from(key).equals(keyBuf)) {
          console.log(`*** HKDF MATCH: salt="${salt}", info="${info}" ***`);
        }
      } catch (e) {}
    }
  }
  
  // 2. Try PBKDF2
  console.log('\n=== Testing PBKDF2 ===\n');
  
  const pbkdf2Salts = ['', 'flixer', 'tmdb', timestamp, random, data.sessionId, canvasBase64.slice(0, 32)];
  const iterations = [1, 10, 100, 1000];
  
  for (const salt of pbkdf2Salts) {
    for (const iter of iterations) {
      try {
        const key = crypto.pbkdf2Sync(fpString, salt, iter, 32, 'sha256');
        if (key.equals(keyBuf)) {
          console.log(`*** PBKDF2 MATCH: salt="${salt}", iterations=${iter} ***`);
        }
      } catch (e) {}
    }
  }
  
  // 3. Try double/triple hashing
  console.log('\n=== Testing Multiple Hash Rounds ===\n');
  
  let hash = crypto.createHash('sha256').update(fpString).digest();
  console.log(`Round 1: ${hash.toString('hex')}`);
  
  for (let i = 2; i <= 10; i++) {
    hash = crypto.createHash('sha256').update(hash).digest();
    console.log(`Round ${i}: ${hash.toString('hex')}`);
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH at round ${i}! ***`);
    }
  }
  
  // 4. Try hash with different inputs
  console.log('\n=== Testing Hash with Variations ===\n');
  
  // Maybe the hash input includes the full canvas, not truncated
  const fullFp = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`;
  hash = crypto.createHash('sha256').update(fullFp).digest();
  console.log(`Full canvas: ${hash.toString('hex')}`);
  
  // Maybe it's just canvas + session
  hash = crypto.createHash('sha256').update(`${canvasBase64}:${data.sessionId}`).digest();
  console.log(`Canvas:Session: ${hash.toString('hex')}`);
  
  hash = crypto.createHash('sha256').update(`${data.sessionId}:${canvasBase64}`).digest();
  console.log(`Session:Canvas: ${hash.toString('hex')}`);
  
  // Maybe it uses the full canvas data URL
  const fullCanvasURL = `data:image/png;base64,${canvasBase64}`;
  hash = crypto.createHash('sha256').update(`${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${fullCanvasURL.slice(0, 50)}`).digest();
  console.log(`With data URL: ${hash.toString('hex')}`);
  
  // 5. Try XOR of multiple hashes
  console.log('\n=== Testing XOR of Hashes ===\n');
  
  const hash1 = crypto.createHash('sha256').update(fpString).digest();
  const hash2 = crypto.createHash('sha256').update(data.sessionId).digest();
  const hash3 = crypto.createHash('sha256').update(canvasBase64).digest();
  
  const xor12 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor12[i] = hash1[i] ^ hash2[i];
  console.log(`hash1 XOR hash2: ${xor12.toString('hex')}`);
  if (xor12.equals(keyBuf)) console.log('*** MATCH! ***');
  
  const xor13 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor13[i] = hash1[i] ^ hash3[i];
  console.log(`hash1 XOR hash3: ${xor13.toString('hex')}`);
  if (xor13.equals(keyBuf)) console.log('*** MATCH! ***');
  
  const xor123 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor123[i] = hash1[i] ^ hash2[i] ^ hash3[i];
  console.log(`hash1 XOR hash2 XOR hash3: ${xor123.toString('hex')}`);
  if (xor123.equals(keyBuf)) console.log('*** MATCH! ***');
  
  console.log(`\nExpected: ${data.key}`);
  
  // 6. Try with the random part of session ID
  console.log('\n=== Testing with Random Part ===\n');
  
  // The session ID is timestamp.random
  // Maybe the key derivation uses both parts separately
  
  const fpWithRandom = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${random}:${canvasBase64.slice(0, 50)}`;
  hash = crypto.createHash('sha256').update(fpWithRandom).digest();
  console.log(`With random: ${hash.toString('hex')}`);
  
  // Try HMAC with random as key
  const hmac = crypto.createHmac('sha256', random).update(fpString).digest();
  console.log(`HMAC(random, fpString): ${hmac.toString('hex')}`);
  if (hmac.equals(keyBuf)) console.log('*** MATCH! ***');
  
  // Try HMAC with timestamp as key
  const hmac2 = crypto.createHmac('sha256', timestamp).update(fpString).digest();
  console.log(`HMAC(timestamp, fpString): ${hmac2.toString('hex')}`);
  if (hmac2.equals(keyBuf)) console.log('*** MATCH! ***');
}

prngAnalysis().catch(console.error);
