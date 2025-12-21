/**
 * Rust Crate Analysis for WASM Key Derivation
 * 
 * The WASM uses these Rust crates:
 * - aes-0.8.4 (fixslice32.rs) - AES encryption
 * - ctr-0.9.2 (ctr32.rs) - CTR mode
 * - hmac-0.12.1 - HMAC authentication
 * - cipher-0.4.4 (stream_core.rs) - Stream cipher traits
 * - base64-0.21.7 - Base64 encoding/decoding
 * 
 * Based on the function analysis:
 * - Function 57 (get_img_key): Collects fingerprint, derives key
 * - Function 52 (process_img_data): Main decryption
 * - Function 58: AES round function (75 XOR ops)
 * - Function 59: AES key schedule (144 XOR ops)
 * 
 * The key derivation likely uses HMAC-SHA256 to combine:
 * - Canvas fingerprint
 * - Session ID
 * - Screen/navigator properties
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function analyzeKeyDerivation() {
  console.log('=== Rust Crate Analysis for Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Capture detailed fingerprint data
  await page.evaluateOnNewDocument(() => {
    window.__fpCapture = {
      canvasOperations: [],
      storageOperations: [],
      navigatorAccess: [],
      screenAccess: [],
      randomCalls: [],
    };
    
    // Intercept canvas operations
    const origFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
      window.__fpCapture.canvasOperations.push({ type: 'fillText', text, x, y, font: this.font });
      return origFillText.apply(this, arguments);
    };
    
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      window.__fpCapture.canvasOperations.push({ type: 'toDataURL', length: result.length });
      window.__fpCapture.lastCanvasData = result;
      return result;
    };
    
    // Intercept Math.random
    const origRandom = Math.random;
    Math.random = function() {
      const result = origRandom.call(this);
      window.__fpCapture.randomCalls.push(result);
      return result;
    };
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get all captured data
  const data = await page.evaluate(() => {
    return {
      embeddedKey: window.wasmImgData.get_img_key(),
      sessionId: localStorage.getItem('tmdb_session_id'),
      fpCapture: window.__fpCapture,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: new Date().getTimezoneOffset(),
    };
  });
  
  await browser.close();
  
  console.log('Captured Data:');
  console.log(`  Embedded key: ${data.embeddedKey}`);
  console.log(`  Session ID: ${data.sessionId}`);
  console.log(`  Canvas operations: ${data.fpCapture.canvasOperations.length}`);
  console.log(`  Random calls: ${data.fpCapture.randomCalls.length}`);
  
  console.log('\nCanvas operations:');
  for (const op of data.fpCapture.canvasOperations) {
    if (op.type === 'fillText') {
      console.log(`  fillText("${op.text}", ${op.x}, ${op.y}) font="${op.font}"`);
    } else {
      console.log(`  ${op.type}: length=${op.length}`);
    }
  }
  
  console.log('\nRandom values:');
  for (const r of data.fpCapture.randomCalls) {
    console.log(`  ${r}`);
  }
  
  // The session ID format is: timestamp.random
  // The random part comes from Math.random()
  const sessionParts = data.sessionId.split('.');
  const timestamp = sessionParts[0];
  const randomPart = sessionParts[1];
  
  console.log(`\nSession ID breakdown:`);
  console.log(`  Timestamp: ${timestamp} (${new Date(parseInt(timestamp) * 1000).toISOString()})`);
  console.log(`  Random: ${randomPart}`);
  
  // Check if random part matches captured random
  if (data.fpCapture.randomCalls.length > 0) {
    const capturedRandom = data.fpCapture.randomCalls[0].toString().split('.')[1];
    console.log(`  Captured random: ${capturedRandom}`);
    console.log(`  Match: ${randomPart === capturedRandom}`);
  }
  
  const embeddedKeyBuf = Buffer.from(data.embeddedKey, 'hex');
  const canvasData = data.fpCapture.lastCanvasData;
  
  console.log('\n=== Key Derivation Analysis ===\n');
  
  // Based on Rust HMAC crate usage, the key is likely derived using HMAC-SHA256
  // The typical pattern in Rust is:
  // 1. Create HMAC with a key
  // 2. Update with data
  // 3. Finalize to get the result
  
  // The fingerprint data collected:
  // - userAgent
  // - screen width/height
  // - colorDepth
  // - platform
  // - language
  // - timezone
  // - sessionId (timestamp.random)
  // - canvas fingerprint
  
  // Let's try to find the exact combination
  
  // Build fingerprint string in various orders
  const fpStrings = [
    // Order 1: As collected in trace
    `${data.userAgent}|${data.screenWidth}|${data.screenHeight}|${data.colorDepth}|${data.platform}|${data.language}|${data.timezone}`,
    // Order 2: Screen first
    `${data.screenWidth}|${data.screenHeight}|${data.colorDepth}|${data.userAgent}|${data.platform}|${data.language}|${data.timezone}`,
    // Order 3: Simple
    `${data.screenWidth}x${data.screenHeight}x${data.colorDepth}`,
    // Order 4: With timezone
    `${data.screenWidth}:${data.screenHeight}:${data.colorDepth}:${data.timezone}`,
  ];
  
  // Try HMAC with canvas as key and various data
  console.log('Trying HMAC combinations with canvas as key...');
  
  for (const fpStr of fpStrings) {
    // HMAC(canvas, fp)
    let hmac = crypto.createHmac('sha256', canvasData).update(fpStr).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(canvas, "${fpStr.slice(0, 50)}...") ***`);
    }
    
    // HMAC(canvas, fp + session)
    hmac = crypto.createHmac('sha256', canvasData).update(`${fpStr}|${data.sessionId}`).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(canvas, fp|session) ***`);
    }
    
    // HMAC(canvas, session + fp)
    hmac = crypto.createHmac('sha256', canvasData).update(`${data.sessionId}|${fpStr}`).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(canvas, session|fp) ***`);
    }
  }
  
  // Try HMAC with session as key
  console.log('\nTrying HMAC combinations with session as key...');
  
  // HMAC(session, canvas)
  let hmac = crypto.createHmac('sha256', data.sessionId).update(canvasData).digest();
  if (hmac.equals(embeddedKeyBuf)) {
    console.log('*** MATCH: HMAC(session, canvas) ***');
  }
  
  // HMAC(session, canvas + fp)
  for (const fpStr of fpStrings) {
    hmac = crypto.createHmac('sha256', data.sessionId).update(`${canvasData}|${fpStr}`).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(session, canvas|fp) ***`);
    }
  }
  
  // Try with canvas base64 only
  console.log('\nTrying with canvas base64 only...');
  const canvasBase64 = canvasData.split(',')[1];
  
  hmac = crypto.createHmac('sha256', data.sessionId).update(canvasBase64).digest();
  if (hmac.equals(embeddedKeyBuf)) {
    console.log('*** MATCH: HMAC(session, canvas_b64) ***');
  }
  
  hmac = crypto.createHmac('sha256', canvasBase64).update(data.sessionId).digest();
  if (hmac.equals(embeddedKeyBuf)) {
    console.log('*** MATCH: HMAC(canvas_b64, session) ***');
  }
  
  // Try SHA256 of various combinations
  console.log('\nTrying SHA256 combinations...');
  
  const sha256Attempts = [
    `${canvasData}${data.sessionId}`,
    `${data.sessionId}${canvasData}`,
    `${canvasBase64}${data.sessionId}`,
    `${data.sessionId}${canvasBase64}`,
    `${canvasData}|${data.sessionId}`,
    `${data.sessionId}|${canvasData}`,
    `${canvasData}:${data.sessionId}`,
    `${data.sessionId}:${canvasData}`,
  ];
  
  for (const attempt of sha256Attempts) {
    const hash = crypto.createHash('sha256').update(attempt).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: SHA256("${attempt.slice(0, 50)}...") ***`);
    }
  }
  
  // Try with fingerprint components individually
  console.log('\nTrying with individual fingerprint components...');
  
  const components = [
    data.userAgent,
    data.platform,
    data.language,
    data.screenWidth.toString(),
    data.screenHeight.toString(),
    data.colorDepth.toString(),
    data.timezone.toString(),
    timestamp,
    randomPart,
  ];
  
  // Try HMAC with each component as key
  for (const comp of components) {
    hmac = crypto.createHmac('sha256', comp).update(canvasData).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC("${comp.slice(0, 30)}...", canvas) ***`);
    }
    
    hmac = crypto.createHmac('sha256', canvasData).update(comp).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(canvas, "${comp.slice(0, 30)}...") ***`);
    }
  }
  
  // The key might be derived from a hash of the canvas data combined with session
  // using a specific algorithm from the Rust crates
  
  // Try HKDF (common in Rust crypto)
  console.log('\nTrying HKDF...');
  
  const hkdfAttempts = [
    { ikm: canvasData, salt: data.sessionId, info: 'TMDB Image Enhancement' },
    { ikm: data.sessionId, salt: canvasData, info: 'TMDB Image Enhancement' },
    { ikm: canvasBase64, salt: data.sessionId, info: 'TMDB Image Enhancement' },
    { ikm: canvasData, salt: '', info: data.sessionId },
    { ikm: data.sessionId, salt: '', info: canvasData },
  ];
  
  for (const attempt of hkdfAttempts) {
    try {
      const key = crypto.hkdfSync('sha256', attempt.ikm, attempt.salt, attempt.info, 32);
      if (Buffer.from(key).equals(embeddedKeyBuf)) {
        console.log(`*** MATCH: HKDF(${attempt.ikm.slice(0, 20)}..., ${attempt.salt.slice(0, 20)}..., ${attempt.info}) ***`);
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  console.log('\n=== Summary ===\n');
  console.log('The key derivation algorithm is complex and likely involves:');
  console.log('1. Canvas fingerprint (drawing specific text with specific fonts)');
  console.log('2. Session ID (timestamp.random from Math.random())');
  console.log('3. Screen/navigator properties');
  console.log('4. A custom combination algorithm in the WASM');
  console.log('\nThe exact algorithm is obfuscated in the compiled Rust code.');
  console.log('To fully reverse engineer it, we would need to:');
  console.log('1. Decompile the WASM to readable pseudocode');
  console.log('2. Trace the exact byte operations in the key derivation');
  console.log('3. Identify the specific hash/HMAC operations used');
  
  // Save all data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/rust-analysis.json',
    JSON.stringify(data, null, 2)
  );
  console.log('\nData saved to: source-testing/tests/wasm-analysis/rust-analysis.json');
}

analyzeKeyDerivation().catch(console.error);
