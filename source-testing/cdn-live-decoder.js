/**
 * cdn-live.tv Stream URL Decoder
 * 
 * This script decodes the obfuscated JavaScript from cdn-live.tv player pages
 * to extract the actual m3u8 stream URLs.
 */

// The decoder function from cdn-live.tv (deobfuscated)
const _0xc71e = ["", "split", "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/", "slice", "indexOf", "", "", ".", "pow", "reduce", "reverse", "0"];

function _0xe63c(d, e, f) {
  const g = _0xc71e[2].split(_0xc71e[0]); // "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/".split("")
  const h = g.slice(0, e);
  const i = g.slice(0, f);
  let j = d.split(_0xc71e[0]).reverse().reduce(function(a, b, c) {
    if (h.indexOf(b) !== -1) {
      return a + h.indexOf(b) * (Math.pow(e, c));
    }
    return a;
  }, 0);
  let k = _0xc71e[0];
  while (j > 0) {
    k = i[j % f] + k;
    j = (j - (j % f)) / f;
  }
  return k || _0xc71e[11];
}

// The main decoder function
function decode(h, u, n, t, e, r) {
  r = "";
  for (let i = 0, len = h.length; i < len; i++) {
    let s = "";
    while (h[i] !== n[e]) {
      s += h[i];
      i++;
    }
    for (let j = 0; j < n.length; j++) {
      s = s.replace(new RegExp(n[j], "g"), j);
    }
    const charCode = _0xe63c(s, e, 10) - t;
    r += String.fromCharCode(charCode);
  }
  // Try to decode URI, but return raw if it fails
  try {
    return decodeURIComponent(escape(r));
  } catch (e) {
    return r;
  }
}

// Test with the encoded data from cdn-live-player.html
async function testDecode() {
  const fs = require('fs');
  
  // Read the player HTML
  const html = fs.readFileSync('cdn-live-player.html', 'utf-8');
  
  // Extract the encoded payload and parameters from the eval() call
  // The format is: eval(function(h,u,n,t,e,r){...}("ENCODED",72,"CHARSET",36,4,44))
  // We need to find the closing pattern: ",72,"IKzuXTkxf",36,4,44))"
  
  // Find the start of encoded data (after the function definition)
  const funcStart = html.indexOf('eval(function(h,u,n,t,e,r)');
  if (funcStart === -1) {
    console.log('Could not find eval function');
    return;
  }
  
  // Find the opening quote of the encoded data
  const dataStart = html.indexOf('("', funcStart) + 2;
  
  // Find the closing pattern - look for ",NUMBER,"CHARSET",NUMBER,NUMBER,NUMBER))"
  const closingPattern = /",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)/;
  const remaining = html.substring(dataStart);
  const closingMatch = remaining.match(closingPattern);
  
  if (!closingMatch) {
    console.log('Could not find closing pattern');
    return;
  }
  
  const encodedData = remaining.substring(0, closingMatch.index);
  const u = parseInt(closingMatch[1]);
  const charset = closingMatch[2];
  const base = parseInt(closingMatch[3]);
  const e = parseInt(closingMatch[4]);
  const offset = parseInt(closingMatch[5]);
  
  console.log('Found encoded data!');
  console.log('U:', u);
  console.log('Charset:', charset);
  console.log('Base:', base);
  console.log('E:', e);
  console.log('Offset:', offset);
  console.log('Encoded length:', encodedData.length);
  
  // Decode it
  try {
    const decoded = decode(encodedData, u, charset, offset, e);
    console.log('\n=== DECODED JAVASCRIPT ===\n');
    console.log(decoded.substring(0, 5000));
    
    // Look for m3u8 URLs in the decoded content
    const m3u8Match = decoded.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
    if (m3u8Match) {
      console.log('\n=== FOUND M3U8 URLs ===');
      m3u8Match.forEach(url => console.log(url));
    }
    
    // Look for source/src assignments
    const srcMatch = decoded.match(/(?:source|src|file|url)\s*[=:]\s*["']([^"']+)["']/gi);
    if (srcMatch) {
      console.log('\n=== FOUND SOURCE ASSIGNMENTS ===');
      srcMatch.forEach(s => console.log(s));
    }
    
    // Look for any URLs
    const allUrls = decoded.match(/https?:\/\/[^"'\s<>]+/gi);
    if (allUrls) {
      console.log('\n=== ALL URLs FOUND ===');
      [...new Set(allUrls)].forEach(url => console.log(url));
    }
    
    // Save decoded content
    fs.writeFileSync('cdn-live-decoded.js', decoded);
    console.log('\nDecoded content saved to cdn-live-decoded.js');
  } catch (err) {
    console.error('Decode error:', err.message);
  }
}

testDecode();
