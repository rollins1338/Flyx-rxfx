/**
 * CDN-Live.tv Decoder v6 - Fixed offset parameter
 * 
 * The eval call is: eval(function(h,u,n,t,e,r){...}('...',43,'njcHQxRAP',38,3,44))
 * Parameters: h=encoded, u=43, n=charset, t=38 (offset!), e=3 (delimiter), r=44
 * The decode uses: String.fromCharCode(_0xe48c(s,e,10)-t)
 * So offset is 't' (38), not 'r' (44)
 */

const fs = require('fs');

const html = fs.readFileSync('source-testing/cdn-player-espn.html', 'utf-8');

// Find the script
const scriptStart = html.indexOf('<script>var _0x');
const scriptEnd = html.indexOf('</script>', scriptStart);
const script = html.substring(scriptStart + 8, scriptEnd);

// The base conversion function
const BASE_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

function baseConvert(d, e, f) {
  const g = BASE_CHARSET.split('');
  const h = g.slice(0, e);
  const i = g.slice(0, f);
  
  let j = d.split('').reverse().reduce((a, b, c) => {
    const idx = h.indexOf(b);
    if (idx !== -1) {
      return a + idx * Math.pow(e, c);
    }
    return a;
  }, 0);
  
  let k = '';
  while (j > 0) {
    k = i[j % f] + k;
    j = Math.floor(j / f);
  }
  return k || '0';
}

// Extract parameters: ",43,"njcHQxRAP",38,3,44))
// Format: ",u,"n",t,e,r))
const endMatch = script.match(/",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)$/);
const u = parseInt(endMatch[1]);      // 43
const charset = endMatch[2];          // njcHQxRAP
const t = parseInt(endMatch[3]);      // 38 - THIS IS THE OFFSET!
const e = parseInt(endMatch[4]);      // 3 - delimiter index
const r = parseInt(endMatch[5]);      // 44

console.log('Parameters:');
console.log('  u:', u);
console.log('  charset (n):', charset);
console.log('  t (offset):', t);
console.log('  e (delimiter index):', e);
console.log('  r:', r);
console.log('  delimiter char:', charset[e]);

// Find the encoded data
const evalIdx = script.indexOf('eval(function(h,u,n,t,e,r)');
const dataStartIdx = script.indexOf('("', evalIdx) + 2;
const dataEndIdx = script.lastIndexOf('",');
const encoded = script.substring(dataStartIdx, dataEndIdx);

console.log('Encoded data length:', encoded.length);

function decode(h, n, t, e) {
  const delimiter = n[e];
  let result = '';
  let i = 0;
  
  while (i < h.length) {
    let s = '';
    while (i < h.length && h[i] !== delimiter) {
      s += h[i];
      i++;
    }
    i++;
    
    // Replace charset chars with their indices
    for (let j = 0; j < n.length; j++) {
      s = s.split(n[j]).join(j.toString());
    }
    
    // Convert from base e to base 10, subtract offset t
    const charCode = parseInt(baseConvert(s, e, 10)) - t;
    result += String.fromCharCode(charCode);
  }
  
  try {
    return decodeURIComponent(escape(result));
  } catch {
    return result;
  }
}

console.log('\n=== Decoding with t as offset ===');
const decoded = decode(encoded, charset, t, e);
console.log('Decoded length:', decoded.length);
console.log('\nFirst 1500 chars:');
console.log(decoded.substring(0, 1500));

// Validation
console.log('\n=== Validation ===');
console.log('Contains function:', decoded.includes('function'));
console.log('Contains const:', decoded.includes('const'));
console.log('Contains OPlayer:', decoded.includes('OPlayer'));
console.log('Contains playlistUrl:', decoded.includes('playlistUrl'));
console.log('Contains m3u8:', decoded.includes('m3u8'));

// Look for m3u8 URLs
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

// Save decoded
fs.writeFileSync('source-testing/cdn-decoded-espn.js', decoded);
console.log('\nSaved to cdn-decoded-espn.js');
