/**
 * CDN-Live.tv Decoder v4 - Proper implementation
 */

const fs = require('fs');

const html = fs.readFileSync('source-testing/cdn-player-espn.html', 'utf-8');

// Find the script
const scriptStart = html.indexOf('<script>var _0x');
const scriptEnd = html.indexOf('</script>', scriptStart);
const script = html.substring(scriptStart + 8, scriptEnd);

console.log('Script length:', script.length);

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
const evalIdx = script.indexOf('eval(function(h,u,n,t,e,r)');
const dataStartIdx = script.indexOf('("', evalIdx) + 2;
const dataEndIdx = script.lastIndexOf('",');
const encoded = script.substring(dataStartIdx, dataEndIdx);

console.log('Encoded data length:', encoded.length);

// The decode function from the obfuscated code:
// eval(function(h,u,n,t,e,r){
//   r="";
//   for(var i=0,len=h.length;i<len;i++){
//     var s="";
//     while(h[i]!==n[e]){s+=h[i];i++}
//     for(var j=0;j<n.length;j++)s=s.replace(new RegExp(n[j],"g"),j);
//     r+=String.fromCharCode(_0xe48c(s,e,10)-t)
//   }
//   return decodeURIComponent(escape(r))
// }("...",43,"njcHQxRAP",38,3,44))

function decode(h, n, t, e) {
  // h = encoded data
  // n = charset for encoding
  // t = offset to subtract
  // e = delimiter index in charset
  
  const delimiter = n[e];
  let r = '';
  let i = 0;
  
  while (i < h.length) {
    let s = '';
    // Read until delimiter
    while (i < h.length && h[i] !== delimiter) {
      s += h[i];
      i++;
    }
    i++; // Skip delimiter
    
    // Replace each charset character with its index
    for (let j = 0; j < n.length; j++) {
      s = s.split(n[j]).join(j.toString());
    }
    
    // Convert from base e to base 10, then subtract offset
    const charCode = parseInt(baseConvert(s, e, 10)) - t;
    r += String.fromCharCode(charCode);
  }
  
  try {
    return decodeURIComponent(escape(r));
  } catch {
    return r;
  }
}

console.log('\n=== Decoding ===');
const decoded = decode(encoded, charset, offset, e);
console.log('Decoded length:', decoded.length);
console.log('\nFirst 1000 chars:');
console.log(decoded.substring(0, 1000));

// Check if it looks like valid JS
console.log('\n=== Validation ===');
console.log('Contains function:', decoded.includes('function'));
console.log('Contains const:', decoded.includes('const'));
console.log('Contains var:', decoded.includes('var'));
console.log('Contains OPlayer:', decoded.includes('OPlayer'));
console.log('Contains playlistUrl:', decoded.includes('playlistUrl'));

// Look for m3u8
const m3u8Match = decoded.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
if (m3u8Match) {
  console.log('\n=== M3U8 URLs ===');
  m3u8Match.forEach(u => console.log(u));
}

// Look for playlistUrl
const playlistMatch = decoded.match(/playlistUrl\s*[=:]\s*["']([^"']+)["']/);
if (playlistMatch) {
  console.log('\n=== playlistUrl ===');
  console.log(playlistMatch[1]);
}

// Look for src:
const srcMatch = decoded.match(/src\s*:\s*["']([^"']+)["']/);
if (srcMatch) {
  console.log('\n=== src ===');
  console.log(srcMatch[1]);
}

// Save decoded
fs.writeFileSync('source-testing/cdn-decoded-espn.js', decoded);
console.log('\nSaved to cdn-decoded-espn.js');
