#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v50
 * 
 * The base keystream with running XOR matches for 33 bytes, then diverges.
 * This is exactly where the plaintext diverges!
 * 
 * Let me try: base_keystream[i] = keystream[i] XOR xor(plaintext[0:i])
 * (including plaintext[i] in the XOR, not just 0:i-1)
 */

const fs = require('fs');

const working = JSON.parse(fs.readFileSync('megaup-keystream-working.json', 'utf8'));
const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));

const wKs = working.keystream;
const fKs = failing.keystream;
const wDec = Buffer.from(working.decrypted, 'utf8');
const fDec = Buffer.from(failing.decrypted, 'utf8');

console.log('=== Testing different running XOR formulas ===\n');

// Formula 1: base[i] = ks[i] XOR xor(plain[0:i-1])
console.log('Formula 1: base[i] = ks[i] XOR xor(plain[0:i-1])');
let wXor = 0, fXor = 0;
let matches1 = 0;
for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  const wBase = wKs[i] ^ wXor;
  const fBase = fKs[i] ^ fXor;
  if (wBase === fBase) matches1++;
  wXor ^= wDec[i];
  fXor ^= fDec[i];
}
console.log(`Matches: ${matches1}/${Math.min(wKs.length, fKs.length)}\n`);

// Formula 2: base[i] = ks[i] XOR xor(plain[0:i])
console.log('Formula 2: base[i] = ks[i] XOR xor(plain[0:i])');
wXor = 0; fXor = 0;
let matches2 = 0;
for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  wXor ^= wDec[i];
  fXor ^= fDec[i];
  const wBase = wKs[i] ^ wXor;
  const fBase = fKs[i] ^ fXor;
  if (wBase === fBase) matches2++;
}
console.log(`Matches: ${matches2}/${Math.min(wKs.length, fKs.length)}\n`);

// Formula 3: base[i] = ks[i] - sum(plain[0:i-1]) mod 256
console.log('Formula 3: base[i] = ks[i] - sum(plain[0:i-1]) mod 256');
let wSum = 0, fSum = 0;
let matches3 = 0;
for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  const wBase = (wKs[i] - wSum + 256) & 0xFF;
  const fBase = (fKs[i] - fSum + 256) & 0xFF;
  if (wBase === fBase) matches3++;
  wSum = (wSum + wDec[i]) & 0xFF;
  fSum = (fSum + fDec[i]) & 0xFF;
}
console.log(`Matches: ${matches3}/${Math.min(wKs.length, fKs.length)}\n`);

// Formula 4: base[i] = ks[i] XOR plain[i-1] (just previous byte)
console.log('Formula 4: base[i] = ks[i] XOR plain[i-1]');
let matches4 = 0;
for (let i = 1; i < Math.min(wKs.length, fKs.length); i++) {
  const wBase = wKs[i] ^ wDec[i-1];
  const fBase = fKs[i] ^ fDec[i-1];
  if (wBase === fBase) matches4++;
}
console.log(`Matches: ${matches4}/${Math.min(wKs.length, fKs.length)-1}\n`);

// Formula 5: base[i] = ks[i] XOR ks[i-1] XOR plain[i-1]
console.log('Formula 5: base[i] = ks[i] XOR ks[i-1] XOR plain[i-1]');
let matches5 = 0;
for (let i = 1; i < Math.min(wKs.length, fKs.length); i++) {
  const wBase = wKs[i] ^ wKs[i-1] ^ wDec[i-1];
  const fBase = fKs[i] ^ fKs[i-1] ^ fDec[i-1];
  if (wBase === fBase) matches5++;
}
console.log(`Matches: ${matches5}/${Math.min(wKs.length, fKs.length)-1}\n`);

// Let's think about this differently.
// We know: ks_w[i] XOR ks_f[i] = plain_w[i] XOR plain_f[i]
// This means: ks_w[i] XOR plain_w[i] = ks_f[i] XOR plain_f[i]
// Which is: ciphertext[i] is the same for both!

// So the cipher is: ciphertext[i] = plaintext[i] XOR keystream[i]
// And: keystream[i] = f(UA, i, ???)

// The keystream must depend on something that makes it different for different plaintexts
// but produces the same ciphertext.

// Wait! What if the keystream is computed AFTER we know the plaintext?
// In other words, what if the "keystream" we're computing is actually:
// keystream[i] = ciphertext[i] XOR plaintext[i]
// And the actual encryption is more complex?

// Let me look at this from the encryption side.
// If I want to encrypt plaintext P to get ciphertext C:
// C[i] = P[i] XOR K[i]
// where K[i] = base_K[i] XOR f(P[0:i-1])

// Then for decryption:
// P[i] = C[i] XOR K[i]
// But K[i] depends on P[0:i-1], which we've already decrypted!

// So the decryption algorithm is:
// 1. Initialize running_state = 0
// 2. For each position i:
//    a. K[i] = base_K[i] XOR running_state
//    b. P[i] = C[i] XOR K[i]
//    c. running_state = f(running_state, P[i])

// Let's test this with f = XOR
console.log('=== Testing decryption algorithm ===\n');
console.log('Algorithm: K[i] = base_K[i] XOR running_xor; P[i] = C[i] XOR K[i]; running_xor ^= P[i]');

// We need to find base_K such that this works for both videos
// Since ciphertext is the same for positions 0-99, and plaintext differs at 33,
// the base_K must be the same for both videos.

// From the working video, we can compute base_K:
// base_K[i] = K[i] XOR running_xor_before_i
// where running_xor_before_i = XOR of P[0:i-1]

// Let's verify this produces the same base_K for both videos

console.log('Computing base keystream from working video...');
let runningXor = 0;
const baseK = [];
for (let i = 0; i < wKs.length; i++) {
  baseK.push(wKs[i] ^ runningXor);
  runningXor ^= wDec[i];
}

console.log('Verifying with failing video...');
runningXor = 0;
let verified = 0;
for (let i = 0; i < fKs.length; i++) {
  const expectedK = baseK[i] ^ runningXor;
  if (expectedK === fKs[i]) verified++;
  else if (i < 50) {
    console.log(`Mismatch at ${i}: expected 0x${expectedK.toString(16).padStart(2,'0')}, got 0x${fKs[i].toString(16).padStart(2,'0')}`);
  }
  runningXor ^= fDec[i];
}
console.log(`Verified: ${verified}/${fKs.length}\n`);

// The issue is that the running_xor diverges when plaintext diverges!
// So the base_K computed from working video won't work for failing video
// after the plaintext diverges.

// But wait - we want to DECRYPT, not verify.
// Let's try decrypting the failing video using the base_K from working video.

console.log('=== Attempting decryption of failing video ===\n');

// Get the encrypted bytes for failing video
const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function getEncryptedFromRPI(videoId) {
  const mediaUrl = `https://megaup22.online/media/${videoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  const response = await fetch(proxyUrl, {
    headers: { 'User-Agent': UA }
  });
  const data = await response.json();
  
  if (!data.result) {
    throw new Error(`No result for ${videoId}: ${JSON.stringify(data)}`);
  }
  
  const base64 = data.result.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

async function testDecryption() {
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
  const encBytes = await getEncryptedFromRPI(failingVideoId);
  
  console.log(`Encrypted bytes: ${encBytes.length}`);
  console.log(`Base keystream: ${baseK.length}`);
  
  // Decrypt using the algorithm
  runningXor = 0;
  const decrypted = [];
  
  for (let i = 0; i < Math.min(encBytes.length, baseK.length); i++) {
    const K = baseK[i] ^ runningXor;
    const P = encBytes[i] ^ K;
    decrypted.push(P);
    runningXor ^= P;
  }
  
  const decryptedStr = Buffer.from(decrypted).toString('utf8');
  console.log('\nDecrypted (first 200 chars):');
  console.log(decryptedStr.substring(0, 200));
  
  // Compare with API decryption
  console.log('\nExpected (from API):');
  console.log(failing.decrypted.substring(0, 200));
  
  // Check if they match
  const expected = failing.decrypted;
  let matchCount = 0;
  for (let i = 0; i < Math.min(decryptedStr.length, expected.length); i++) {
    if (decryptedStr[i] === expected[i]) matchCount++;
  }
  console.log(`\nMatch: ${matchCount}/${Math.min(decryptedStr.length, expected.length)}`);
  
  if (matchCount === Math.min(decryptedStr.length, expected.length)) {
    console.log('\n*** DECRYPTION SUCCESSFUL! ***');
    
    // Save the base keystream
    const ksHex = Buffer.from(baseK).toString('hex');
    fs.writeFileSync('megaup-base-keystream-final.json', JSON.stringify({
      ua: UA,
      length: baseK.length,
      hex: ksHex,
      algorithm: 'K[i] = base_K[i] XOR xor(P[0:i-1]); P[i] = C[i] XOR K[i]'
    }, null, 2));
    
    console.log('Saved base keystream to megaup-base-keystream-final.json');
  }
}

testDecryption().catch(console.error);
