/**
 * Replicate WASM Fingerprint Generation
 * 
 * Based on the extracted strings and trace, replicate the exact fingerprint
 * generation to derive the key.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function replicateFingerprint() {
  console.log('=== Replicate WASM Fingerprint ===\n');
  
  // First, get the actual fingerprint from the browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Capture all fingerprint data
  await page.evaluateOnNewDocument(() => {
    window.__fpData = {};
    
    // Clear localStorage
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get all fingerprint data
  const browserData = await page.evaluate(() => {
    // Generate canvas fingerprint exactly as WASM does
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillText('TMDB Image Enhancement', 2, 2);
    ctx.font = "11px 'Arial'";
    ctx.fillText('Processing capabilities test', 4, 17);
    
    const canvasData = canvas.toDataURL();
    
    return {
      embeddedKey: window.wasmImgData.get_img_key(),
      sessionId: localStorage.getItem('tmdb_session_id'),
      canvasData: canvasData,
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
  
  console.log('Browser fingerprint data:');
  console.log(`  Embedded key: ${browserData.embeddedKey}`);
  console.log(`  Session ID: ${browserData.sessionId}`);
  console.log(`  Screen: ${browserData.screenWidth}x${browserData.screenHeight}x${browserData.colorDepth}`);
  console.log(`  Platform: ${browserData.platform}`);
  console.log(`  Language: ${browserData.language}`);
  console.log(`  Timezone: ${browserData.timezone}`);
  console.log(`  Canvas length: ${browserData.canvasData.length}`);
  
  const embeddedKeyBuf = Buffer.from(browserData.embeddedKey, 'hex');
  
  console.log('\n=== Key Derivation Attempts ===\n');
  
  // The WASM likely combines these in a specific order and hashes them
  // Based on the trace, the order is:
  // 1. userAgent
  // 2. screen width/height
  // 3. colorDepth
  // 4. platform
  // 5. language
  // 6. timezone
  // 7. sessionId (from localStorage or generated)
  // 8. canvas fingerprint
  
  const fp = browserData;
  
  // Try many different combinations
  const combinations = [
    // Simple hashes
    { name: 'canvas', data: fp.canvasData },
    { name: 'sessionId', data: fp.sessionId },
    { name: 'canvas_base64', data: fp.canvasData.split(',')[1] },
    
    // Concatenations
    { name: 'canvas:session', data: `${fp.canvasData}:${fp.sessionId}` },
    { name: 'session:canvas', data: `${fp.sessionId}:${fp.canvasData}` },
    { name: 'canvas+session', data: `${fp.canvasData}${fp.sessionId}` },
    { name: 'session+canvas', data: `${fp.sessionId}${fp.canvasData}` },
    
    // With fingerprint data
    { name: 'fp_string', data: `${fp.screenWidth}x${fp.screenHeight}:${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}` },
    { name: 'fp_simple', data: `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}` },
    
    // Canvas + fingerprint
    { name: 'canvas:fp', data: `${fp.canvasData}:${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}` },
    { name: 'fp:canvas', data: `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}:${fp.canvasData}` },
    
    // Session + fingerprint
    { name: 'session:fp', data: `${fp.sessionId}:${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}` },
    { name: 'fp:session', data: `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.timezone}:${fp.sessionId}` },
    
    // All combined
    { name: 'all_colon', data: `${fp.canvasData}:${fp.sessionId}:${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}` },
    { name: 'all_pipe', data: `${fp.canvasData}|${fp.sessionId}|${fp.screenWidth}|${fp.screenHeight}|${fp.colorDepth}|${fp.userAgent}|${fp.platform}|${fp.language}|${fp.timezone}` },
    
    // Just canvas base64 + session
    { name: 'base64:session', data: `${fp.canvasData.split(',')[1]}:${fp.sessionId}` },
    { name: 'session:base64', data: `${fp.sessionId}:${fp.canvasData.split(',')[1]}` },
    
    // Try with newlines
    { name: 'canvas_nl_session', data: `${fp.canvasData}\n${fp.sessionId}` },
    { name: 'session_nl_canvas', data: `${fp.sessionId}\n${fp.canvasData}` },
    
    // Try with specific separators
    { name: 'canvas_dash_session', data: `${fp.canvasData}-${fp.sessionId}` },
    { name: 'canvas_underscore_session', data: `${fp.canvasData}_${fp.sessionId}` },
  ];
  
  // Also try HMAC with various keys
  const hmacKeys = [
    'tmdb_session_id',
    'TMDB Image Enhancement',
    'Processing capabilities test',
    fp.sessionId,
    fp.canvasData.split(',')[1]?.slice(0, 32) || '',
  ];
  
  for (const combo of combinations) {
    // SHA256
    const sha256 = crypto.createHash('sha256').update(combo.data).digest();
    if (sha256.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with SHA256(${combo.name})! ***`);
    }
    
    // SHA512 truncated
    const sha512 = crypto.createHash('sha512').update(combo.data).digest().slice(0, 32);
    if (sha512.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with SHA512(${combo.name})! ***`);
    }
    
    // MD5 doubled
    const md5 = crypto.createHash('md5').update(combo.data).digest();
    const md5Doubled = Buffer.concat([md5, md5]);
    if (md5Doubled.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with MD5x2(${combo.name})! ***`);
    }
    
    // HMAC with various keys
    for (const hmacKey of hmacKeys) {
      if (!hmacKey) continue;
      const hmac = crypto.createHmac('sha256', hmacKey).update(combo.data).digest();
      if (hmac.equals(embeddedKeyBuf)) {
        console.log(`*** MATCH with HMAC-SHA256(${combo.name}, key=${hmacKey.slice(0, 20)})! ***`);
      }
    }
  }
  
  // Try double hashing
  console.log('\nTrying double hashing...');
  for (const combo of combinations.slice(0, 10)) {
    const hash1 = crypto.createHash('sha256').update(combo.data).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();
    if (hash2.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with SHA256(SHA256(${combo.name}))! ***`);
    }
  }
  
  // Try XOR combinations
  console.log('\nTrying XOR combinations...');
  const canvasHash = crypto.createHash('sha256').update(fp.canvasData).digest();
  const sessionHash = crypto.createHash('sha256').update(fp.sessionId).digest();
  
  const xorResult = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorResult[i] = canvasHash[i] ^ sessionHash[i];
  }
  if (xorResult.equals(embeddedKeyBuf)) {
    console.log('*** MATCH with SHA256(canvas) XOR SHA256(session)! ***');
  }
  
  // Try HKDF
  console.log('\nTrying HKDF...');
  const hkdfSalt = Buffer.from(fp.sessionId);
  const hkdfInfo = Buffer.from('TMDB Image Enhancement');
  const hkdfKey = crypto.hkdfSync('sha256', fp.canvasData, hkdfSalt, hkdfInfo, 32);
  if (Buffer.from(hkdfKey).equals(embeddedKeyBuf)) {
    console.log('*** MATCH with HKDF(canvas, session, "TMDB...")! ***');
  }
  
  // Try PBKDF2
  console.log('\nTrying PBKDF2...');
  const pbkdf2Key = crypto.pbkdf2Sync(fp.canvasData, fp.sessionId, 1, 32, 'sha256');
  if (pbkdf2Key.equals(embeddedKeyBuf)) {
    console.log('*** MATCH with PBKDF2(canvas, session, 1)! ***');
  }
  
  console.log('\nNo simple derivation found. The key derivation is more complex.');
  console.log('\nThe WASM likely uses a custom algorithm combining:');
  console.log('  - Canvas fingerprint');
  console.log('  - Session ID');
  console.log('  - Screen/navigator properties');
  console.log('  - Possibly internal state or constants');
  
  // Save data for further analysis
  const fs = require('fs');
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/fingerprint-data.json',
    JSON.stringify(browserData, null, 2)
  );
  console.log('\nFingerprint data saved to: source-testing/tests/wasm-analysis/fingerprint-data.json');
}

replicateFingerprint().catch(console.error);
