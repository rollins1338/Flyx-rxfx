/**
 * Test: Is the key SHA256(SHA256(fingerprint).toHex())?
 * Based on Ghidra decompilation showing two hash operations
 */

const crypto = require('crypto');

// Known sample from our tests
const sample = {
  timestamp: 1700000000,
  fpHash: '54c52b1a96975f71e8a3c9d2b4f6e1a0c3d5b7e9f1a2c4d6e8f0a1b3c5d7e9f0', // SHA256 of fingerprint
  key: '48d4fb5730cead3a...', // Actual key from WASM
  xor: '1c11d04da659f24b...',
};

// Fingerprint format (confirmed):
// {colorDepth}:{userAgent.slice(0,50)}:{platform}:{language}:{timezone}:{timestamp}:{canvasBase64.slice(0,50)}

function buildFingerprint(timestamp) {
  // Using controlled values from our tests
  const colorDepth = 24;
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const platform = 'Win32';
  const language = 'en-US';
  const timezone = 0;
  // Canvas base64 first 50 chars (from controlled test)
  const canvasBase64First50 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZTh';
  
  return `${colorDepth}:${userAgent.slice(0, 50)}:${platform}:${language}:${timezone}:${timestamp}:${canvasBase64First50}`;
}

console.log('=== Testing Double Hash Theory ===\n');

const timestamp = 1700000000;
const fp = buildFingerprint(timestamp);
console.log('Fingerprint:', fp);
console.log('Length:', fp.length);

// First hash
const hash1 = crypto.createHash('sha256').update(fp).digest('hex');
console.log('\nHash1 (SHA256 of fingerprint):', hash1);

// Second hash - hash the hex string
const hash2 = crypto.createHash('sha256').update(hash1).digest('hex');
console.log('Hash2 (SHA256 of hash1 hex):', hash2);

// Also try hashing the raw bytes
const hash1Bytes = Buffer.from(hash1, 'hex');
const hash2FromBytes = crypto.createHash('sha256').update(hash1Bytes).digest('hex');
console.log('Hash2 from bytes:', hash2FromBytes);

// Try various combinations
console.log('\n=== Other Combinations ===');

// SHA256(fingerprint + timestamp)
const withTs = crypto.createHash('sha256').update(fp + timestamp).digest('hex');
console.log('SHA256(fp + ts):', withTs);

// SHA256(timestamp + fingerprint)
const tsFirst = crypto.createHash('sha256').update(timestamp + fp).digest('hex');
console.log('SHA256(ts + fp):', tsFirst);

// HMAC-SHA256 with timestamp as key
const hmac1 = crypto.createHmac('sha256', String(timestamp)).update(fp).digest('hex');
console.log('HMAC(ts, fp):', hmac1);

// HMAC-SHA256 with hash1 as key
const hmac2 = crypto.createHmac('sha256', hash1).update(String(timestamp)).digest('hex');
console.log('HMAC(hash1, ts):', hmac2);

// Double SHA256 (like Bitcoin)
const doubleSha = crypto.createHash('sha256').update(hash1Bytes).digest('hex');
console.log('Double SHA256:', doubleSha);

console.log('\n=== Expected Key (from WASM) ===');
console.log('We need to compare with actual WASM output');
console.log('Run crack-wasm-collect-samples.js to get actual keys');
