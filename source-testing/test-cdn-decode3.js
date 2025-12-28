/**
 * CDN-Live.tv Decoder v3 - Working version
 */

const fs = require('fs');

const html = fs.readFileSync('source-testing/cdn-player-espn.html', 'utf-8');

// Find the script
const scriptStart = html.indexOf('<script>var _0x');
const scriptEnd = html.indexOf('</script>', scriptStart);
const script = html.substring(scriptStart + 8, scriptEnd);

console.log('Script length:', script.length);

// Find the eval function
const evalIdx = script.indexOf('eval(function(h,u,n,t,e,r)');
console.log('Eval at:', evalIdx);

// Extract parameters from the end: ",43,"njcHQxRAP",38,3,44))
const endMatch = script.match(/",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)$/);
if (!endMatch) {
  console.log('Could not find end parameters');
  process.exit(1);
}

const u = parseInt(endMatch[1]);
const charset = endMatch[2];
const base = parseInt(endMatch[3]);
const e = parseInt(endMatch[4]);
const offset = parseInt(endMatch[5]);

console.log('Parameters:');
console.log('  u:', u);
console.log('  charset:', charset);
console.log('  base:', base);
console.log('  e (delimiter index):', e);
console.log('  offset:', offset);
console.log('  delimiter char:', charset[e]);

// Find the encoded data
const dataStartIdx = script.indexOf('("', evalIdx) + 2;
const dataEndIdx = script.lastIndexOf('",');
const encoded = script.substring(dataStartIdx, dataEndIdx);

console.log('Encoded data length:', encoded.length);
console.log('First 100 chars:', encoded.substring(0, 100));

// The decode function
// h = encoded data
// n = charset
// e = delimiter index (the character at n[e] is the delimiter)
// t = offset to subtract from char codes
function decode(h, n, e, t) {
  const delimiter = n[e];
  let r = '';
  let i = 0;
  
  while (i < h.length) {
    let s = '';
    // Read until we hit the delimiter
    while (i < h.length && h[i] !== delimiter) {
      s += h[i];
      i++;
    }
    i++; // Skip the delimiter
    
    // Replace each charset character with its index
    for (let j = 0; j < n.length; j++) {
      s = s.split(n[j]).join(j.toString());
    }
    
    // Convert from base 'e' to decimal and subtract offset
    // Wait, 'e' is the delimiter index, not the base!
    // The base is actually the 'base' parameter (38 in this case)
    // But we're using 'e' as the base for parseInt... that's wrong
    
    // Actually looking at the original function:
    // function(h,u,n,t,e,r) where:
    // h = encoded data
    // u = some number (43)
    // n = charset
    // t = base (38)
    // e = delimiter index (3)
    // r = offset (44)
    
    // So we should use 'e' (3) as the base for the number system
    const charCode = parseInt(s, e) - t;
    r += String.fromCharCode(charCode);
  }
  
  return r;
}

// Try decoding with e as the base
console.log('\n=== Trying with e as base ===');
const decoded1 = decode(encoded, charset, e, offset);
console.log('Decoded length:', decoded1.length);
console.log('First 500 chars:', decoded1.substring(0, 500));

// Check if it looks like valid JS
const hasFunction = decoded1.includes('function');
const hasConst = decoded1.includes('const');
const hasVar = decoded1.includes('var');
console.log('Contains function:', hasFunction);
console.log('Contains const:', hasConst);
console.log('Contains var:', hasVar);

// Look for m3u8
const m3u8Match = decoded1.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
if (m3u8Match) {
  console.log('\n=== M3U8 URLs ===');
  m3u8Match.forEach(u => console.log(u));
}

// Look for playlistUrl
const playlistMatch = decoded1.match(/playlistUrl\s*[=:]\s*["']([^"']+)["']/);
if (playlistMatch) {
  console.log('\n=== playlistUrl ===');
  console.log(playlistMatch[1]);
}

// Save decoded
fs.writeFileSync('source-testing/cdn-decoded-espn.js', decoded1);
console.log('\nSaved to cdn-decoded-espn.js');
