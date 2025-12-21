/**
 * Memory Scan - Find the fingerprint string by searching for session ID
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function memoryScan() {
  console.log('=== Memory Scan for Fingerprint String ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.__scanResults = [];
    
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    
    WebAssembly.instantiateStreaming = async function(source, imports) {
      const result = await origInstantiateStreaming.call(this, source, imports);
      
      const memory = result.instance.exports.memory;
      const origGetImgKey = result.instance.exports.get_img_key;
      
      result.instance.exports.get_img_key = function(retptr) {
        const ret = origGetImgKey.apply(this, arguments);
        
        // After key generation, scan memory for the session ID
        const mem = new Uint8Array(memory.buffer);
        const sessionId = localStorage.getItem('tmdb_session_id');
        
        if (!sessionId) {
          console.log('[SCAN] No session ID found');
          return ret;
        }
        
        // Search for the timestamp part (more unique)
        const timestamp = sessionId.split('.')[0];
        const searchBytes = new TextEncoder().encode(timestamp);
        
        console.log(`[SCAN] Searching for timestamp: ${timestamp}`);
        
        const found = [];
        for (let i = 0; i < mem.length - searchBytes.length; i++) {
          let match = true;
          for (let j = 0; j < searchBytes.length; j++) {
            if (mem[i + j] !== searchBytes[j]) {
              match = false;
              break;
            }
          }
          
          if (match) {
            // Found! Now extract the surrounding context
            // Go back to find the start of the string
            let start = i;
            while (start > 0 && mem[start - 1] >= 32 && mem[start - 1] < 127) {
              start--;
              if (i - start > 2000) break;
            }
            
            // Go forward to find the end
            let end = i + searchBytes.length;
            while (end < mem.length && mem[end] >= 32 && mem[end] < 127) {
              end++;
              if (end - i > 10000) break;
            }
            
            const bytes = mem.slice(start, end);
            const str = String.fromCharCode(...bytes);
            
            found.push({
              offset: start,
              timestampOffset: i,
              length: str.length,
              str: str,
            });
            
            console.log(`[SCAN] Found at ${i}, context length: ${str.length}`);
            
            // Skip ahead
            i = end;
          }
        }
        
        window.__scanResults = found;
        
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
      scanResults: window.__scanResults,
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
  
  console.log(`\nFound ${data.scanResults.length} occurrences of timestamp in memory:\n`);
  
  for (const result of data.scanResults) {
    console.log(`=== Offset ${result.offset} (timestamp at ${result.timestampOffset}) ===`);
    console.log(`Length: ${result.length}`);
    console.log(`Content: ${result.str.slice(0, 300)}...`);
    
    // Try to hash this string
    const hash = crypto.createHash('sha256').update(result.str).digest();
    if (hash.equals(keyBuf)) {
      console.log(`\n*** SHA256 MATCH! ***`);
      console.log(`Full string:\n${result.str}`);
      
      fs.writeFileSync(
        'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
        result.str
      );
      console.log(`\nSaved to: source-testing/tests/wasm-analysis/FOUND_FORMAT.txt`);
      return;
    }
    
    // Try variations
    const variations = [
      result.str.trim(),
      result.str.replace(/\s+/g, ''),
      result.str.replace(/\0/g, ''),
    ];
    
    for (const v of variations) {
      const h = crypto.createHash('sha256').update(v).digest();
      if (h.equals(keyBuf)) {
        console.log(`\n*** SHA256 MATCH (variation)! ***`);
        console.log(`Full string:\n${v}`);
        return;
      }
    }
    
    console.log('');
  }
  
  // If no match, let's analyze the format more carefully
  console.log('\n=== Analyzing Format ===\n');
  
  if (data.scanResults.length > 0) {
    const longestResult = data.scanResults.reduce((a, b) => a.length > b.length ? a : b);
    console.log('Longest string found:');
    console.log(longestResult.str);
    
    // Parse the format
    // Based on previous analysis: "Win64; x64) AppleWeb:Win32:en-US:360:1766277949:iVBORw0..."
    // The format seems to be colon-separated
    
    const parts = longestResult.str.split(':');
    console.log(`\nParts (${parts.length}):`);
    for (let i = 0; i < parts.length; i++) {
      console.log(`  ${i}: ${parts[i].slice(0, 50)}${parts[i].length > 50 ? '...' : ''}`);
    }
    
    // Try to reconstruct the format
    console.log('\n=== Trying to Reconstruct Format ===\n');
    
    const fp = data.fingerprint;
    const sid = data.sessionId;
    const timestamp = sid.split('.')[0];
    
    // The format appears to be:
    // {something}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64}
    
    // We need to figure out what the first part is
    // From the memory dump: "Win64; x64) AppleWeb" - this is part of the userAgent
    
    // Let's try different userAgent truncations
    const ua = fp.userAgent;
    
    // Find where "Win64; x64)" appears in the userAgent
    const win64Idx = ua.indexOf('Win64; x64)');
    console.log(`"Win64; x64)" found at index ${win64Idx} in userAgent`);
    
    // The format might use a specific substring of userAgent
    // Let's try to find the exact match
    
    // From memory: "Win64; x64) AppleWeb" - this is 20 chars
    // But it might be truncated differently
    
    // Let's try to find what comes before the platform in the memory string
    const platformIdx = longestResult.str.indexOf(`:${fp.platform}:`);
    if (platformIdx > 0) {
      const beforePlatform = longestResult.str.slice(0, platformIdx);
      console.log(`Before platform: "${beforePlatform}"`);
      
      // Now we know the first part of the format
      // Let's reconstruct and test
      
      // Get the canvas base64 from the string
      const canvasStart = longestResult.str.indexOf('iVBORw');
      if (canvasStart > 0) {
        const canvasBase64 = longestResult.str.slice(canvasStart);
        console.log(`Canvas base64 length: ${canvasBase64.length}`);
        
        // Reconstruct the format
        const reconstructed = `${beforePlatform}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64}`;
        console.log(`\nReconstructed format:`);
        console.log(reconstructed.slice(0, 200) + '...');
        
        const hash = crypto.createHash('sha256').update(reconstructed).digest();
        if (hash.equals(keyBuf)) {
          console.log(`\n*** SHA256 MATCH! ***`);
          
          // Now we know the format!
          console.log('\n=== FORMAT DISCOVERED ===');
          console.log(`First part: ${beforePlatform}`);
          console.log(`Format: {first_part}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64}`);
          
          fs.writeFileSync(
            'source-testing/tests/wasm-analysis/FOUND_FORMAT.txt',
            reconstructed
          );
        } else {
          console.log('Reconstructed format does not match.');
          
          // Try the exact string from memory
          console.log('\nTrying exact memory string...');
          const exactHash = crypto.createHash('sha256').update(longestResult.str).digest();
          console.log(`Memory string hash: ${exactHash.toString('hex')}`);
          console.log(`Expected key:       ${data.key}`);
        }
      }
    }
  }
}

memoryScan().catch(console.error);
