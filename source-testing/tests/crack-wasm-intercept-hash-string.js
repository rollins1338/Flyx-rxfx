/**
 * Intercept the actual string being hashed by monitoring WASM memory
 * We'll look for the fingerprint string in memory right before hashing
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptHashString() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  await page.evaluateOnNewDocument((ts) => {
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    Math.random = function() { return 0.5; };
    let time = ts * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
    
    window.__canvasData = null;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const result = origToDataURL.apply(this, arguments);
      if (this.width === 200 && this.height === 50) {
        window.__canvasData = result;
      }
      return result;
    };
    
    // Hook WebAssembly.instantiate
    const origInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = async function(bufferSource, importObject) {
      const result = await origInstantiate.call(this, bufferSource, importObject);
      const instance = result.instance || result;
      const memory = instance.exports.memory;
      
      window.__wasmMemory = memory;
      
      // Wrap get_img_key
      if (instance.exports.get_img_key) {
        const origGetImgKey = instance.exports.get_img_key;
        instance.exports.get_img_key = function(...args) {
          // Before calling, scan memory for strings
          const mem = new Uint8Array(memory.buffer);
          
          // Look for patterns that might be the fingerprint
          const patterns = [
            '24:Mozilla',
            '24:',
            ':Win32:',
            ':en-US:',
            ':0:1700000000:',
          ];
          
          window.__foundStrings = [];
          
          for (const pattern of patterns) {
            const patternBytes = new TextEncoder().encode(pattern);
            for (let i = 0; i < mem.length - patternBytes.length; i++) {
              let match = true;
              for (let j = 0; j < patternBytes.length; j++) {
                if (mem[i + j] !== patternBytes[j]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                // Found pattern, read surrounding context
                const start = Math.max(0, i - 10);
                const end = Math.min(mem.length, i + 200);
                const context = new TextDecoder().decode(mem.slice(start, end));
                window.__foundStrings.push({
                  pattern,
                  offset: i,
                  context: context.replace(/[^\x20-\x7E]/g, '.'),
                });
              }
            }
          }
          
          const result = origGetImgKey.apply(this, args);
          
          // After calling, look for the key in memory
          const keyHex = result;
          if (keyHex && keyHex.length === 64) {
            // Look for the key bytes in memory
            const keyBytes = [];
            for (let i = 0; i < 64; i += 2) {
              keyBytes.push(parseInt(keyHex.substr(i, 2), 16));
            }
            
            for (let i = 0; i < mem.length - 32; i++) {
              let match = true;
              for (let j = 0; j < 32; j++) {
                if (mem[i + j] !== keyBytes[j]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                window.__keyOffset = i;
                break;
              }
            }
          }
          
          return result;
        };
      }
      
      return result;
    };
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const key = window.wasmImgData.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    const canvasBase64 = window.__canvasData?.split(',')[1] || '';
    
    // Read memory around where we found strings
    let memoryStrings = [];
    if (window.__wasmMemory) {
      const mem = new Uint8Array(window.__wasmMemory.buffer);
      
      // Look for the complete fingerprint string
      const searchStart = '24:';
      const searchBytes = new TextEncoder().encode(searchStart);
      
      for (let i = 0; i < mem.length - searchBytes.length; i++) {
        let match = true;
        for (let j = 0; j < searchBytes.length; j++) {
          if (mem[i + j] !== searchBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          // Read up to 200 bytes or until null
          let end = i;
          while (end < mem.length && end < i + 200 && mem[end] !== 0) {
            end++;
          }
          const str = new TextDecoder().decode(mem.slice(i, end));
          if (str.length > 50) {
            memoryStrings.push({ offset: i, string: str });
          }
        }
      }
    }
    
    return {
      key,
      sessionId,
      canvasBase64First50: canvasBase64.slice(0, 50),
      foundStrings: window.__foundStrings || [],
      keyOffset: window.__keyOffset,
      memoryStrings,
      fingerprint: {
        colorDepth: screen.colorDepth,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timezone: new Date().getTimezoneOffset(),
      },
    };
  });
  
  await browser.close();
  
  console.log('=== Results ===');
  console.log('WASM Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Key found at offset:', result.keyOffset);
  
  console.log('\n=== Found Strings ===');
  for (const s of result.foundStrings) {
    console.log(`Pattern "${s.pattern}" at offset ${s.offset}:`);
    console.log(`  ${s.context.slice(0, 150)}`);
  }
  
  console.log('\n=== Memory Strings (starting with "24:") ===');
  for (const s of result.memoryStrings) {
    console.log(`Offset ${s.offset}: ${s.string}`);
  }
  
  // Build expected fingerprint
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  const expectedFp = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64First50}`;
  
  console.log('\n=== Expected Fingerprint ===');
  console.log(expectedFp);
  console.log('Length:', expectedFp.length);
  
  // Calculate hash
  const fpHash = crypto.createHash('sha256').update(expectedFp).digest('hex');
  console.log('\nSHA256(expected):', fpHash);
  
  // Calculate XOR constant
  const fpHashBuf = Buffer.from(fpHash, 'hex');
  const keyBuf = Buffer.from(result.key, 'hex');
  const xorBuf = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBuf[i] = fpHashBuf[i] ^ keyBuf[i];
  }
  console.log('XOR constant:', xorBuf.toString('hex'));
  
  // Check if any memory string matches expected
  console.log('\n=== Checking Memory Strings ===');
  for (const s of result.memoryStrings) {
    const hash = crypto.createHash('sha256').update(s.string).digest('hex');
    if (hash === fpHash) {
      console.log('MATCH! String at offset', s.offset, 'matches expected fingerprint');
    }
    
    // Also check if this string's hash XOR with key gives a known pattern
    const hashBuf = Buffer.from(hash, 'hex');
    const xor = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xor[i] = hashBuf[i] ^ keyBuf[i];
    }
    
    // Check if XOR is all zeros (meaning hash === key)
    if (xor.every(b => b === 0)) {
      console.log('String at offset', s.offset, 'hashes directly to the key!');
      console.log('String:', s.string);
    }
  }
}

interceptHashString().catch(console.error);
