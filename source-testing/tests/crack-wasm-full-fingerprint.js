/**
 * Crack WASM - Full Fingerprint Analysis
 * 
 * Capture ALL fingerprint data and try to derive the embedded key.
 * The WASM collects:
 * - Canvas fingerprint (toDataURL)
 * - User agent
 * - Platform
 * - Language
 * - Screen dimensions
 * - Color depth
 * - Timezone offset
 * - localStorage tmdb_session_id
 * - Performance.now()
 * - Date.now()
 * - Math.random()
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function fullFingerprintAnalysis() {
  console.log('=== Full Fingerprint Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept all fingerprint-related calls
  const fingerprintData = {
    canvasDataURLs: [],
    userAgents: [],
    platforms: [],
    languages: [],
    screenWidths: [],
    screenHeights: [],
    colorDepths: [],
    timezoneOffsets: [],
    localStorageGets: [],
    localStorageSets: [],
    dateNows: [],
    performanceNows: [],
    mathRandoms: [],
  };
  
  await page.evaluateOnNewDocument(() => {
    window.__fpData = {
      canvasDataURLs: [],
      userAgents: [],
      platforms: [],
      languages: [],
      screenWidths: [],
      screenHeights: [],
      colorDepths: [],
      timezoneOffsets: [],
      localStorageGets: [],
      localStorageSets: [],
      dateNows: [],
      performanceNows: [],
      mathRandoms: [],
    };
    
    // Canvas
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const result = origToDataURL.apply(this, args);
      window.__fpData.canvasDataURLs.push(result.slice(0, 100));
      return result;
    };
    
    // Navigator
    const origUA = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      get: function() {
        const val = origUA.get.call(this);
        window.__fpData.userAgents.push(val);
        return val;
      }
    });
    
    const origPlatform = Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform');
    Object.defineProperty(Navigator.prototype, 'platform', {
      get: function() {
        const val = origPlatform.get.call(this);
        window.__fpData.platforms.push(val);
        return val;
      }
    });
    
    const origLang = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');
    Object.defineProperty(Navigator.prototype, 'language', {
      get: function() {
        const val = origLang.get.call(this);
        window.__fpData.languages.push(val);
        return val;
      }
    });
    
    // Screen
    const origWidth = Object.getOwnPropertyDescriptor(Screen.prototype, 'width');
    Object.defineProperty(Screen.prototype, 'width', {
      get: function() {
        const val = origWidth.get.call(this);
        window.__fpData.screenWidths.push(val);
        return val;
      }
    });
    
    const origHeight = Object.getOwnPropertyDescriptor(Screen.prototype, 'height');
    Object.defineProperty(Screen.prototype, 'height', {
      get: function() {
        const val = origHeight.get.call(this);
        window.__fpData.screenHeights.push(val);
        return val;
      }
    });
    
    const origColorDepth = Object.getOwnPropertyDescriptor(Screen.prototype, 'colorDepth');
    Object.defineProperty(Screen.prototype, 'colorDepth', {
      get: function() {
        const val = origColorDepth.get.call(this);
        window.__fpData.colorDepths.push(val);
        return val;
      }
    });
    
    // Date
    const origGetTZ = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function() {
      const val = origGetTZ.call(this);
      window.__fpData.timezoneOffsets.push(val);
      return val;
    };
    
    // localStorage
    const origGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      const val = origGetItem.call(this, key);
      window.__fpData.localStorageGets.push({ key, value: val });
      return val;
    };
    
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      window.__fpData.localStorageSets.push({ key, value });
      return origSetItem.call(this, key, value);
    };
    
    // Math.random
    const origRandom = Math.random;
    Math.random = function() {
      const val = origRandom.call(Math);
      window.__fpData.mathRandoms.push(val);
      return val;
    };
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get the embedded key and fingerprint data
  const result = await page.evaluate(() => {
    return {
      embeddedKey: window.wasmImgData.get_img_key(),
      fpData: window.__fpData,
      sessionId: localStorage.getItem('tmdb_session_id'),
    };
  });
  
  await browser.close();
  
  console.log(`Embedded key: ${result.embeddedKey}\n`);
  console.log(`Session ID: ${result.sessionId}\n`);
  
  console.log('Fingerprint data collected:');
  console.log(`  Canvas toDataURL calls: ${result.fpData.canvasDataURLs.length}`);
  console.log(`  User agent reads: ${result.fpData.userAgents.length}`);
  console.log(`  Platform reads: ${result.fpData.platforms.length}`);
  console.log(`  Language reads: ${result.fpData.languages.length}`);
  console.log(`  Screen width reads: ${result.fpData.screenWidths.length}`);
  console.log(`  Screen height reads: ${result.fpData.screenHeights.length}`);
  console.log(`  Color depth reads: ${result.fpData.colorDepths.length}`);
  console.log(`  Timezone offset reads: ${result.fpData.timezoneOffsets.length}`);
  console.log(`  localStorage gets: ${result.fpData.localStorageGets.length}`);
  console.log(`  localStorage sets: ${result.fpData.localStorageSets.length}`);
  console.log(`  Math.random calls: ${result.fpData.mathRandoms.length}`);
  
  // Show unique values
  console.log('\nUnique fingerprint values:');
  if (result.fpData.userAgents.length > 0) {
    console.log(`  User agent: ${result.fpData.userAgents[0]}`);
  }
  if (result.fpData.platforms.length > 0) {
    console.log(`  Platform: ${result.fpData.platforms[0]}`);
  }
  if (result.fpData.languages.length > 0) {
    console.log(`  Language: ${result.fpData.languages[0]}`);
  }
  if (result.fpData.screenWidths.length > 0) {
    console.log(`  Screen: ${result.fpData.screenWidths[0]}x${result.fpData.screenHeights[0]}`);
  }
  if (result.fpData.colorDepths.length > 0) {
    console.log(`  Color depth: ${result.fpData.colorDepths[0]}`);
  }
  if (result.fpData.timezoneOffsets.length > 0) {
    console.log(`  Timezone offset: ${result.fpData.timezoneOffsets[0]}`);
  }
  if (result.fpData.canvasDataURLs.length > 0) {
    console.log(`  Canvas (first 100 chars): ${result.fpData.canvasDataURLs[0]}`);
  }
  
  // Show localStorage operations
  console.log('\nlocalStorage operations:');
  for (const op of result.fpData.localStorageSets) {
    console.log(`  SET ${op.key} = ${op.value}`);
  }
  
  // Try to derive the key
  console.log('\n=== Key Derivation Attempts ===\n');
  
  const embeddedKeyBuf = Buffer.from(result.embeddedKey, 'hex');
  
  // Build fingerprint string like the WASM might
  const ua = result.fpData.userAgents[0] || '';
  const platform = result.fpData.platforms[0] || '';
  const language = result.fpData.languages[0] || '';
  const screenW = result.fpData.screenWidths[0] || 0;
  const screenH = result.fpData.screenHeights[0] || 0;
  const colorDepth = result.fpData.colorDepths[0] || 0;
  const tzOffset = result.fpData.timezoneOffsets[0] || 0;
  const sessionId = result.sessionId || '';
  const canvas = result.fpData.canvasDataURLs[0] || '';
  
  // Try various fingerprint combinations
  const fpStrings = [
    `${screenW}x${screenH}:${colorDepth}:${ua}:${platform}:${language}:${tzOffset}`,
    `${ua}:${platform}:${language}:${screenW}:${screenH}:${colorDepth}:${tzOffset}`,
    `${canvas}`,
    `${sessionId}`,
    `${sessionId}:${canvas}`,
    `${ua}${platform}${language}${screenW}${screenH}${colorDepth}${tzOffset}`,
    `${screenW}:${screenH}:${colorDepth}:${tzOffset}:${platform}:${language}`,
  ];
  
  for (const fpStr of fpStrings) {
    const hash = crypto.createHash('sha256').update(fpStr).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`*** MATCH! ***`);
      console.log(`Fingerprint string: ${fpStr.slice(0, 100)}...`);
    }
  }
  
  // Try HMAC with various keys
  const hmacKeys = [
    Buffer.from('TMDB Image Enhancement'),
    Buffer.from('flixer'),
    Buffer.from('img_data'),
    Buffer.from(sessionId),
  ];
  
  for (const hmacKey of hmacKeys) {
    for (const fpStr of fpStrings) {
      const hash = crypto.createHmac('sha256', hmacKey).update(fpStr).digest();
      if (hash.equals(embeddedKeyBuf)) {
        console.log(`*** MATCH! ***`);
        console.log(`HMAC key: ${hmacKey.toString()}`);
        console.log(`Fingerprint string: ${fpStr.slice(0, 100)}...`);
      }
    }
  }
  
  // The key might be derived from the canvas fingerprint hash
  if (canvas) {
    // Canvas data URL is base64 encoded PNG
    const canvasHash = crypto.createHash('sha256').update(canvas).digest();
    console.log(`\nCanvas hash: ${canvasHash.toString('hex')}`);
    console.log(`Embedded key: ${embeddedKeyBuf.toString('hex')}`);
    console.log(`Match: ${canvasHash.equals(embeddedKeyBuf)}`);
  }
  
  console.log('\nThe key derivation is complex and likely involves:');
  console.log('1. Canvas fingerprint (drawn text "TMDB Image Enhancement")');
  console.log('2. Browser properties (UA, platform, language, screen, etc.)');
  console.log('3. Session ID (timestamp-based)');
  console.log('4. Multiple rounds of hashing');
  console.log('\nWithout the exact algorithm from the WASM, we cannot replicate it.');
}

fullFingerprintAnalysis().catch(console.error);
