#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v55
 * 
 * The simple XOR feedback doesn't work. Let me analyze the actual
 * relationship between the keystrams more carefully.
 * 
 * We know:
 * - K_w[i] XOR K_f[i] = P_w[i] XOR P_f[i] (for positions 0-99)
 * - This means the ciphertext is the same for both videos
 * 
 * Let me look at the CUMULATIVE difference and see if there's a pattern.
 */

const fs = require('fs');

const working = JSON.parse(fs.readFileSync('megaup-keystream-working.json', 'utf8'));
const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));

const wKs = working.keystream;
const fKs = failing.keystream;
const wDec = Buffer.from(working.decrypted, 'utf8');
const fDec = Buffer.from(failing.decrypted, 'utf8');

console.log('=== Analyzing cumulative differences ===\n');

// Compute cumulative XOR of plaintext differences
let cumXorDiff = 0;
const cumXorDiffs = [0];

for (let i = 0; i < Math.min(wDec.length, fDec.length); i++) {
  cumXorDiff ^= (wDec[i] ^ fDec[i]);
  cumXorDiffs.push(cumXorDiff);
}

// Compute keystream differences
const ksDiffs = [];
for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  ksDiffs.push(wKs[i] ^ fKs[i]);
}

// Check if K_diff[i] = cumXorDiff[i] (XOR of P_diff[0:i-1])
console.log('Testing: K_diff[i] = XOR(P_diff[0:i-1])\n');

let matches = 0;
for (let i = 0; i < ksDiffs.length; i++) {
  if (ksDiffs[i] === cumXorDiffs[i]) {
    matches++;
  } else if (i >= 30 && i < 50) {
    console.log(`i=${i}: K_diff=0x${ksDiffs[i].toString(16).padStart(2,'0')} cumXor=0x${cumXorDiffs[i].toString(16).padStart(2,'0')}`);
  }
}

console.log(`Matches: ${matches}/${ksDiffs.length}\n`);

// Check if K_diff[i] = XOR(P_diff[0:i]) (including current position)
console.log('Testing: K_diff[i] = XOR(P_diff[0:i])\n');

matches = 0;
for (let i = 0; i < ksDiffs.length; i++) {
  if (ksDiffs[i] === cumXorDiffs[i + 1]) {
    matches++;
  } else if (i >= 30 && i < 50) {
    console.log(`i=${i}: K_diff=0x${ksDiffs[i].toString(16).padStart(2,'0')} cumXor=0x${cumXorDiffs[i+1].toString(16).padStart(2,'0')}`);
  }
}

console.log(`Matches: ${matches}/${ksDiffs.length}\n`);

// Check if K_diff[i] = P_diff[i] (just the current position)
console.log('Testing: K_diff[i] = P_diff[i]\n');

matches = 0;
for (let i = 0; i < ksDiffs.length; i++) {
  const pDiff = wDec[i] ^ fDec[i];
  if (ksDiffs[i] === pDiff) {
    matches++;
  }
}

console.log(`Matches: ${matches}/${ksDiffs.length}\n`);

// This should be 100% for positions 0-99 (where ciphertext is the same)
// Let's verify

console.log('Verifying K_diff[i] = P_diff[i] for positions 0-99:\n');

let matchesInRange = 0;
for (let i = 0; i < 100 && i < ksDiffs.length; i++) {
  const pDiff = wDec[i] ^ fDec[i];
  if (ksDiffs[i] === pDiff) {
    matchesInRange++;
  } else {
    console.log(`Mismatch at ${i}: K_diff=0x${ksDiffs[i].toString(16).padStart(2,'0')} P_diff=0x${pDiff.toString(16).padStart(2,'0')}`);
  }
}

console.log(`Matches in 0-99: ${matchesInRange}/100\n`);

// OK so K_diff[i] = P_diff[i] for all positions where ciphertext is the same.
// This is just the definition: C[i] = P[i] XOR K[i], so if C_w[i] = C_f[i],
// then P_w[i] XOR K_w[i] = P_f[i] XOR K_f[i], which gives K_w[i] XOR K_f[i] = P_w[i] XOR P_f[i].

// The question is: how is K[i] computed?

// Let me try a different approach. Let's see if the keystream can be
// expressed as a function of the CIPHERTEXT (not plaintext).

console.log('=== Testing ciphertext-based keystream ===\n');

// Compute ciphertext
const wCipher = [];
const fCipher = [];
for (let i = 0; i < wKs.length; i++) {
  wCipher.push(wKs[i] ^ wDec[i]);
}
for (let i = 0; i < fKs.length; i++) {
  fCipher.push(fKs[i] ^ fDec[i]);
}

// The ciphertext is the same for positions 0-99
// Let's see if K[i] = f(C[0:i-1])

// If K[i] = base_K[i] XOR XOR(C[0:i-1]), then:
// K_w[i] XOR K_f[i] = XOR(C_w[0:i-1]) XOR XOR(C_f[0:i-1])
// Since C_w[0:i-1] = C_f[0:i-1] for i <= 100, we have K_w[i] = K_f[i] for i <= 100.
// But we observe K_w[33] != K_f[33]!

// So the keystream does NOT depend only on previous ciphertext.

// Let me try: K[i] = base_K[i] XOR C[i]
// Then: P[i] = C[i] XOR K[i] = C[i] XOR base_K[i] XOR C[i] = base_K[i]
// So P[i] = base_K[i], which means the plaintext IS the base keystream!

// Let's check if the plaintext equals the base keystream...
console.log('Testing if plaintext equals base keystream...\n');

// If P[i] = base_K[i], then the plaintext should be the same for both videos.
// But it's not! So this formula doesn't work.

// Let me try yet another approach.
// What if the cipher is: C[i] = P[i] XOR K[i] XOR P[i-1]?
// Then: K[i] = C[i] XOR P[i] XOR P[i-1]

// For decryption:
// P[i] = C[i] XOR K[i] XOR P[i-1]

// Let's test this.
console.log('Testing: K[i] = C[i] XOR P[i] XOR P[i-1]\n');

// Compute K using this formula
const wKsTest = [wCipher[0] ^ wDec[0]]; // K[0] = C[0] XOR P[0] (no P[-1])
for (let i = 1; i < wKs.length; i++) {
  wKsTest.push(wCipher[i] ^ wDec[i] ^ wDec[i-1]);
}

// Check if this matches the actual keystream
matches = 0;
for (let i = 0; i < wKs.length; i++) {
  if (wKsTest[i] === wKs[i]) matches++;
}

console.log(`Working video: ${matches}/${wKs.length} matches\n`);

// If this works, then the decryption algorithm is:
// P[i] = C[i] XOR K[i] XOR P[i-1]

// Let's verify with the failing video
const fKsTest = [fCipher[0] ^ fDec[0]];
for (let i = 1; i < fKs.length; i++) {
  fKsTest.push(fCipher[i] ^ fDec[i] ^ fDec[i-1]);
}

matches = 0;
for (let i = 0; i < fKs.length; i++) {
  if (fKsTest[i] === fKs[i]) matches++;
}

console.log(`Failing video: ${matches}/${fKs.length} matches\n`);

// If both match, then the base keystream is K[i] = C[i] XOR P[i] XOR P[i-1]
// And it should be the same for both videos!

if (wKsTest.length === wKs.length && fKsTest.length === fKs.length) {
  let baseMatches = 0;
  for (let i = 0; i < Math.min(wKsTest.length, fKsTest.length); i++) {
    if (wKsTest[i] === fKsTest[i]) baseMatches++;
  }
  console.log(`Base keystream matches: ${baseMatches}/${Math.min(wKsTest.length, fKsTest.length)}\n`);
}

// Actually, let me think about this more carefully.
// The "keystream" we compute is K[i] = C[i] XOR P[i].
// This is just the definition of XOR encryption.

// The question is: what is the ACTUAL keystream that the cipher uses?
// And how is it generated?

// The enc-dec.app API takes the encrypted data and UA, and returns the plaintext.
// The decryption must be deterministic given just these two inputs.

// So the keystream must be derivable from the encrypted data and UA alone.

// Let me try to find the base keystream by assuming it's static (UA-derived only).

console.log('=== Finding the static base keystream ===\n');

// If the keystream is static, then K_w[i] = K_f[i] for all i.
// But we observe K_w[33] != K_f[33].

// So the keystream is NOT static. It must depend on something that differs
// between the two videos.

// The only thing that differs is the encrypted data (and hence the plaintext).

// So the keystream must depend on the plaintext (feedback).

// The formula K[i] = base_K[i] XOR f(P[0:i-1]) doesn't work because
// K_w[33] != K_f[33] even though P_w[0:32] = P_f[0:32].

// This means the keystream at position 33 depends on something at position 33,
// not just positions 0-32.

// The only possibility is that the keystream depends on the CIPHERTEXT at position 33.
// But the ciphertext at position 33 is the same for both videos!

// Wait... let me re-check.

console.log('Checking ciphertext at position 33:\n');
console.log(`wCipher[33] = 0x${wCipher[33].toString(16)}`);
console.log(`fCipher[33] = 0x${fCipher[33].toString(16)}`);
console.log(`Are they equal? ${wCipher[33] === fCipher[33]}`);

// If they're equal, then the keystream cannot depend only on ciphertext.
// The keystream must depend on the plaintext.

// But how can the keystream at position 33 depend on plaintext[33] if we
// need the keystream to decrypt plaintext[33]?

// The answer must be that the decryption is ITERATIVE:
// 1. Guess P[33]
// 2. Compute K[33] = f(P[33])
// 3. Check if C[33] XOR K[33] = P[33]
// 4. If yes, we found P[33]. If no, try another guess.

// But this would be very slow (256 possibilities per byte).

// Unless... the cipher is designed so that there's only ONE valid P[33]
// that satisfies the equation.

// Let me think about this algebraically.
// C[33] = P[33] XOR K[33]
// K[33] = base_K[33] XOR f(P[33])

// So: C[33] = P[33] XOR base_K[33] XOR f(P[33])
// Rearranging: P[33] XOR f(P[33]) = C[33] XOR base_K[33]

// If f(P) = P, then: P XOR P = 0 = C XOR base_K, so C = base_K.
// This would mean the ciphertext equals the base keystream, which is not true.

// If f(P) = 0, then: P = C XOR base_K. This is simple XOR decryption.

// If f(P) = some_constant, then: P XOR some_constant = C XOR base_K.
// So P = C XOR base_K XOR some_constant.

// None of these explain the observed behavior.

// Let me try a completely different approach: maybe the cipher uses
// a DIFFERENT keystream for each video, derived from the video ID or
// some other metadata embedded in the encrypted data.

console.log('\n=== Looking for video-specific data in encrypted bytes ===\n');

// The encrypted data might contain:
// 1. A header with video-specific information
// 2. The actual ciphertext

// Let's see if there's any pattern in the first few bytes that differs
// between videos.

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

async function analyzeEncryptedData() {
  const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
  
  const wEnc = await getEncryptedFromRPI(workingVideoId);
  await new Promise(r => setTimeout(r, 500));
  const fEnc = await getEncryptedFromRPI(failingVideoId);
  
  console.log(`Working encrypted: ${wEnc.length} bytes`);
  console.log(`Failing encrypted: ${fEnc.length} bytes`);
  
  // The encrypted data is 717 vs 720 bytes
  // The decrypted data is 521 vs 524 bytes
  // Overhead: 196 bytes
  
  // Maybe the last 196 bytes are padding/MAC, and the first (length - 196) bytes
  // are the actual ciphertext?
  
  const wCipherLen = wEnc.length - 196;
  const fCipherLen = fEnc.length - 196;
  
  console.log(`\nCiphertext length: working=${wCipherLen}, failing=${fCipherLen}`);
  console.log(`Decrypted length: working=${wDec.length}, failing=${fDec.length}`);
  
  // The ciphertext length matches the decrypted length!
  // So the first (length - 196) bytes are the ciphertext,
  // and the last 196 bytes are something else.
  
  // Let's see what the last 196 bytes look like.
  console.log('\nLast 196 bytes (working):');
  console.log(wEnc.slice(-196, -186).toString('hex') + '...');
  
  console.log('\nLast 196 bytes (failing):');
  console.log(fEnc.slice(-196, -186).toString('hex') + '...');
  
  // Are the last 196 bytes the same?
  let tailMatch = true;
  for (let i = 0; i < 196; i++) {
    if (wEnc[wEnc.length - 196 + i] !== fEnc[fEnc.length - 196 + i]) {
      tailMatch = false;
      break;
    }
  }
  
  console.log(`\nLast 196 bytes identical? ${tailMatch}`);
  
  // If the tail is different, it might contain video-specific information
  // that affects the keystream.
  
  // Let's see if the tail contains the video ID or something derived from it.
  console.log('\nLooking for video ID in tail...');
  
  const wTail = wEnc.slice(-196);
  const fTail = fEnc.slice(-196);
  
  // Check if video ID is in the tail (as ASCII or base64)
  const wTailStr = wTail.toString('utf8');
  const fTailStr = fTail.toString('utf8');
  
  console.log(`Working tail contains video ID? ${wTailStr.includes(workingVideoId) || wTailStr.includes(workingVideoId.substring(0, 10))}`);
  console.log(`Failing tail contains video ID? ${fTailStr.includes(failingVideoId) || fTailStr.includes(failingVideoId.substring(0, 10))}`);
}

analyzeEncryptedData().catch(console.error);
