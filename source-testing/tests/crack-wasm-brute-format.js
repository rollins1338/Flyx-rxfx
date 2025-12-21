/**
 * Brute Force Format Discovery
 * 
 * We know the exact fingerprint components. Now we need to find
 * the exact format string that produces the key.
 * 
 * Components:
 * - screenWidth: 800
 * - screenHeight: 600
 * - colorDepth: 24
 * - timezone: 360
 * - sessionId: timestamp.random
 * - canvasData: base64 PNG
 * - userAgent, platform, language
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function bruteForceFormat() {
  console.log('=== Brute Force Format Discovery ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Get all fingerprint data
  const data = await page.evaluate(() => {
    // Generate canvas fingerprint exactly as WASM does
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = "14px Arial";
    ctx.fillText('TMDB Image Enhancement 🎬', 2, 2);
    ctx.font = "11px Arial";
    ctx.fillText('Processing capabilities test', 2, 20);
    const canvasData = canvas.toDataURL();
    
    return {
      embeddedKey: window.wasmImgData.get_img_key(),
      sessionId: localStorage.getItem('tmdb_session_id'),
      canvasData,
      canvasBase64: canvasData.split(',')[1],
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
  console.log(`Canvas base64 length: ${data.canvasBase64.length}`);
  
  const embeddedKeyBuf = Buffer.from(data.embeddedKey, 'hex');
  
  // Extract components
  const w = data.screenWidth.toString();
  const h = data.screenHeight.toString();
  const cd = data.colorDepth.toString();
  const tz = data.timezone.toString();
  const sid = data.sessionId;
  const cb64 = data.canvasBase64;
  const cdata = data.canvasData;
  const ua = data.userAgent;
  const plat = data.platform;
  const lang = data.language;
  
  // Session ID parts
  const [sidTs, sidRand] = sid.split('.');
  
  // Canvas data parts
  const cb64_22 = cb64.slice(22); // Offset 22 as seen in WAT
  const cb64_50 = cb64.slice(0, 50);
  const cb64_72 = cb64.slice(0, 72);
  
  console.log('\n=== Testing Format Combinations ===\n');
  
  let found = false;
  let attempts = 0;
  
  // Function to test a format
  function testFormat(format, name) {
    attempts++;
    const hash = crypto.createHash('sha256').update(format).digest();
    if (hash.equals(embeddedKeyBuf)) {
      console.log(`\n*** MATCH FOUND! ***`);
      console.log(`Format name: ${name}`);
      console.log(`Format: ${format.slice(0, 200)}...`);
      found = true;
      return true;
    }
    return false;
  }
  
  // Separators to try
  const seps = ['', ':', '|', '.', '-', '_', '\n', '\t', ' ', ',', ';'];
  
  // Component orders to try
  const orders = [
    // Based on trace order
    [w, h, cd, ua, plat, lang, tz, sid, cb64],
    [w, h, cd, tz, sid, cb64],
    [cb64, sid, w, h, cd, tz],
    [sid, cb64, w, h, cd, tz],
    [cb64, w, h, cd, tz, sid],
    [w, h, cd, sid, cb64],
    [sid, w, h, cd, tz, cb64],
    
    // Canvas first variations
    [cb64, sid],
    [cb64, sid, w, h, cd],
    [cb64, w, h, cd, sid],
    [cb64, tz, sid],
    
    // Session first variations
    [sid, cb64],
    [sid, cb64, w, h, cd],
    [sid, w, h, cd, cb64],
    [sid, tz, cb64],
    
    // With canvas offset 22
    [cb64_22, sid],
    [sid, cb64_22],
    [cb64_22, sid, w, h, cd],
    [sid, cb64_22, w, h, cd],
    
    // With truncated canvas
    [cb64_50, sid],
    [sid, cb64_50],
    [cb64_72, sid],
    [sid, cb64_72],
    
    // With session parts
    [cb64, sidTs, sidRand],
    [sidTs, sidRand, cb64],
    [cb64, sidTs],
    [sidTs, cb64],
    [cb64, sidRand],
    [sidRand, cb64],
    
    // Full canvas data URL
    [cdata, sid],
    [sid, cdata],
    [cdata, sid, w, h, cd],
    
    // With user agent
    [ua, cb64, sid],
    [cb64, ua, sid],
    [sid, ua, cb64],
    
    // With platform
    [plat, cb64, sid],
    [cb64, plat, sid],
    
    // Screen dimensions
    [`${w}x${h}`, cd, tz, sid, cb64],
    [cb64, `${w}x${h}`, cd, tz, sid],
  ];
  
  console.log(`Testing ${orders.length} orders with ${seps.length} separators...`);
  
  for (const order of orders) {
    if (found) break;
    for (const sep of seps) {
      if (found) break;
      const format = order.join(sep);
      testFormat(format, `order[${order.length}] sep="${sep}"`);
    }
  }
  
  // Try double hashing
  if (!found) {
    console.log('\nTrying double SHA256...');
    for (const order of orders.slice(0, 20)) {
      if (found) break;
      for (const sep of seps.slice(0, 5)) {
        if (found) break;
        const format = order.join(sep);
        const hash1 = crypto.createHash('sha256').update(format).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        attempts++;
        if (hash2.equals(embeddedKeyBuf)) {
          console.log(`\n*** MATCH with double SHA256! ***`);
          console.log(`Format: ${format.slice(0, 200)}...`);
          found = true;
        }
      }
    }
  }
  
  // Try HMAC with various keys
  if (!found) {
    console.log('\nTrying HMAC-SHA256...');
    const hmacKeys = [cb64, sid, sidTs, sidRand, cdata, ua, plat, 'TMDB Image Enhancement'];
    const hmacData = [cb64, sid, cdata, `${w}:${h}:${cd}:${tz}`];
    
    for (const key of hmacKeys) {
      if (found) break;
      for (const d of hmacData) {
        if (found) break;
        if (key === d) continue;
        try {
          const hmac = crypto.createHmac('sha256', key).update(d).digest();
          attempts++;
          if (hmac.equals(embeddedKeyBuf)) {
            console.log(`\n*** MATCH with HMAC! ***`);
            console.log(`Key: ${key.slice(0, 50)}...`);
            console.log(`Data: ${d.slice(0, 50)}...`);
            found = true;
          }
        } catch (e) {}
      }
    }
  }
  
  // Try with specific format strings from WASM
  if (!found) {
    console.log('\nTrying specific WASM format patterns...');
    
    // The WASM uses format specifiers, likely building a string like:
    // "{width}:{height}:{colorDepth}:{timezone}:{sessionId}:{canvas}"
    
    const patterns = [
      `${w}:${h}:${cd}:${tz}:${sid}:${cb64}`,
      `${cb64}:${w}:${h}:${cd}:${tz}:${sid}`,
      `${sid}:${w}:${h}:${cd}:${tz}:${cb64}`,
      `${w}|${h}|${cd}|${tz}|${sid}|${cb64}`,
      `${cb64}|${w}|${h}|${cd}|${tz}|${sid}`,
      `${sid}|${w}|${h}|${cd}|${tz}|${cb64}`,
      `${w}.${h}.${cd}.${tz}.${sid}.${cb64}`,
      `${cb64}.${w}.${h}.${cd}.${tz}.${sid}`,
      `${sid}.${w}.${h}.${cd}.${tz}.${cb64}`,
      
      // With user agent
      `${w}:${h}:${cd}:${ua}:${plat}:${lang}:${tz}:${sid}:${cb64}`,
      `${cb64}:${w}:${h}:${cd}:${ua}:${plat}:${lang}:${tz}:${sid}`,
      
      // Truncated versions
      `${w.slice(0,50)}:${h.slice(0,20)}:${cd.slice(0,10)}:${sid.slice(0,10)}:${cb64_22}`,
      `${cb64_22}:${w.slice(0,50)}:${h.slice(0,20)}:${cd.slice(0,10)}:${sid.slice(0,10)}`,
    ];
    
    for (const pattern of patterns) {
      if (testFormat(pattern, 'specific pattern')) break;
    }
  }
  
  // Try XOR combinations
  if (!found) {
    console.log('\nTrying XOR of hashes...');
    const hashes = {
      canvas: crypto.createHash('sha256').update(cb64).digest(),
      session: crypto.createHash('sha256').update(sid).digest(),
      fp: crypto.createHash('sha256').update(`${w}:${h}:${cd}:${tz}`).digest(),
    };
    
    // XOR canvas and session
    const xor1 = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xor1[i] = hashes.canvas[i] ^ hashes.session[i];
    }
    attempts++;
    if (xor1.equals(embeddedKeyBuf)) {
      console.log('*** MATCH: SHA256(canvas) XOR SHA256(session) ***');
      found = true;
    }
    
    // XOR all three
    const xor2 = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xor2[i] = hashes.canvas[i] ^ hashes.session[i] ^ hashes.fp[i];
    }
    attempts++;
    if (xor2.equals(embeddedKeyBuf)) {
      console.log('*** MATCH: SHA256(canvas) XOR SHA256(session) XOR SHA256(fp) ***');
      found = true;
    }
  }
  
  console.log(`\nTotal attempts: ${attempts}`);
  
  if (!found) {
    console.log('\nNo match found with standard combinations.');
    console.log('The key derivation uses a more complex algorithm.');
    console.log('\nPossible reasons:');
    console.log('1. Multiple rounds of hashing');
    console.log('2. Custom byte manipulation');
    console.log('3. Additional internal state');
    console.log('4. Different encoding (UTF-16, etc.)');
  }
  
  // Save data for further analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/brute-force-data.json',
    JSON.stringify({
      embeddedKey: data.embeddedKey,
      sessionId: data.sessionId,
      canvasBase64Length: data.canvasBase64.length,
      screenWidth: data.screenWidth,
      screenHeight: data.screenHeight,
      colorDepth: data.colorDepth,
      timezone: data.timezone,
      platform: data.platform,
      language: data.language,
      userAgentLength: data.userAgent.length,
    }, null, 2)
  );
}

bruteForceFormat().catch(console.error);
