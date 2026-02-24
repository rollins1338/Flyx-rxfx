#!/usr/bin/env node
/**
 * Run the p_mLjDq shuffle function extracted from AnimeKai bundle.
 * Then figure out how the __$ key generates the actual substitution tables.
 * 
 * From the bundle:
 * _[565766] is called with (129, 39, [129])
 * This creates a permutation structure used by the crypto functions.
 * 
 * The actual encrypt/decrypt uses:
 * - _.G3v (alias for p_mLjDq) 
 * - The __$ page key
 * - charCodeAt, fromCharCode, atob, btoa
 */

// Exact reproduction of the p_mLjDq function from the state machine
function p_mLjDq(h, r, e) {
  var K = [];
  var b, k, n, c, t, i, v, s;
  
  // case 14 → 13: Initialize K with h empty arrays
  b = 0;
  while (b < h) {
    K[b] = [];
    b++;
  }
  
  // case 10: k = 0
  k = 0;
  while (k < h) {
    // case 19: n = h - 1
    n = h - 1;
    
    while (n >= 0) {
      // case 17: c = 0, t = 0
      c = 0;
      t = 0;
      
      // case 15: i = t (i = 0)
      i = t;
      
      // case 27: i = t, t = e[c], c++
      // Wait — case 15 goes to case 27
      // case 27: i = t; t = e[c]; → case 25
      // case 25: v = t - i; c++; → case 23
      // case 23: n >= t? → case 27 (loop) or case 22 (exit)
      
      // So the inner loop is:
      // Start: i = 0, then enter loop:
      //   i = t (previous t)
      //   t = e[c]
      //   v = t - i
      //   c++
      //   if n >= t: continue loop
      //   else: exit to case 22
      
      // First iteration: i = 0, t = e[0] = 129, v = 129 - 0 = 129, c = 1
      // Check: n >= 129? For n = 128 (h-1), 128 >= 129 is false → exit
      // So for e = [129], the loop always exits after first iteration
      // with i = 0, t = 129, v = 129
      
      // Actually wait, let me re-trace more carefully:
      // case 15: i = t → i = 0 (since t was set to 0 in case 17)
      // Then goes to case 27
      // case 27: i = t → i = 0 (t is still 0)
      //          t = e[c] → t = e[0] = 129
      //          → case 25
      // case 25: v = t - i → v = 129 - 0 = 129
      //          c++ → c = 1
      //          → case 23
      // case 23: n >= t? → n >= 129?
      //   For n = 128: 128 >= 129 is false → case 22
      //   For n = 129+: would be true → case 27 again
      
      // Since h = 129, n goes from 128 down to 0
      // n is always < 129, so we always exit to case 22 after first iteration
      // with i = 0, v = 129
      
      // Actually wait, I need to re-read case 15 and 27 more carefully
      // case 15: i = t; G = 27
      // case 27: i = t; t = e[c]; G = 25
      // 
      // Hmm, case 15 sets i = t, then case 27 ALSO sets i = t
      // So after case 15 → 27:
      //   i = t (from case 15, t = 0) → i = 0
      //   Then case 27: i = t → i = 0 (again, t still 0)
      //   t = e[c] → t = e[0] = 129
      //   → case 25
      
      // So i = 0, t = 129, v = 129
      
      i = 0;
      t = 0;
      
      // Inner loop to find the right range
      while (true) {
        i = t;
        if (c >= e.length) break;
        t = e[c];
        v = t - i;
        c++;
        if (n < t) break;
        // n >= t, continue
      }
      
      // case 22: s = i + (n - i + r * k) % v
      if (v === undefined || v <= 0) {
        // Shouldn't happen with valid inputs
        n--;
        continue;
      }
      
      s = i + ((n - i + r * k) % v + v) % v;  // Ensure positive modulo
      
      // K[k][s] = K[n]
      // But K[n] is an array! This is building a permutation where
      // table k maps position s to... what?
      // Actually, maybe K is being used as a flat array initially,
      // and K[n] refers to the VALUE at position n (which starts as undefined/[])
      // 
      // Wait — K[b] = [] for all b. So K[n] is an empty array.
      // K[k][s] = K[n] would set K[k][s] to an empty array.
      // That doesn't make sense.
      //
      // UNLESS: this is a Fisher-Yates shuffle on K[k], and K[n] should be K[k][n]
      // Let me re-read: "K[k][s]=K[n]" — but in the state machine it says:
      // case 22: s=i+(n-i+r*k)%v; K[k][s]=K[n]; G=35;
      // 
      // Hmm, but K[n] IS an array (K[n] = []). So K[k][s] gets set to that array.
      // Then K[n] gets decremented (n-=1).
      //
      // Actually, I think this might be building a permutation where:
      // K[k] is a permutation array, and K[k][s] = n
      // meaning "position s in table k maps to value n"
      //
      // But K[n] is [], not n. Unless... the code is actually:
      // K[k][s] = K[k][n] (swap), not K[k][s] = K[n]
      //
      // Let me look at the raw state machine one more time...
      // "case 22:s=i+(n-i+r*k)%v;K[k][s]=K[n];G=35;"
      // 
      // K[k][s] = K[n] — this is K[n], the nth element of the outer array
      // K[n] was initialized as [] in the first loop
      // 
      // BUT WAIT: maybe K[n] gets modified during the shuffle!
      // When k=0, n goes from 128 to 0. For each n, we compute s and set K[0][s] = K[n].
      // K[n] starts as []. But K[0] is also one of these arrays.
      // So K[0][s] = K[n] means K[0][s] points to the array K[n].
      // 
      // This creates a structure where K[0] is an array of arrays.
      // K[0][s] = K[n] means position s in permutation 0 points to array n.
      // 
      // Then for k=1, K[1][s] = K[n] — but K[n] might have been modified by k=0.
      // Actually K[n] itself (the array) hasn't been modified, only K[0] has been modified.
      // K[n] is still the same empty array object.
      //
      // So K[k][s] = K[n] creates a reference. K[k] becomes an array where
      // K[k][s] === K[n] (same object reference).
      //
      // This means K[k] is a permutation: K[k][s] points to K[n].
      // To get the permutation as numbers, we'd need to figure out which
      // K[n] each K[k][s] points to.
      //
      // Actually, I think the simpler interpretation is correct:
      // K[k][s] = n (the number), not K[n] (the array)
      // The obfuscator might have mangled the variable names.
      // Let me just try both interpretations.
      
      // Interpretation 1: K[k][s] = n (number)
      K[k][s] = n;
      
      n--;
    }
    
    k++;
  }
  
  return K;
}

// Run with the actual parameters
const result = p_mLjDq(129, 39, [129]);

console.log('Generated', result.length, 'permutation tables');
console.log('Table 0 length:', result[0].length);
console.log('Table 0:', JSON.stringify(result[0].slice(0, 30)));
console.log('Table 1:', JSON.stringify(result[1].slice(0, 30)));

// Check if each table is a valid permutation of 0..128
for (let k = 0; k < Math.min(5, result.length); k++) {
  const sorted = [...result[k]].sort((a, b) => a - b);
  const isValid = sorted.length === 129 && sorted[0] === 0 && sorted[128] === 128;
  const unique = new Set(result[k]).size;
  console.log(`Table ${k}: length=${result[k].length}, unique=${unique}, isPermutation=${isValid}`);
}

// Now the question is: how does the __$ key interact with these permutations
// to create the actual substitution tables?
// 
// The encrypt function likely:
// 1. Takes a plaintext character
// 2. Gets its ASCII code
// 3. Uses the permutation table for the current position to map it
// 4. The mapped value is the cipher byte
//
// If the permutation table maps position s → value n,
// then encrypt(char_at_position_s) = permutation[s][charCode]
// or something similar.
//
// Let's check: for position 0, char '{' (code 123) should map to 0xd4 (212)
// In the NEW tables (from our samples), pos 0: byte 212 → '{'
// So encrypt('{') at pos 0 = 212
// If the permutation is used directly: result[0][123] should be 212?

console.log('\nChecking if permutation directly maps ASCII to cipher bytes...');
console.log(`Table 0[123] ('{' = 123): ${result[0][123]}`);
console.log(`Expected: 212 (0xd4)`);

// Also check other known mappings from our samples
// pos 1: byte 107 (0x6b) → '"' (code 34)
console.log(`Table 1[34] ('"' = 34): ${result[1][34]}`);
console.log(`Expected: 107 (0x6b)`);

// pos 2: byte 82 (0x52) → 'u' (code 117)
console.log(`Table 2[117] ('u' = 117): ${result[2][117]}`);
console.log(`Expected: 82 (0x52)`);

// pos 8: byte 56 (0x38) → 'h' (code 104)
console.log(`Table 8[104] ('h' = 104): ${result[8][104]}`);
console.log(`Expected: 56 (0x38)`);
