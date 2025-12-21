/**
 * PRNG Derivation - The WASM might use a PRNG seeded with the fingerprint
 * 
 * Common Rust PRNGs:
 * - ChaCha20 (rand_chacha)
 * - Xorshift
 * - PCG
 * 
 * The key might be: PRNG(seed=SHA256(fingerprint)).next_bytes(32)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

// Simple ChaCha20 implementation for testing
function chacha20Block(key, counter, nonce) {
  // ChaCha20 quarter round
  function quarterRound(state, a, b, c, d) {
    state[a] = (state[a] + state[b]) >>> 0;
    state[d] = rotl32(state[d] ^ state[a], 16);
    state[c] = (state[c] + state[d]) >>> 0;
    state[b] = rotl32(state[b] ^ state[c], 12);
    state[a] = (state[a] + state[b]) >>> 0;
    state[d] = rotl32(state[d] ^ state[a], 8);
    state[c] = (state[c] + state[d]) >>> 0;
    state[b] = rotl32(state[b] ^ state[c], 7);
  }
  
  function rotl32(x, n) {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
  }
  
  // Initialize state
  const state = new Uint32Array(16);
  
  // Constants "expand 32-byte k"
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  
  // Key (8 words)
  const keyView = new DataView(key.buffer, key.byteOffset, key.byteLength);
  for (let i = 0; i < 8; i++) {
    state[4 + i] = keyView.getUint32(i * 4, true);
  }
  
  // Counter
  state[12] = counter;
  
  // Nonce (3 words)
  const nonceView = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
  for (let i = 0; i < 3; i++) {
    state[13 + i] = nonceView.getUint32(i * 4, true);
  }
  
  // Copy state for mixing
  const working = new Uint32Array(state);
  
  // 20 rounds (10 double rounds)
  for (let i = 0; i < 10; i++) {
    // Column rounds
    quarterRound(working, 0, 4, 8, 12);
    quarterRound(working, 1, 5, 9, 13);
    quarterRound(working, 2, 6, 10, 14);
    quarterRound(working, 3, 7, 11, 15);
    // Diagonal rounds
    quarterRound(working, 0, 5, 10, 15);
    quarterRound(working, 1, 6, 11, 12);
    quarterRound(working, 2, 7, 8, 13);
    quarterRound(working, 3, 4, 9, 14);
  }
  
  // Add original state
  for (let i = 0; i < 16; i++) {
    working[i] = (working[i] + state[i]) >>> 0;
  }
  
  // Convert to bytes
  const output = Buffer.alloc(64);
  for (let i = 0; i < 16; i++) {
    output.writeUInt32LE(working[i], i * 4);
  }
  
  return output;
}

// Xorshift128+ PRNG
function xorshift128plus(seed) {
  let s0 = seed.readBigUInt64LE(0);
  let s1 = seed.readBigUInt64LE(8);
  
  return function() {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23n;
    s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n);
    return (s1 + y) & 0xFFFFFFFFFFFFFFFFn;
  };
}

async function prngDerive() {
  console.log('=== PRNG Key Derivation ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
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
  
  await browser.close();
  
  console.log(`Key: ${data.key}`);
  console.log(`Session ID: ${data.sessionId}`);
  
  const keyBuf = Buffer.from(data.key, 'hex');
  const fp = data.fingerprint;
  const canvasBase64 = data.canvasBase64;
  const [timestamp, random] = data.sessionId.split('.');
  
  // The fingerprint string
  const fpString = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${timestamp}:${canvasBase64.slice(0, 50)}`;
  
  // Hash of fingerprint
  const fpHash = crypto.createHash('sha256').update(fpString).digest();
  
  console.log(`\nFP Hash: ${fpHash.toString('hex')}`);
  console.log(`Expected: ${data.key}`);
  
  // Test ChaCha20 PRNG
  console.log('\n=== Testing ChaCha20 PRNG ===\n');
  
  // Use fpHash as key, try different nonces
  const nonces = [
    Buffer.alloc(12, 0),
    Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
    Buffer.from(fpHash.slice(0, 12)),
    Buffer.from(timestamp.padStart(12, '0').slice(-12)),
  ];
  
  for (const nonce of nonces) {
    const block = chacha20Block(fpHash, 0, nonce);
    const first32 = block.slice(0, 32);
    
    if (first32.equals(keyBuf)) {
      console.log(`*** ChaCha20 MATCH with nonce ${nonce.toString('hex')}! ***`);
    }
  }
  
  // Test with fpHash as both key and nonce source
  const block = chacha20Block(fpHash, 0, fpHash.slice(0, 12));
  console.log(`ChaCha20(fpHash, 0, fpHash[:12]): ${block.slice(0, 32).toString('hex')}`);
  
  // Test Xorshift128+
  console.log('\n=== Testing Xorshift128+ PRNG ===\n');
  
  // Seed with first 16 bytes of fpHash
  const seed16 = Buffer.alloc(16);
  fpHash.copy(seed16, 0, 0, 16);
  
  const rng = xorshift128plus(seed16);
  
  // Generate 4 64-bit values to get 32 bytes
  const xorshiftResult = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    const val = rng();
    xorshiftResult.writeBigUInt64LE(val, i * 8);
  }
  
  console.log(`Xorshift128+(fpHash[:16]): ${xorshiftResult.toString('hex')}`);
  
  if (xorshiftResult.equals(keyBuf)) {
    console.log('*** Xorshift128+ MATCH! ***');
  }
  
  // Test simple transformations
  console.log('\n=== Testing Simple Transformations ===\n');
  
  // Reverse bytes
  const reversed = Buffer.from(fpHash).reverse();
  console.log(`Reversed: ${reversed.toString('hex')}`);
  if (reversed.equals(keyBuf)) console.log('*** MATCH! ***');
  
  // Swap halves
  const swapped = Buffer.concat([fpHash.slice(16), fpHash.slice(0, 16)]);
  console.log(`Swapped halves: ${swapped.toString('hex')}`);
  if (swapped.equals(keyBuf)) console.log('*** MATCH! ***');
  
  // Rotate bytes
  for (let rot = 1; rot < 32; rot++) {
    const rotated = Buffer.concat([fpHash.slice(rot), fpHash.slice(0, rot)]);
    if (rotated.equals(keyBuf)) {
      console.log(`*** MATCH with rotation ${rot}! ***`);
    }
  }
  
  // XOR with constant
  const constants = [
    Buffer.alloc(32, 0xff),
    Buffer.alloc(32, 0xaa),
    Buffer.alloc(32, 0x55),
  ];
  
  for (const constant of constants) {
    const xored = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      xored[i] = fpHash[i] ^ constant[i];
    }
    if (xored.equals(keyBuf)) {
      console.log(`*** XOR MATCH with constant ${constant[0].toString(16)}! ***`);
    }
  }
  
  // Test with different hash algorithms
  console.log('\n=== Testing Different Hash Algorithms ===\n');
  
  const algorithms = ['sha256', 'sha384', 'sha512', 'sha1', 'md5'];
  
  for (const algo of algorithms) {
    try {
      const hash = crypto.createHash(algo).update(fpString).digest();
      const first32 = hash.slice(0, 32);
      
      console.log(`${algo}: ${first32.toString('hex')}`);
      
      if (first32.equals(keyBuf)) {
        console.log(`*** ${algo} MATCH! ***`);
      }
    } catch (e) {}
  }
  
  // Test double hashing with different algorithms
  console.log('\n=== Testing Double Hashing ===\n');
  
  for (const algo1 of ['sha256', 'sha512']) {
    for (const algo2 of ['sha256', 'sha512']) {
      const hash1 = crypto.createHash(algo1).update(fpString).digest();
      const hash2 = crypto.createHash(algo2).update(hash1).digest();
      const first32 = hash2.slice(0, 32);
      
      if (first32.equals(keyBuf)) {
        console.log(`*** ${algo1} -> ${algo2} MATCH! ***`);
      }
    }
  }
  
  // Test HKDF with different parameters
  console.log('\n=== Testing HKDF Variations ===\n');
  
  const hkdfInfos = ['', 'key', 'flixer', 'tmdb', 'image', 'session', timestamp, random];
  const hkdfSalts = ['', 'flixer', 'tmdb', timestamp, random, canvasBase64.slice(0, 32)];
  
  for (const salt of hkdfSalts) {
    for (const info of hkdfInfos) {
      try {
        const derived = crypto.hkdfSync('sha256', fpString, salt, info, 32);
        if (Buffer.from(derived).equals(keyBuf)) {
          console.log(`*** HKDF MATCH: salt="${salt}", info="${info}" ***`);
        }
      } catch (e) {}
    }
  }
  
  console.log('\nNo match found with standard PRNG/hash algorithms.');
}

prngDerive().catch(console.error);
