/**
 * Crack rapidshare/rapidairmax PAGE_DATA encryption
 * 
 * Analysis shows:
 * 1. PAGE_DATA is URL-safe base64 encoded
 * 2. The decoded data is 56 bytes
 * 3. Both samples start with same bytes (df030e2cf382169ad6825734dfc193e1ebab67)
 * 4. The obfuscated code uses XOR with a 32-byte key
 * 5. The key might be derived from MD5 of something
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Cracking rapidshare PAGE_DATA ===\n');

// Sample PAGE_DATA values
const SAMPLES = [
  { 
    pageData: '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4',
    domain: 'rapidshare.cc',
    embedId: '2MvvbnGoWS2JcOLzFLpK7RXpCQ' // from URL
  },
  { 
    pageData: '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4',
    domain: 'rapidairmax.site',
    embedId: '2MvvbnGoWS2JcOLzFLpK7RXpCQ'
  },
];

// URL-safe base64 decode
function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// MD5 hash
function md5(str) {
  return crypto.createHash('md5').update(str).digest();
}

function md5Hex(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// XOR decrypt
function xorDecrypt(data, key) {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

// Check if result looks valid
function isValidResult(buffer) {
  const str = buffer.toString('utf8');
  if (str.includes('http://') || str.includes('https://')) return { valid: true, reason: 'URL' };
  if (str.includes('.m3u8')) return { valid: true, reason: 'm3u8' };
  if (str.includes('.mp4')) return { valid: true, reason: 'mp4' };
  if (str.startsWith('{') || str.startsWith('[')) return { valid: true, reason: 'JSON' };
  
  // Check printable ratio
  let printable = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] >= 32 && buffer[i] <= 126) printable++;
  }
  if (printable / buffer.length > 0.9) return { valid: true, reason: 'printable' };
  
  return { valid: false };
}

// Analyze the structure
console.log('=== Structure Analysis ===\n');

SAMPLES.forEach((sample, i) => {
  console.log(`Sample ${i + 1} (${sample.domain}):`);
  const decoded = urlSafeBase64Decode(sample.pageData);
  console.log(`  Length: ${decoded.length} bytes`);
  console.log(`  Hex: ${decoded.toString('hex')}`);
  console.log('');
});

// Compare the two samples
const decoded1 = urlSafeBase64Decode(SAMPLES[0].pageData);
const decoded2 = urlSafeBase64Decode(SAMPLES[1].pageData);

console.log('=== Comparing samples ===');
let diffStart = -1;
for (let i = 0; i < decoded1.length; i++) {
  if (decoded1[i] !== decoded2[i]) {
    if (diffStart === -1) diffStart = i;
    console.log(`  Byte ${i}: ${decoded1[i].toString(16)} vs ${decoded2[i].toString(16)}`);
  }
}
console.log(`First difference at byte ${diffStart}`);
console.log('');

// The common prefix might be a header or IV
const commonPrefix = decoded1.slice(0, diffStart);
console.log(`Common prefix (${commonPrefix.length} bytes): ${commonPrefix.toString('hex')}`);

// Try various key derivations
console.log('\n=== Trying key derivations ===\n');

const sample = SAMPLES[0];
const decoded = urlSafeBase64Decode(sample.pageData);

// Keys to try
const keyDerivations = [
  // Domain-based
  { name: 'md5(domain)', key: md5(sample.domain) },
  { name: 'md5(rapidshare)', key: md5('rapidshare') },
  { name: 'md5(rapidairmax)', key: md5('rapidairmax') },
  
  // Embed ID based
  { name: 'md5(embedId)', key: md5(sample.embedId) },
  { name: 'embedId bytes', key: Buffer.from(sample.embedId) },
  
  // Common strings
  { name: 'md5(secret)', key: md5('secret') },
  { name: 'md5(key)', key: md5('key') },
  { name: 'md5(player)', key: md5('player') },
  { name: 'md5(jwplayer)', key: md5('jwplayer') },
  
  // URL-based
  { name: 'md5(/e/)', key: md5('/e/') },
  { name: 'md5(e)', key: md5('e') },
  
  // The common prefix as key
  { name: 'common prefix', key: commonPrefix },
  
  // First 16/32 bytes as key
  { name: 'first 16 bytes', key: decoded.slice(0, 16) },
  { name: 'first 32 bytes', key: decoded.slice(0, 32) },
  
  // Known obfuscation key
  { name: 'C|B%', key: Buffer.from('C|B%') },
  { name: 'md5(C|B%)', key: md5('C|B%') },
];

for (const { name, key } of keyDerivations) {
  const decrypted = xorDecrypt(decoded, key);
  const result = isValidResult(decrypted);
  
  if (result.valid) {
    console.log(`✓ ${name}: ${result.reason}`);
    console.log(`  Key: ${key.toString('hex')}`);
    console.log(`  Result: ${decrypted.toString('utf8').substring(0, 100)}`);
    console.log('');
  }
}

// Try XOR with the difference between samples
console.log('\n=== XOR difference analysis ===\n');

const xorDiff = Buffer.alloc(decoded1.length);
for (let i = 0; i < decoded1.length; i++) {
  xorDiff[i] = decoded1[i] ^ decoded2[i];
}
console.log(`XOR difference: ${xorDiff.toString('hex')}`);

// The non-zero bytes in xorDiff show where the data differs
// This might reveal the key pattern
const nonZeroPositions = [];
for (let i = 0; i < xorDiff.length; i++) {
  if (xorDiff[i] !== 0) nonZeroPositions.push(i);
}
console.log(`Non-zero positions: ${nonZeroPositions.join(', ')}`);

// Try to find repeating pattern in the data
console.log('\n=== Pattern analysis ===\n');

// Check if there's a repeating XOR key
for (let keyLen = 1; keyLen <= 32; keyLen++) {
  let consistent = true;
  for (let i = keyLen; i < decoded.length; i++) {
    // Check if XORing with position i-keyLen gives consistent results
    // This would indicate a repeating key
  }
}

// Try decoding as different structures
console.log('\n=== Structure decoding ===\n');

// Maybe it's: [header][encrypted_data]
// Try removing first N bytes and decrypting the rest
for (let headerLen = 0; headerLen <= 20; headerLen++) {
  const data = decoded.slice(headerLen);
  
  // Try XOR with MD5 of header
  if (headerLen > 0) {
    const header = decoded.slice(0, headerLen);
    const key = md5(header);
    const decrypted = xorDecrypt(data, key);
    const result = isValidResult(decrypted);
    
    if (result.valid) {
      console.log(`Header ${headerLen} bytes + md5(header) XOR: ${result.reason}`);
      console.log(`  Result: ${decrypted.toString('utf8').substring(0, 100)}`);
    }
  }
}

// Try AES decryption
console.log('\n=== AES decryption attempts ===\n');

const aesKeys = [
  md5(sample.domain),
  md5(sample.embedId),
  md5('rapidshare'),
  decoded.slice(0, 16),
  decoded.slice(0, 32),
];

for (const key of aesKeys) {
  for (const mode of ['aes-128-ecb', 'aes-128-cbc']) {
    try {
      const keyBuf = key.slice(0, 16);
      let decipher;
      
      if (mode === 'aes-128-ecb') {
        decipher = crypto.createDecipheriv(mode, keyBuf, null);
      } else {
        // Try different IVs
        const ivs = [
          Buffer.alloc(16, 0),
          decoded.slice(0, 16),
          decoded.slice(decoded.length - 16),
        ];
        
        for (const iv of ivs) {
          try {
            decipher = crypto.createDecipheriv(mode, keyBuf, iv);
            decipher.setAutoPadding(false);
            const decrypted = Buffer.concat([decipher.update(decoded), decipher.final()]);
            const result = isValidResult(decrypted);
            if (result.valid) {
              console.log(`${mode} with key ${key.toString('hex').substring(0, 16)}... IV ${iv.toString('hex').substring(0, 8)}...`);
              console.log(`  Result: ${decrypted.toString('utf8').substring(0, 100)}`);
            }
          } catch {}
        }
        continue;
      }
      
      decipher.setAutoPadding(false);
      const decrypted = Buffer.concat([decipher.update(decoded), decipher.final()]);
      const result = isValidResult(decrypted);
      if (result.valid) {
        console.log(`${mode} with key ${key.toString('hex').substring(0, 16)}...`);
        console.log(`  Result: ${decrypted.toString('utf8').substring(0, 100)}`);
      }
    } catch {}
  }
}

// Try RC4
console.log('\n=== RC4 decryption attempts ===\n');

function rc4(key, data) {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  const result = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    result[k] = data[k] ^ S[(S[i] + S[j]) % 256];
  }
  return result;
}

const rc4Keys = [
  Buffer.from(sample.domain),
  Buffer.from(sample.embedId),
  Buffer.from('rapidshare'),
  md5(sample.domain),
  md5(sample.embedId),
];

for (const key of rc4Keys) {
  const decrypted = rc4(key, decoded);
  const result = isValidResult(decrypted);
  if (result.valid) {
    console.log(`RC4 with key ${key.toString().substring(0, 20)}...`);
    console.log(`  Result: ${decrypted.toString('utf8').substring(0, 100)}`);
  }
}

// Analyze the obfuscated code for clues
console.log('\n=== Analyzing obfuscated code ===\n');

const code = fs.readFileSync('rapidshare-app.js', 'utf8');

// Find the string table initialization
const v2asvlMatch = code.match(/V2AsvL/);
if (v2asvlMatch) {
  console.log('Found V2AsvL string table');
}

// Look for the decryption function signature
const decryptFuncMatch = code.match(/function\s+\w+\s*\([^)]*\)\s*\{[^}]*\^=[^}]*%32[^}]*\}/);
if (decryptFuncMatch) {
  console.log('Found XOR decryption function pattern');
}

// Look for where PAGE_DATA might be accessed
// The code uses window[...] patterns
const windowAccessMatch = code.match(/window\s*\[\s*\w+\s*\]/g);
if (windowAccessMatch) {
  console.log(`Found ${windowAccessMatch.length} window access patterns`);
}

console.log('\n=== Summary ===\n');
console.log('The PAGE_DATA appears to be:');
console.log('1. URL-safe base64 encoded');
console.log('2. 56 bytes when decoded');
console.log('3. Has a common prefix between different domains');
console.log('4. Likely XOR encrypted with a 32-byte key');
console.log('5. Key might be derived from MD5 of domain/embedId/constant');
