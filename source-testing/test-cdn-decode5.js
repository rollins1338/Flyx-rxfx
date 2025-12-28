/**
 * CDN-Live.tv Decoder v5 - Debug version
 */

const fs = require('fs');

const html = fs.readFileSync('source-testing/cdn-player-espn.html', 'utf-8');

// Find the script
const scriptStart = html.indexOf('<script>var _0x');
const scriptEnd = html.indexOf('</script>', scriptStart);
const script = html.substring(scriptStart + 8, scriptEnd);

// The base conversion function (deobfuscated from _0xe48c)
const BASE_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

function baseConvert(d, e, f) {
  const g = BASE_CHARSET.split('');
  const h = g.slice(0, e);
  const i = g.slice(0, f);
  
  // Convert from base e to decimal
  let j = d.split('').reverse().reduce((a, b, c) => {
    const idx = h.indexOf(b);
    if (idx !== -1) {
      return a + idx * Math.pow(e, c);
    }
    return a;
  }, 0);
  
  // Convert from decimal to base f
  let k = '';
  while (j > 0) {
    k = i[j % f] + k;
    j = Math.floor(j / f);
  }
  return k || '0';
}

// Extract parameters
const endMatch = script.match(/",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)$/);
const u = parseInt(endMatch[1]);
const charset = endMatch[2];
const base = parseInt(endMatch[3]);
const e = parseInt(endMatch[4]);
const offset = parseInt(endMatch[5]);

console.log('charset:', charset);
console.log('e (delimiter index):', e);
console.log('offset:', offset);
console.log('delimiter:', charset[e]);

// Find the encoded data
const evalIdx = script.indexOf('eval(function(h,u,n,t,e,r)');
const dataStartIdx = script.indexOf('("', evalIdx) + 2;
const dataEndIdx = script.lastIndexOf('",');
const encoded = script.substring(dataStartIdx, dataEndIdx);

// Let's trace through the first few characters
const delimiter = charset[e];
console.log('\n=== Tracing first few encoded segments ===');

let i = 0;
for (let count = 0; count < 10 && i < encoded.length; count++) {
  let s = '';
  while (i < encoded.length && encoded[i] !== delimiter) {
    s += encoded[i];
    i++;
  }
  i++; // Skip delimiter
  
  console.log(`\nSegment ${count}: "${s}"`);
  
  // Replace each charset character with its index
  let replaced = s;
  for (let j = 0; j < charset.length; j++) {
    replaced = replaced.split(charset[j]).join(j.toString());
  }
  console.log(`After replacement: "${replaced}"`);
  
  // Convert from base e to base 10
  const converted = baseConvert(replaced, e, 10);
  console.log(`After base convert (base ${e} to 10): "${converted}"`);
  
  const charCode = parseInt(converted) - offset;
  console.log(`Char code (${converted} - ${offset}): ${charCode}`);
  console.log(`Character: "${String.fromCharCode(charCode)}"`);
}

// The issue might be that we need to use the charset for the base conversion too
// Let's try a different approach - use the charset indices directly

console.log('\n\n=== Alternative approach ===');

function decode2(h, n, t, e) {
  const delimiter = n[e];
  let r = '';
  let i = 0;
  
  while (i < h.length) {
    let s = '';
    while (i < h.length && h[i] !== delimiter) {
      s += h[i];
      i++;
    }
    i++;
    
    // Replace charset chars with their indices
    let numStr = '';
    for (const char of s) {
      const idx = n.indexOf(char);
      if (idx !== -1) {
        numStr += idx.toString();
      } else {
        numStr += char;
      }
    }
    
    // Parse as base e number
    let num = 0;
    for (let j = 0; j < numStr.length; j++) {
      const digit = parseInt(numStr[j]);
      if (!isNaN(digit)) {
        num = num * e + digit;
      }
    }
    
    const charCode = num - t;
    r += String.fromCharCode(charCode);
  }
  
  return r;
}

const decoded2 = decode2(encoded, charset, offset, e);
console.log('Decoded2 first 500 chars:');
console.log(decoded2.substring(0, 500));
console.log('\nContains function:', decoded2.includes('function'));
console.log('Contains const:', decoded2.includes('const'));
