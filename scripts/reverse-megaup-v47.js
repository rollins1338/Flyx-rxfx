#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v47
 * 
 * CRITICAL OBSERVATION:
 * - Encrypted bytes at position 33: BOTH are 0xc7 (IDENTICAL)
 * - Decrypted bytes at position 33: 'l' (0x6c) vs 'c' (0x63) (DIFFERENT)
 * - Therefore keystream at position 33: 0xab vs 0xa4 (DIFFERENT)
 * 
 * But encrypted bytes are identical up to position 99!
 * So the keystream MUST be different starting at position 33.
 * 
 * This proves the keystream uses PLAINTEXT FEEDBACK.
 * The keystream diverges at position 33 because the DECRYPTED plaintext
 * at position 33 is different (different URLs in the JSON).
 * 
 * But wait - how can the keystream at position 33 depend on plaintext[33]
 * if we need keystream[33] to DECRYPT plaintext[33]?
 * 
 * Answer: The keystream is computed DURING decryption, using the
 * PREVIOUSLY decrypted plaintext to update the state.
 * 
 * So: keystream[i] = f(state[i-1], plaintext[i-1])
 * 
 * Let's verify this by checking if the keystream divergence
 * correlates with plaintext divergence.
 */

const fs = require('fs');

// Load the saved data
const working = JSON.parse(fs.readFileSync('megaup-keystream-working.json', 'utf8'));
const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));

const wKs = working.keystream;
const fKs = failing.keystream;
const wDec = Buffer.from(working.decrypted, 'utf8');
const fDec = Buffer.from(failing.decrypted, 'utf8');

console.log('=== Verifying plaintext feedback hypothesis ===\n');

// Find where plaintext first differs
let plainDiffPos = -1;
for (let i = 0; i < Math.min(wDec.length, fDec.length); i++) {
  if (wDec[i] !== fDec[i]) {
    plainDiffPos = i;
    break;
  }
}

// Find where keystream first differs
let ksDiffPos = -1;
for (let i = 0; i < Math.min(wKs.length, fKs.length); i++) {
  if (wKs[i] !== fKs[i]) {
    ksDiffPos = i;
    break;
  }
}

console.log(`Plaintext first differs at position: ${plainDiffPos}`);
console.log(`Keystream first differs at position: ${ksDiffPos}`);

// If keystream uses plaintext feedback, then:
// keystream[i] depends on plaintext[0:i-1]
// So keystream should diverge at position plainDiffPos (not plainDiffPos + 1)
// because keystream[plainDiffPos] is computed BEFORE we decrypt plaintext[plainDiffPos]

// Actually, let's think about this more carefully:
// - To decrypt position i, we need keystream[i]
// - keystream[i] is computed from state[i-1]
// - state[i-1] is updated using plaintext[i-1]
// - So keystream[i] depends on plaintext[0:i-1]

// If plaintext first differs at position 33:
// - plaintext[0:32] is identical
// - state[32] is identical (computed from plaintext[0:31])
// - keystream[33] is computed from state[32] and plaintext[32]
// - plaintext[32] is identical ('.')
// - So keystream[33] should be identical!

// But we observe keystream[33] is DIFFERENT!
// This means the feedback is NOT just from the previous plaintext byte.

console.log('\n=== Checking plaintext at divergence point ===\n');

console.log(`plaintext[32]: working='${String.fromCharCode(wDec[32])}' (0x${wDec[32].toString(16)}) failing='${String.fromCharCode(fDec[32])}' (0x${fDec[32].toString(16)})`);
console.log(`plaintext[33]: working='${String.fromCharCode(wDec[33])}' (0x${wDec[33].toString(16)}) failing='${String.fromCharCode(fDec[33])}' (0x${fDec[33].toString(16)})`);
console.log(`keystream[32]: working=0x${wKs[32].toString(16)} failing=0x${fKs[32].toString(16)}`);
console.log(`keystream[33]: working=0x${wKs[33].toString(16)} failing=0x${fKs[33].toString(16)}`);

// The keystream at position 33 is different, but plaintext at position 32 is the same!
// This is very strange...

// Wait! Maybe the keystream is computed AFTER decryption, not before!
// In other words, maybe it's a SELF-SYNCHRONIZING cipher where:
// keystream[i] = f(ciphertext[i-1]) or f(plaintext[i])

// Let's check if keystream[33] depends on plaintext[33]:
console.log('\n=== Testing if keystream[i] depends on plaintext[i] ===\n');

// If keystream[i] = f(state, plaintext[i]), then we have a chicken-and-egg problem
// because we need keystream[i] to compute plaintext[i].

// Unless... the cipher works like this:
// 1. Compute initial keystream[i] from state
// 2. Decrypt: plaintext[i] = ciphertext[i] XOR keystream[i]
// 3. Update state using plaintext[i]
// 4. The NEXT keystream byte will be different

// In this case, keystream[33] should be the same for both videos
// because it's computed BEFORE we know plaintext[33].

// But we observe keystream[33] is DIFFERENT!
// This means the keystream is NOT computed in the way I thought.

// NEW HYPOTHESIS: The keystream is pre-computed based on the User-Agent,
// but the ENCRYPTED DATA itself is different for different videos!

// Let me re-read the encrypted data...

console.log('\n=== Re-examining the data ===\n');

// The encrypted bytes at position 33 are BOTH 0xc7
// working: 0xc7 XOR 0xab = 0x6c = 'l'
// failing: 0xc7 XOR 0xa4 = 0x63 = 'c'

// So the encrypted bytes are the SAME, but the keystream is DIFFERENT.
// This means the keystream MUST be video-specific.

// But wait - the encrypted bytes are the same from 0 to 99!
// And the keystream is the same from 0 to 32!
// So the keystream diverges at position 33, but encrypted bytes don't diverge until position 100.

// This is very confusing. Let me think about this differently.

// What if the "encrypted" data we're seeing is not the raw ciphertext,
// but has already been partially processed?

// Or what if there's additional data in the encrypted blob that affects the keystream?

// Let me look at the raw encrypted data more carefully.

console.log('Looking at the encrypted data structure...\n');

// The encrypted data is base64 encoded. Let's see if there's any structure.
// Working: 717 bytes
// Failing: 720 bytes

// The difference in length (3 bytes) might be significant.
// The decrypted data is also different in length (521 vs 524 bytes).

// The extra 3 bytes in the failing video might be causing the keystream to shift!

console.log(`Working encrypted length: 717 bytes, decrypted length: 521 bytes, diff: ${717 - 521}`);
console.log(`Failing encrypted length: 720 bytes, decrypted length: 524 bytes, diff: ${720 - 524}`);

// Both have a 196-byte difference between encrypted and decrypted.
// This suggests there's 196 bytes of overhead/metadata in the encrypted data.

// Maybe the first 196 bytes are used to derive the keystream?
// Or maybe the keystream is embedded in the encrypted data?

console.log('\n=== Hypothesis: Keystream is derived from encrypted data ===\n');

// What if the encrypted data contains:
// 1. Some header/metadata that affects keystream generation
// 2. The actual ciphertext

// The keystream might be derived from:
// - User-Agent (we know this affects it)
// - Some bytes from the encrypted data itself

// Let's see if there's a pattern in the first 196 bytes...

// Actually, let me try a different approach.
// Let's see if we can find the keystream derivation by looking at
// multiple videos and finding what's common.

console.log('=== Conclusion ===\n');
console.log('The keystream is VIDEO-SPECIFIC, not just UA-specific.');
console.log('The keystream diverges at position 33, even though:');
console.log('  - Encrypted bytes are identical at position 33');
console.log('  - Plaintext at position 32 is identical');
console.log('');
console.log('This suggests the keystream depends on something OTHER than');
console.log('just the User-Agent and previous plaintext.');
console.log('');
console.log('Possible factors:');
console.log('  1. Video ID embedded in the encrypted data');
console.log('  2. Server-side state that varies per video');
console.log('  3. Timestamp or nonce in the encrypted data');
console.log('');
console.log('Next step: Analyze the encrypted data structure to find');
console.log('what differs between videos that could affect the keystream.');
