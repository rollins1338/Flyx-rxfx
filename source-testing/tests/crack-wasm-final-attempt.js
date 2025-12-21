/**
 * Final Attempt - Crack WASM Key Derivation
 * 
 * Key insights:
 * 1. Canvas text: "TMDB Image Enhancement 🎬" (14px Arial) + "Processing capabilities test" (11px Arial)
 * 2. Session ID: timestamp.random (last Math.random() value)
 * 3. 189 random calls during initialization
 * 4. The key is 32 bytes (64 hex chars)
 * 
 * The WASM uses HMAC-SHA256 (from hmac-0.12.1 crate)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function finalAttempt() {
  console.log('=== Final Attempt - Crack WASM Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Capture everything
  await page.evaluateOnNewDocument(() => {
    window.__capture = {
      randomValues: [],
      canvasData: null,
      allStrings: [],
    };
    
    // Capture all Math.random calls
    const origRandom = Math.random;
    Math.random = function() {
      const result = origRandom.call(this);
      window.__capture.randomValues.push(result);
      return result;
    };
    
    // Capture canvas toDataURL
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      window.__capture.canvasData = result;
      return result;
    };
    
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get all data
  const data = await page.evaluate(() => {
    return {
      embeddedKey: window.wasmImgData.get_img_key(),
      sessionId: localStorage.getItem('tmdb_session_id'),
      canvasData: window.__capture.canvasData,
      randomValues: window.__capture.randomValues,
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
  
  console.log(`Embedded key: ${data.embeddedKey}`);
  console.log(`Session ID: ${data.sessionId}`);
  console.log(`Canvas data length: ${data.canvasData?.length || 0}`);
  console.log(`Random values count: ${data.randomValues.length}`);
  console.log(`Last random: ${data.randomValues[data.randomValues.length - 1]}`);
  
  const embeddedKeyBuf = Buffer.from(data.embeddedKey, 'hex');
  
  // The session ID is: floor(Date.now()/1000) + "." + lastRandom.toString().split('.')[1].slice(0,7)
  const sessionParts = data.sessionId.split('.');
  const timestamp = sessionParts[0];
  const randomPart = sessionParts[1];
  
  console.log(`\nSession breakdown:`);
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Random part: ${randomPart}`);
  
  // Verify the random part comes from the last random value
  const lastRandom = data.randomValues[data.randomValues.length - 1];
  const expectedRandomPart = lastRandom.toString().split('.')[1].slice(0, 7);
  console.log(`  Expected random: ${expectedRandomPart}`);
  console.log(`  Match: ${randomPart === expectedRandomPart}`);
  
  console.log('\n=== Comprehensive Key Derivation Attempts ===\n');
  
  // The key derivation likely uses the canvas data and session ID
  // Let's try every possible combination
  
  const canvasData = data.canvasData;
  const canvasBase64 = canvasData.split(',')[1];
  const sessionId = data.sessionId;
  
  // Build fingerprint strings
  const fpSimple = `${data.screenWidth}:${data.screenHeight}:${data.colorDepth}:${data.timezone}`;
  const fpFull = `${data.screenWidth}:${data.screenHeight}:${data.colorDepth}:${data.userAgent}:${data.platform}:${data.language}:${data.timezone}`;
  
  // Try all combinations
  const attempts = [];
  
  // Simple SHA256
  const sha256Tests = [
    canvasData,
    canvasBase64,
    sessionId,
    `${canvasData}${sessionId}`,
    `${sessionId}${canvasData}`,
    `${canvasBase64}${sessionId}`,
    `${sessionId}${canvasBase64}`,
    `${canvasData}:${sessionId}`,
    `${sessionId}:${canvasData}`,
    `${canvasBase64}:${sessionId}`,
    `${sessionId}:${canvasBase64}`,
    `${canvasData}|${sessionId}`,
    `${sessionId}|${canvasData}`,
    `${canvasData}\n${sessionId}`,
    `${sessionId}\n${canvasData}`,
    `${canvasData}${fpSimple}`,
    `${fpSimple}${canvasData}`,
    `${sessionId}${fpSimple}`,
    `${fpSimple}${sessionId}`,
    `${canvasData}${sessionId}${fpSimple}`,
    `${sessionId}${canvasData}${fpSimple}`,
    `${fpSimple}${canvasData}${sessionId}`,
  ];
  
  console.log('Testing SHA256...');
  for (const test of sha256Tests) {
    const hash = crypto.createHash('sha256').update(test).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: SHA256("${test.slice(0, 50)}...") ***`);
      attempts.push({ type: 'SHA256', input: test.slice(0, 100) });
    }
  }
  
  // HMAC-SHA256 with various keys
  console.log('\nTesting HMAC-SHA256...');
  
  const hmacKeys = [
    canvasData,
    canvasBase64,
    sessionId,
    timestamp,
    randomPart,
    fpSimple,
    'TMDB Image Enhancement',
    'Processing capabilities test',
    'tmdb_session_id',
    data.userAgent,
    data.platform,
    data.language,
  ];
  
  const hmacData = [
    canvasData,
    canvasBase64,
    sessionId,
    timestamp,
    randomPart,
    fpSimple,
    `${canvasData}${sessionId}`,
    `${sessionId}${canvasData}`,
    `${canvasBase64}${sessionId}`,
    `${sessionId}${canvasBase64}`,
  ];
  
  for (const key of hmacKeys) {
    for (const data of hmacData) {
      if (key === data) continue;
      try {
        const hmac = crypto.createHmac('sha256', key).update(data).digest();
        if (hmac.equals(embeddedKeyBuf)) {
          console.log(`*** MATCH: HMAC(key="${key.slice(0, 30)}...", data="${data.slice(0, 30)}...") ***`);
          attempts.push({ type: 'HMAC', key: key.slice(0, 50), data: data.slice(0, 50) });
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  // Try with hex-encoded canvas hash as key
  console.log('\nTesting with canvas hash as key...');
  const canvasHash = crypto.createHash('sha256').update(canvasData).digest();
  const canvasHashHex = canvasHash.toString('hex');
  
  for (const data of [sessionId, timestamp, randomPart, fpSimple]) {
    let hmac = crypto.createHmac('sha256', canvasHash).update(data).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(SHA256(canvas), "${data.slice(0, 30)}...") ***`);
    }
    
    hmac = crypto.createHmac('sha256', canvasHashHex).update(data).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(SHA256(canvas).hex, "${data.slice(0, 30)}...") ***`);
    }
  }
  
  // Try with session hash as key
  console.log('\nTesting with session hash as key...');
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest();
  const sessionHashHex = sessionHash.toString('hex');
  
  for (const data of [canvasData, canvasBase64, fpSimple]) {
    let hmac = crypto.createHmac('sha256', sessionHash).update(data).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(SHA256(session), "${data.slice(0, 30)}...") ***`);
    }
    
    hmac = crypto.createHmac('sha256', sessionHashHex).update(data).digest();
    if (hmac.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: HMAC(SHA256(session).hex, "${data.slice(0, 30)}...") ***`);
    }
  }
  
  // Try XOR of hashes
  console.log('\nTesting XOR of hashes...');
  const xorResult = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorResult[i] = canvasHash[i] ^ sessionHash[i];
  }
  if (xorResult.equals(embeddedKeyBuf)) {
    console.log('*** MATCH: SHA256(canvas) XOR SHA256(session) ***');
  }
  
  // Try double hashing
  console.log('\nTesting double hashing...');
  for (const test of sha256Tests.slice(0, 10)) {
    const hash1 = crypto.createHash('sha256').update(test).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();
    if (hash2.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: SHA256(SHA256("${test.slice(0, 50)}...")) ***`);
    }
  }
  
  // Try HKDF
  console.log('\nTesting HKDF...');
  const hkdfTests = [
    { ikm: canvasData, salt: sessionId, info: '' },
    { ikm: sessionId, salt: canvasData, info: '' },
    { ikm: canvasBase64, salt: sessionId, info: '' },
    { ikm: sessionId, salt: canvasBase64, info: '' },
    { ikm: canvasData, salt: '', info: sessionId },
    { ikm: sessionId, salt: '', info: canvasData },
    { ikm: canvasData, salt: sessionId, info: 'TMDB Image Enhancement' },
    { ikm: canvasData, salt: sessionId, info: fpSimple },
  ];
  
  for (const test of hkdfTests) {
    try {
      const key = crypto.hkdfSync('sha256', test.ikm, test.salt, test.info, 32);
      if (Buffer.from(key).equals(embeddedKeyBuf)) {
        console.log(`*** MATCH: HKDF(ikm="${test.ikm.slice(0, 30)}...", salt="${test.salt.slice(0, 30)}...", info="${test.info}") ***`);
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // Try PBKDF2
  console.log('\nTesting PBKDF2...');
  const pbkdf2Tests = [
    { password: canvasData, salt: sessionId, iterations: 1 },
    { password: sessionId, salt: canvasData, iterations: 1 },
    { password: canvasBase64, salt: sessionId, iterations: 1 },
    { password: canvasData, salt: sessionId, iterations: 1000 },
    { password: canvasData, salt: sessionId, iterations: 10000 },
  ];
  
  for (const test of pbkdf2Tests) {
    try {
      const key = crypto.pbkdf2Sync(test.password, test.salt, test.iterations, 32, 'sha256');
      if (key.equals(embeddedKeyBuf)) {
        console.log(`*** MATCH: PBKDF2(password="${test.password.slice(0, 30)}...", salt="${test.salt.slice(0, 30)}...", iterations=${test.iterations}) ***`);
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // Try with random values
  console.log('\nTesting with random values...');
  
  // The WASM might use the random values in the key derivation
  const randomStr = data.randomValues.join('');
  const randomHash = crypto.createHash('sha256').update(randomStr).digest();
  
  if (randomHash.equals(embeddedKeyBuf)) {
    console.log('*** MATCH: SHA256(all_random_values) ***');
  }
  
  // Try HMAC with random values
  let hmac = crypto.createHmac('sha256', randomStr).update(canvasData).digest();
  if (hmac.equals(embeddedKeyBuf)) {
    console.log('*** MATCH: HMAC(random_values, canvas) ***');
  }
  
  hmac = crypto.createHmac('sha256', canvasData).update(randomStr).digest();
  if (hmac.equals(embeddedKeyBuf)) {
    console.log('*** MATCH: HMAC(canvas, random_values) ***');
  }
  
  console.log('\n=== Results ===\n');
  
  if (attempts.length > 0) {
    console.log('Found matches:');
    for (const attempt of attempts) {
      console.log(`  ${attempt.type}: ${JSON.stringify(attempt)}`);
    }
  } else {
    console.log('No matches found with standard cryptographic operations.');
    console.log('\nThe key derivation algorithm is likely:');
    console.log('1. A custom combination of fingerprint data');
    console.log('2. Using internal WASM state or constants');
    console.log('3. Multiple rounds of hashing with specific byte manipulation');
    console.log('\nTo crack this, we would need to:');
    console.log('1. Use a WASM decompiler (like Ghidra with WASM plugin)');
    console.log('2. Trace the exact byte operations in function 57');
    console.log('3. Identify the specific algorithm used');
  }
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/final-attempt.json',
    JSON.stringify({
      embeddedKey: data.embeddedKey,
      sessionId: data.sessionId,
      canvasDataLength: data.canvasData?.length,
      randomValuesCount: data.randomValues.length,
      fingerprint: {
        screenWidth: data.screenWidth,
        screenHeight: data.screenHeight,
        colorDepth: data.colorDepth,
        platform: data.platform,
        language: data.language,
        timezone: data.timezone,
      },
    }, null, 2)
  );
}

finalAttempt().catch(console.error);
