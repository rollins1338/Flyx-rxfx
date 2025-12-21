/**
 * Format String Discovery
 * 
 * The WASM uses Rust's format! macro to build the fingerprint string.
 * Let's try to discover the exact format by:
 * 1. Running multiple sessions with controlled fingerprint values
 * 2. Comparing the resulting keys to find patterns
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function collectSample(browser, sampleNum) {
  const page = await browser.newPage();
  
  // Set specific viewport to control screen dimensions
  await page.setViewport({ width: 800, height: 600 });
  
  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const data = await page.evaluate(() => {
    // Get canvas fingerprint
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
  
  await page.close();
  
  return data;
}

async function formatStringDiscovery() {
  console.log('=== Format String Discovery ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  // Collect multiple samples
  const samples = [];
  
  for (let i = 0; i < 3; i++) {
    console.log(`Collecting sample ${i + 1}...`);
    const sample = await collectSample(browser, i);
    samples.push(sample);
    console.log(`  Key: ${sample.embeddedKey}`);
    console.log(`  Session: ${sample.sessionId}`);
    
    // Wait a bit between samples
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
  
  console.log('\n=== Analyzing Samples ===\n');
  
  // All samples should have the same canvas fingerprint (same browser)
  const canvasMatch = samples.every(s => s.canvasBase64 === samples[0].canvasBase64);
  console.log(`Canvas fingerprint consistent: ${canvasMatch}`);
  
  // Session IDs should be different
  const sessionsDifferent = new Set(samples.map(s => s.sessionId)).size === samples.length;
  console.log(`Session IDs different: ${sessionsDifferent}`);
  
  // Keys should be different (since session IDs are different)
  const keysDifferent = new Set(samples.map(s => s.embeddedKey)).size === samples.length;
  console.log(`Keys different: ${keysDifferent}`);
  
  // Now let's try to find the relationship between session ID and key
  console.log('\n=== Key Derivation Analysis ===\n');
  
  for (const sample of samples) {
    console.log(`\nSample:`);
    console.log(`  Session: ${sample.sessionId}`);
    console.log(`  Key: ${sample.embeddedKey}`);
    
    const embeddedKeyBuf = Buffer.from(sample.embeddedKey, 'hex');
    const cb64 = sample.canvasBase64;
    const sid = sample.sessionId;
    
    // The key is likely: SHA256(canvas + separator + session + separator + fingerprint)
    // Let's try to find the exact format
    
    // Try with the exact fingerprint values
    const fp = {
      w: sample.screenWidth.toString(),
      h: sample.screenHeight.toString(),
      cd: sample.colorDepth.toString(),
      tz: sample.timezone.toString(),
      ua: sample.userAgent,
      plat: sample.platform,
      lang: sample.language,
    };
    
    // The format string from WASM analysis shows 9 components
    // Let's try various 9-component formats
    
    const formats = [
      // Format: {w}:{h}:{cd}:{ua}:{plat}:{lang}:{tz}:{sid}:{canvas}
      `${fp.w}:${fp.h}:${fp.cd}:${fp.ua}:${fp.plat}:${fp.lang}:${fp.tz}:${sid}:${cb64}`,
      
      // Format: {canvas}:{w}:{h}:{cd}:{ua}:{plat}:{lang}:{tz}:{sid}
      `${cb64}:${fp.w}:${fp.h}:${fp.cd}:${fp.ua}:${fp.plat}:${fp.lang}:${fp.tz}:${sid}`,
      
      // Format: {sid}:{canvas}:{w}:{h}:{cd}:{ua}:{plat}:{lang}:{tz}
      `${sid}:${cb64}:${fp.w}:${fp.h}:${fp.cd}:${fp.ua}:${fp.plat}:${fp.lang}:${fp.tz}`,
      
      // Without user agent (might be truncated)
      `${fp.w}:${fp.h}:${fp.cd}:${fp.tz}:${sid}:${cb64}`,
      `${cb64}:${fp.w}:${fp.h}:${fp.cd}:${fp.tz}:${sid}`,
      `${sid}:${cb64}:${fp.w}:${fp.h}:${fp.cd}:${fp.tz}`,
      
      // With pipe separator
      `${fp.w}|${fp.h}|${fp.cd}|${fp.tz}|${sid}|${cb64}`,
      `${cb64}|${fp.w}|${fp.h}|${fp.cd}|${fp.tz}|${sid}`,
      
      // Simple concatenation
      `${cb64}${sid}`,
      `${sid}${cb64}`,
      `${cb64}${sid}${fp.w}${fp.h}${fp.cd}${fp.tz}`,
    ];
    
    for (const format of formats) {
      const hash = crypto.createHash('sha256').update(format).digest();
      if (hash.equals(embeddedKeyBuf)) {
        console.log(`  *** MATCH: ${format.slice(0, 100)}... ***`);
      }
    }
    
    // Try HMAC with canvas as key
    const hmacTests = [
      { key: cb64, data: sid },
      { key: sid, data: cb64 },
      { key: cb64, data: `${sid}:${fp.w}:${fp.h}:${fp.cd}:${fp.tz}` },
      { key: sid, data: `${cb64}:${fp.w}:${fp.h}:${fp.cd}:${fp.tz}` },
    ];
    
    for (const test of hmacTests) {
      try {
        const hmac = crypto.createHmac('sha256', test.key).update(test.data).digest();
        if (hmac.equals(embeddedKeyBuf)) {
          console.log(`  *** HMAC MATCH: key=${test.key.slice(0,30)}..., data=${test.data.slice(0,30)}... ***`);
        }
      } catch (e) {}
    }
  }
  
  // Save samples for further analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/format-samples.json',
    JSON.stringify(samples.map(s => ({
      embeddedKey: s.embeddedKey,
      sessionId: s.sessionId,
      canvasBase64Length: s.canvasBase64.length,
      screenWidth: s.screenWidth,
      screenHeight: s.screenHeight,
      colorDepth: s.colorDepth,
      timezone: s.timezone,
      platform: s.platform,
      language: s.language,
    })), null, 2)
  );
  
  console.log('\nSamples saved to: source-testing/tests/wasm-analysis/format-samples.json');
  
  // Final attempt: Try to find the format by analyzing the WAT more carefully
  console.log('\n=== WAT Analysis Hints ===\n');
  console.log('From the WAT analysis, the key derivation:');
  console.log('1. Collects 9 fingerprint components');
  console.log('2. Uses format specifiers (i32.const 9 appears multiple times)');
  console.log('3. Calls function 122 (SHA256 update) and 175 (SHA256 finalize)');
  console.log('4. The format string is at offset 1051108');
  console.log('\nThe exact format is obfuscated in the compiled Rust code.');
}

formatStringDiscovery().catch(console.error);
