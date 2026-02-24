#!/usr/bin/env node
/**
 * Extract and run the p_mLjDq shuffle function from AnimeKai bundle.
 * This function generates the permutation tables used for encryption/decryption.
 */

// Cleaned up from the obfuscated bundle
function p_mLjDq(h, r, e) {
  // h = number of tables (e.g., 129)
  // r = some parameter (e.g., 39)
  // e = array parameter (e.g., [129])
  
  var K = [];
  var b, k, n, c, t, i, v, s;
  
  // Create h empty arrays
  for (b = 0; b < h; b++) {
    K[b] = [];
  }
  
  // Generate permutations
  for (k = 0; k < h; k++) {
    n = h - 1;
    while (n >= 0) {
      // Initialize c and t from e array
      c = 0;
      t = 0;
      i = t;
      t = e[c];
      c++;
      
      // Continue while n >= t
      while (n >= t) {
        i = t;
        t = e[c];
        c++;
        // If c goes past e.length, t becomes undefined
        if (c > e.length) break;
      }
      
      // If n < t (or t is undefined), skip
      if (t === undefined || n < t) {
        // When n < first element of e, we just decrement
        // Actually let me re-read the state machine more carefully
      }
      
      v = t - i;
      s = i + (n - i + r * k) % v;
      
      // Swap K[k][s] and K[n]... but K[k] is an array, not K[n]
      // Actually looking at the code again:
      // K[k][s] = K[n]  -- this sets position s in table k
      // But K[n] is an array... 
      // Wait, maybe K is being used differently
      // Let me re-read: K[k][s]=K[n]; then n-=1
      // This doesn't make sense as a permutation of values
      // Unless K[n] refers to something else
      
      // Actually, I think the original code might be:
      // K[s] and K[n] are being swapped (Fisher-Yates on a flat array)
      // Let me re-examine...
      
      // The state machine says:
      // case 22: s=i+(n-i+r*k)%v; K[k][s]=K[n]; break; (then n-=1)
      // Wait no, case 22 says: K[k][s]=K[n]; 
      // But K[n] is an array (since K[b]=[] for all b)
      // Unless this is building a mapping: table k maps position s to value n
      
      // Actually I think this IS building a permutation:
      // For each table k, for each position n (from h-1 down to 0),
      // compute s = shuffle(n, k), then K[k][s] = n
      // Wait no, K[k][s] = K[n] which is an array...
      
      // Let me look at the raw state machine again more carefully
      K[k][s] = n;  // I think this is what it does - maps position s to value n
      n -= 1;
    }
  }
  
  return K;
}

// Test with the actual parameters from the bundle
const tables = p_mLjDq(129, 39, [129]);
console.log('Generated', tables.length, 'tables');
console.log('Table 0 length:', tables[0].length);
console.log('Table 0 first 20:', tables[0].slice(0, 20));
console.log('Table 1 first 20:', tables[1].slice(0, 20));

// Check if these are permutations (each table should contain 0..128 in some order)
for (let i = 0; i < 3; i++) {
  const sorted = [...tables[i]].sort((a, b) => a - b);
  const isPermutation = sorted.length === 129 && sorted[0] === 0 && sorted[128] === 128;
  console.log(`Table ${i}: length=${tables[i].length}, isPermutation=${isPermutation}`);
}
