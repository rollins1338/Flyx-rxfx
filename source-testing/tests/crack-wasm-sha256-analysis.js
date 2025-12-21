/**
 * SHA256 Analysis for WASM Key Derivation
 * 
 * The WASM uses SHA256 (confirmed by the initial hash values in the data section).
 * The key derivation likely:
 * 1. Collects fingerprint data (canvas, session, screen, etc.)
 * 2. Formats it into a specific string
 * 3. Hashes it with SHA256
 * 
 * The format string at 1051108 suggests a specific format is used.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function sha256Analysis() {
  console.log('=== SHA256 Analysis for Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Capture all data
  await page.evaluateOnNewDocument(() => {
    window.__capture = {
      canvasData: null,
      randomValues: [],
    };
    
    const origRandom = Math.random;
    Math.random = function() {
      const result = origRandom.call(this);
      window.__capture.randomValues.push(result);
      return result;
    };
    
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
  console.log(`Canvas length: ${data.canvasData?.length || 0}`);
  
  const embeddedKeyBuf = Buffer.from(data.embeddedKey, 'hex');
  
  // Based on the WAT analysis, the fingerprint data is formatted as:
  // - Screen width (up to 50 chars)
  // - Screen height (up to 20 chars)
  // - Color depth (up to 10 chars)
  // - Session ID (up to 10 chars)
  // - Canvas data (starting at offset 22)
  // - Plus other components
  
  // The format string at 1051108 is just "." which might be a separator
  
  console.log('\n=== Trying SHA256 with various formats ===\n');
  
  const canvasData = data.canvasData;
  const canvasBase64 = canvasData.split(',')[1];
  const sessionId = data.sessionId;
  
  // Extract canvas data starting at offset 22 (as seen in WAT)
  const canvasOffset22 = canvasBase64.slice(22);
  
  // Build fingerprint components
  const fp = {
    width: data.screenWidth.toString(),
    height: data.screenHeight.toString(),
    colorDepth: data.colorDepth.toString(),
    timezone: data.timezone.toString(),
    userAgent: data.userAgent,
    platform: data.platform,
    language: data.language,
  };
  
  // Try various format combinations
  const formats = [
    // Simple concatenations
    `${fp.width}${fp.height}${fp.colorDepth}${sessionId}${canvasBase64}`,
    `${fp.width}.${fp.height}.${fp.colorDepth}.${sessionId}.${canvasBase64}`,
    `${fp.width}:${fp.height}:${fp.colorDepth}:${sessionId}:${canvasBase64}`,
    
    // With canvas offset
    `${fp.width}${fp.height}${fp.colorDepth}${sessionId}${canvasOffset22}`,
    `${fp.width}.${fp.height}.${fp.colorDepth}.${sessionId}.${canvasOffset22}`,
    
    // Different orders
    `${canvasBase64}${sessionId}${fp.width}${fp.height}${fp.colorDepth}`,
    `${sessionId}${canvasBase64}${fp.width}${fp.height}${fp.colorDepth}`,
    
    // With all fingerprint data
    `${fp.width}${fp.height}${fp.colorDepth}${fp.userAgent}${fp.platform}${fp.language}${fp.timezone}${sessionId}${canvasBase64}`,
    
    // Truncated versions (as seen in WAT: 50, 20, 10, 10 chars)
    `${fp.width.slice(0, 50)}${fp.height.slice(0, 20)}${fp.colorDepth.slice(0, 10)}${sessionId.slice(0, 10)}${canvasOffset22}`,
    
    // With separators
    `${fp.width.slice(0, 50)}.${fp.height.slice(0, 20)}.${fp.colorDepth.slice(0, 10)}.${sessionId.slice(0, 10)}.${canvasOffset22}`,
    
    // Canvas first
    `${canvasBase64}${fp.width}${fp.height}${fp.colorDepth}${sessionId}`,
    `${canvasOffset22}${fp.width}${fp.height}${fp.colorDepth}${sessionId}`,
    
    // Just canvas parts
    canvasBase64,
    canvasOffset22,
    canvasData,
    
    // Session + canvas
    `${sessionId}${canvasBase64}`,
    `${canvasBase64}${sessionId}`,
    `${sessionId}${canvasOffset22}`,
    `${canvasOffset22}${sessionId}`,
    
    // With timezone
    `${fp.width}${fp.height}${fp.colorDepth}${fp.timezone}${sessionId}${canvasBase64}`,
    `${fp.timezone}${fp.width}${fp.height}${fp.colorDepth}${sessionId}${canvasBase64}`,
  ];
  
  for (const format of formats) {
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: SHA256("${format.slice(0, 80)}...") ***`);
    }
  }
  
  // Try with binary data
  console.log('\nTrying with binary canvas data...');
  
  const canvasBinary = Buffer.from(canvasBase64, 'base64');
  
  const binaryFormats = [
    canvasBinary,
    Buffer.concat([canvasBinary, Buffer.from(sessionId)]),
    Buffer.concat([Buffer.from(sessionId), canvasBinary]),
    Buffer.concat([Buffer.from(fp.width), Buffer.from(fp.height), Buffer.from(fp.colorDepth), canvasBinary]),
  ];
  
  for (const format of binaryFormats) {
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with binary format! ***`);
    }
  }
  
  // Try double SHA256
  console.log('\nTrying double SHA256...');
  
  for (const format of formats.slice(0, 10)) {
    const hash1 = crypto.createHash('sha256').update(format).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();
    if (hash2.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH: SHA256(SHA256("${format.slice(0, 50)}...")) ***`);
    }
  }
  
  // Try SHA256 of concatenated hashes
  console.log('\nTrying SHA256 of concatenated hashes...');
  
  const canvasHash = crypto.createHash('sha256').update(canvasBase64).digest();
  const sessionHash = crypto.createHash('sha256').update(sessionId).digest();
  const fpHash = crypto.createHash('sha256').update(`${fp.width}${fp.height}${fp.colorDepth}`).digest();
  
  const hashCombos = [
    Buffer.concat([canvasHash, sessionHash]),
    Buffer.concat([sessionHash, canvasHash]),
    Buffer.concat([canvasHash, fpHash]),
    Buffer.concat([sessionHash, fpHash]),
    Buffer.concat([canvasHash, sessionHash, fpHash]),
    Buffer.concat([fpHash, canvasHash, sessionHash]),
  ];
  
  for (const combo of hashCombos) {
    const hash = crypto.createHash('sha256').update(combo).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with hash concatenation! ***`);
    }
  }
  
  // Try XOR of hashes
  console.log('\nTrying XOR of hashes...');
  
  const xorResult = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorResult[i] = canvasHash[i] ^ sessionHash[i];
  }
  if (xorResult.equals(embeddedKeyBuf)) {
    console.log('*** MATCH: canvasHash XOR sessionHash ***');
  }
  
  // The hash might also include the random values
  console.log('\nTrying with random values...');
  
  const lastRandom = data.randomValues[data.randomValues.length - 1];
  const randomStr = lastRandom.toString();
  
  const randomFormats = [
    `${canvasBase64}${randomStr}`,
    `${randomStr}${canvasBase64}`,
    `${sessionId}${randomStr}${canvasBase64}`,
    `${canvasBase64}${sessionId}${randomStr}`,
  ];
  
  for (const format of randomFormats) {
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH with random: SHA256("${format.slice(0, 50)}...") ***`);
    }
  }
  
  console.log('\n=== Analysis Complete ===\n');
  console.log('The key derivation uses SHA256 but with a specific format that');
  console.log('combines multiple fingerprint components in a way that is');
  console.log('obfuscated in the compiled WASM code.');
  console.log('\nTo fully reverse engineer this, we would need to:');
  console.log('1. Trace the exact byte sequence passed to SHA256');
  console.log('2. Identify the format string and separators used');
  console.log('3. Understand the order and truncation of components');
  
  // Save data
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/sha256-analysis.json',
    JSON.stringify({
      embeddedKey: data.embeddedKey,
      sessionId: data.sessionId,
      canvasLength: data.canvasData?.length,
      fingerprint: fp,
    }, null, 2)
  );
}

sha256Analysis().catch(console.error);
