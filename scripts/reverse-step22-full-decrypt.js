/**
 * Step 22: Full decryption implementation
 * 
 * Based on analysis:
 * 1. PAGE_DATA is base64-like encoded
 * 2. Decryption uses XOR with a 32-byte key derived from MD5
 * 3. The key might be derived from location.host or a constant
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Step 22: Full Decryption Implementation ===\n');

// Sample PAGE_DATA values
const PAGE_DATA_SAMPLES = [
  '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4', // rapidshare
  '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4', // rapidairmax
];

// Known domains
const DOMAINS = [
  'rapidshare.cc',
  'rapidairmax.site',
  'rapidshare.nu',
  'rapidshare.ws',
];

// MD5 implementation (same as in the obfuscated code)
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Convert hex string to byte array
function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

// URL-safe base64 decode
function urlSafeBase64Decode(str) {
  // Replace URL-safe chars with standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

// Standard base64 decode
function base64Decode(str) {
  return Buffer.from(str, 'base64');
}

// XOR decrypt with key
function xorDecrypt(data, key) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    result.push(data[i] ^ key[i % key.length]);
  }
  return Buffer.from(result);
}

// Try different key derivations
function tryKeyDerivations(domain) {
  const keys = [];
  
  // Direct MD5 of domain
  keys.push({ name: `md5(${domain})`, key: hexToBytes(md5(domain)) });
  
  // MD5 of domain without TLD
  const domainBase = domain.split('.')[0];
  keys.push({ name: `md5(${domainBase})`, key: hexToBytes(md5(domainBase)) });
  
  // MD5 of "rapidshare"
  keys.push({ name: 'md5(rapidshare)', key: hexToBytes(md5('rapidshare')) });
  
  // MD5 of common strings
  const commonStrings = ['secret', 'key', 'player', 'video', 'stream', 'embed'];
  commonStrings.forEach(s => {
    keys.push({ name: `md5(${s})`, key: hexToBytes(md5(s)) });
  });
  
  // Try the domain + path combinations
  keys.push({ name: `md5(${domain}/e/)`, key: hexToBytes(md5(`${domain}/e/`)) });
  
  return keys;
}

// Check if result looks like valid data
function isValidResult(buffer) {
  const str = buffer.toString('utf8');
  
  // Check for URL patterns
  if (str.includes('http://') || str.includes('https://')) return { valid: true, reason: 'Contains URL' };
  if (str.includes('.m3u8')) return { valid: true, reason: 'Contains m3u8' };
  if (str.includes('.mp4')) return { valid: true, reason: 'Contains mp4' };
  
  // Check for JSON-like structure
  if (str.startsWith('{') || str.startsWith('[')) return { valid: true, reason: 'JSON-like' };
  
  // Check for mostly printable ASCII
  let printable = 0;
  for (let i = 0; i < Math.min(buffer.length, 100); i++) {
    if (buffer[i] >= 32 && buffer[i] <= 126) printable++;
  }
  if (printable / Math.min(buffer.length, 100) > 0.8) {
    return { valid: true, reason: 'Mostly printable' };
  }
  
  return { valid: false };
}

// Main decryption attempt
function tryDecrypt(pageData, domain) {
  console.log(`\n=== Trying to decrypt PAGE_DATA for ${domain} ===`);
  console.log(`PAGE_DATA: ${pageData.substring(0, 50)}...`);
  
  // Try URL-safe base64 decode first
  let decoded;
  try {
    decoded = urlSafeBase64Decode(pageData);
    console.log(`URL-safe base64 decoded: ${decoded.length} bytes`);
    console.log(`First 20 bytes (hex): ${decoded.slice(0, 20).toString('hex')}`);
  } catch (e) {
    console.log('URL-safe base64 decode failed:', e.message);
    return;
  }
  
  // Try different keys
  const keys = tryKeyDerivations(domain);
  
  for (const { name, key } of keys) {
    const decrypted = xorDecrypt(decoded, key);
    const result = isValidResult(decrypted);
    
    if (result.valid) {
      console.log(`\n✓ SUCCESS with key: ${name}`);
      console.log(`Reason: ${result.reason}`);
      console.log(`Decrypted (first 200 chars): ${decrypted.toString('utf8').substring(0, 200)}`);
      return decrypted;
    }
  }
  
  console.log('\nNo valid decryption found with standard keys');
  
  // Try without XOR - maybe it's just base64
  const result = isValidResult(decoded);
  if (result.valid) {
    console.log(`\n✓ Data is valid without XOR: ${result.reason}`);
    console.log(`Decoded (first 200 chars): ${decoded.toString('utf8').substring(0, 200)}`);
    return decoded;
  }
}

// Analyze the structure of PAGE_DATA
function analyzePageData(pageData) {
  console.log('\n=== Analyzing PAGE_DATA structure ===');
  console.log(`Length: ${pageData.length}`);
  console.log(`Characters: ${[...new Set(pageData)].sort().join('')}`);
  
  // Check if it's URL-safe base64
  const urlSafeChars = /^[A-Za-z0-9_-]+$/;
  console.log(`Is URL-safe base64: ${urlSafeChars.test(pageData)}`);
  
  // Decode and analyze
  try {
    const decoded = urlSafeBase64Decode(pageData);
    console.log(`Decoded length: ${decoded.length} bytes`);
    
    // Look for patterns in decoded data
    const hexStr = decoded.toString('hex');
    console.log(`First 40 bytes (hex): ${hexStr.substring(0, 80)}`);
    
    // Check for repeating patterns
    const patterns = {};
    for (let i = 0; i < decoded.length - 1; i++) {
      const pair = decoded.slice(i, i + 2).toString('hex');
      patterns[pair] = (patterns[pair] || 0) + 1;
    }
    const topPatterns = Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log('Top byte patterns:', topPatterns);
    
  } catch (e) {
    console.log('Decode error:', e.message);
  }
}

// Look for the key in the obfuscated code
function findKeyInCode() {
  console.log('\n=== Looking for key in obfuscated code ===');
  
  const code = fs.readFileSync('rapidshare-app.js', 'utf8');
  
  // Look for 32-character hex strings (MD5 hashes)
  const md5Pattern = /['"]([\da-f]{32})['"]/gi;
  const md5Matches = code.match(md5Pattern);
  if (md5Matches) {
    console.log('Found potential MD5 hashes:', md5Matches.slice(0, 5));
  }
  
  // Look for base64-encoded keys
  const base64Pattern = /['"]([A-Za-z0-9+/=]{20,44})['"]/g;
  let match;
  const base64Keys = [];
  while ((match = base64Pattern.exec(code)) !== null) {
    if (match[1].length === 32 || match[1].length === 44) {
      base64Keys.push(match[1]);
    }
  }
  if (base64Keys.length > 0) {
    console.log('Found potential base64 keys:', base64Keys.slice(0, 5));
  }
  
  // Look for the W3.N4F/W3.N0M function calls that might return the key
  const n4fPattern = /W3\.N[04][FM]\((\d+)\)/g;
  const indices = new Set();
  while ((match = n4fPattern.exec(code)) !== null) {
    indices.add(parseInt(match[1]));
  }
  console.log('N4F/N0M indices used:', [...indices].sort((a, b) => a - b).slice(0, 20));
}

// Run analysis
console.log('=== PAGE_DATA Analysis ===\n');

PAGE_DATA_SAMPLES.forEach((pageData, i) => {
  console.log(`\n--- Sample ${i + 1} ---`);
  analyzePageData(pageData);
});

// Try decryption
DOMAINS.forEach((domain, i) => {
  if (i < PAGE_DATA_SAMPLES.length) {
    tryDecrypt(PAGE_DATA_SAMPLES[i], domain);
  }
});

// Look for key in code
findKeyInCode();

// Try brute force with common patterns
console.log('\n\n=== Brute Force with Common Patterns ===');

const pageData = PAGE_DATA_SAMPLES[0];
const decoded = urlSafeBase64Decode(pageData);

// Try XOR with single bytes
console.log('\nTrying single-byte XOR...');
for (let key = 0; key < 256; key++) {
  const decrypted = Buffer.from(decoded.map(b => b ^ key));
  const str = decrypted.toString('utf8');
  if (str.includes('http') || str.includes('.m3u8') || str.includes('file')) {
    console.log(`Key ${key} (0x${key.toString(16)}): ${str.substring(0, 100)}`);
  }
}

// Try XOR with the first few bytes as key
console.log('\nTrying first bytes as key...');
for (let keyLen = 1; keyLen <= 8; keyLen++) {
  const key = decoded.slice(0, keyLen);
  const decrypted = xorDecrypt(decoded.slice(keyLen), key);
  const result = isValidResult(decrypted);
  if (result.valid) {
    console.log(`Key length ${keyLen}: ${result.reason}`);
    console.log(`Decrypted: ${decrypted.toString('utf8').substring(0, 100)}`);
  }
}
