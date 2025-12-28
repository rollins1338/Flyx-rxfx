/**
 * CDN Live Final Deobfuscation
 * 
 * Reverse engineering the obfuscated player script
 */

import { describe, test, expect } from 'bun:test';

const CDN_LIVE_BASE = 'https://cdn-live.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * The decoder function from the obfuscated script.
 * It converts a string from one base to another using a custom alphabet.
 */
function customBaseConvert(str: string, fromBase: number, toBase: number): string {
  // The full alphabet used
  const fullAlphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/';
  const sourceAlphabet = fullAlphabet.slice(0, fromBase);
  const targetAlphabet = fullAlphabet.slice(0, toBase);
  
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
  if (decimal === 0) return '0';
  
  let result = '';
  while (decimal > 0) {
    result = targetAlphabet[decimal % toBase] + result;
    decimal = Math.floor(decimal / toBase);
  }
  
  return result;
}

/**
 * Decode the obfuscated string using the extracted parameters
 * 
 * The eval function:
 * function(h,u,n,t,e,r){
 *   r="";
 *   for(var i=0,len=h.length;i<len;i++){
 *     var s="";
 *     while(h[i]!==n[e]){s+=h[i];i++}  // Read chars until delimiter n[e]
 *     for(var j=0;j<n.length;j++) s=s.replace(new RegExp(n[j],"g"),j);  // Replace alphabet chars with indices
 *     r+=String.fromCharCode(_0xe66c(s,e,10)-t)  // Convert base and get char
 *   }
 *   return decodeURIComponent(escape(r))
 * }
 * 
 * Parameters:
 * h = encoded string
 * u = unused
 * n = alphabet string (e.g., "WQGlaKpfM")
 * t = offset to subtract from char code
 * e = base for conversion
 * r = result accumulator
 */
function decodeScript(encoded: string, alphabet: string, offset: number, base: number): string {
  let result = '';
  let i = 0;
  const delimiter = alphabet[base]; // The character at index 'base' is the delimiter
  
  while (i < encoded.length) {
    let segment = '';
    
    // Read characters until we hit the delimiter
    while (i < encoded.length && encoded[i] !== delimiter) {
      segment += encoded[i];
      i++;
    }
    i++; // Skip the delimiter
    
    if (segment.length > 0) {
      // Replace each alphabet character with its index
      let numStr = '';
      for (const char of segment) {
        const idx = alphabet.indexOf(char);
        if (idx !== -1) {
          numStr += idx.toString();
        }
      }
      
      // Convert from base to decimal
      const decimal = parseInt(customBaseConvert(numStr, base, 10), 10);
      
      // Subtract offset to get the character code
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

/**
 * Alternative decoder - the numStr might already be in the right format
 */
function decodeScriptV2(encoded: string, alphabet: string, offset: number, base: number): string {
  let result = '';
  let i = 0;
  const delimiter = alphabet[base];
  
  while (i < encoded.length) {
    let segment = '';
    
    while (i < encoded.length && encoded[i] !== delimiter) {
      segment += encoded[i];
      i++;
    }
    i++;
    
    if (segment.length > 0) {
      // Replace alphabet chars with their indices to form a number string
      let numStr = segment;
      for (let j = 0; j < alphabet.length; j++) {
        const regex = new RegExp(alphabet[j].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        numStr = numStr.replace(regex, j.toString());
      }
      
      // Parse as base-N number and convert to decimal
      let decimal = 0;
      const digits = numStr.split('').reverse();
      for (let k = 0; k < digits.length; k++) {
        decimal += parseInt(digits[k], 10) * Math.pow(base, k);
      }
      
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

describe('CDN Live Final Decode', () => {
  test('should decode the obfuscated script', async () => {
    const playerUrl = `${CDN_LIVE_BASE}/api/v1/channels/player/?name=espn&code=us&user=cdnlivetv&plan=free`;
    
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    const html = await response.text();
    
    // Extract the full script content
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let fullScript = '';
    let match;
    
    while ((match = scriptPattern.exec(html)) !== null) {
      if (match[1].includes('eval(function')) {
        fullScript = match[1];
        break;
      }
    }
    
    console.log(`Full script length: ${fullScript.length}`);
    
    // Find the eval call and extract parameters
    // The pattern is: eval(function(h,u,n,t,e,r){...}("ENCODED",u,"ALPHABET",t,e,r))
    
    // First, find where the encoded string starts
    const evalIndex = fullScript.indexOf('eval(function');
    const argsStart = fullScript.indexOf('}("', evalIndex);
    
    if (argsStart === -1) {
      console.log('Could not find args start');
      return;
    }
    
    // Extract from after }(" to the end
    const argsSection = fullScript.substring(argsStart + 3);
    
    // Find the encoded string (ends with ",)
    let encodedEnd = 0;
    let depth = 0;
    let inQuote = true;
    
    for (let i = 0; i < argsSection.length; i++) {
      const char = argsSection[i];
      if (inQuote) {
        if (char === '"' && argsSection[i-1] !== '\\') {
          encodedEnd = i;
          break;
        }
      }
    }
    
    const encoded = argsSection.substring(0, encodedEnd);
    console.log(`Encoded string length: ${encoded.length}`);
    console.log(`Encoded preview: ${encoded.substring(0, 200)}`);
    
    // Now find the other parameters after the encoded string
    const afterEncoded = argsSection.substring(encodedEnd + 1);
    // Pattern: ,u,"ALPHABET",t,e,r)
    const paramsPattern = /,\s*(\d+),\s*"([^"]+)",\s*(\d+),\s*(\d+),\s*(\d+)\)/;
    const paramsMatch = afterEncoded.match(paramsPattern);
    
    if (!paramsMatch) {
      console.log('Could not extract parameters');
      console.log(`After encoded: ${afterEncoded.substring(0, 100)}`);
      return;
    }
    
    const [, u, alphabet, t, e, r] = paramsMatch;
    console.log(`\nParameters:`);
    console.log(`  u: ${u}`);
    console.log(`  alphabet: ${alphabet}`);
    console.log(`  t (offset): ${t}`);
    console.log(`  e (base): ${e}`);
    console.log(`  r: ${r}`);
    
    const offset = parseInt(t, 10);
    const base = parseInt(e, 10);
    
    // Try decoding
    console.log(`\n=== Attempting decode with V1 ===`);
    const decoded1 = decodeScript(encoded, alphabet, offset, base);
    console.log(`Decoded length: ${decoded1.length}`);
    if (decoded1.length > 0) {
      console.log(`First 1000 chars:\n${decoded1.substring(0, 1000)}`);
    }
    
    console.log(`\n=== Attempting decode with V2 ===`);
    const decoded2 = decodeScriptV2(encoded, alphabet, offset, base);
    console.log(`Decoded length: ${decoded2.length}`);
    if (decoded2.length > 0) {
      console.log(`First 1000 chars:\n${decoded2.substring(0, 1000)}`);
      
      // Search for m3u8 URLs
      const m3u8Pattern = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
      const m3u8Urls = decoded2.match(m3u8Pattern);
      if (m3u8Urls) {
        console.log(`\n*** FOUND M3U8 URLs ***`);
        m3u8Urls.forEach(url => console.log(`  ${url}`));
      }
      
      // Search for any URLs
      const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
      const allUrls = decoded2.match(urlPattern);
      if (allUrls) {
        console.log(`\n*** ALL URLs ***`);
        [...new Set(allUrls)].forEach(url => console.log(`  ${url}`));
      }
    }
  });
  
  test('should try direct character-by-character decode', async () => {
    const playerUrl = `${CDN_LIVE_BASE}/api/v1/channels/player/?name=abc&code=us&user=cdnlivetv&plan=free`;
    
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    const html = await response.text();
    
    // Find the script
    const scriptMatch = html.match(/<script[^>]*>(var _0x[\s\S]*?eval\([\s\S]*?\)\))<\/script>/i);
    if (!scriptMatch) {
      console.log('Script not found');
      return;
    }
    
    const script = scriptMatch[1];
    
    // Extract the encoded data more carefully
    // Look for the pattern: }("ENCODED",number,"ALPHABET",number,number,number))
    const fullPattern = /\}\("([^"]+)",(\d+),"([^"]+)",(\d+),(\d+),(\d+)\)\)/;
    const fullMatch = script.match(fullPattern);
    
    if (!fullMatch) {
      console.log('Full pattern not matched');
      
      // Try to find just the alphabet and numbers
      const simplePattern = /,(\d+),"([A-Za-z]+)",(\d+),(\d+),(\d+)\)\)/;
      const simpleMatch = script.match(simplePattern);
      if (simpleMatch) {
        console.log(`Found simple pattern:`);
        console.log(`  Alphabet: ${simpleMatch[2]}`);
        console.log(`  Numbers: ${simpleMatch[1]}, ${simpleMatch[3]}, ${simpleMatch[4]}, ${simpleMatch[5]}`);
      }
      return;
    }
    
    const [, encoded, u, alphabet, t, e, r] = fullMatch;
    console.log(`Extracted:`);
    console.log(`  Encoded length: ${encoded.length}`);
    console.log(`  Alphabet: ${alphabet}`);
    console.log(`  t=${t}, e=${e}`);
    
    // The delimiter is alphabet[e]
    const base = parseInt(e, 10);
    const offset = parseInt(t, 10);
    const delimiter = alphabet[base];
    
    console.log(`  Delimiter: "${delimiter}" (alphabet[${base}])`);
    
    // Split by delimiter and decode each segment
    const segments = encoded.split(delimiter);
    console.log(`  Segments: ${segments.length}`);
    console.log(`  First few segments: ${segments.slice(0, 5).join(' | ')}`);
    
    // Decode
    let decoded = '';
    for (const segment of segments) {
      if (segment.length === 0) continue;
      
      // Replace each char with its index in alphabet
      let numStr = '';
      for (const char of segment) {
        const idx = alphabet.indexOf(char);
        if (idx !== -1) {
          numStr += idx.toString();
        }
      }
      
      // Convert from base to decimal
      let decimal = 0;
      for (let i = 0; i < numStr.length; i++) {
        decimal = decimal * base + parseInt(numStr[i], 10);
      }
      
      // Subtract offset
      const charCode = decimal - offset;
      if (charCode > 0 && charCode < 65536) {
        decoded += String.fromCharCode(charCode);
      }
    }
    
    console.log(`\nDecoded length: ${decoded.length}`);
    console.log(`\nDecoded content:\n${decoded.substring(0, 2000)}`);
    
    // Look for stream URLs
    if (decoded.includes('http')) {
      const urls = decoded.match(/https?:\/\/[^\s"'<>]+/gi);
      if (urls) {
        console.log(`\n*** URLs found ***`);
        [...new Set(urls)].forEach(url => console.log(`  ${url}`));
      }
    }
  });
});
