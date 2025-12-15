/**
 * Extract the full l array from the player bundle
 */

const fs = require('fs');

// Read the player bundle
const bundle = fs.readFileSync('source-testing/smashystream-player-bundle.js', 'utf8');

// Find the l array - it starts with l=['
const lStart = bundle.indexOf("l=['");
if (lStart === -1) {
  console.log('Could not find l array');
  process.exit(1);
}

console.log('Found l array at position:', lStart);

// Extract strings manually
const strings = [];
let pos = lStart + 3; // Skip "l=["
let current = '';
let inString = false;
let stringChar = '';
let escaped = false;
let depth = 1;

while (pos < bundle.length && depth > 0) {
  const char = bundle[pos];
  
  if (!inString) {
    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      current = '';
    } else if (char === ']') {
      depth--;
    } else if (char === '[') {
      depth++;
    }
  } else {
    if (escaped) {
      // Handle escape sequences
      if (char === 'n') current += '\n';
      else if (char === 'r') current += '\r';
      else if (char === 't') current += '\t';
      else if (char === 'x') {
        // Hex escape \xNN
        const hex = bundle.substring(pos + 1, pos + 3);
        current += String.fromCharCode(parseInt(hex, 16));
        pos += 2;
      } else if (char === 'u') {
        // Unicode escape \uNNNN
        const hex = bundle.substring(pos + 1, pos + 5);
        current += String.fromCharCode(parseInt(hex, 16));
        pos += 4;
      } else {
        current += char;
      }
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
  pos++;
}

console.log('Extracted', strings.length, 'strings');

// Now decode with CHARSET_2 (the m function charset used in onRuntimeInitialized)
const CHARSET_2 = 'A8CglIhpEO7,xSXz#Ji;dw~>n4DB(Y=3H_WUG$[5%/?a<K]V}F^o6vNf&PkqM|u0Tj@me1ZRQLc+)rt!sby:2`{".9*';

function utf8Decode(bytes) {
  const result = [];
  for (let i = 0; i < bytes.length;) {
    let byte = bytes[i++], codePoint;
    if (byte <= 127) codePoint = byte;
    else if (byte <= 223) codePoint = (byte & 31) << 6 | bytes[i++] & 63;
    else if (byte <= 239) codePoint = (byte & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
    else codePoint = (byte & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
    if (codePoint > 0x10FFFF) return '[INVALID:' + codePoint + ']';
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
    console.log(`  raw: "${strings[idx].substring(0, 50)}..."`);
  } else {
    console.log(`[${idx}]: OUT OF RANGE (only ${strings.length} strings)`);
  }
}

// Also show strings around 126-142 with CHARSET_1 (the h function charset)
const CHARSET_1 = 'neIHlhigVfNbPdxA9{"a8wR]zWX@UZst26.7MYuo_j,pBTyS$JqCK^4O;}FG3Dv*+mcEQk=r0&[1!#5()~%?<:/`|>L';

console.log('\n=== STRINGS 126-142 (decoded with CHARSET_1) ===\n');
for (let idx = 126; idx <= 142; idx++) {
  if (idx < strings.length) {
    const decoded = decode91(strings[idx], CHARSET_1);
    console.log(`[${idx}]: "${decoded}"`);
  }
}
