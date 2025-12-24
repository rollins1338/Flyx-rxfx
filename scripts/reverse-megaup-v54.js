#!/usr/bin/env node
/**
 * Reverse engineer MegaUp encryption - v54
 * 
 * CONFIRMED: The keystream uses plaintext feedback at the CURRENT position!
 * 
 * The decryption must work like:
 * 1. base_K[i] = f(UA, i, state)
 * 2. P[i] = C[i] XOR base_K[i] XOR g(P[i])
 * 
 * But this is circular! We need P[i] to compute g(P[i]).
 * 
 * Unless... the cipher is designed so that g(P[i]) cancels out!
 * 
 * Let's think about this algebraically:
 * C[i] = P[i] XOR K[i]
 * K[i] = base_K[i] XOR h(P[i])
 * 
 * So: C[i] = P[i] XOR base_K[i] XOR h(P[i])
 * 
 * For decryption:
 * P[i] = C[i] XOR base_K[i] XOR h(P[i])
 * P[i] XOR h(P[i]) = C[i] XOR base_K[i]
 * 
 * If h(P[i]) = P[i], then:
 * P[i] XOR P[i] = C[i] XOR base_K[i]
 * 0 = C[i] XOR base_K[i]
 * C[i] = base_K[i]
 * 
 * This would mean the ciphertext IS the base keystream!
 * And the plaintext can be anything!
 * 
 * But that doesn't match our observations. The ciphertext is NOT the same
 * as the base keystream (we can see different ciphertext for different videos).
 * 
 * Let me try a different approach.
 * 
 * What if the cipher uses a RUNNING XOR that includes the current plaintext?
 * 
 * K[i] = base_K[i] XOR running_xor[i]
 * running_xor[i] = running_xor[i-1] XOR P[i-1] XOR P[i]
 * 
 * Wait, that still requires knowing P[i] before decrypting.
 * 
 * Let me look at the actual relationship between the keystrams.
 */

const fs = require('fs');

const working = JSON.parse(fs.readFileSync('megaup-keystream-working.json', 'utf8'));
const failing = JSON.parse(fs.readFileSync('megaup-keystream-failing.json', 'utf8'));

const wKs = working.keystream;
const fKs = failing.keystream;
const wDec = Buffer.from(working.decrypted, 'utf8');
const fDec = Buffer.from(failing.decrypted, 'utf8');

console.log('=== Analyzing the keystream relationship ===\n');

// We know: K_w[i] XOR K_f[i] = P_w[i] XOR P_f[i] (for positions where ciphertext is the same)

// Let's define:
// D_K[i] = K_w[i] XOR K_f[i]
// D_P[i] = P_w[i] XOR P_f[i]

// We have: D_K[i] = D_P[i]

// Now, if K[i] = base_K[i] XOR f(P[0:i]), then:
// D_K[i] = f(P_w[0:i]) XOR f(P_f[0:i])

// For this to equal D_P[i], we need:
// f(P_w[0:i]) XOR f(P_f[0:i]) = P_w[i] XOR P_f[i]

// If f is XOR of all elements:
// f(P[0:i]) = P[0] XOR P[1] XOR ... XOR P[i]
// f(P_w[0:i]) XOR f(P_f[0:i]) = (P_w[0] XOR ... XOR P_w[i]) XOR (P_f[0] XOR ... XOR P_f[i])
//                             = (P_w[0] XOR P_f[0]) XOR ... XOR (P_w[i] XOR P_f[i])
//                             = D_P[0] XOR D_P[1] XOR ... XOR D_P[i]

// For positions 0-32, D_P[j] = 0 (plaintext is the same)
// So f(P_w[0:32]) XOR f(P_f[0:32]) = 0

// At position 33:
// f(P_w[0:33]) XOR f(P_f[0:33]) = D_P[33] = 0x0f

// This matches! D_K[33] = 0x0f

// So the formula is: K[i] = base_K[i] XOR XOR(P[0:i])

// Let's verify this for all positions.

console.log('Testing: K[i] = base_K[i] XOR XOR(P[0:i])\n');

// Compute base_K from working video
let wXor = 0;
const baseK = [];

for (let i = 0; i < wKs.length; i++) {
  wXor ^= wDec[i];
  baseK.push(wKs[i] ^ wXor);
}

// Verify with failing video
let fXor = 0;
let matches = 0;

for (let i = 0; i < fKs.length; i++) {
  fXor ^= fDec[i];
  const expectedK = baseK[i] ^ fXor;
  
  if (expectedK === fKs[i]) {
    matches++;
  } else if (i < 50) {
    console.log(`Mismatch at ${i}: expected 0x${expectedK.toString(16).padStart(2,'0')}, got 0x${fKs[i].toString(16).padStart(2,'0')}`);
  }
}

console.log(`\nMatches: ${matches}/${fKs.length}`);

if (matches === fKs.length) {
  console.log('\n*** FORMULA VERIFIED! ***');
  console.log('K[i] = base_K[i] XOR XOR(P[0:i])');
  console.log('Decryption: P[i] = solve for P[i] in C[i] = P[i] XOR base_K[i] XOR XOR(P[0:i])');
} else {
  // Try the formula with XOR(P[0:i-1]) instead
  console.log('\nTrying: K[i] = base_K[i] XOR XOR(P[0:i-1])\n');
  
  wXor = 0;
  const baseK2 = [];
  
  for (let i = 0; i < wKs.length; i++) {
    baseK2.push(wKs[i] ^ wXor);
    wXor ^= wDec[i];
  }
  
  fXor = 0;
  matches = 0;
  
  for (let i = 0; i < fKs.length; i++) {
    const expectedK = baseK2[i] ^ fXor;
    
    if (expectedK === fKs[i]) {
      matches++;
    } else if (i < 50) {
      console.log(`Mismatch at ${i}: expected 0x${expectedK.toString(16).padStart(2,'0')}, got 0x${fKs[i].toString(16).padStart(2,'0')}`);
    }
    
    fXor ^= fDec[i];
  }
  
  console.log(`\nMatches: ${matches}/${fKs.length}`);
  
  if (matches === fKs.length) {
    console.log('\n*** FORMULA VERIFIED! ***');
    console.log('K[i] = base_K[i] XOR XOR(P[0:i-1])');
    
    // Save the base keystream
    const ksHex = Buffer.from(baseK2).toString('hex');
    fs.writeFileSync('megaup-base-keystream-verified.json', JSON.stringify({
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      length: baseK2.length,
      hex: ksHex,
      algorithm: 'K[i] = base_K[i] XOR XOR(P[0:i-1]); P[i] = C[i] XOR K[i]'
    }, null, 2));
    
    console.log('\nSaved base keystream to megaup-base-keystream-verified.json');
    
    // Now let's implement the decryption algorithm
    console.log('\n=== Implementing decryption ===\n');
    
    // The decryption algorithm:
    // 1. Initialize running_xor = 0
    // 2. For each position i:
    //    a. K[i] = base_K[i] XOR running_xor
    //    b. P[i] = C[i] XOR K[i]
    //    c. running_xor ^= P[i]
    
    // This is exactly what we tested before! Let me verify it works.
    
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
    
    async function testDecryption() {
      const failingVideoId = 'jKfJZ2GHWS2JcOLzF79M6RvpCQ';
      const encBytes = await getEncryptedFromRPI(failingVideoId);
      
      console.log(`Encrypted bytes: ${encBytes.length}`);
      console.log(`Base keystream: ${baseK2.length}`);
      
      // Decrypt
      let runningXor = 0;
      const decrypted = [];
      
      for (let i = 0; i < Math.min(encBytes.length, baseK2.length); i++) {
        const K = baseK2[i] ^ runningXor;
        const P = encBytes[i] ^ K;
        decrypted.push(P);
        runningXor ^= P;
      }
      
      const decryptedStr = Buffer.from(decrypted).toString('utf8');
      console.log('\nDecrypted (first 200 chars):');
      console.log(decryptedStr.substring(0, 200));
      
      // Compare with expected
      console.log('\nExpected (from API):');
      console.log(failing.decrypted.substring(0, 200));
      
      // Check match
      let matchCount = 0;
      for (let i = 0; i < Math.min(decryptedStr.length, failing.decrypted.length); i++) {
        if (decryptedStr[i] === failing.decrypted[i]) matchCount++;
      }
      console.log(`\nMatch: ${matchCount}/${Math.min(decryptedStr.length, failing.decrypted.length)}`);
      
      if (matchCount === Math.min(decryptedStr.length, failing.decrypted.length)) {
        console.log('\n*** DECRYPTION SUCCESSFUL! ***');
      }
    }
    
    testDecryption().catch(console.error);
  }
}
