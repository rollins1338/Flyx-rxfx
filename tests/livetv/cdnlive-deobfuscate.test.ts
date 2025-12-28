/**
 * CDN Live JavaScript Deobfuscation
 * 
 * Reverse engineering the obfuscated player script to extract m3u8 URLs
 */

import { describe, test, expect } from 'bun:test';

const CDN_LIVE_BASE = 'https://cdn-live.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * The obfuscated script uses a custom base conversion decoder.
 * This is the _0xe66c function from the script:
 * 
 * var _0xc69e=["","split","0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/","slice","indexOf","","",".","pow","reduce","reverse","0"];
 * function _0xe66c(d,e,f){
 *   var g=_0xc69e[2][_0xc69e[1]](_0xc69e[0]); // "0123456789...+/".split("")
 *   var h=g[_0xc69e[3]](0,e); // g.slice(0,e) - source alphabet
 *   var i=g[_0xc69e[3]](0,f); // g.slice(0,f) - target alphabet
 *   var j=d[_0xc69e[1]](_0xc69e[0])[_0xc69e[10]]()[_0xc69e[9]](function(a,b,c){
 *     if(h[_0xc69e[4]](b)!==-1) return a+=h[_0xc69e[4]](b)*(Math[_0xc69e[8]](e,c))
 *   },0); // Convert from base e to decimal
 *   var k=_0xc69e[0];
 *   while(j>0){k=i[j%f]+k;j=(j-(j%f))/f} // Convert from decimal to base f
 *   return k||_0xc69e[11]
 * }
 */

// Base64-like alphabet used by the obfuscator
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/';

/**
 * Custom base conversion function (reverse engineered from _0xe66c)
 */
function baseConvert(str: string, fromBase: number, toBase: number): string {
  const sourceAlphabet = ALPHABET.slice(0, fromBase);
  const targetAlphabet = ALPHABET.slice(0, toBase);
  
  // Convert from source base to decimal
  let decimal = 0;
  const chars = str.split('').reverse();
  for (let i = 0; i < chars.length; i++) {
    const index = sourceAlphabet.indexOf(chars[i]);
    if (index !== -1) {
      decimal += index * Math.pow(fromBase, i);
    }
  }
  
  // Convert from decimal to target base
  let result = '';
  while (decimal > 0) {
    result = targetAlphabet[decimal % toBase] + result;
    decimal = Math.floor(decimal / toBase);
  }
  
  return result || '0';
}

/**
 * Decode the obfuscated string
 * 
 * The eval function does:
 * eval(function(h,u,n,t,e,r){
 *   r="";
 *   for(var i=0,len=h.length;i<len;i++){
 *     var s="";
 *     while(h[i]!==n[e]){s+=h[i];i++}  // Read until delimiter (n[e])
 *     for(var j=0;j<n.length;j++) s=s.replace(new RegExp(n[j],"g"),j);  // Replace chars with indices
 *     r+=String.fromCharCode(_0xe66c(s,e,10)-t)  // Convert and get char code
 *   }
 *   return decodeURIComponent(escape(r))
 * }("ENCODED_STRING", u, "ALPHABET", OFFSET, BASE, r))
 */
function decodeObfuscatedScript(encoded: string, alphabet: string, offset: number, base: number): string {
  let result = '';
  let i = 0;
  const delimiter = alphabet[base];
  
  while (i < encoded.length) {
    let segment = '';
    
    // Read until we hit the delimiter
    while (i < encoded.length && encoded[i] !== delimiter) {
      segment += encoded[i];
      i++;
    }
    i++; // Skip the delimiter
    
    if (segment.length > 0) {
      // Replace each character in alphabet with its index
      let numStr = segment;
      for (let j = 0; j < alphabet.length; j++) {
        numStr = numStr.split(alphabet[j]).join(j.toString());
      }
      
      // Convert from base to decimal and subtract offset to get char code
      const decimal = parseInt(baseConvert(numStr, base, 10), 10) || 0;
      const charCode = decimal - offset;
      
      if (charCode > 0 && charCode < 65536) {
        result += String.fromCharCode(charCode);
      }
    }
  }
  
  try {
    return decodeURIComponent(escape(result));
  } catch {
    return result;
  }
}

describe('CDN Live Deobfuscation', () => {
  test('should fetch and extract obfuscated script', async () => {
    const playerUrl = `${CDN_LIVE_BASE}/api/v1/channels/player/?name=espn&code=us&user=cdnlivetv&plan=free`;
    
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    expect(response.ok).toBe(true);
    const html = await response.text();
    
    // Extract the obfuscated script
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let obfuscatedScript = '';
    
    while ((match = scriptPattern.exec(html)) !== null) {
      const content = match[1].trim();
      if (content.includes('_0xc') && content.includes('eval(function')) {
        obfuscatedScript = content;
        break;
      }
    }
    
    expect(obfuscatedScript.length).toBeGreaterThan(0);
    console.log(`Found obfuscated script: ${obfuscatedScript.length} chars`);
    
    // Extract the eval parameters
    // Pattern: eval(function(h,u,n,t,e,r){...}("ENCODED", u, "ALPHABET", OFFSET, BASE, r))
    const evalPattern = /eval\(function\(h,u,n,t,e,r\)\{[^}]+\}\("([^"]+)",\s*\d+,\s*"([^"]+)",\s*(\d+),\s*(\d+),\s*\d+\)\)/;
    const evalMatch = obfuscatedScript.match(evalPattern);
    
    if (evalMatch) {
      const [, encoded, alphabet, offsetStr, baseStr] = evalMatch;
      const offset = parseInt(offsetStr, 10);
      const base = parseInt(baseStr, 10);
      
      console.log(`\nExtracted parameters:`);
      console.log(`  Alphabet: ${alphabet}`);
      console.log(`  Offset: ${offset}`);
      console.log(`  Base: ${base}`);
      console.log(`  Encoded length: ${encoded.length}`);
      console.log(`  Encoded preview: ${encoded.substring(0, 100)}...`);
      
      // Decode the script
      const decoded = decodeObfuscatedScript(encoded, alphabet, offset, base);
      console.log(`\nDecoded script length: ${decoded.length}`);
      console.log(`\nDecoded script preview:\n${decoded.substring(0, 2000)}`);
      
      // Look for m3u8 URLs in decoded script
      const m3u8Pattern = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi;
      const m3u8Matches = decoded.match(m3u8Pattern);
      if (m3u8Matches) {
        console.log(`\n*** FOUND M3U8 URLs: ***`);
        m3u8Matches.forEach(url => console.log(`  ${url}`));
      }
      
      // Look for stream-related variables
      const streamVarPattern = /(?:source|stream|url|src|file)\s*[:=]\s*["']([^"']+)["']/gi;
      let streamMatch;
      console.log(`\nStream-related assignments:`);
      while ((streamMatch = streamVarPattern.exec(decoded)) !== null) {
        console.log(`  ${streamMatch[0]}`);
      }
    } else {
      console.log('Could not extract eval parameters with standard pattern');
      
      // Try alternative extraction
      // Look for the encoded string directly
      const encodedPattern = /\("([A-Za-z]+)",\s*\d+,\s*"([A-Za-z]+)",\s*(\d+),\s*(\d+)/;
      const altMatch = obfuscatedScript.match(encodedPattern);
      
      if (altMatch) {
        console.log('Found alternative pattern');
        console.log(`  Encoded preview: ${altMatch[1].substring(0, 50)}`);
        console.log(`  Alphabet: ${altMatch[2]}`);
        console.log(`  Offset: ${altMatch[3]}`);
        console.log(`  Base: ${altMatch[4]}`);
      }
    }
  });
  
  test('should analyze the obfuscation pattern more deeply', async () => {
    const playerUrl = `${CDN_LIVE_BASE}/api/v1/channels/player/?name=abc&code=us&user=cdnlivetv&plan=free`;
    
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    const html = await response.text();
    
    // Find the script with the obfuscation
    const scriptPattern = /<script[^>]*>(var _0x[^<]+)<\/script>/i;
    const scriptMatch = html.match(scriptPattern);
    
    if (!scriptMatch) {
      console.log('No obfuscated script found');
      return;
    }
    
    const script = scriptMatch[1];
    console.log(`Script length: ${script.length}`);
    
    // Extract the array definition
    const arrayPattern = /var (_0x[a-f0-9]+)=\[([^\]]+)\]/;
    const arrayMatch = script.match(arrayPattern);
    
    if (arrayMatch) {
      console.log(`\nArray variable: ${arrayMatch[1]}`);
      const arrayContent = arrayMatch[2];
      const elements = arrayContent.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      console.log(`Array elements (${elements.length}):`);
      elements.forEach((el, i) => console.log(`  [${i}]: "${el.substring(0, 50)}${el.length > 50 ? '...' : ''}"`));
    }
    
    // Extract the function definition
    const funcPattern = /function (_0x[a-f0-9]+)\(([^)]+)\)\{([^}]+)\}/;
    const funcMatch = script.match(funcPattern);
    
    if (funcMatch) {
      console.log(`\nFunction: ${funcMatch[1]}(${funcMatch[2]})`);
    }
    
    // Extract the eval call more carefully
    const evalStartIndex = script.indexOf('eval(function');
    if (evalStartIndex !== -1) {
      // Find the matching closing parenthesis
      let depth = 0;
      let evalEnd = evalStartIndex;
      let inString = false;
      let stringChar = '';
      
      for (let i = evalStartIndex; i < script.length; i++) {
        const char = script[i];
        
        if (!inString) {
          if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
          } else if (char === '(') {
            depth++;
          } else if (char === ')') {
            depth--;
            if (depth === 0) {
              evalEnd = i + 1;
              break;
            }
          }
        } else {
          if (char === stringChar && script[i-1] !== '\\') {
            inString = false;
          }
        }
      }
      
      const evalCall = script.substring(evalStartIndex, evalEnd);
      console.log(`\nEval call length: ${evalCall.length}`);
      
      // Extract the inner function body
      const innerFuncPattern = /eval\(function\(([^)]+)\)\{([\s\S]+?)\}\(/;
      const innerMatch = evalCall.match(innerFuncPattern);
      
      if (innerMatch) {
        console.log(`\nInner function params: ${innerMatch[1]}`);
        console.log(`Inner function body:\n${innerMatch[2]}`);
      }
      
      // Extract the arguments to the eval function
      // They come after the function definition
      const argsStartIndex = evalCall.lastIndexOf('}(');
      if (argsStartIndex !== -1) {
        const argsStr = evalCall.substring(argsStartIndex + 2, evalCall.length - 2);
        console.log(`\nArguments string: ${argsStr.substring(0, 200)}...`);
        
        // Parse the arguments
        // Format: "ENCODED_STRING", number, "ALPHABET", number, number, number
        const argsPattern = /"([^"]+)",\s*(\d+),\s*"([^"]+)",\s*(\d+),\s*(\d+),\s*(\d+)/;
        const argsMatch = argsStr.match(argsPattern);
        
        if (argsMatch) {
          const [, encoded, u, alphabet, t, e, r] = argsMatch;
          console.log(`\nParsed arguments:`);
          console.log(`  h (encoded): ${encoded.substring(0, 100)}... (${encoded.length} chars)`);
          console.log(`  u: ${u}`);
          console.log(`  n (alphabet): ${alphabet}`);
          console.log(`  t (offset): ${t}`);
          console.log(`  e (base): ${e}`);
          console.log(`  r: ${r}`);
          
          // Now decode!
          const offset = parseInt(t, 10);
          const base = parseInt(e, 10);
          
          console.log(`\nAttempting decode with offset=${offset}, base=${base}...`);
          const decoded = decodeObfuscatedScript(encoded, alphabet, offset, base);
          
          console.log(`\nDecoded length: ${decoded.length}`);
          if (decoded.length > 0) {
            console.log(`\n=== DECODED SCRIPT ===\n${decoded.substring(0, 3000)}`);
            
            // Search for URLs
            const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
            const urls = decoded.match(urlPattern);
            if (urls) {
              console.log(`\n=== FOUND URLs ===`);
              urls.forEach(url => console.log(`  ${url}`));
            }
          }
        }
      }
    }
  });
});
