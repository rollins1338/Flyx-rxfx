/**
 * Test if the XOR constant is derived from a PRNG seeded with timestamp
 * We'll test various PRNG algorithms commonly used in Rust
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

// Various PRNG implementations
function xorshift32(seed) {
  let x = seed >>> 0;
  return function() {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x >>> 0;
  };
}

function xorshift64(seed) {
  let x = BigInt(seed);
  return function() {
    x ^= x << 13n;
    x ^= x >> 7n;
    x ^= x << 17n;
    return Number(x & 0xFFFFFFFFn);
  };
}

function splitmix64(seed) {
  let x = BigInt(seed);
  return function() {
    x = (x + 0x9e3779b97f4a7c15n) & 0xFFFFFFFFFFFFFFFFn;
    let z = x;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xFFFFFFFFFFFFFFFFn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xFFFFFFFFFFFFFFFFn;
    return Number((z ^ (z >> 31n)) & 0xFFFFFFFFn);
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t = (t + 0x6D2B79F5) >>> 0;
    let z = t;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0);
  };
}

function pcg32(seed) {
  let state = BigInt(seed);
  const inc = 0xda3e39cb94b95bdbn;
  return function() {
    const oldstate = state;
    state = (oldstate * 6364136223846793005n + inc) & 0xFFFFFFFFFFFFFFFFn;
    const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
    const rot = Number(oldstate >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  };
}

// Generate 32 bytes from a PRNG
function generateBytes(prng, count) {
  const bytes = Buffer.alloc(count);
  for (let i = 0; i < count; i += 4) {
    const val = prng();
    bytes[i] = val & 0xff;
    bytes[i + 1] = (val >> 8) & 0xff;
    bytes[i + 2] = (val >> 16) & 0xff;
    bytes[i + 3] = (val >> 24) & 0xff;
  }
  return bytes;
}

async function collectSample(browser, timestamp) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
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
  }, timestamp);
  
  try {
    await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    
    await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
    
    const result = await page.evaluate(() => {
      const key = window.wasmImgData.get_img_key();
      const sessionId = localStorage.getItem('tmdb_session_id');
      const canvasBase64 = window.__canvasData?.split(',')[1] || '';
      
      return {
        key,
        sessionId,
        canvasBase64First50: canvasBase64.slice(0, 50),
        fingerprint: {
          colorDepth: screen.colorDepth,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: new Date().getTimezoneOffset(),
        },
      };
    });
    
    await page.close();
    return result;
  } catch (e) {
    await page.close();
    throw e;
  }
}

async function testPRNGs() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const timestamp = 1700000000;
  console.log(`Collecting sample for timestamp ${timestamp}...`);
  const result = await collectSample(browser, timestamp);
  
  await browser.close();
  
  const fp = result.fingerprint;
  const [ts] = result.sessionId.split('.');
  
  // Build fingerprint string
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${result.canvasBase64First50}`;
  
  // Calculate hash
  const fpHash = crypto.createHash('sha256').update(fpString).digest();
  const keyBuf = Buffer.from(result.key, 'hex');
  
  // Calculate XOR constant
  const xorConstant = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    xorConstant[i] = fpHash[i] ^ keyBuf[i];
  }
  
  console.log('\n=== Target XOR Constant ===');
  console.log(xorConstant.toString('hex'));
  
  console.log('\n=== Testing PRNG Algorithms ===\n');
  
  const tsNum = parseInt(ts);
  
  // Test various seeds
  const seeds = [
    { name: 'timestamp', value: tsNum },
    { name: 'timestamp * 1000', value: tsNum * 1000 },
    { name: 'timestamp + 1', value: tsNum + 1 },
    { name: 'timestamp ^ 0x12345678', value: tsNum ^ 0x12345678 },
    { name: 'timestamp reversed bytes', value: ((tsNum & 0xff) << 24) | (((tsNum >> 8) & 0xff) << 16) | (((tsNum >> 16) & 0xff) << 8) | ((tsNum >> 24) & 0xff) },
  ];
  
  const prngs = [
    { name: 'xorshift32', fn: xorshift32 },
    { name: 'splitmix64', fn: splitmix64 },
    { name: 'mulberry32', fn: mulberry32 },
    { name: 'pcg32', fn: pcg32 },
  ];
  
  for (const seed of seeds) {
    console.log(`\nSeed: ${seed.name} (${seed.value})`);
    
    for (const prng of prngs) {
      const gen = prng.fn(seed.value);
      const bytes = generateBytes(gen, 32);
      
      if (bytes.equals(xorConstant)) {
        console.log(`  *** MATCH: ${prng.name} ***`);
      }
      
      // Also try XORing with fpHash
      const xored = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        xored[i] = fpHash[i] ^ bytes[i];
      }
      if (xored.equals(keyBuf)) {
        console.log(`  *** MATCH (fpHash XOR ${prng.name}): key ***`);
      }
    }
  }
  
  // Try ChaCha20-like quarter round
  console.log('\n=== Testing ChaCha20-like derivation ===');
  
  function chacha_quarter_round(a, b, c, d) {
    a = (a + b) >>> 0; d = ((d ^ a) >>> 0); d = ((d << 16) | (d >>> 16)) >>> 0;
    c = (c + d) >>> 0; b = ((b ^ c) >>> 0); b = ((b << 12) | (b >>> 20)) >>> 0;
    a = (a + b) >>> 0; d = ((d ^ a) >>> 0); d = ((d << 8) | (d >>> 24)) >>> 0;
    c = (c + d) >>> 0; b = ((b ^ c) >>> 0); b = ((b << 7) | (b >>> 25)) >>> 0;
    return [a, b, c, d];
  }
  
  // Initialize with timestamp
  let state = [
    0x61707865, 0x3320646e, 0x79622d32, 0x6b206574, // "expand 32-byte k"
    tsNum, tsNum, tsNum, tsNum,
    tsNum, tsNum, tsNum, tsNum,
    0, 0, tsNum, tsNum
  ];
  
  // Run 20 rounds
  for (let i = 0; i < 10; i++) {
    [state[0], state[4], state[8], state[12]] = chacha_quarter_round(state[0], state[4], state[8], state[12]);
    [state[1], state[5], state[9], state[13]] = chacha_quarter_round(state[1], state[5], state[9], state[13]);
    [state[2], state[6], state[10], state[14]] = chacha_quarter_round(state[2], state[6], state[10], state[14]);
    [state[3], state[7], state[11], state[15]] = chacha_quarter_round(state[3], state[7], state[11], state[15]);
    [state[0], state[5], state[10], state[15]] = chacha_quarter_round(state[0], state[5], state[10], state[15]);
    [state[1], state[6], state[11], state[12]] = chacha_quarter_round(state[1], state[6], state[11], state[12]);
    [state[2], state[7], state[8], state[13]] = chacha_quarter_round(state[2], state[7], state[8], state[13]);
    [state[3], state[4], state[9], state[14]] = chacha_quarter_round(state[3], state[4], state[9], state[14]);
  }
  
  const chachaBytes = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    chachaBytes.writeUInt32LE(state[i], i * 4);
  }
  
  console.log('ChaCha20-like output:', chachaBytes.toString('hex'));
  console.log('Match:', chachaBytes.equals(xorConstant));
  
  // Try HKDF with timestamp
  console.log('\n=== Testing HKDF ===');
  
  const hkdfSalt = Buffer.from('flixer');
  const hkdfInfo = Buffer.from('img_key');
  const hkdfKey = crypto.hkdfSync('sha256', Buffer.from(ts), hkdfSalt, hkdfInfo, 32);
  console.log('HKDF(ts, "flixer", "img_key"):', Buffer.from(hkdfKey).toString('hex'));
  console.log('Match:', Buffer.from(hkdfKey).equals(xorConstant));
  
  // Try with fpHash as key
  const hkdfKey2 = crypto.hkdfSync('sha256', fpHash, Buffer.from(ts), Buffer.from(''), 32);
  console.log('HKDF(fpHash, ts, ""):', Buffer.from(hkdfKey2).toString('hex'));
  console.log('Match:', Buffer.from(hkdfKey2).equals(xorConstant));
}

testPRNGs().catch(console.error);
