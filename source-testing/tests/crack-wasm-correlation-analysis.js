/**
 * Correlation Analysis - Collect multiple samples and analyze patterns
 * 
 * By collecting many samples with known inputs, we can try to find
 * the correlation between inputs and the generated key.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function collectSample(browser) {
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
  
  await page.close();
  return data;
}

async function correlationAnalysis() {
  console.log('=== Correlation Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  // Collect multiple samples
  const samples = [];
  const numSamples = 5;
  
  console.log(`Collecting ${numSamples} samples...\n`);
  
  for (let i = 0; i < numSamples; i++) {
    console.log(`Sample ${i + 1}...`);
    const sample = await collectSample(browser);
    samples.push(sample);
    console.log(`  Key: ${sample.key}`);
    console.log(`  Session: ${sample.sessionId}`);
    
    // Wait between samples
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
  
  console.log('\n=== Analysis ===\n');
  
  // All samples should have the same canvas (same browser)
  const canvasMatch = samples.every(s => s.canvasBase64 === samples[0].canvasBase64);
  console.log(`Canvas consistent: ${canvasMatch}`);
  
  // All samples should have the same fingerprint (except session)
  const fpMatch = samples.every(s => 
    s.fingerprint.screenWidth === samples[0].fingerprint.screenWidth &&
    s.fingerprint.colorDepth === samples[0].fingerprint.colorDepth &&
    s.fingerprint.platform === samples[0].fingerprint.platform
  );
  console.log(`Fingerprint consistent: ${fpMatch}`);
  
  // Keys should all be different (different sessions)
  const uniqueKeys = new Set(samples.map(s => s.key)).size;
  console.log(`Unique keys: ${uniqueKeys}/${numSamples}`);
  
  // Now let's try to find the format
  console.log('\n=== Testing Format Hypotheses ===\n');
  
  const fp = samples[0].fingerprint;
  const canvasBase64 = samples[0].canvasBase64;
  
  // Test each sample
  for (const sample of samples) {
    const keyBuf = Buffer.from(sample.key, 'hex');
    const [timestamp, random] = sample.sessionId.split('.');
    
    console.log(`\nSample: ${sample.sessionId}`);
    console.log(`Key: ${sample.key}`);
    
    // Try many format combinations
    const formats = [
      // Basic formats
      `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`,
      `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${sample.sessionId}:${canvasBase64.slice(0, 50)}`,
      
      // With full canvas
      `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`,
      
      // Different separators
      `${fp.colorDepth}|${fp.userAgent.slice(0, 50)}|${fp.platform}|${fp.language}|${fp.timezone}|${timestamp}|${canvasBase64.slice(0, 50)}`,
      
      // Without colorDepth
      `${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`,
      
      // With screen dimensions
      `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`,
      
      // Just timestamp and canvas
      `${timestamp}:${canvasBase64}`,
      `${sample.sessionId}:${canvasBase64}`,
      
      // Canvas first
      `${canvasBase64}:${timestamp}`,
      `${canvasBase64}:${sample.sessionId}`,
      
      // With random part
      `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${random}:${canvasBase64.slice(0, 50)}`,
    ];
    
    let found = false;
    for (const format of formats) {
      const hash = crypto.createHash('sha256').update(format).digest();
      if (hash.equals(keyBuf)) {
        console.log(`*** MATCH: ${format.slice(0, 100)}... ***`);
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Try HMAC with various keys
      const hmacKeys = [
        canvasBase64,
        canvasBase64.slice(0, 50),
        fp.userAgent,
        fp.userAgent.slice(0, 50),
        'flixer',
        'tmdb',
      ];
      
      const hmacData = [
        sample.sessionId,
        timestamp,
        `${timestamp}:${canvasBase64.slice(0, 50)}`,
        `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}`,
      ];
      
      for (const key of hmacKeys) {
        for (const data of hmacData) {
          try {
            const hmac = crypto.createHmac('sha256', key).update(data).digest();
            if (hmac.equals(keyBuf)) {
              console.log(`*** HMAC MATCH: key=${key.slice(0, 30)}..., data=${data.slice(0, 30)}... ***`);
              found = true;
              break;
            }
          } catch (e) {}
        }
        if (found) break;
      }
    }
    
    if (!found) {
      console.log('No match found for this sample');
    }
  }
  
  // Save samples for further analysis
  fs.writeFileSync(
    'source-testing/tests/wasm-analysis/correlation-samples.json',
    JSON.stringify(samples.map(s => ({
      key: s.key,
      sessionId: s.sessionId,
      canvasBase64Length: s.canvasBase64.length,
      canvasBase64First100: s.canvasBase64.slice(0, 100),
      fingerprint: s.fingerprint,
    })), null, 2)
  );
  
  console.log('\nSamples saved to: source-testing/tests/wasm-analysis/correlation-samples.json');
}

correlationAnalysis().catch(console.error);
