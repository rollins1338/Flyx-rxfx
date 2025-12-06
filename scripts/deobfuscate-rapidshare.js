/**
 * Deobfuscate rapidshare app.js to find the decryption algorithm
 * 
 * The code uses:
 * - u6JBF object for state
 * - N4F/N0M functions to access string table
 * - W3 object for control flow
 * - XOR with 32-byte key for decryption
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Deobfuscating rapidshare app.js ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// First, let's understand the string table
// The string table is built by V2AsvL and accessed via N4F/N0M

// Find the V2AsvL function
console.log('=== Finding V2AsvL string table builder ===\n');

// The string table is XOR encoded with "C|B%"
// Let's find where it's defined
const v2asvlIdx = code.indexOf('V2AsvL');
if (v2asvlIdx !== -1) {
  // Find the function definition
  const funcStart = code.lastIndexOf('function', v2asvlIdx);
  const funcEnd = code.indexOf('}', v2asvlIdx + 500);
  console.log('V2AsvL function:');
  console.log(code.substring(funcStart, funcEnd + 1).substring(0, 500));
}

// Find the encoded string that gets decoded
// It's passed to M2OpVfE
const m2opvfeIdx = code.indexOf('M2OpVfE');
if (m2opvfeIdx !== -1) {
  // Look for the string passed to it
  const contextStart = Math.max(0, m2opvfeIdx - 200);
  const contextEnd = Math.min(code.length, m2opvfeIdx + 1000);
  const context = code.substring(contextStart, contextEnd);
  
  // Find the encoded string
  const encodedMatch = context.match(/\("([^"]+)"\)/);
  if (encodedMatch) {
    console.log('\n=== Encoded string table ===');
    console.log(`Encoded: ${encodedMatch[1]}`);
    
    // Decode it
    const encoded = decodeURIComponent(encodedMatch[1]);
    console.log(`URL decoded: ${encoded}`);
    
    // XOR with "C|B%"
    const xorKey = 'C|B%';
    let decoded = '';
    for (let i = 0; i < encoded.length; i++) {
      decoded += String.fromCharCode(encoded.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
    }
    console.log(`XOR decoded: ${decoded}`);
  }
}

// Find all N4F/N0M calls and their indices
console.log('\n=== N4F/N0M string table indices ===\n');

const n4fPattern = /N[04][FM]\((\d+)\)/g;
const indices = new Map();
let match;
while ((match = n4fPattern.exec(code)) !== null) {
  const idx = parseInt(match[1]);
  indices.set(idx, (indices.get(idx) || 0) + 1);
}

// Sort by frequency
const sortedIndices = [...indices.entries()].sort((a, b) => b[1] - a[1]);
console.log('Most used indices:');
sortedIndices.slice(0, 20).forEach(([idx, count]) => {
  console.log(`  ${idx}: ${count} times`);
});

// Find the actual decryption function
// It should use XOR with %32
console.log('\n=== Finding decryption function ===\n');

const xor32Idx = code.indexOf('%32]');
if (xor32Idx !== -1) {
  // Find the enclosing function
  let funcStart = xor32Idx;
  let braceCount = 0;
  
  for (let i = xor32Idx; i >= 0; i--) {
    if (code[i] === '}') braceCount++;
    if (code[i] === '{') {
      braceCount--;
      if (braceCount < 0) {
        // Find function keyword
        const before = code.substring(Math.max(0, i - 100), i);
        const funcMatch = before.match(/function\s*(\w*)\s*\([^)]*\)\s*$/);
        if (funcMatch) {
          funcStart = i - 100 + funcMatch.index;
          console.log(`Found function: ${funcMatch[0]}`);
          break;
        }
      }
    }
  }
  
  // Get the full function
  const funcEnd = Math.min(code.length, xor32Idx + 2000);
  console.log('\nDecryption function context:');
  console.log(code.substring(funcStart, funcEnd).substring(0, 1500));
}

// Look for where window.__PAGE_DATA is accessed
// The string "__PAGE_DATA" is likely in the string table
console.log('\n=== Looking for PAGE_DATA access ===\n');

// Find window access patterns
const windowPatterns = code.match(/window\s*\[\s*\w+\s*\]/g);
if (windowPatterns) {
  console.log('Window access patterns:');
  [...new Set(windowPatterns)].forEach(p => console.log(`  ${p}`));
}

// Look for the player setup
// JWPlayer setup is likely called with the decrypted data
console.log('\n=== Looking for player setup ===\n');

// Find jwplayer references (might be obfuscated)
const jwIdx = code.indexOf('jwplayer');
if (jwIdx !== -1) {
  console.log('Found jwplayer at index:', jwIdx);
  console.log(code.substring(Math.max(0, jwIdx - 100), jwIdx + 200));
}

// Look for the k[] string table that's built at runtime
console.log('\n=== Looking for k[] string table ===\n');

const kPattern = /k\[(\d+)\]\s*=\s*["']([^"']+)["']/g;
const kEntries = [];
while ((match = kPattern.exec(code)) !== null) {
  kEntries.push({ idx: parseInt(match[1]), value: match[2] });
}

console.log(`Found ${kEntries.length} k[] entries`);

// Look for interesting entries
const interestingK = kEntries.filter(e => 
  e.value.includes('PAGE') || 
  e.value.includes('DATA') || 
  e.value.includes('__') ||
  e.value.includes('jw') ||
  e.value.includes('player') ||
  e.value.includes('setup') ||
  e.value.includes('source') ||
  e.value.includes('file') ||
  e.value.includes('m3u8') ||
  e.value.includes('hls')
);

console.log('Interesting k[] entries:');
interestingK.forEach(e => console.log(`  k[${e.idx}] = "${e.value}"`));

// Try to find the actual key used for decryption
console.log('\n=== Looking for decryption key ===\n');

// The key might be derived from:
// 1. A constant in the code
// 2. MD5 of something
// 3. The embed ID from the URL

// Look for 32-character hex strings (MD5 hashes)
const md5Pattern = /['"]([\da-f]{32})['"]/gi;
const md5Matches = code.match(md5Pattern);
if (md5Matches) {
  console.log('Potential MD5 hashes:');
  [...new Set(md5Matches)].slice(0, 10).forEach(m => console.log(`  ${m}`));
}

// Look for the path in the app.js URL which contains a hash
// 2457433dff948487f3bb6d58f9db2a11 or 2457433dff868594ecbf3b15e9f22a46efd70a
const pathHash = '2457433dff948487f3bb6d58f9db2a11';
console.log(`\nPath hash: ${pathHash}`);
console.log(`MD5 of path hash: ${crypto.createHash('md5').update(pathHash).digest('hex')}`);

// Try using the path hash as the decryption key
const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

function xorDecrypt(data, key) {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

const decoded = urlSafeBase64Decode(pageData);
console.log(`\nDecoded PAGE_DATA: ${decoded.toString('hex')}`);

// Try path hash as key
const pathHashKey = Buffer.from(pathHash, 'hex');
let result = xorDecrypt(decoded, pathHashKey);
console.log(`\nXOR with path hash: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try MD5 of path hash
const md5PathHash = crypto.createHash('md5').update(pathHash).digest();
result = xorDecrypt(decoded, md5PathHash);
console.log(`XOR with MD5(path hash): ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try the version string
const version = '19a76d77646';
const md5Version = crypto.createHash('md5').update(version).digest();
result = xorDecrypt(decoded, md5Version);
console.log(`XOR with MD5(version): ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

console.log('\n=== Done ===');
