#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v53
 * 
 * FINAL THEORY: The keystream uses plaintext feedback!
 * 
 * Algorithm:
 * 1. Initialize state from User-Agent
 * 2. For each position i:
 *    a. Generate keystream byte K[i] from current state
 *    b. Decrypt: P[i] = C[i] XOR K[i]
 *    c. Update state using P[i]
 * 
 * The key insight is that the keystream at position i depends on
 * the plaintext at positions 0 to i-1.
 * 
 * Since the encrypted bytes are identical for positions 0-99,
 * and the decrypted bytes differ starting at position 33,
 * the keystream must be computed using plaintext feedback.
 * 
 * Let me derive the base keystream and the feedback function.
 */

const fs = require('fs');

const working = JSON.parse(fs.readFileSync('megaup-keystream-working.json', 'utf8'));
const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));

const wKs = working.keystream;
const fKs = failing.keystream;
const wDec = Buffer.from(working.decrypted, 'utf8');
const fDec = Buffer.from(failing.decrypted, 'utf8');

console.log('=== Deriving the feedback function ===\n');

// We know: K_w[i] XOR K_f[i] = P_w[i] XOR P_f[i] (for positions 0-99)
// This means: K[i] = base_K[i] XOR f(P[0:i-1])
// where f is some function of the previous plaintext.

// Let's find f by looking at the keystream differences.

// At position 33:
// K_w[33] = 0xab, K_f[33] = 0xa4
// P_w[33] = 'l' (0x6c), P_f[33] = 'c' (0x63)
// K_w[33] XOR K_f[33] = 0x0f = P_w[33] XOR P_f[33]

// But P_w[0:32] = P_f[0:32], so f(P_w[0:32]) = f(P_f[0:32])
// This means K_w[33] should equal K_f[33]!
// But they don't!

// Wait... let me re-read the data.
// The keystream at position 33 is DIFFERENT, but the plaintext at positions 0-32 is IDENTICAL.
// This is a contradiction if the keystream only depends on previous plaintext!

// Unless... the keystream at position i depends on the plaintext at position i itself!
// K[i] = base_K[i] XOR P[i]

// Let's test this:
// K_w[33] = base_K[33] XOR P_w[33]
// K_f[33] = base_K[33] XOR P_f[33]
// K_w[33] XOR K_f[33] = P_w[33] XOR P_f[33] ✓

// This works! But how do we decrypt if K[i] depends on P[i]?
// P[i] = C[i] XOR K[i] = C[i] XOR base_K[i] XOR P[i]
// 0 = C[i] XOR base_K[i]
// C[i] = base_K[i]

// This would mean the ciphertext IS the base keystream!
// Let me check...

console.log('Testing if ciphertext equals base keystream...\n');

// Compute ciphertext
const wCipher = [];
for (let i = 0; i < wKs.length; i++) {
  wCipher.push(wKs[i] ^ wDec[i]);
}

// If K[i] = base_K[i] XOR P[i], then:
// C[i] = P[i] XOR K[i] = P[i] XOR base_K[i] XOR P[i] = base_K[i]

// So base_K[i] = C[i]!

// Let's verify: K[i] = C[i] XOR P[i]
// This is just the definition of XOR encryption!
// K[i] = C[i] XOR P[i] is always true.

// So the "keystream" we've been computing is just C XOR P, which is trivially true.

// The real question is: how is the ciphertext generated?
// C[i] = P[i] XOR K[i]
// where K[i] is the actual keystream.

// Let me think about this differently.
// The enc-dec.app API takes the encrypted data and UA, and returns the plaintext.
// The decryption must be deterministic.

// If the keystream depends on the plaintext, then decryption would be:
// 1. Initialize state from UA
// 2. For each position i:
//    a. K[i] = generate_keystream(state)
//    b. P[i] = C[i] XOR K[i]
//    c. state = update_state(state, P[i])

// The key is that K[i] is generated BEFORE we know P[i].
// Then we decrypt to get P[i].
// Then we update the state using P[i].

// So the keystream at position i depends on P[0:i-1], not P[i].

// But we observed that K_w[33] != K_f[33] even though P_w[0:32] = P_f[0:32]!

// This is impossible unless there's something else going on.

// Wait! Let me re-check the data.

console.log('Re-checking the data...\n');

// Check if P_w[0:32] really equals P_f[0:32]
let plainMatch = true;
for (let i = 0; i < 33; i++) {
  if (wDec[i] !== fDec[i]) {
    console.log(`Plaintext differs at position ${i}: '${String.fromCharCode(wDec[i])}' vs '${String.fromCharCode(fDec[i])}'`);
    plainMatch = false;
  }
}

if (plainMatch) {
  console.log('Plaintext is identical for positions 0-32.');
}

// Check if K_w[0:32] equals K_f[0:32]
let ksMatch = true;
for (let i = 0; i < 33; i++) {
  if (wKs[i] !== fKs[i]) {
    console.log(`Keystream differs at position ${i}: 0x${wKs[i].toString(16)} vs 0x${fKs[i].toString(16)}`);
    ksMatch = false;
  }
}

if (ksMatch) {
  console.log('Keystream is identical for positions 0-32.');
}

// Check if C_w[0:32] equals C_f[0:32]
let cipherMatch = true;
for (let i = 0; i < 33; i++) {
  if (wCipher[i] !== (fKs[i] ^ fDec[i])) {
    console.log(`Ciphertext differs at position ${i}`);
    cipherMatch = false;
  }
}

if (cipherMatch) {
  console.log('Ciphertext is identical for positions 0-32.');
}

console.log('\n=== Summary ===\n');
console.log(`Plaintext identical for 0-32: ${plainMatch}`);
console.log(`Keystream identical for 0-32: ${ksMatch}`);
console.log(`Ciphertext identical for 0-32: ${cipherMatch}`);

// If plaintext and ciphertext are identical, but keystream differs,
// that's a contradiction!

// Let me double-check by computing the keystream from scratch.
console.log('\n=== Recomputing keystream ===\n');

// Get the encrypted bytes
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

async function main() {
  const workingVideoId = 'jIrrLzj-WS2JcOLzF79O5xvpCQ';
  const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
  
  const wEnc = await getEncryptedFromRPI(workingVideoId);
  await new Promise(r => setTimeout(r, 500));
  const fEnc = await getEncryptedFromRPI(failingVideoId);
  
  console.log(`Working encrypted: ${wEnc.length} bytes`);
  console.log(`Failing encrypted: ${fEnc.length} bytes`);
  
  // Check if encrypted bytes are identical for 0-32
  let encMatch = true;
  for (let i = 0; i < 33; i++) {
    if (wEnc[i] !== fEnc[i]) {
      console.log(`Encrypted differs at position ${i}: 0x${wEnc[i].toString(16)} vs 0x${fEnc[i].toString(16)}`);
      encMatch = false;
    }
  }
  
  if (encMatch) {
    console.log('Encrypted bytes are identical for positions 0-32.');
  }
  
  // Compute keystream from encrypted and decrypted
  const wKsNew = [];
  const fKsNew = [];
  
  for (let i = 0; i < wDec.length; i++) {
    wKsNew.push(wEnc[i] ^ wDec[i]);
  }
  
  for (let i = 0; i < fDec.length; i++) {
    fKsNew.push(fEnc[i] ^ fDec[i]);
  }
  
  // Check if keystream is identical for 0-32
  let ksNewMatch = true;
  for (let i = 0; i < 33; i++) {
    if (wKsNew[i] !== fKsNew[i]) {
      console.log(`New keystream differs at position ${i}: 0x${wKsNew[i].toString(16)} vs 0x${fKsNew[i].toString(16)}`);
      ksNewMatch = false;
    }
  }
  
  if (ksNewMatch) {
    console.log('New keystream is identical for positions 0-32.');
  }
  
  // So we have:
  // - Encrypted bytes identical for 0-99
  // - Decrypted bytes identical for 0-32, differ at 33
  // - Keystream identical for 0-32, differ at 33
  
  // This is consistent! The keystream is the same, but the encrypted bytes
  // at position 33 are the same, so the decrypted bytes should be the same.
  // But they're not!
  
  // Wait, let me check position 33 specifically.
  console.log('\n=== Position 33 analysis ===\n');
  console.log(`wEnc[33] = 0x${wEnc[33].toString(16)}`);
  console.log(`fEnc[33] = 0x${fEnc[33].toString(16)}`);
  console.log(`wDec[33] = '${String.fromCharCode(wDec[33])}' (0x${wDec[33].toString(16)})`);
  console.log(`fDec[33] = '${String.fromCharCode(fDec[33])}' (0x${fDec[33].toString(16)})`);
  console.log(`wKs[33] = wEnc[33] XOR wDec[33] = 0x${(wEnc[33] ^ wDec[33]).toString(16)}`);
  console.log(`fKs[33] = fEnc[33] XOR fDec[33] = 0x${(fEnc[33] ^ fDec[33]).toString(16)}`);
  
  // If wEnc[33] = fEnc[33] and wDec[33] != fDec[33], then wKs[33] != fKs[33]
  // This is exactly what we observe!
  
  // So the keystream IS different at position 33.
  // But the encrypted bytes are the same!
  // This means the decryption algorithm produces different keystream
  // for the same encrypted input!
  
  // The only way this can happen is if the keystream depends on
  // something OTHER than just the encrypted bytes and UA.
  
  // What could it be?
  // 1. The video ID (but the API doesn't take video ID as input)
  // 2. Some server-side state (unlikely for a decryption API)
  // 3. The DECRYPTED plaintext (feedback!)
  
  // If the keystream at position i depends on the decrypted plaintext
  // at positions 0 to i-1, then:
  // - For positions 0-32, plaintext is the same, so keystream is the same
  // - At position 33, keystream is computed from plaintext[0:32], which is the same
  // - So keystream[33] should be the same!
  
  // But it's not! This is the contradiction.
  
  // Unless... the keystream at position 33 depends on plaintext[33] itself!
  // But that's circular - we need keystream[33] to decrypt plaintext[33].
  
  // WAIT! I think I finally understand!
  
  // The decryption might work like this:
  // 1. Compute initial keystream K[i] = f(UA, i)
  // 2. Decrypt: P[i] = C[i] XOR K[i]
  // 3. Adjust keystream: K[i] = K[i] XOR g(P[i])
  // 4. The "effective" keystream is K[i] XOR g(P[i])
  
  // But this doesn't make sense either because we need K[i] to decrypt P[i].
  
  // Let me try yet another approach.
  // What if the encrypted data contains the plaintext XOR'd with a keystream,
  // AND the keystream is XOR'd with the plaintext?
  
  // C[i] = P[i] XOR K[i] XOR P[i] = K[i]
  // So C[i] = K[i], and P[i] = C[i] XOR K[i] = K[i] XOR K[i] = 0
  
  // That doesn't work either.
  
  // OK, I think the answer is simpler than I thought.
  // The keystream is STATIC (derived from UA only).
  // The encrypted bytes are DIFFERENT for different videos.
  // The decrypted bytes are DIFFERENT because the encrypted bytes are different.
  
  // Let me verify that the encrypted bytes at position 33 are actually different.
  
  console.log('\n=== Final verification ===\n');
  console.log(`wEnc[33] = 0x${wEnc[33].toString(16)}`);
  console.log(`fEnc[33] = 0x${fEnc[33].toString(16)}`);
  console.log(`Are they equal? ${wEnc[33] === fEnc[33]}`);
  
  // If they're equal, then the keystream must be different.
  // If they're different, then the keystream can be the same.
  
  if (wEnc[33] === fEnc[33]) {
    console.log('\nEncrypted bytes at position 33 are EQUAL.');
    console.log('This means the keystream MUST be different to produce different plaintext.');
    console.log('The keystream uses PLAINTEXT FEEDBACK.');
  } else {
    console.log('\nEncrypted bytes at position 33 are DIFFERENT.');
    console.log('The keystream can be the same (static).');
  }
}

main().catch(console.error);
