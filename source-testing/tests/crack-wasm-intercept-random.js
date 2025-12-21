/**
 * Intercept the WASM random function to see what random values are used
 * The WASM imports __wbg_random which likely calls Math.random()
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

async function interceptRandom() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const timestamp = 1700000000;
  
  // Intercept Math.random and track all calls
  await page.evaluateOnNewDocument((ts) => {
    // Control the environment
    Object.defineProperty(window, 'screen', {
      value: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080, colorDepth: 24, pixelDepth: 24 },
      writable: false,
    });
    Date.prototype.getTimezoneOffset = function() { return 0; };
    
    let time = ts * 1000;
    Date.now = function() { return time++; };
    localStorage.clear();
    
    // Track random calls
    window.__randomCalls = [];
    window.__randomIndex = 0;
    
    // Use a seeded PRNG for reproducibility
    function seededRandom(seed) {
      let state = seed;
      return function() {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
      };
    }
    
    // Create a seeded random with timestamp as seed
    const prng = seededRandom(ts);
    
    const originalRandom = Math.random;
    Math.random = function() {
      const value = prng(); // Use seeded random
      window.__randomCalls.push({
        index: window.__randomIndex++,
        value: value,
        stack: new Error().stack.split('\n').slice(2, 5).join(' <- '),
      });
      return value;
    };
    
    // Also intercept crypto.getRandomValues if used
    if (window.crypto && window.crypto.getRandomValues) {
      const originalGetRandomValues = window.crypto.getRandomValues.bind(window.crypto);
      window.crypto.getRandomValues = function(array) {
        // Fill with deterministic values based on timestamp
        for (let i = 0; i < array.length; i++) {
          array[i] = (ts + i) & 0xFF;
        }
        window.__randomCalls.push({
          index: window.__randomIndex++,
          type: 'getRandomValues',
          length: array.length,
        });
        return array;
      };
    }
  }, timestamp);
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  const result = await page.evaluate(() => {
    const wasm = window.wasmImgData;
    const key = wasm.get_img_key();
    const sessionId = localStorage.getItem('tmdb_session_id');
    
    return {
      key,
      sessionId,
      randomCalls: window.__randomCalls,
    };
  });
  
  await browser.close();
  
  console.log('=== Random Interception Results ===\n');
  console.log('Key:', result.key);
  console.log('Session ID:', result.sessionId);
  console.log('Total random calls:', result.randomCalls.length);
  
  console.log('\n--- Random Calls ---');
  for (const call of result.randomCalls.slice(0, 20)) {
    if (call.type === 'getRandomValues') {
      console.log(`  [${call.index}] getRandomValues(${call.length})`);
    } else {
      console.log(`  [${call.index}] Math.random() = ${call.value.toFixed(10)}`);
    }
  }
  
  if (result.randomCalls.length > 20) {
    console.log(`  ... and ${result.randomCalls.length - 20} more calls`);
  }
  
  // Analyze if random values affect the key
  console.log('\n--- Analysis ---');
  
  // The key should be deterministic if we control random
  // Let's verify by computing what we expect
  const fpString = '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:1700000000:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';
  const fpHash = crypto.createHash('sha256').update(fpString).digest('hex');
  
  console.log('Expected fpHash:', fpHash);
  console.log('Actual key:', result.key);
  
  // Compute XOR constant
  const fpHashBytes = Buffer.from(fpHash, 'hex');
  const keyBytes = Buffer.from(result.key, 'hex');
  const xorBytes = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorBytes[i] = fpHashBytes[i] ^ keyBytes[i];
  }
  console.log('XOR constant:', xorBytes.toString('hex'));
  
  // Check if XOR constant matches our known value
  const knownXor = '1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc';
  console.log('Known XOR:', knownXor);
  console.log('Match:', xorBytes.toString('hex') === knownXor ? 'YES' : 'NO');
  
  // If random values are used in key derivation, the XOR should be different
  // when we use different random values
  
  return result;
}

interceptRandom().catch(console.error);
