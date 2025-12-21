/**
 * Exact Format Discovery
 * 
 * Based on memory analysis, the format appears to be:
 * {userAgent_part}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64}
 * 
 * Let's find the exact format and verify it.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function findExactFormat() {
  console.log('=== Exact Format Discovery ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Inject to capture all fingerprint data
  await page.evaluateOnNewDocument(() => {
    window.__fpData = {
      canvasDataURL: null,
      sessionId: null,
    };
    
    // Intercept canvas toDataURL
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      // Only capture the fingerprint canvas (200x50)
      if (this.width === 200 && this.height === 50) {
        window.__fpData.canvasDataURL = result;
        console.log(`[FP] Canvas fingerprint captured: ${result.length} chars`);
      }
      return result;
    };
    
    // Intercept localStorage
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tmdb_session_id') {
        window.__fpData.sessionId = value;
        console.log(`[FP] Session ID set: ${value}`);
      }
      return origSetItem.call(this, key, value);
    };
    
    const origGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      const result = origGetItem.call(this, key);
      if (key === 'tmdb_session_id' && result) {
        window.__fpData.sessionId = result;
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
  
  // Get all the data
  const data = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    
    return {
      key,
      sessionId: window.__fpData.sessionId || localStorage.getItem('tmdb_session_id'),
      canvasDataURL: window.__fpData.canvasDataURL,
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
  console.log(`Canvas length: ${data.canvasDataURL?.length || 0}`);
  
  const fp = data.fingerprint;
  const sid = data.sessionId;
  const canvasBase64 = data.canvasDataURL?.split(',')[1] || '';
  const keyBuf = Buffer.from(data.key, 'hex');
  
  console.log('\nFingerprint components:');
  console.log(`  screenWidth: ${fp.screenWidth}`);
  console.log(`  screenHeight: ${fp.screenHeight}`);
  console.log(`  colorDepth: ${fp.colorDepth}`);
  console.log(`  userAgent: ${fp.userAgent}`);
  console.log(`  platform: ${fp.platform}`);
  console.log(`  language: ${fp.language}`);
  console.log(`  timezone: ${fp.timezone}`);
  console.log(`  sessionId: ${sid}`);
  console.log(`  canvasBase64: ${canvasBase64.slice(0, 50)}... (${canvasBase64.length} chars)`);
  
  // Parse session ID
  const [timestamp, random] = sid.split('.');
  console.log(`\nSession ID parts:`);
  console.log(`  timestamp: ${timestamp}`);
  console.log(`  random: ${random}`);
  
  console.log('\n=== Testing Format Combinations ===\n');
  
  // Based on memory dump: "Win64; x64) AppleWeb:Win32:en-US:360:1766277949:iVBORw0..."
  // This suggests the format is:
  // {userAgent_suffix}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64}
  
  // But we need to find the exact userAgent part
  // Let's try different truncations
  
  const ua = fp.userAgent;
  const uaParts = [
    ua,
    ua.slice(-50),
    ua.slice(-100),
    ua.slice(0, 50),
    ua.slice(0, 100),
    // Common truncation points
    ua.split(') ')[0] + ')',
    ua.split('(')[1]?.split(')')[0] || '',
    ua.match(/\(([^)]+)\)/)?.[1] || '',
  ];
  
  // Try various formats
  let found = false;
  
  for (const uaPart of uaParts) {
    if (!uaPart) continue;
    
    // Format: {ua}:{platform}:{language}:{timezone}:{timestamp}:{canvas}
    const formats = [
      `${uaPart}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`,
      `${uaPart}:${fp.platform}:${fp.language}:${fp.timezone}:${sid}:${canvasBase64}`,
      `${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`,
      `${fp.platform}:${fp.language}:${fp.timezone}:${sid}:${canvasBase64}`,
      
      // With screen dimensions
      `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${uaPart}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`,
      `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`,
      
      // Without userAgent
      `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.platform}:${fp.language}:${fp.timezone}:${sid}:${canvasBase64}`,
      `${fp.screenWidth}:${fp.screenHeight}:${fp.colorDepth}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`,
    ];
    
    for (const format of formats) {
      const hash = crypto.createHash('sha256').update(format).digest();
      if (hash.equals(keyBuf)) {
        console.log(`*** MATCH FOUND! ***`);
        console.log(`Format: ${format.slice(0, 200)}...`);
        found = true;
        break;
      }
    }
    if (found) break;
  }
  
  if (!found) {
    console.log('No match with simple formats. Trying more variations...\n');
    
    // Try with different separators
    const seps = [':', '|', '.', '', '-', '_'];
    
    for (const sep of seps) {
      // Basic format without userAgent
      const format1 = [fp.screenWidth, fp.screenHeight, fp.colorDepth, fp.platform, fp.language, fp.timezone, timestamp, canvasBase64].join(sep);
      const format2 = [fp.screenWidth, fp.screenHeight, fp.colorDepth, fp.platform, fp.language, fp.timezone, sid, canvasBase64].join(sep);
      const format3 = [fp.platform, fp.language, fp.timezone, timestamp, canvasBase64].join(sep);
      const format4 = [fp.platform, fp.language, fp.timezone, sid, canvasBase64].join(sep);
      
      for (const format of [format1, format2, format3, format4]) {
        const hash = crypto.createHash('sha256').update(format).digest();
        if (hash.equals(keyBuf)) {
          console.log(`*** MATCH FOUND! ***`);
          console.log(`Separator: "${sep}"`);
          console.log(`Format: ${format.slice(0, 200)}...`);
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  
  if (!found) {
    console.log('No match found. Let me try to extract the exact string from WASM memory...\n');
    await extractFromMemory();
  }
}

async function extractFromMemory() {
  console.log('=== Memory Extraction ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__memCapture = null;
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      const memory = result.instance.exports.memory;
      const origGetImgKey = result.instance.exports.get_img_key;
      
      result.instance.exports.get_img_key = function(retptr) {
        // Snapshot before
        const memBefore = new Uint8Array(memory.buffer.slice(0));
        
        const ret = origGetImgKey.apply(this, arguments);
        
        // Snapshot after
        const memAfter = new Uint8Array(memory.buffer.slice(0));
        
        // Find all strings that contain "iVBORw" (PNG base64 header)
        const pngHeader = [105, 86, 66, 79, 82, 119]; // "iVBORw"
        const foundStrings = [];
        
        for (let i = 0; i < memAfter.length - 1000; i++) {
          let match = true;
          for (let j = 0; j < pngHeader.length; j++) {
            if (memAfter[i + j] !== pngHeader[j]) {
              match = false;
              break;
            }
          }
          
          if (match) {
            // Found PNG header, now find the start of the string
            // Go backwards to find the beginning
            let start = i;
            while (start > 0 && memAfter[start - 1] >= 32 && memAfter[start - 1] < 127) {
              start--;
              if (i - start > 500) break; // Don't go too far back
            }
            
            // Go forward to find the end
            let end = i;
            while (end < memAfter.length && memAfter[end] >= 32 && memAfter[end] < 127) {
              end++;
              if (end - i > 10000) break; // Don't go too far forward
            }
            
            // Extract the string
            const bytes = memAfter.slice(start, end);
            const str = String.fromCharCode(...bytes);
            
            if (str.length > 100) {
              foundStrings.push({
                offset: start,
                length: str.length,
                str: str,
              });
            }
            
            // Skip ahead
            i = end;
          }
        }
        
        window.__memCapture = {
          foundStrings,
        };
        
        return ret;
      };
      
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
    
    return {
      key,
      sessionId: localStorage.getItem('tmdb_session_id'),
      memCapture: window.__memCapture,
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
  
  console.log(`\nFound ${data.memCapture?.foundStrings?.length || 0} strings with PNG header:\n`);
  
  for (const s of data.memCapture?.foundStrings || []) {
    console.log(`[${s.offset}] Length: ${s.length}`);
    console.log(`  Preview: ${s.str.slice(0, 150)}...`);
    
    // Try to hash this string
    const hash = crypto.createHash('sha256').update(s.str).digest();
    if (hash.equals(keyBuf)) {
      console.log(`  *** SHA256 MATCH! ***`);
      console.log(`  Full string: ${s.str}`);
      
      // Save the format
      fs.writeFileSync(
        'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
        s.str
      );
      console.log(`\n  Saved to: source-testing/tests/wasm-analysis/FOUND_FORMAT.txt`);
    }
    console.log('');
  }
  
  // Also try variations of the found strings
  console.log('Trying variations of found strings...\n');
  
  for (const s of data.memCapture?.foundStrings || []) {
    // Try trimming whitespace
    const trimmed = s.str.trim();
    let hash = crypto.createHash('sha256').update(trimmed).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH (trimmed): ${trimmed.slice(0, 150)}...`);
    }
    
    // Try removing null bytes
    const noNull = s.str.replace(/\0/g, '');
    hash = crypto.createHash('sha256').update(noNull).digest();
    if (hash.equals(keyBuf)) {
      console.log(`*** MATCH (no null): ${noNull.slice(0, 150)}...`);
    }
  }
}

findExactFormat().catch(console.error);
