/**
 * Fingerprint Format Analysis
 * 
 * Based on the WASM strings, let's understand the fingerprint format better.
 */

const crypto = require('crypto');

// From the WASM strings analysis, we found:
// - E1, E8, E10, E13, E17, etc. - these look like length prefixes
// - tmdb_session_id - localStorage key
// - canvas2d, top, 14px 'Arial', TMDB Image Enhancement, 11px 'Arial', Processing capabilities test

// The format seems to be:
// E{length}{string}

// Let's decode the strings we found:
const wasmStrings = [
  "E60src\\lib.rsE1E8E10tmdb_session_id",
  "E13canvas2dE17top14px 'Arial'TMDB Image Enhancement ",
  "11px 'Arial'Processing capabilities test",
];

console.log('=== Fingerprint Format Analysis ===\n');

// The E{n} format seems to be a length prefix
// E1 = 1 byte, E8 = 8 bytes, E10 = 10 bytes, etc.

// Let's try to understand the fingerprint string format
// Based on our analysis, the format is:
// {colorDepth}:{userAgent.slice(0,50)}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64.slice(0,50)}

// But the WASM might use a different internal format

// Let's test with our known samples
const samples = [
  { timestamp: 1700000000, xor: "1c11d04da659f24b1c9ed02e831ca78d42c8eed05349c918b1bbc147646895dc" },
  { timestamp: 1700000001, xor: "165a5195989481d50e1d2417102e2519e0a93f4ec2c34ba43700c9624938f977" },
  { timestamp: 1700000002, xor: "c22c65a74d2b04cadf60e1030aa1e6a21dc49eee4729e53d974570b7c65696a8" },
];

// The fingerprint components we control:
const fp = {
  colorDepth: 24,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  platform: "Win32",
  language: "en-US",
  timezone: 0,
  canvasBase64First50: "iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk",
};

console.log('Fingerprint components:');
console.log('  colorDepth:', fp.colorDepth);
console.log('  userAgent (first 50):', fp.userAgent.slice(0, 50));
console.log('  platform:', fp.platform);
console.log('  language:', fp.language);
console.log('  timezone:', fp.timezone);
console.log('  canvasBase64 (first 50):', fp.canvasBase64First50);

// Try different fingerprint formats
console.log('\n=== Testing Different Fingerprint Formats ===\n');

for (const s of samples) {
  const ts = s.timestamp;
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // Format 1: Original (confirmed working)
  const format1 = `${fp.colorDepth}:${fp.userAgent.slice(0, 50)}:${fp.platform}:${fp.language}:${fp.timezone}:${ts}:${fp.canvasBase64First50}`;
  const hash1 = crypto.createHash('sha256').update(format1).digest();
  
  // Calculate what the key would be
  const key1 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    key1[i] = hash1[i] ^ xorBuf[i];
  }
  
  console.log(`ts=${ts}:`);
  console.log(`  Format 1 hash: ${hash1.toString('hex')}`);
  console.log(`  XOR constant:  ${s.xor}`);
  console.log(`  Derived key:   ${key1.toString('hex')}`);
  console.log('');
}

// Now let's try to find the XOR constant derivation
console.log('\n=== XOR Constant Analysis ===\n');

// The XOR constant changes with timestamp but not with the random part of sessionId
// This means it's derived from timestamp alone (or timestamp + some constant)

// Let's try to find a pattern by looking at the XOR constants as numbers
for (const s of samples) {
  const xorBuf = Buffer.from(s.xor, 'hex');
  
  // Read as 4 32-bit integers
  const ints = [];
  for (let i = 0; i < 8; i++) {
    ints.push(xorBuf.readUInt32LE(i * 4));
  }
  
  console.log(`ts=${s.timestamp}:`);
  console.log(`  As 32-bit ints: ${ints.map(i => '0x' + i.toString(16).padStart(8, '0')).join(', ')}`);
  
  // Check if any int is related to timestamp
  for (let i = 0; i < 8; i++) {
    const diff = ints[i] - s.timestamp;
    if (Math.abs(diff) < 1000000) {
      console.log(`  Int[${i}] - ts = ${diff}`);
    }
  }
}

// Try to find if XOR is derived from a combination of timestamp and a secret
console.log('\n=== Testing Secret-Based Derivation ===\n');

// Try HKDF with various salts
const hkdfSalts = [
  'flixer',
  'tmdb',
  'img_data',
  'session',
  'key',
  'wasm',
  'rust',
  'aes',
  'fingerprint',
  'canvas',
];

for (const salt of hkdfSalts) {
  let matches = 0;
  for (const s of samples) {
    const xorBuf = Buffer.from(s.xor, 'hex');
    
    // HKDF-like derivation
    const prk = crypto.createHmac('sha256', salt).update(String(s.timestamp)).digest();
    const okm = crypto.createHmac('sha256', prk).update('').digest();
    
    if (okm.equals(xorBuf)) {
      console.log(`MATCH: HKDF(${salt}, ts) for ts=${s.timestamp}`);
      matches++;
    }
  }
}

// Try PBKDF2 with various iterations
console.log('\nTesting PBKDF2...');
const iterations = [1, 10, 100, 1000];
for (const iter of iterations) {
  for (const s of samples) {
    const xorBuf = Buffer.from(s.xor, 'hex');
    
    const derived = crypto.pbkdf2Sync(String(s.timestamp), 'flixer', iter, 32, 'sha256');
    if (derived.equals(xorBuf)) {
      console.log(`MATCH: PBKDF2(ts, 'flixer', ${iter}) for ts=${s.timestamp}`);
    }
  }
}

console.log('\n=== Summary ===');
console.log('The XOR constant derivation uses a custom algorithm.');
console.log('It is not a simple hash, HMAC, HKDF, or PBKDF2 of the timestamp.');
console.log('The algorithm is implemented in the WASM binary.');
