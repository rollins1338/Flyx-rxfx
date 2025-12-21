/**
 * Analyze the relationship between fingerprint components and XOR constant
 * Try to find if XOR is derived from specific parts of the fingerprint
 */

const crypto = require('crypto');
const fs = require('fs');

const samples = JSON.parse(fs.readFileSync('./xor-samples.json', 'utf8'));

// Parse fingerprint into components
function parseFingerprint(fp) {
  const parts = fp.split(':');
  return {
    colorDepth: parts[0],
    userAgent: parts[1],
    platform: parts[2],
    language: parts[3],
    timezone: parts[4],
    timestamp: parts[5],
    canvas: parts[6],
  };
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

function sha256Hex(data) {
  return sha256(data).toString('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function xorBuffers(a, b) {
  const result = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    result[i] = a[i] ^ (b[i % b.length] || 0);
  }
  return result;
}

console.log('=== Fingerprint Component Analysis ===\n');

// Analyze first sample
const s = samples[0];
const fp = parseFingerprint(s.fingerprint);

console.log('Fingerprint components:');
console.log('  colorDepth:', fp.colorDepth);
console.log('  userAgent:', fp.userAgent);
console.log('  platform:', fp.platform);
console.log('  language:', fp.language);
console.log('  timezone:', fp.timezone);
console.log('  timestamp:', fp.timestamp);
console.log('  canvas:', fp.canvas.slice(0, 30) + '...');

console.log('\nKnown values:');
console.log('  fpHash:', s.fpHash);
console.log('  key:', s.key);
console.log('  xor:', s.xor);

// Try various derivations from components
console.log('\n--- Component-based Derivations ---\n');

const fpHashBytes = Buffer.from(s.fpHash, 'hex');
const xorBytes = Buffer.from(s.xor, 'hex');
const keyBytes = Buffer.from(s.key, 'hex');

// Hash of each component
const componentHashes = {
  colorDepth: sha256(fp.colorDepth),
  userAgent: sha256(fp.userAgent),
  platform: sha256(fp.platform),
  language: sha256(fp.language),
  timezone: sha256(fp.timezone),
  timestamp: sha256(fp.timestamp),
  canvas: sha256(fp.canvas),
};

// Try XOR of component hashes
console.log('XOR of component hashes:');

// XOR all component hashes together
let xorAll = Buffer.alloc(32);
for (const [name, hash] of Object.entries(componentHashes)) {
  xorAll = xorBuffers(xorAll, hash);
}
console.log('  XOR(all components):', xorAll.toString('hex').slice(0, 32) + '...');
console.log('  Match:', xorAll.toString('hex') === s.xor ? 'YES' : 'NO');

// Try specific combinations
const combos = [
  ['timestamp', 'canvas'],
  ['timestamp', 'userAgent'],
  ['timestamp', 'platform'],
  ['canvas', 'userAgent'],
  ['timestamp', 'canvas', 'userAgent'],
  ['timestamp', 'canvas', 'platform'],
];

for (const combo of combos) {
  let xorCombo = Buffer.alloc(32);
  for (const name of combo) {
    xorCombo = xorBuffers(xorCombo, componentHashes[name]);
  }
  const match = xorCombo.toString('hex') === s.xor;
  console.log(`  XOR(${combo.join(', ')}): ${match ? '*** MATCH ***' : xorCombo.toString('hex').slice(0, 32) + '...'}`);
}

// Try HMAC with component combinations
console.log('\n--- HMAC with Components ---\n');

const hmacCombos = [
  { key: fp.timestamp, data: fp.canvas },
  { key: fp.canvas, data: fp.timestamp },
  { key: fp.timestamp, data: s.fpHash },
  { key: s.fpHash, data: fp.timestamp },
  { key: fp.canvas, data: s.fpHash },
  { key: s.fpHash, data: fp.canvas },
  { key: fp.timestamp + fp.canvas, data: s.fpHash },
  { key: s.fpHash, data: fp.timestamp + fp.canvas },
];

for (const { key, data } of hmacCombos) {
  const hmac = hmacSha256(key, data);
  const match = hmac.toString('hex') === s.xor;
  console.log(`  HMAC(${key.slice(0, 15)}..., ${data.slice(0, 15)}...): ${match ? '*** MATCH ***' : hmac.toString('hex').slice(0, 32) + '...'}`);
}

// Try double hashing with components
console.log('\n--- Double Hashing with Components ---\n');

// SHA256(SHA256(timestamp) || fpHash)
const doubleHash1 = sha256(Buffer.concat([sha256(fp.timestamp), fpHashBytes]));
console.log('SHA256(SHA256(ts) || fpHash):', doubleHash1.toString('hex').slice(0, 32) + '...');
console.log('Match:', doubleHash1.toString('hex') === s.xor ? 'YES' : 'NO');

// SHA256(fpHash || SHA256(timestamp))
const doubleHash2 = sha256(Buffer.concat([fpHashBytes, sha256(fp.timestamp)]));
console.log('SHA256(fpHash || SHA256(ts)):', doubleHash2.toString('hex').slice(0, 32) + '...');
console.log('Match:', doubleHash2.toString('hex') === s.xor ? 'YES' : 'NO');

// SHA256(SHA256(canvas) || fpHash)
const doubleHash3 = sha256(Buffer.concat([sha256(fp.canvas), fpHashBytes]));
console.log('SHA256(SHA256(canvas) || fpHash):', doubleHash3.toString('hex').slice(0, 32) + '...');
console.log('Match:', doubleHash3.toString('hex') === s.xor ? 'YES' : 'NO');

// Try with the full fingerprint in different orders
console.log('\n--- Fingerprint Reordering ---\n');

const reorderings = [
  `${fp.timestamp}:${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}:${fp.canvas}`,
  `${fp.canvas}:${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}:${fp.timestamp}`,
  `${fp.timestamp}:${fp.canvas}`,
  `${fp.canvas}:${fp.timestamp}`,
  `${fp.timestamp}${fp.canvas}`,
  `${fp.canvas}${fp.timestamp}`,
];

for (const reorder of reorderings) {
  const hash = sha256Hex(reorder);
  const match = hash === s.xor;
  console.log(`SHA256("${reorder.slice(0, 30)}..."): ${match ? '*** MATCH ***' : hash.slice(0, 32) + '...'}`);
}

// Try XOR with timestamp bytes
console.log('\n--- Timestamp Byte Operations ---\n');

const tsNum = parseInt(fp.timestamp);
const tsBytes = Buffer.alloc(8);
tsBytes.writeBigUInt64LE(BigInt(tsNum));

// fpHash XOR (timestamp repeated)
const tsRepeated = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  tsRepeated[i] = tsBytes[i % 8];
}
const fpXorTs = xorBuffers(fpHashBytes, tsRepeated);
console.log('fpHash XOR ts_repeated:', fpXorTs.toString('hex').slice(0, 32) + '...');
console.log('Match:', fpXorTs.toString('hex') === s.xor ? 'YES' : 'NO');

// Try with canvas bytes
const canvasBytes = Buffer.from(fp.canvas);
const canvasRepeated = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  canvasRepeated[i] = canvasBytes[i % canvasBytes.length];
}
const fpXorCanvas = xorBuffers(fpHashBytes, canvasRepeated);
console.log('fpHash XOR canvas_repeated:', fpXorCanvas.toString('hex').slice(0, 32) + '...');
console.log('Match:', fpXorCanvas.toString('hex') === s.xor ? 'YES' : 'NO');

// Try HKDF with specific parameters
console.log('\n--- HKDF Derivations ---\n');

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

const hkdfTests = [
  { ikm: s.fpHash, salt: fp.timestamp, info: 'key' },
  { ikm: fp.timestamp, salt: s.fpHash, info: 'key' },
  { ikm: s.fpHash, salt: fp.canvas, info: 'key' },
  { ikm: fp.canvas, salt: s.fpHash, info: 'key' },
  { ikm: s.fingerprint, salt: '', info: 'xor' },
  { ikm: s.fpHash, salt: '', info: 'xor' },
  { ikm: s.fpHash, salt: fp.timestamp, info: '' },
  { ikm: fpHashBytes, salt: fp.timestamp, info: '' },
  { ikm: fpHashBytes, salt: tsBytes, info: '' },
];

for (const { ikm, salt, info } of hkdfTests) {
  const result = hkdf(ikm, salt, info, 32);
  const match = result.toString('hex') === s.xor;
  const ikmStr = Buffer.isBuffer(ikm) ? 'bytes' : ikm.slice(0, 15);
  const saltStr = Buffer.isBuffer(salt) ? 'bytes' : (salt || '').slice(0, 15);
  console.log(`HKDF(${ikmStr}..., ${saltStr}..., "${info}"): ${match ? '*** MATCH ***' : result.toString('hex').slice(0, 32) + '...'}`);
}

// Verify across multiple samples
console.log('\n--- Cross-Sample Verification ---\n');

// Check if there's a consistent pattern
console.log('Checking if XOR = f(timestamp, static_component) for all samples...');

// The static components are the same across all samples (same browser fingerprint)
// Only timestamp changes

// Let's see if XOR = SHA256(timestamp || static_secret)
// where static_secret is derived from the static fingerprint components

const staticPart = `${fp.colorDepth}:${fp.userAgent}:${fp.platform}:${fp.language}:${fp.timezone}:${fp.canvas}`;
const staticHash = sha256(staticPart);

console.log('Static part hash:', staticHash.toString('hex'));

for (const sample of samples.slice(0, 5)) {
  const sampleFp = parseFingerprint(sample.fingerprint);
  
  // Try: XOR = SHA256(timestamp || staticHash)
  const derived1 = sha256(Buffer.concat([Buffer.from(sampleFp.timestamp), staticHash]));
  const match1 = derived1.toString('hex') === sample.xor;
  
  // Try: XOR = SHA256(staticHash || timestamp)
  const derived2 = sha256(Buffer.concat([staticHash, Buffer.from(sampleFp.timestamp)]));
  const match2 = derived2.toString('hex') === sample.xor;
  
  // Try: XOR = HMAC(staticHash, timestamp)
  const derived3 = hmacSha256(staticHash, sampleFp.timestamp);
  const match3 = derived3.toString('hex') === sample.xor;
  
  // Try: XOR = HMAC(timestamp, staticHash)
  const derived4 = hmacSha256(sampleFp.timestamp, staticHash);
  const match4 = derived4.toString('hex') === sample.xor;
  
  console.log(`ts=${sampleFp.timestamp}: SHA256(ts||static)=${match1}, SHA256(static||ts)=${match2}, HMAC(static,ts)=${match3}, HMAC(ts,static)=${match4}`);
}

console.log('\n=== Summary ===');
console.log('No simple derivation found from fingerprint components.');
console.log('The XOR constant derivation uses a custom algorithm.');
