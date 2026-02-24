#!/usr/bin/env node
/**
 * Extract AnimeKai substitution tables by running the p_mLjDq permutation
 * function directly. This is the core of their encryption.
 *
 * The obfuscated bundle calls: _[565766](129, 39, [129])
 * which returns { p_mLjDq: function(h, r, e) { ... } }
 *
 * p_mLjDq generates a 2D permutation array used as the substitution table.
 * Parameters: (h=size, r=seed, e=array_of_values)
 *
 * The function is a Fisher-Yates shuffle variant that creates a permutation
 * matrix. Let me deobfuscate and run it.
 */

// Deobfuscated p_mLjDq function from the bundle
// Original: _[565766] = function(a, h, r) { ... }(129, 39, [129])
function p_mLjDq(h, r, e) {
  // h = number of rows (table size)
  // r = number of columns? seed?
  // e = array of values used in shuffle
  
  var K = [];  // result 2D array
  var b;       // loop counter
  var k;       // outer loop counter
  var n;       // inner loop counter
  var c = 0;   // index into e array
  var t = 0;   // current value from e
  var i;       // previous value
  var v;       // range (t - i)
  var s;       // swap index

  // Initialize K as array of h empty arrays
  for (b = 0; b < h; b++) {
    K[b] = [];
  }

  // Main permutation loop
  for (k = 0; k < h; k++) {
    n = h - 1;
    if (n >= 0) {
      // Reset c and t for each row
      c = 0;
      t = 0;
      
      // First iteration setup
      i = t;
      t = e[c];
      v = t - i;
      c++;
      
      while (n >= t) {
        i = t;
        t = e[c];
        v = t - i;
        c++;
      }
      
      // Shuffle: place k at position s in row n, then decrement n
      s = i + (n - i + r * k) % v;
      K[k][s] = K[n];  // This might be undefined initially
      
      n -= 1;
      while (n >= 0) {
        // Reset c and t
        c = 0;
        t = 0;
        
        i = t;
        t = e[c];
        v = t - i;
        c++;
        
        while (n >= t) {
          i = t;
          t = e[c];
          v = t - i;
          c++;
        }
        
        s = i + (n - i + r * k) % v;
        K[k][s] = K[n];
        
        n -= 1;
      }
    }
  }

  return K;
}

// Wait, I need to re-read the obfuscated code more carefully.
// Let me trace through the switch cases:
//
// case 2: K=[], var b, k, n, var c, t, i, var v, s
// case 14: b=0
// case 13: if b<h goto 12 else goto 10
// case 12: K[b]=[]; goto 11
// case 11: b++; goto 13
// case 10: k=0; goto 20
// case 20: if k<h goto 19 else goto 33
// case 19: n=h-1; goto 18
// case 18: if n>=0 goto 17 else goto 34
// case 17: c=0; t=0; goto 15
// case 15: i=t; goto 27
// case 27: i=t; t=e[c]; goto 25
// case 25: v=t-i; c++; goto 23
// case 23: if n>=t goto 27 else goto 22
// case 22: s=i+(n-i+r*k)%v; K[k][s]=K[n]; goto 35  (WAIT: K[k][s] = K[n]??)
// case 35: n-=1; goto 18
// case 34: k+=1; goto 20
// case 33: return K

// Hmm, K[k][s] = K[n] doesn't make sense for building a permutation.
// Let me re-read case 22 more carefully...
// 
// Actually wait - looking at the original more carefully:
// case 22: s=i+(n-i+r*k)%v; K[k][s]=K[n]; goto 35
//
// But K[n] is an ARRAY (row n). So K[k][s] = K[n] means:
// "Put the entire row n into position s of row k"
// That doesn't make sense either...
//
// WAIT. Let me re-read. The original code says:
// K[k][s] = K[n]  -- but K[n] was initialized as []
// 
// Hmm, maybe this is building a SWAP pattern?
// Actually I think I'm misreading. Let me look at the raw obfuscated code again.

// From the bundle, the actual switch statement for p_mLjDq:
// case 22: s=i+(n-i+r*k)%v; K[k][s]=K[n]; goto 35
//
// But K is initialized as K[b]=[] for each b.
// So K[n] is an array. K[k][s] = K[n] sets element s of array k to array n.
// That creates a 2D structure where each cell points to another row.
//
// Actually, I think this might be wrong. Let me look at the ACTUAL raw bytes
// from the bundle more carefully...

// Let me just run the actual obfuscated function directly.
console.log('Extracting tables by running the actual obfuscated p_mLjDq...\n');

// The actual function from the bundle (cleaned up but preserving logic):
function p_mLjDq_actual(h, r, e) {
  var K = [];
  var b, k, n;
  var c, t, i;
  var v, s;

  // Init: K = array of h empty arrays
  for (b = 0; b < h; b++) {
    K[b] = [];
  }

  // Main loop
  for (k = 0; k < h; k++) {
    n = h - 1;
    
    while (n >= 0) {
      // Find which segment n falls into
      c = 0;
      t = 0;
      i = t;
      t = e[c];
      v = t - i;
      c++;
      
      while (n >= t) {
        i = t;
        t = e[c];
        if (t === undefined) break;
        v = t - i;
        c++;
      }
      
      // Calculate swap position
      s = i + ((n - i + r * k) % v);
      
      // Swap K[k][s] and K[n] -- but what does this mean?
      // K[k] is an array, K[n] is an array
      // K[k][s] = K[n] means: set element s of row k to the array at row n
      // This is building a permutation!
      
      // Actually I think the swap is:
      // temp = K[k][s]; K[k][s] = K[n][something]; K[n][something] = temp;
      // But the code just says K[k][s] = K[n]...
      
      // Let me try a different interpretation:
      // Maybe K is a 1D array and K[k][s] means K[k*something + s]?
      // No, K[b] = [] makes it 2D.
      
      // OR: maybe the result is used differently than I think.
      // The function returns K, and the caller uses K as a lookup table.
      // K[position][char] = encrypted_byte
      
      // Let me just try running it and see what comes out.
      K[k][s] = K[n];
      
      n -= 1;
    }
  }

  return K;
}

// Run with the parameters from the bundle: (129, 39, [129])
const result = p_mLjDq_actual(129, 39, [129]);
console.log('Result dimensions:', result.length, 'x', result[0]?.length);
console.log('First row:', JSON.stringify(result[0]?.slice(0, 20)));
console.log('Row 0 non-undefined count:', result[0]?.filter(x => x !== undefined).length);

// Hmm, all values will be [] (empty arrays) or undefined.
// This function doesn't produce byte values - it produces a PERMUTATION STRUCTURE.
// The actual encryption uses this structure differently.

// Let me look at how the bundle USES the result of p_mLjDq.
// The bundle has: _.G3v = function() { return p_mLjDq.apply(...) }
// And _.K76 = function() { return p_mLjDq.apply(...) }
// These are called somewhere in the encrypt/decrypt functions.

// The key call is: _[565766](129, 39, [129])
// This means: create a 129x129 permutation with seed 39 and breakpoints [129]

// Since e=[129] and h=129, the segment is [0, 129).
// For each k (0..128) and n (128..0):
//   s = 0 + (n - 0 + 39*k) % 129 = (n + 39*k) % 129
//   K[k][s] = K[n]
//
// Since K[n] starts as [], K[k][s] = [] for all assignments.
// This means the STRUCTURE of which positions are filled tells us the permutation!

// Actually, I think the permutation IS the mapping of positions.
// For row k, the filled positions tell us where each n maps to.
// s = (n + 39*k) % 129

// So for position k, character n maps to position s = (n + 39*k) % 129
// This is a simple affine cipher per position!

console.log('\n=== Affine cipher analysis ===');
console.log('For position k, char n encrypts to: s = (n + 39*k) % 129');
console.log('');

// Let's verify: for k=0, s = n % 129 = n (identity)
// For k=1, s = (n + 39) % 129
// For k=2, s = (n + 78) % 129

// But wait - the actual encryption in animekai.rs uses 128 ASCII chars (0-127)
// and the tables map ASCII to cipher bytes (0-255).
// The p_mLjDq function uses 129 entries...

// Let me check: maybe the tables are NOT from p_mLjDq directly.
// Maybe p_mLjDq is used for something else (like the anti-tamper checks)
// and the actual substitution tables are embedded differently.

// Let me search for where the actual encrypt/decrypt happens in the bundle.
console.log('=== Searching for encrypt/decrypt pattern ===');

// The encrypt function likely:
// 1. Takes plaintext string
// 2. Adds the 21-byte header
// 3. For each char, looks up in a table based on position
// 4. Inserts constant bytes at fixed positions
// 5. Base64 encodes

// The decrypt function reverses this.
// The tables must be 256-entry arrays (byte -> byte mapping).

// Let me try a completely different approach: 
// Instead of reverse-engineering the bundle, let me use Puppeteer to
// run the actual AnimeKai page and extract the tables by calling
// the encrypt function with every possible input.

console.log('\n=== APPROACH: Extract tables via API probing ===');
console.log('For each position (0-182), encrypt a string where only that position varies.');
console.log('By trying all 128 ASCII chars, we get the full table for that position.');
console.log('');
console.log('Method: encrypt(padding + char) where padding is (position) chars long');
console.log('Then read the cipher byte at cipher_pos(position) from the base64 output.');
console.log('');
console.log('Since our Rust encrypt already works (server accepts it),');
console.log('the SERVER tables must match our encrypt tables.');
console.log('The issue is that the SERVER DECRYPT tables are DIFFERENT from our encrypt tables.');
console.log('');
console.log('KEY INSIGHT: The server encrypts its response with tables that are the');
console.log('INVERSE of what the client uses to decrypt.');
console.log('The client JS has BOTH encrypt and decrypt tables.');
console.log('Our Rust code only has the encrypt tables (which the server validates).');
console.log('We need the SERVER ENCRYPT tables (= client DECRYPT tables).');
console.log('');
console.log('To get these, we need to:');
console.log('1. Get encrypted responses from the server');
console.log('2. Know the plaintext (by getting the same data from another source)');
console.log('3. Build the mapping: for each position, cipher_byte -> plaintext_char');
