/**
 * Try to decode the obfuscated strings in rapidshare app.js
 */

const fs = require('fs');

function decodeUrlEncoded(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

function analyzeObfuscatedCode(): void {
  const code = fs.readFileSync('rapidshare-app.js', 'utf8');
  
  console.log('=== Analyzing Obfuscated Code ===\n');
  
  // Find the V2AsvL function which returns the encoded string
  const v2asvlMatch = code.match(/function V2AsvL\(\)\{return"([^"]+)"\}/);
  if (v2asvlMatch) {
    console.log('Found V2AsvL encoded string');
    const encoded = v2asvlMatch[1];
    console.log('Encoded length:', encoded.length);
    
    const decoded = decodeUrlEncoded(encoded);
    console.log('\nDecoded string:');
    console.log(decoded.substring(0, 2000));
    
    // Save full decoded string
    fs.writeFileSync('rapidshare-decoded-strings.txt', decoded);
    console.log('\nSaved full decoded string to rapidshare-decoded-strings.txt');
    
    // Look for interesting patterns in decoded string
    console.log('\n=== Patterns in decoded string ===');
    
    if (decoded.includes('setup')) console.log('Contains: setup');
    if (decoded.includes('file')) console.log('Contains: file');
    if (decoded.includes('source')) console.log('Contains: source');
    if (decoded.includes('m3u8')) console.log('Contains: m3u8');
    if (decoded.includes('decrypt')) console.log('Contains: decrypt');
    if (decoded.includes('PAGE_DATA')) console.log('Contains: PAGE_DATA');
    if (decoded.includes('jwplayer')) console.log('Contains: jwplayer');
    if (decoded.includes('http')) console.log('Contains: http');
  }
  
  // Find the W3 object methods
  const w3Methods = code.match(/W3\.\w+/g);
  if (w3Methods) {
    const unique = Array.from(new Set(w3Methods));
    console.log('\n=== W3 methods used ===');
    unique.forEach(m => console.log('  ', m));
  }
  
  // Find u6JBF namespace
  const u6jbfMatch = code.match(/u6JBF\[(\d+)\]/g);
  if (u6jbfMatch) {
    const indices = Array.from(new Set(u6jbfMatch));
    console.log('\n=== u6JBF indices used ===');
    console.log('Count:', indices.length);
    indices.slice(0, 20).forEach(i => console.log('  ', i));
  }
  
  // Look for the string decoder function
  const decoderMatch = code.match(/function\s+(\w+)\s*\(\s*\w+\s*\)\s*\{[^}]*String\.fromCharCode[^}]+\}/g);
  if (decoderMatch) {
    console.log('\n=== String decoder functions ===');
    decoderMatch.forEach((d: string, i: number) => console.log(`${i + 1}. ${d.substring(0, 200)}...`));
  }
}

function tryDecodePageData(): void {
  console.log('\n\n=== Trying to decode PAGE_DATA ===\n');
  
  const pageData = '3wMOLPOCFprWglc038GT4eurZwSGn86JYmUV5gUgxSOmb62y0TJ8SwhOf8ie9-78GJAP94g4uw4';
  
  // The decoded strings might give us hints about the algorithm
  const decoded = fs.readFileSync('rapidshare-decoded-strings.txt', 'utf8');
  
  // Look for encryption-related keywords
  const keywords = ['aes', 'key', 'iv', 'encrypt', 'decrypt', 'cipher', 'secret', 'password'];
  
  console.log('Searching for encryption keywords in decoded strings:');
  for (const kw of keywords) {
    const idx = decoded.toLowerCase().indexOf(kw);
    if (idx !== -1) {
      console.log(`  Found "${kw}" at index ${idx}`);
      console.log(`  Context: ...${decoded.substring(Math.max(0, idx - 20), idx + 50)}...`);
    }
  }
  
  // Try simple XOR with common keys
  console.log('\n=== Trying XOR decryption ===');
  
  const pageDataBytes = Buffer.from(pageData.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  console.log('PAGE_DATA as bytes:', pageDataBytes.length, 'bytes');
  console.log('Hex:', pageDataBytes.toString('hex').substring(0, 100));
  
  // Try XOR with single byte keys
  for (let key = 0; key < 256; key++) {
    const xored = Buffer.from(pageDataBytes.map(b => b ^ key));
    const str = xored.toString('utf8');
    
    // Check if result looks like JSON or URL
    if (str.includes('http') || str.includes('{') || str.includes('file')) {
      console.log(`\nKey ${key} (0x${key.toString(16)}):`);
      console.log(str.substring(0, 200));
    }
  }
}

analyzeObfuscatedCode();
tryDecodePageData();
