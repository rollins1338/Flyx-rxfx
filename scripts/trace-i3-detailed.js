/**
 * Detailed trace of i3() function to understand key derivation
 * 
 * From the code:
 * r[9]=J(u7dV1j(W3.N0M(212))) - initializes key array from string table entry 212
 * r[8]=M() - gets something (likely timestamp or hash)
 * r[4]=t4TD2P[u7dV1j(L)][u7dV1j(A)] - gets from t4TD2P (likely location)
 * r[1]=new p9Dy1d(r[8]+d)[g3](r[4]) - regex match
 * r[7]=f() - gets cleaned pathname
 * r[3]=r[1]?r[1][1]:W3.N0M(419)===r[4]?r[7]:R - conditional
 * 
 * Key building:
 * r[9][r[6]]=r[7][j3](r[6]%r[7][W3.N4F(380)]) - key[i] = pathname.charCodeAt(i % pathname.length)
 * r[9][r[6]]=r[3][j3](r[6]%r[3][W3.N0M(380)]) - key[i] = something.charCodeAt(i % something.length)
 * r[9][r[6]]=r[9][r[6]+2] - key[i] = key[i+2] (shift)
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== Detailed i3() Analysis ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// Find the k[] string table
const kPattern = /k\[(\d+)\]\s*=\s*["']([^"']+)["']/g;
const stringTable = {};
let match;
while ((match = kPattern.exec(code)) !== null) {
  stringTable[parseInt(match[1])] = match[2];
}

// Key indices from the code
const keyIndices = {
  212: 'Initial key array source',
  419: 'Empty string or default',
  380: 'length property',
  90: 'charCodeAt (j3)',
  148: 'match/exec (g3)',
};

console.log('String table entries used in i3():');
Object.entries(keyIndices).forEach(([idx, desc]) => {
  console.log(`  k[${idx}] = "${stringTable[idx] || 'NOT FOUND'}" (${desc})`);
});

// Find what t4TD2P is
console.log('\n=== Finding t4TD2P ===\n');

// t4TD2P is likely window or document
// Look for its definition
const t4tdPattern = /t4TD2P\s*=\s*([^;,\n]+)/g;
while ((match = t4tdPattern.exec(code)) !== null) {
  console.log(`t4TD2P = ${match[1]}`);
}

// Find E3 and B3 (indices for location.pathname)
console.log('\n=== Finding E3 and B3 ===\n');

const e3Pattern = /E3\s*=\s*(\d+|W3\.[^;,]+)/g;
while ((match = e3Pattern.exec(code)) !== null) {
  console.log(`E3 = ${match[1]}`);
}

const b3Pattern = /B3\s*=\s*(\d+|W3\.[^;,]+)/g;
while ((match = b3Pattern.exec(code)) !== null) {
  console.log(`B3 = ${match[1]}`);
}

// Find the M() function that returns something
console.log('\n=== Finding M() ===\n');

// M() returns r(t4TD2P[u7dV1j(E3)][u7dV1j(B3)])[I3](16)
// This is likely: parseInt(location.pathname, 16) or similar

// Find I3
const i3Pattern = /I3\s*=\s*(\d+|W3\.[^;,]+)/g;
while ((match = i3Pattern.exec(code)) !== null) {
  console.log(`I3 = ${match[1]}`);
}

// Find the r() function
console.log('\n=== Finding r() function ===\n');

const rFuncPattern = /function r\(a\)\{[^}]+\}/g;
const rMatches = code.match(rFuncPattern);
if (rMatches) {
  rMatches.forEach(m => {
    if (m.length < 500) {
      console.log(m);
    }
  });
}

// The key derivation seems to involve:
// 1. Getting the pathname
// 2. Cleaning it (removing non-alphanumeric)
// 3. Possibly hashing or transforming it
// 4. Building a 32-byte key

// Let's try to understand the regex pattern
console.log('\n=== Regex pattern analysis ===\n');

// The regex in f(): /[^\u0041-\x44\u0045-\u0047\110-\x50\121-\126\x57-\u005a\x30-\x34\x35-\x39]/g
// This keeps: A-Z, 0-9

// But there's also a regex match: new p9Dy1d(r[8]+d)[g3](r[4])
// r[8] is from M() - might be a pattern
// d is some string
// r[4] is location.pathname

// Find the d variable
const dPattern = /\bd\s*=\s*["']([^"']+)["']/g;
while ((match = dPattern.exec(code)) !== null) {
  if (match[1].length < 50) {
    console.log(`d = "${match[1]}"`);
  }
}

// The key might be derived from a combination of:
// 1. The embed ID
// 2. A timestamp
// 3. A secret constant

// Let's look for the actual key building loop
console.log('\n=== Key building loop ===\n');

// Find the pattern: r[9][r[6]]=...
const keyBuildPattern = /r\[9\]\[r\[6\]\]\s*=\s*([^;]+)/g;
while ((match = keyBuildPattern.exec(code)) !== null) {
  console.log(`Key build: ${match[1]}`);
}

// Also look for c[1] assignments in the decryption function
const c1Pattern = /c\[1\]\s*=\s*([^;,\n]+)/g;
const c1Assignments = [];
while ((match = c1Pattern.exec(code)) !== null) {
  c1Assignments.push(match[1]);
}
console.log('\nc[1] assignments:');
c1Assignments.slice(0, 10).forEach(a => console.log(`  ${a}`));

// The key might be static or derived from the page
// Let's try to find any hardcoded keys
console.log('\n=== Looking for hardcoded keys ===\n');

// Look for 32-byte hex strings
const hex32Pattern = /["']([0-9a-f]{64})["']/gi;
const hex32Matches = code.match(hex32Pattern);
if (hex32Matches) {
  console.log('32-byte hex strings:');
  hex32Matches.forEach(m => console.log(`  ${m}`));
}

// Look for base64 strings that might be keys
const base64Pattern = /["']([A-Za-z0-9+/]{32,44}={0,2})["']/g;
const base64Matches = [];
while ((match = base64Pattern.exec(code)) !== null) {
  if (match[1].length >= 32 && match[1].length <= 44) {
    base64Matches.push(match[1]);
  }
}
if (base64Matches.length > 0) {
  console.log('Potential base64 keys:');
  base64Matches.slice(0, 10).forEach(m => console.log(`  ${m}`));
}

// The PAGE_DATA might be encrypted with a key derived from the app.js path
// The path contains: 2457433dff868594ecbf3b15e9f22a46efd70a
console.log('\n=== Trying app.js path hash as key ===\n');

const appJsHash = '2457433dff868594ecbf3b15e9f22a46efd70a';
console.log(`App.js path hash: ${appJsHash}`);

// Try using this as the key
const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const decoded = urlSafeBase64Decode(pageData);

// Try the hash as key
const hashKey = Buffer.from(appJsHash, 'hex');
let result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ hashKey[i % hashKey.length];
}
console.log(`XOR with app.js hash: ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// Try MD5 of the hash
const md5Hash = crypto.createHash('md5').update(appJsHash).digest();
result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ md5Hash[i % md5Hash.length];
}
console.log(`XOR with MD5(app.js hash): ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

// The key might be derived from combining embed ID and app.js hash
const embedId = '2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const combined = embedId + appJsHash;
const combinedMd5 = crypto.createHash('md5').update(combined).digest();
result = Buffer.alloc(decoded.length);
for (let i = 0; i < decoded.length; i++) {
  result[i] = decoded[i] ^ combinedMd5[i % combinedMd5.length];
}
console.log(`XOR with MD5(embedId + hash): ${result.toString('utf8').replace(/[^\x20-\x7e]/g, '.')}`);

console.log('\n=== Done ===');
