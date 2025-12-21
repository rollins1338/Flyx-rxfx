/**
 * Search the WASM binary for patterns that could be the XOR derivation
 * Look for lookup tables, embedded constants, or PRNG state
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function downloadAndAnalyzeWasm() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept WASM download
  let wasmBytes = null;
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('.wasm')) {
      try {
        const buffer = await response.buffer();
        wasmBytes = buffer;
        console.log('Downloaded WASM:', buffer.length, 'bytes');
      } catch (e) {}
    }
  });
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  await browser.close();
  
  if (!wasmBytes) {
    console.log('Failed to download WASM');
    return;
  }
  
  // Save WASM for analysis
  fs.writeFileSync('img_data_bg.wasm', wasmBytes);
  console.log('Saved WASM to img_data_bg.wasm');
  
  // Analyze the binary
  console.log('\n=== WASM Binary Analysis ===');
  
  // Look for the data section
  // WASM data section starts with 0x0b (section ID 11)
  let dataStart = -1;
  for (let i = 0; i < wasmBytes.length - 1; i++) {
    // Look for data section marker
    if (wasmBytes[i] === 0x0b) {
      // Check if this could be a section start
      dataStart = i;
      break;
    }
  }
  
  // Search for known patterns
  const patterns = {
    // SHA256 initial H values (big-endian)
    'SHA256_H0': Buffer.from([0x6a, 0x09, 0xe6, 0x67]),
    'SHA256_H1': Buffer.from([0xbb, 0x67, 0xae, 0x85]),
    // SHA256 K constants
    'SHA256_K0': Buffer.from([0x42, 0x8a, 0x2f, 0x98]),
    // Known XOR constant first bytes
    'XOR_1700000000': Buffer.from([0x1c, 0x11, 0xd0, 0x4d]),
    'XOR_1700000001': Buffer.from([0x16, 0x5a, 0x51, 0x95]),
  };
  
  console.log('\nSearching for known patterns...');
  for (const [name, pattern] of Object.entries(patterns)) {
    const locations = [];
    for (let i = 0; i <= wasmBytes.length - pattern.length; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (wasmBytes[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        locations.push(i);
      }
    }
    if (locations.length > 0) {
      console.log(`${name}: found at ${locations.slice(0, 5).join(', ')}${locations.length > 5 ? '...' : ''}`);
    }
  }
  
  // Look for large constant tables (potential lookup tables)
  console.log('\nSearching for potential lookup tables...');
  const tableSize = 256; // Common lookup table size
  for (let i = 0; i < wasmBytes.length - tableSize; i++) {
    // Check if this could be a byte lookup table (all values 0-255 present)
    const slice = wasmBytes.slice(i, i + tableSize);
    const unique = new Set(slice);
    if (unique.size === 256) {
      console.log(`Potential 256-byte lookup table at offset ${i}`);
      // Show first 32 bytes
      console.log(`  First 32: ${Buffer.from(slice.slice(0, 32)).toString('hex')}`);
    }
  }
  
  // Look for 32-byte sequences that could be keys/constants
  console.log('\nSearching for 32-byte high-entropy sequences...');
  const highEntropySequences = [];
  for (let i = 0; i < wasmBytes.length - 32; i++) {
    const slice = wasmBytes.slice(i, i + 32);
    const unique = new Set(slice);
    // High entropy = many unique bytes
    if (unique.size >= 28) {
      // Check if it's not just incrementing bytes
      let isIncrementing = true;
      for (let j = 1; j < 32; j++) {
        if (slice[j] !== (slice[j-1] + 1) % 256) {
          isIncrementing = false;
          break;
        }
      }
      if (!isIncrementing) {
        highEntropySequences.push({
          offset: i,
          hex: Buffer.from(slice).toString('hex'),
          unique: unique.size,
        });
      }
    }
  }
  
  console.log(`Found ${highEntropySequences.length} high-entropy 32-byte sequences`);
  for (const seq of highEntropySequences.slice(0, 10)) {
    console.log(`  Offset ${seq.offset}: ${seq.hex.slice(0, 32)}... (${seq.unique} unique)`);
    
    // Check if this could be a key derivation constant
    // XOR with known fpHash to see if we get known key
    const fpHash = Buffer.from('54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e', 'hex');
    const expectedKey = '48d4fb5730cead3aa520e6ca277981e74b22013e8fbf42848b7348417aa347f2';
    
    const seqBytes = Buffer.from(seq.hex, 'hex');
    const xored = Buffer.alloc(32);
    for (let j = 0; j < 32; j++) {
      xored[j] = seqBytes[j] ^ fpHash[j];
    }
    if (xored.toString('hex') === expectedKey) {
      console.log(`    *** THIS IS THE XOR CONSTANT! ***`);
    }
  }
  
  // Search for the actual XOR constant in the binary
  console.log('\nSearching for known XOR constant in binary...');
  const xorConstant = Buffer.from('1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc', 'hex');
  for (let i = 0; i <= wasmBytes.length - 32; i++) {
    let match = true;
    for (let j = 0; j < 32; j++) {
      if (wasmBytes[i + j] !== xorConstant[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`XOR constant found at offset ${i}!`);
    }
  }
  
  // Search for first 8 bytes of XOR constant
  console.log('\nSearching for first 8 bytes of XOR constant...');
  const xorFirst8 = xorConstant.slice(0, 8);
  for (let i = 0; i <= wasmBytes.length - 8; i++) {
    let match = true;
    for (let j = 0; j < 8; j++) {
      if (wasmBytes[i + j] !== xorFirst8[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      console.log(`XOR first 8 bytes found at offset ${i}!`);
      console.log(`  Context: ${wasmBytes.slice(Math.max(0, i-8), i+40).toString('hex')}`);
    }
  }
  
  // Look for PRNG-like patterns (state initialization)
  console.log('\nSearching for PRNG state patterns...');
  // xorshift128+ uses two 64-bit state values
  // splitmix64 uses a single 64-bit state
  // Look for sequences that could be PRNG seeds
  
  // Check if any 8-byte sequence in the binary, when used as a seed,
  // produces the XOR constant through common PRNGs
  
  function xorshift128plus(s0, s1, iterations) {
    const result = [];
    for (let i = 0; i < iterations; i++) {
      const x = s0;
      const y = s1;
      s0 = y;
      let t = x ^ (x << 23n);
      t = t ^ (t >> 17n);
      t = t ^ y ^ (y >> 26n);
      s1 = t;
      result.push(Number((s0 + s1) & 0xFFFFFFFFn));
    }
    return result;
  }
  
  function splitmix64(seed, iterations) {
    const result = [];
    let state = seed;
    for (let i = 0; i < iterations; i++) {
      state = (state + 0x9e3779b97f4a7c15n) & 0xFFFFFFFFFFFFFFFFn;
      let z = state;
      z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xFFFFFFFFFFFFFFFFn;
      z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xFFFFFFFFFFFFFFFFn;
      z = z ^ (z >> 31n);
      result.push(Number(z & 0xFFFFFFFFn));
    }
    return result;
  }
  
  // Try using timestamp as PRNG seed
  const timestamp = 1700000000n;
  console.log('\nTrying timestamp as PRNG seed...');
  
  const splitmixResult = splitmix64(timestamp, 8);
  const splitmixHex = splitmixResult.map(n => n.toString(16).padStart(8, '0')).join('');
  console.log(`splitmix64(${timestamp}): ${splitmixHex}`);
  console.log(`Expected XOR: ${xorConstant.toString('hex')}`);
  
  // Try with fpHash as seed
  const fpHashBigInt = BigInt('0x' + '54c52b1a96975f71b9be36e4a465266a09eaefeedcf68b9c3ac889061ecbd22e'.slice(0, 16));
  const splitmixFromFp = splitmix64(fpHashBigInt, 8);
  const splitmixFromFpHex = splitmixFromFp.map(n => n.toString(16).padStart(8, '0')).join('');
  console.log(`splitmix64(fpHash first 8 bytes): ${splitmixFromFpHex}`);
}

downloadAndAnalyzeWasm().catch(console.error);
