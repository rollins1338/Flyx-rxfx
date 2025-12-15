/**
 * Extract the inner l array from the token chunk
 * The outer l array is decoded with CHARSET_1 (h function)
 * The inner scope uses CHARSET_2 (m function) with the SAME l array
 */

const fs = require('fs');

// Read the token chunk
const chunk = fs.readFileSync('source-testing/smashystream-token-chunk.js', 'utf8');

// Find the l array definition
const lMatch = chunk.match(/l=\[([^\]]+)\]/);
if (!lMatch) {
  console.log('Could not find l array');
  process.exit(1);
}

// Parse the array - it's a list of quoted strings
const lArrayStr = lMatch[1];
console.log('Found l array, length:', lArrayStr.length);

// Extract strings manually
const strings = [];
let current = '';
let inString = false;
let stringChar = '';
let escaped = false;

for (let i = 0; i < lArrayStr.length; i++) {
  const char = lArrayStr[i];
  
  if (!inString) {
    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      current = '';
    }
  } else {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === stringChar) {
      strings.push(current);
      inString = false;
    } else {
      current += char;
    }
  }
}

console.log('Extracted', strings.length, 'strings');

// Now decode with CHARSET_2 (the m function charset)
const CHARSET_2 = 'A8CglIhpEO7,xSXz#Ji;dw~>n4DB(Y=3H_WUG$[5%/?a<K]V}F^o6vNf&PkqM|u0Tj@me1ZRQLc+)rt!sby:2`{".9*';

function utf8Decode(bytes) {
  const result = [];
  for (let i = 0; i < bytes.length;) {
    let byte = bytes[i++], codePoint;
    if (byte <= 127) codePoint = byte;
    else if (byte <= 223) codePoint = (byte & 31) << 6 | bytes[i++] & 63;
    else if (byte <= 239) codePoint = (byte & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
    else codePoint = (byte & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
    if (codePoint > 0x10FFFF) return '[INVALID]';
    result.push(String.fromCodePoint(codePoint));
  }
  return result.join('');
}

function decode91(input, charset) {
  const str = "" + (input || ""), bytes = [];
  let P = 0, M = 0, T = -1;
  for (let H = 0; H < str.length; H++) {
    const V = charset.indexOf(str[H]);
    if (V !== -1) {
      if (T < 0) T = V;
      else {
        T += V * 91; P |= T << M; M += (T & 8191) > 88 ? 13 : 14;
        do { bytes.push(P & 255); P >>= 8; M -= 8; } while (M > 7);
        T = -1;
      }
    }
  }
  if (T > -1) bytes.push((P | T << M) & 255);
  return utf8Decode(bytes);
}

// Decode key indices with CHARSET_2
console.log('\n=== KEY INDICES (decoded with CHARSET_2) ===\n');
const keyIndices = [132, 133, 134, 135, 136, 137, 138];
for (const idx of keyIndices) {
  if (idx < strings.length) {
    const decoded = decode91(strings[idx], CHARSET_2);
    console.log(`[${idx}]: "${decoded}"`);
  } else {
    console.log(`[${idx}]: OUT OF RANGE`);
  }
}

// Also show what f[19] and f[20] are
const f = [0, 1, 8, 255, "length", "undefined", 63, 6, "fromCodePoint", 7, 12, "push", 91, 8191, 88, 13, 14, 127, 128, 134, 132];
console.log('\n=== f array values ===');
console.log('f[19] =', f[19], '-> x(132)');
console.log('f[20] =', f[20], '-> x(134)');

// The pattern is:
// Module[x(f[20])](x(133), x(f[19]), [x(f[19])])
// = Module[x(134)](x(133), x(132), [x(132)])
// = Module.cwrap("_gewe_town", "string", ["string"])

console.log('\n=== Expected decoded values ===');
console.log('x(134) should be "cwrap"');
console.log('x(133) should be "_gewe_town"');
console.log('x(132) should be "string"');
console.log('x(135) should be "_free_token"');
console.log('x(136) should be "number"');
console.log('x(137) should be "tokenFunc"');
console.log('x(138) should be "freeTokenFunc"');
