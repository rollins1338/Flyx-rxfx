/**
 * cdn-live.tv Decoder v2
 * Properly decodes the obfuscated JavaScript
 */

const fs = require('fs');

// The base conversion function (same as in the obfuscated code)
const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

function baseConvert(d, e, f) {
  const g = charset.split('');
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

// The main decoder
function decode(encodedData, u, n, base, e, offset) {
  let result = '';
  let i = 0;
  
  while (i < encodedData.length) {
    let s = '';
    // Read until we hit the delimiter character (n[e])
    while (i < encodedData.length && encodedData[i] !== n[e]) {
      s += encodedData[i];
      i++;
    }
    i++; // Skip the delimiter
    
    // Replace each character in the charset with its index
    for (let j = 0; j < n.length; j++) {
      s = s.split(n[j]).join(j.toString());
    }
    
    // Convert from base 'e' to base 10, then subtract offset
    const charCode = parseInt(baseConvert(s, e, 10)) - offset;
    result += String.fromCharCode(charCode);
  }
  
  return result;
}

// Read and decode the player HTML
function decodePlayerFile(filename) {
  const html = fs.readFileSync(filename, 'utf-8');
  
  // Find the obfuscated script
  const scriptStart = html.indexOf('var _0xc');
  if (scriptStart === -1) {
    console.log('No obfuscated script found');
    return null;
  }
  
  const scriptEnd = html.indexOf('</script>', scriptStart);
  const script = html.substring(scriptStart, scriptEnd);
  
  console.log('Script length:', script.length);
  
  // Extract parameters from the end: ",51,"qYnkafhvw",12,5,50))"
  const paramsMatch = script.match(/",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)$/);
  if (!paramsMatch) {
    console.log('Could not find parameters');
    return null;
  }
  
  const u = parseInt(paramsMatch[1]);
  const n = paramsMatch[2]; // charset for this encoding
  const base = parseInt(paramsMatch[3]);
  const e = parseInt(paramsMatch[4]);
  const offset = parseInt(paramsMatch[5]);
  
  console.log('Parameters:');
  console.log('  u:', u);
  console.log('  charset (n):', n);
  console.log('  base:', base);
  console.log('  e:', e);
  console.log('  offset:', offset);
  
  // Find the encoded data - it's between ("..." and the parameters
  const evalStart = script.indexOf('eval(function(h,u,n,t,e,r)');
  const dataStart = script.indexOf('("', evalStart) + 2;
  const dataEnd = script.lastIndexOf('",');
  const encodedData = script.substring(dataStart, dataEnd);
  
  console.log('Encoded data length:', encodedData.length);
  console.log('First 100 chars:', encodedData.substring(0, 100));
  
  // Decode
  const decoded = decode(encodedData, u, n, base, e, offset);
  
  return decoded;
}

// Main
const decoded = decodePlayerFile('cdn-player-ABC.html');
if (decoded) {
  fs.writeFileSync('cdn-decoded-v2.js', decoded);
  console.log('\nDecoded length:', decoded.length);
  console.log('\n=== First 3000 chars of decoded ===\n');
  console.log(decoded.substring(0, 3000));
  
  // Look for stream URL patterns
  console.log('\n=== Looking for stream patterns ===\n');
  
  // playlistUrl
  const playlistMatch = decoded.match(/playlistUrl\s*[=:]\s*["'`]([^"'`]+)["'`]/i);
  if (playlistMatch) {
    console.log('playlistUrl:', playlistMatch[1]);
  }
  
  // src in source object
  const srcMatch = decoded.match(/src\s*:\s*["'`]([^"'`]+)["'`]/gi);
  if (srcMatch) {
    console.log('src patterns:', srcMatch);
  }
  
  // Any m3u8 URLs
  const m3u8Match = decoded.match(/https?:\/\/[^\s"'`]+\.m3u8[^\s"'`]*/gi);
  if (m3u8Match) {
    console.log('m3u8 URLs:', m3u8Match);
  }
  
  // edge.cdn-live.tv URLs
  const edgeMatch = decoded.match(/https?:\/\/edge[^\s"'`]+/gi);
  if (edgeMatch) {
    console.log('edge URLs:', edgeMatch);
  }
  
  // Any URLs with token
  const tokenMatch = decoded.match(/https?:\/\/[^\s"'`]*token[^\s"'`]*/gi);
  if (tokenMatch) {
    console.log('token URLs:', tokenMatch);
  }
}
