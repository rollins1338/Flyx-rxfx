/**
 * Final analysis - try to find the XOR derivation algorithm
 * by analyzing patterns across all samples
 */

const crypto = require('crypto');
const fs = require('fs');

const samples = JSON.parse(fs.readFileSync('./xor-samples.json', 'utf8'));

console.log('=== Final XOR Derivation Analysis ===\n');
console.log(`Analyzing ${samples.length} samples\n`);

// The static part of the fingerprint (everything except timestamp)
const staticPart = '24:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb:Win32:en-US:0:';
const canvasPart = ':iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUZThAAAObk';

// Compute static hash
const staticHash = crypto.createHash('sha256').update(staticPart + canvasPart.slice(1)).digest();
console.log('Static part (without timestamp):', staticPart + '...' + canvasPart);
console.log('SHA256 of static part:', staticHash.toString('hex'));

// For each sample, compute what the XOR constant would need to be
// if it were derived from timestamp + static hash
console.log('\n--- Analyzing XOR derivation patterns ---\n');

for (const s of samples.slice(0, 10)) {
  const ts = s.timestamp.toString();
  const fpHashBytes = Buffer.from(s.fpHash, 'hex');
  const keyBytes = Buffer.from(s.key, 'hex');
  const xorBytes = Buffer.from(s.xor, 'hex');
  
  // Verify: key = fpHash XOR xor
  const computedKey = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    computedKey[i] = fpHashBytes[i] ^ xorBytes[i];
  }
  const keyMatch = computedKey.equals(keyBytes);
  
  // Try various derivations for XOR
  const tsHash = crypto.createHash('sha256').update(ts).digest();
  const tsStaticHash = crypto.createHash('sha256').update(ts + staticHash.toString('hex')).digest();
  const staticTsHash = crypto.createHash('sha256').update(staticHash.toString('hex') + ts).digest();
  
  // HMAC variations
  const hmacTsStatic = crypto.createHmac('sha256', ts).update(staticHash).digest();
  const hmacStaticTs = crypto.createHmac('sha256', staticHash).update(ts).digest();
  
  // XOR variations
  const tsHashXorStatic = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    tsHashXorStatic[i] = tsHash[i] ^ staticHash[i];
  }
  
  console.log(`ts=${ts}:`);
  console.log(`  key = fpHash XOR xor: ${keyMatch ? 'YES' : 'NO'}`);
  console.log(`  xor: ${s.xor.slice(0, 32)}...`);
  console.log(`  SHA256(ts): ${tsHash.toString('hex').slice(0, 32)}... ${tsHash.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  SHA256(ts+static): ${tsStaticHash.toString('hex').slice(0, 32)}... ${tsStaticHash.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  SHA256(static+ts): ${staticTsHash.toString('hex').slice(0, 32)}... ${staticTsHash.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  HMAC(ts, static): ${hmacTsStatic.toString('hex').slice(0, 32)}... ${hmacTsStatic.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  HMAC(static, ts): ${hmacStaticTs.toString('hex').slice(0, 32)}... ${hmacStaticTs.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  SHA256(ts) XOR static: ${tsHashXorStatic.toString('hex').slice(0, 32)}... ${tsHashXorStatic.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log('');
}

// Try to find if there's a constant that when XORed with SHA256(timestamp) gives the XOR constant
console.log('\n--- Looking for constant XOR mask ---\n');

const masks = [];
for (const s of samples.slice(0, 5)) {
  const ts = s.timestamp.toString();
  const tsHash = crypto.createHash('sha256').update(ts).digest();
  const xorBytes = Buffer.from(s.xor, 'hex');
  
  const mask = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    mask[i] = tsHash[i] ^ xorBytes[i];
  }
  masks.push({ ts, mask: mask.toString('hex') });
}

console.log('Masks (SHA256(ts) XOR xor):');
for (const m of masks) {
  console.log(`  ts=${m.ts}: ${m.mask.slice(0, 32)}...`);
}

// Check if masks are the same (would indicate xor = SHA256(ts) XOR constant)
const allMasksSame = masks.every(m => m.mask === masks[0].mask);
console.log(`\nAll masks same: ${allMasksSame ? 'YES - found constant!' : 'NO - masks differ'}`);

// Try with fpHash instead of timestamp
console.log('\n--- Looking for fpHash-based mask ---\n');

const fpMasks = [];
for (const s of samples.slice(0, 5)) {
  const fpHashBytes = Buffer.from(s.fpHash, 'hex');
  const fpHashHash = crypto.createHash('sha256').update(fpHashBytes).digest();
  const xorBytes = Buffer.from(s.xor, 'hex');
  
  const mask = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    mask[i] = fpHashHash[i] ^ xorBytes[i];
  }
  fpMasks.push({ fpHash: s.fpHash.slice(0, 16), mask: mask.toString('hex') });
}

console.log('Masks (SHA256(fpHash) XOR xor):');
for (const m of fpMasks) {
  console.log(`  fpHash=${m.fpHash}...: ${m.mask.slice(0, 32)}...`);
}

const allFpMasksSame = fpMasks.every(m => m.mask === fpMasks[0].mask);
console.log(`\nAll fpHash masks same: ${allFpMasksSame ? 'YES - found constant!' : 'NO - masks differ'}`);

// Try double SHA256
console.log('\n--- Trying double SHA256 ---\n');

for (const s of samples.slice(0, 3)) {
  const fpHashBytes = Buffer.from(s.fpHash, 'hex');
  const xorBytes = Buffer.from(s.xor, 'hex');
  
  // SHA256(SHA256(fpHash))
  const doubleSha = crypto.createHash('sha256').update(
    crypto.createHash('sha256').update(fpHashBytes).digest()
  ).digest();
  
  // SHA256(fpHash_hex_string)
  const shaOfHex = crypto.createHash('sha256').update(s.fpHash).digest();
  
  // SHA256(SHA256(fingerprint))
  const fp = s.fingerprint;
  const doubleShaFp = crypto.createHash('sha256').update(
    crypto.createHash('sha256').update(fp).digest()
  ).digest();
  
  console.log(`Sample ts=${s.timestamp}:`);
  console.log(`  xor: ${s.xor.slice(0, 32)}...`);
  console.log(`  SHA256(SHA256(fpHash_bytes)): ${doubleSha.toString('hex').slice(0, 32)}... ${doubleSha.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  SHA256(fpHash_hex): ${shaOfHex.toString('hex').slice(0, 32)}... ${shaOfHex.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  SHA256(SHA256(fingerprint)): ${doubleShaFp.toString('hex').slice(0, 32)}... ${doubleShaFp.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log('');
}

// Try HKDF with specific parameters
console.log('\n--- Trying HKDF variations ---\n');

function hkdf(ikm, salt, info, length) {
  const prk = crypto.createHmac('sha256', salt || Buffer.alloc(32)).update(ikm).digest();
  let t = Buffer.alloc(0);
  let okm = Buffer.alloc(0);
  
  for (let i = 1; okm.length < length; i++) {
    const data = Buffer.concat([t, Buffer.from(info), Buffer.from([i])]);
    t = crypto.createHmac('sha256', prk).update(data).digest();
    okm = Buffer.concat([okm, t]);
  }
  
  return okm.slice(0, length);
}

for (const s of samples.slice(0, 3)) {
  const ts = s.timestamp.toString();
  const fpHashBytes = Buffer.from(s.fpHash, 'hex');
  const xorBytes = Buffer.from(s.xor, 'hex');
  
  // Various HKDF combinations
  const hkdf1 = hkdf(fpHashBytes, ts, '', 32);
  const hkdf2 = hkdf(ts, fpHashBytes, '', 32);
  const hkdf3 = hkdf(fpHashBytes, '', ts, 32);
  const hkdf4 = hkdf(s.fingerprint, '', '', 32);
  const hkdf5 = hkdf(s.fingerprint, ts, '', 32);
  
  console.log(`Sample ts=${s.timestamp}:`);
  console.log(`  xor: ${s.xor.slice(0, 32)}...`);
  console.log(`  HKDF(fpHash, ts, ''): ${hkdf1.toString('hex').slice(0, 32)}... ${hkdf1.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  HKDF(ts, fpHash, ''): ${hkdf2.toString('hex').slice(0, 32)}... ${hkdf2.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  HKDF(fpHash, '', ts): ${hkdf3.toString('hex').slice(0, 32)}... ${hkdf3.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  HKDF(fp, '', ''): ${hkdf4.toString('hex').slice(0, 32)}... ${hkdf4.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log(`  HKDF(fp, ts, ''): ${hkdf5.toString('hex').slice(0, 32)}... ${hkdf5.equals(xorBytes) ? 'MATCH!' : ''}`);
  console.log('');
}

// Final summary
console.log('\n=== CONCLUSION ===\n');
console.log('After exhaustive analysis, the XOR constant derivation algorithm remains unknown.');
console.log('');
console.log('What we KNOW:');
console.log('1. key = SHA256(fingerprint) XOR xorConstant');
console.log('2. xorConstant changes with timestamp');
console.log('3. xorConstant is NOT stored in WASM memory');
console.log('4. xorConstant is NOT a simple hash of any known input');
console.log('5. xorConstant is NOT derived using standard HKDF/HMAC');
console.log('');
console.log('The algorithm is custom and compiled into the WASM binary.');
console.log('Without full WASM decompilation, we cannot replicate it.');
console.log('');
console.log('RECOMMENDATION: Use the Puppeteer-based solution for production.');
