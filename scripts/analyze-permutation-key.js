#!/usr/bin/env node
/**
 * Analyze the relationship between the base permutations from p_mLjDq
 * and the actual cipher bytes from our samples.
 * 
 * We know:
 * - Base permutations: p_mLjDq(129, 39, [129]) → 129 tables
 * - Actual cipher: for each position, plaintext char → cipher byte
 * - The __$ key somehow transforms the base permutations
 * 
 * Hypothesis: The actual table might be:
 *   cipher_byte = base_perm[pos % 129][charCode] XOR key_byte
 * or:
 *   cipher_byte = base_perm[pos % 129][(charCode + key_byte) % 129]
 * or some other combination.
 */
const fs = require('fs');

// Generate base permutations
function p_mLjDq(h, r, e) {
  var K = [];
  for (var b = 0; b < h; b++) K[b] = [];
  for (var k = 0; k < h; k++) {
    var n = h - 1;
    while (n >= 0) {
      var c = 0, t = 0, i = 0, v, s;
      while (true) {
        i = t;
        if (c >= e.length) break;
        t = e[c]; v = t - i; c++;
        if (n < t) break;
      }
      s = i + ((n - i + r * k) % v + v) % v;
      K[k][s] = n;
      n--;
    }
    k; // just to be safe
  }
  return K;
}

const basePerm = p_mLjDq(129, 39, [129]);

// Known mappings from our 82 samples (position → {plainChar → cipherByte})
const knownMappings = {
  0: { '{': 0xd4 },    // 123 → 212
  1: { '"': 0x6b },    // 34 → 107
  2: { 'u': 0x52 },    // 117 → 82
  3: { 'r': 0xf7 },    // 114 → 247
  4: { 'l': 0xea },    // 108 → 234
  5: { '"': 0x8f },    // 34 → 143
  6: { ':': 0x58 },    // 58 → 88
  7: { '"': 0x88 },    // 34 → 136
  8: { 'h': 0x38 },    // 104 → 56
  9: { 't': 0xc8 },    // 116 → 200
  10: { 't': 0xa0 },   // 116 → 160
  11: { 'p': 0x44 },   // 112 → 68
  12: { 's': 0xf3 },   // 115 → 243
  13: { ':': 0xe2 },   // 58 → 226
  14: { '\\': 0x4b },  // 92 → 75
  15: { '/': 0x29 },   // 47 → 41
  16: { '\\': 0xce },  // 92 → 206
  17: { '/': 0x59 },   // 47 → 89
  18: { 'm': 0xb1 },   // 109 → 177
  19: { 'e': 0xde },   // 101 → 222
  20: { 'g': 0x51 },   // 103 → 81
  21: { 'a': 0x8f },   // 97 → 143
  22: { 'u': 0xf2 },   // 117 → 242
  23: { 'p': 0x8c },   // 112 → 140
  24: { '2': 0x25 },   // 50 → 37
  25: { '2': 0x3e },   // 50 → 62
  26: { '.': 0xf8 },   // 46 → 248
  27: { 'o': 0xb8 },   // 111 → 184
  28: { 'n': 0xbf },   // 110 → 191
  29: { 'l': 0xe7 },   // 108 → 231
  30: { 'i': 0x37 },   // 105 → 55
  31: { 'n': 0xcf },   // 110 → 207
  32: { 'e': 0xa3 },   // 101 → 163
  33: { '\\': 0x01 },  // 92 → 1
  34: { '/': 0x50 },   // 47 → 80
  35: { 'e': 0x78 },   // 101 → 120
  36: { '\\': 0x15 },  // 92 → 21
  37: { '/': 0x60 },   // 47 → 96
};

console.log('Analyzing relationship between base permutations and actual cipher bytes...\n');

// For each known mapping, check what the base permutation gives us
for (const [posStr, mapping] of Object.entries(knownMappings)) {
  const pos = parseInt(posStr);
  const [char, cipherByte] = Object.entries(mapping)[0];
  const charCode = char.charCodeAt(0);
  
  // The base permutation for this position (mod 129)
  const permIdx = pos % 129;
  const permValue = basePerm[permIdx][charCode];
  
  // What's the relationship between permValue and cipherByte?
  const xorDiff = permValue ^ cipherByte;
  const addDiff = (cipherByte - permValue + 256) % 256;
  const subDiff = (permValue - cipherByte + 256) % 256;
  
  console.log(`pos ${pos.toString().padStart(2)}: char='${char}' (${charCode}) → cipher=0x${cipherByte.toString(16).padStart(2,'0')} (${cipherByte}), perm[${permIdx}][${charCode}]=${permValue}, XOR=${xorDiff}, ADD=${addDiff}, SUB=${subDiff}`);
}

// Check if there's a consistent XOR key
console.log('\nChecking for consistent XOR pattern...');
const xorValues = [];
for (const [posStr, mapping] of Object.entries(knownMappings)) {
  const pos = parseInt(posStr);
  const [char, cipherByte] = Object.entries(mapping)[0];
  const charCode = char.charCodeAt(0);
  const permIdx = pos % 129;
  const permValue = basePerm[permIdx][charCode];
  xorValues.push(permValue ^ cipherByte);
}
const uniqueXor = new Set(xorValues);
console.log(`Unique XOR values: ${uniqueXor.size} (would be 1 if simple XOR)`);

// Check if there's a per-position key byte
console.log('\nChecking for per-position key byte (cipher = perm[pos][charCode] + key[pos])...');
const keyBytes = [];
for (const [posStr, mapping] of Object.entries(knownMappings)) {
  const pos = parseInt(posStr);
  const [char, cipherByte] = Object.entries(mapping)[0];
  const charCode = char.charCodeAt(0);
  const permIdx = pos % 129;
  const permValue = basePerm[permIdx][charCode];
  keyBytes.push((cipherByte - permValue + 256) % 256);
}
console.log(`Key bytes: ${keyBytes.map(b => '0x'+b.toString(16).padStart(2,'0')).join(', ')}`);

// Check if the key bytes come from the __$ key
// The __$ key is something like "ZZYdbXagjEpeaR4SF5q7C4ViIh-6IB..."
// Let's check if the key bytes match charCodes from a typical __$ key
console.log('\nKey byte values:', keyBytes);

// Maybe the formula is: cipher = (perm[pos][charCode] + keyCharCode) % 256
// where keyCharCode = __$.charCodeAt(pos % __$.length)
// Let's check what __$ char codes would produce these key bytes
console.log('\nRequired __$ char codes (if cipher = (perm + keyChar) % 256):');
for (let i = 0; i < keyBytes.length; i++) {
  const keyChar = keyBytes[i];
  if (keyChar >= 32 && keyChar <= 126) {
    console.log(`  pos ${i}: keyChar = ${keyChar} = '${String.fromCharCode(keyChar)}'`);
  } else {
    console.log(`  pos ${i}: keyChar = ${keyChar} (not printable)`);
  }
}

// Let's also try: cipher = perm[pos][(charCode + keyByte) % 129]
// This would mean the key shifts the input before permutation
console.log('\nChecking: cipher = perm[pos][(charCode + key) % 129]...');
for (const [posStr, mapping] of Object.entries(knownMappings)) {
  const pos = parseInt(posStr);
  const [char, cipherByte] = Object.entries(mapping)[0];
  const charCode = char.charCodeAt(0);
  const permIdx = pos % 129;
  
  // Find what input to perm would give cipherByte
  // perm[permIdx][x] = cipherByte → find x
  let x = -1;
  for (let j = 0; j < 129; j++) {
    if (basePerm[permIdx][j] === cipherByte) { x = j; break; }
  }
  
  if (x >= 0) {
    const shift = (x - charCode + 129) % 129;
    console.log(`  pos ${pos}: x=${x}, charCode=${charCode}, shift=${shift}`);
  } else {
    // cipherByte > 128, so it's not in the permutation range (0-128)
    console.log(`  pos ${pos}: cipherByte ${cipherByte} > 128, not in perm range`);
  }
}

// Key observation: the permutation maps 0-128 to 0-128
// But cipher bytes can be 0-255. So there must be an additional transformation.
// Maybe: cipher = perm[pos][charCode] * 2 + something
// Or: cipher = perm[pos][charCode % 129] + 128 * (charCode >= 129)
// Or the permutation is used differently

console.log('\nChecking: cipher = perm[pos][charCode] * 2...');
for (const [posStr, mapping] of Object.entries(knownMappings).slice(0, 5)) {
  const pos = parseInt(posStr);
  const [char, cipherByte] = Object.entries(mapping)[0];
  const charCode = char.charCodeAt(0);
  const permIdx = pos % 129;
  const permValue = basePerm[permIdx][charCode];
  console.log(`  pos ${pos}: perm=${permValue}, perm*2=${permValue*2}, cipher=${cipherByte}, diff=${cipherByte - permValue*2}`);
}
