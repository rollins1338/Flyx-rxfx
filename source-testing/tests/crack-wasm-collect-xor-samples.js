/**
 * Collect many XOR constant samples with different timestamps
 * Then analyze patterns to reverse engineer the derivation
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs');

puppeteer.use(StealthPlugin());

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes) {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function collectSample(timestamp) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
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
  }, timestamp);
  
  try {
    await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    
    await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
    
    const result = await page.evaluate(() => {
      const wasm = window.wasmImgData;
      const key = wasm.get_img_key();
      return { key };
    });
    
    await browser.close();
    return result.key;
  } catch (e) {
    await browser.close();
    return null;
  }
}

async function main() {
  const samples = [];
  
  // Collect samples at different timestamps
  const baseTimestamp = 1700000000;
  const timestamps = [];
  
  // Sequential timestamps
  for (let i = 0; i < 20; i++) {
    timestamps.push(baseTimestamp + i);
  }
  
  // Some larger gaps
  timestamps.push(baseTimestamp + 100);
  timestamps.push(baseTimestamp + 1000);
  timestamps.push(baseTimestamp + 10000);
  
  console.log(`Collecting ${timestamps.length} samples...`);
  
  for (const ts of timestamps) {
    process.stdout.write(`Timestamp ${ts}... `);
    const key = await collectSample(ts);
    
    if (key) {
      // Compute fingerprint and fpHash
      const fingerprint = `24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:${ts}:iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk`;
      const fpHash = crypto.createHash('sha256').update(fingerprint).digest('hex');
      
      // Compute XOR constant
      const fpHashBytes = hexToBytes(fpHash);
      const keyBytes = hexToBytes(key);
      const xorBytes = fpHashBytes.map((b, i) => b ^ keyBytes[i]);
      const xor = bytesToHex(xorBytes);
      
      samples.push({
        timestamp: ts,
        fingerprint,
        fpHash,
        key,
        xor,
      });
      
      console.log(`key=${key.slice(0, 16)}... xor=${xor.slice(0, 16)}...`);
    } else {
      console.log('FAILED');
    }
  }
  
  // Save samples
  fs.writeFileSync('xor-samples.json', JSON.stringify(samples, null, 2));
  console.log(`\nSaved ${samples.length} samples to xor-samples.json`);
  
  // Analyze patterns
  console.log('\n=== Pattern Analysis ===');
  
  // Check if XOR constants have any relationship
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    
    if (curr.timestamp === prev.timestamp + 1) {
      // Check XOR difference between consecutive timestamps
      const prevXorBytes = hexToBytes(prev.xor);
      const currXorBytes = hexToBytes(curr.xor);
      const diff = prevXorBytes.map((b, j) => b ^ currXorBytes[j]);
      
      console.log(`\nts ${prev.timestamp} -> ${curr.timestamp}:`);
      console.log(`  XOR diff: ${bytesToHex(diff).slice(0, 32)}...`);
      
      // Check if diff is constant
      const diffHash = crypto.createHash('sha256').update(Buffer.from(diff)).digest('hex');
      console.log(`  SHA256(diff): ${diffHash.slice(0, 32)}...`);
    }
  }
  
  // Check if XOR is derived from timestamp in any way
  console.log('\n=== Timestamp Derivation Check ===');
  for (const sample of samples.slice(0, 5)) {
    const ts = sample.timestamp;
    const tsBytes4LE = Buffer.alloc(4);
    tsBytes4LE.writeUInt32LE(ts);
    const tsBytes4BE = Buffer.alloc(4);
    tsBytes4BE.writeUInt32BE(ts);
    const tsBytes8LE = Buffer.alloc(8);
    tsBytes8LE.writeBigUInt64LE(BigInt(ts));
    
    console.log(`\nTimestamp ${ts}:`);
    console.log(`  XOR: ${sample.xor.slice(0, 32)}...`);
    console.log(`  SHA256(ts string): ${crypto.createHash('sha256').update(ts.toString()).digest('hex').slice(0, 32)}...`);
    console.log(`  SHA256(ts 4LE): ${crypto.createHash('sha256').update(tsBytes4LE).digest('hex').slice(0, 32)}...`);
    console.log(`  SHA256(ts 4BE): ${crypto.createHash('sha256').update(tsBytes4BE).digest('hex').slice(0, 32)}...`);
    console.log(`  SHA256(ts 8LE): ${crypto.createHash('sha256').update(tsBytes8LE).digest('hex').slice(0, 32)}...`);
  }
  
  // Check byte-level patterns in XOR constants
  console.log('\n=== Byte Pattern Analysis ===');
  const xorMatrix = samples.map(s => hexToBytes(s.xor));
  
  // Check if any byte position is constant
  for (let pos = 0; pos < 32; pos++) {
    const values = xorMatrix.map(row => row[pos]);
    const unique = [...new Set(values)];
    if (unique.length === 1) {
      console.log(`Byte ${pos} is constant: 0x${unique[0].toString(16).padStart(2, '0')}`);
    }
  }
  
  // Check if any byte is derived from timestamp
  console.log('\n=== Byte-Timestamp Correlation ===');
  for (let pos = 0; pos < 4; pos++) {
    const correlations = [];
    for (let i = 0; i < samples.length; i++) {
      const ts = samples[i].timestamp;
      const xorByte = xorMatrix[i][pos];
      const tsByte = (ts >> (pos * 8)) & 0xFF;
      correlations.push({ ts, xorByte, tsByte, xor: xorByte ^ tsByte });
    }
    console.log(`\nByte ${pos}:`);
    for (const c of correlations.slice(0, 5)) {
      console.log(`  ts=${c.ts} xorByte=0x${c.xorByte.toString(16).padStart(2, '0')} tsByte=0x${c.tsByte.toString(16).padStart(2, '0')} xor=0x${c.xor.toString(16).padStart(2, '0')}`);
    }
  }
}

main().catch(console.error);
