#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v51
 * 
 * Let me trace through the decryption step by step.
 * 
 * The key insight is:
 * - ks_w[i] XOR ks_f[i] = plain_w[i] XOR plain_f[i] (for all i)
 * - This means: ks_w[i] XOR plain_w[i] = ks_f[i] XOR plain_f[i] = ciphertext[i]
 * 
 * So the ciphertext is the SAME for both videos!
 * 
 * The decryption algorithm must be:
 * 1. K[i] = f(base_K, i, running_state)
 * 2. P[i] = C[i] XOR K[i]
 * 3. running_state = g(running_state, P[i])
 * 
 * We need to find f and g such that:
 * - K_w[i] = f(base_K, i, running_state_w)
 * - K_f[i] = f(base_K, i, running_state_f)
 * - K_w[i] XOR K_f[i] = P_w[i] XOR P_f[i]
 * 
 * If f is XOR-based: K[i] = base_K[i] XOR running_state
 * Then: K_w[i] XOR K_f[i] = running_state_w XOR running_state_f
 * 
 * And we need: running_state_w XOR running_state_f = P_w[i] XOR P_f[i]
 * 
 * If g is XOR: running_state = running_state XOR P[i]
 * Then after position i: running_state = XOR(P[0:i])
 * 
 * So: running_state_w XOR running_state_f = XOR(P_w[0:i]) XOR XOR(P_f[0:i])
 *                                         = XOR(P_w[0:i] XOR P_f[0:i])
 * 
 * For positions 0-32, P_w = P_f, so running_state_w = running_state_f
 * At position 33, P_w[33] != P_f[33]
 * 
 * So: K_w[33] XOR K_f[33] = running_state_w[32] XOR running_state_f[32] = 0
 * But we observe: K_w[33] XOR K_f[33] = 0x0f != 0
 * 
 * This means the running_state at position 33 is NOT just XOR(P[0:32])!
 * 
 * Wait, let me re-check. The running_state BEFORE decrypting position 33
 * should be XOR(P[0:32]), which is the same for both videos.
 * So K_w[33] should equal K_f[33].
 * But they don't!
 * 
 * Unless... the running_state is updated BEFORE computing K[i], not after!
 * 
 * Let me try: running_state includes P[i] when computing K[i]
 */

const fs = require('fs');

const working = JSON.parse(fs.readFileSync('megaup-keystream-working.json', 'utf8'));
const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));

const wKs = working.keystream;
const fKs = failing.keystream;
const wDec = Buffer.from(working.decrypted, 'utf8');
const fDec = Buffer.from(failing.decrypted, 'utf8');

console.log('=== Detailed analysis of position 33 ===\n');

// At position 33:
// - P_w[33] = 'l' (0x6c)
// - P_f[33] = 'c' (0x63)
// - K_w[33] = 0xab
// - K_f[33] = 0xa4
// - K_w[33] XOR K_f[33] = 0x0f
// - P_w[33] XOR P_f[33] = 0x0f

console.log(`P_w[33] = '${String.fromCharCode(wDec[33])}' (0x${wDec[33].toString(16)})`);
console.log(`P_f[33] = '${String.fromCharCode(fDec[33])}' (0x${fDec[33].toString(16)})`);
console.log(`K_w[33] = 0x${wKs[33].toString(16)}`);
console.log(`K_f[33] = 0x${fKs[33].toString(16)}`);
console.log(`K_w[33] XOR K_f[33] = 0x${(wKs[33] ^ fKs[33]).toString(16)}`);
console.log(`P_w[33] XOR P_f[33] = 0x${(wDec[33] ^ fDec[33]).toString(16)}`);

// The fact that K_w[33] XOR K_f[33] = P_w[33] XOR P_f[33] means:
// K_w[33] XOR P_w[33] = K_f[33] XOR P_f[33]
// Which is the ciphertext! C[33] = 0xab XOR 0x6c = 0xc7

console.log(`\nC[33] = K_w[33] XOR P_w[33] = 0x${(wKs[33] ^ wDec[33]).toString(16)}`);
console.log(`C[33] = K_f[33] XOR P_f[33] = 0x${(fKs[33] ^ fDec[33]).toString(16)}`);

// Now, the question is: how is K[33] computed?
// If K[33] = base_K[33] XOR running_state[32], and running_state[32] is the same
// for both videos (since P[0:32] is the same), then K_w[33] should equal K_f[33].
// But they don't!

// This means either:
// 1. base_K[33] is different for different videos (unlikely - it's UA-based)
// 2. running_state[32] is different (but P[0:32] is the same!)
// 3. The formula is not K[i] = base_K[i] XOR running_state[i-1]

// Let me check if running_state might include something else...

// What if running_state is computed from CIPHERTEXT, not plaintext?
// running_state[i] = XOR(C[0:i])

console.log('\n=== Testing ciphertext-based running state ===\n');

// We need to get the ciphertext
// C[i] = K[i] XOR P[i]

const wCipher = [];
const fCipher = [];
for (let i = 0; i < wKs.length; i++) {
  wCipher.push(wKs[i] ^ wDec[i]);
}
for (let i = 0; i < fKs.length; i++) {
  fCipher.push(fKs[i] ^ fDec[i]);
}

// Check if ciphertext is the same
let cipherMatch = 0;
for (let i = 0; i < Math.min(wCipher.length, fCipher.length); i++) {
  if (wCipher[i] === fCipher[i]) cipherMatch++;
}
console.log(`Ciphertext match: ${cipherMatch}/${Math.min(wCipher.length, fCipher.length)}`);

// Find first ciphertext difference
let firstCipherDiff = -1;
for (let i = 0; i < Math.min(wCipher.length, fCipher.length); i++) {
  if (wCipher[i] !== fCipher[i]) {
    firstCipherDiff = i;
    break;
  }
}
console.log(`First ciphertext difference: position ${firstCipherDiff}`);

// So ciphertext is the same for positions 0-99!
// This confirms our earlier finding.

// Now let's test: K[i] = base_K[i] XOR XOR(C[0:i-1])
console.log('\n=== Testing K[i] = base_K[i] XOR XOR(C[0:i-1]) ===\n');

let wCipherXor = 0, fCipherXor = 0;
let baseKMatches = 0;
const baseK_cipher = [];

for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  const wBase = wKs[i] ^ wCipherXor;
  const fBase = fKs[i] ^ fCipherXor;
  baseK_cipher.push(wBase);
  
  if (wBase === fBase) baseKMatches++;
  else if (i < 110) {
    console.log(`Mismatch at ${i}: wBase=0x${wBase.toString(16).padStart(2,'0')} fBase=0x${fBase.toString(16).padStart(2,'0')}`);
  }
  
  wCipherXor ^= wCipher[i];
  fCipherXor ^= fCipher[i];
}

console.log(`\nBase keystream (cipher XOR) matches: ${baseKMatches}/${Math.min(wKs.length, fKs.length)}`);

// Hmm, still not matching. Let me think about this differently.

// The key observation is:
// K_w[i] XOR K_f[i] = P_w[i] XOR P_f[i]
// 
// This is true for ALL positions, not just where plaintext differs!
// Let me verify this.

console.log('\n=== Verifying K XOR = P XOR for all positions ===\n');

let allMatch = true;
for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  const kXor = wKs[i] ^ fKs[i];
  const pXor = wDec[i] ^ fDec[i];
  if (kXor !== pXor) {
    console.log(`Mismatch at ${i}: K XOR = 0x${kXor.toString(16)}, P XOR = 0x${pXor.toString(16)}`);
    allMatch = false;
  }
}

if (allMatch) {
  console.log('All positions match: K_w[i] XOR K_f[i] = P_w[i] XOR P_f[i]');
}

// This is a fundamental property of the cipher!
// It means: C_w[i] = C_f[i] for all i (where both exist)

// So the cipher is deterministic given the ciphertext.
// The keystream depends on the plaintext, but in a way that
// produces the same ciphertext regardless of the plaintext!

// This is actually a SELF-SYNCHRONIZING cipher.
// The keystream at position i depends on the ciphertext at positions 0:i-1.

// Let me test: K[i] = f(C[0:i-1])
// where f is some function that produces the keystream from previous ciphertext.

console.log('\n=== Testing self-synchronizing cipher ===\n');

// If K[i] = base_K[i] XOR g(C[0:i-1]), then:
// K_w[i] XOR K_f[i] = g(C_w[0:i-1]) XOR g(C_f[0:i-1])
// 
// Since C_w[0:i-1] = C_f[0:i-1] (ciphertext is the same up to position 99),
// we should have K_w[i] = K_f[i] for i <= 99.
// 
// But we observe K_w[33] != K_f[33]!
// 
// This means the keystream does NOT depend only on previous ciphertext.
// It must depend on something else that differs between videos.

// Wait! What if the keystream depends on the CURRENT plaintext?
// K[i] = base_K[i] XOR P[i]
// Then: P[i] = C[i] XOR K[i] = C[i] XOR base_K[i] XOR P[i]
// This gives: 0 = C[i] XOR base_K[i]
// So: C[i] = base_K[i]
// 
// This would mean the ciphertext IS the base keystream!
// Let me check...

console.log('Testing if ciphertext equals base keystream...');
console.log('C[0:10]:', wCipher.slice(0, 10).map(c => c.toString(16).padStart(2, '0')).join(' '));

// That doesn't make sense because the ciphertext varies with the plaintext.

// Let me try a different approach: what if the keystream is computed
// using a feedback that includes BOTH the previous keystream AND the previous plaintext?

// K[i] = K[i-1] XOR P[i-1] XOR base_K[i]
// Then: K_w[i] XOR K_f[i] = (K_w[i-1] XOR P_w[i-1]) XOR (K_f[i-1] XOR P_f[i-1])
//                        = (K_w[i-1] XOR K_f[i-1]) XOR (P_w[i-1] XOR P_f[i-1])

// Let's denote D_K[i] = K_w[i] XOR K_f[i] and D_P[i] = P_w[i] XOR P_f[i]
// Then: D_K[i] = D_K[i-1] XOR D_P[i-1]

// We know D_K[i] = D_P[i] for all i.
// So: D_P[i] = D_K[i-1] XOR D_P[i-1]
//            = D_P[i-1] XOR D_P[i-1]
//            = 0

// But D_P[33] = 0x0f != 0!
// So this formula doesn't work either.

// Let me try: K[i] = K[i-1] XOR C[i-1] XOR base_K[i]
// (CFB mode with base keystream)

console.log('\n=== Testing CFB-like mode ===\n');

// In CFB mode: K[i] = E(key, C[i-1])
// With base keystream: K[i] = base_K[i] XOR C[i-1]

// Let's compute base_K assuming this formula
let baseK_cfb = [wKs[0]]; // K[0] = base_K[0] (no previous ciphertext)

for (let i = 1; i < wKs.length; i++) {
  // K[i] = base_K[i] XOR C[i-1]
  // base_K[i] = K[i] XOR C[i-1]
  baseK_cfb.push(wKs[i] ^ wCipher[i-1]);
}

// Verify with failing video
let cfbMatches = 0;
for (let i = 0; i < Math.min(baseK_cfb.length, fKs.length); i++) {
  let expectedK;
  if (i === 0) {
    expectedK = baseK_cfb[0];
  } else {
    expectedK = baseK_cfb[i] ^ fCipher[i-1];
  }
  
  if (expectedK === fKs[i]) cfbMatches++;
  else if (i < 40) {
    console.log(`CFB mismatch at ${i}: expected 0x${expectedK.toString(16).padStart(2,'0')}, got 0x${fKs[i].toString(16).padStart(2,'0')}`);
  }
}

console.log(`CFB mode matches: ${cfbMatches}/${Math.min(baseK_cfb.length, fKs.length)}`);

// If CFB mode works, the base keystream should be the same for both videos!
