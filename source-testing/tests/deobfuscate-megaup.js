/**
 * Deobfuscate MegaUp JS to find the decryption algorithm
 */

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function main() {
  // Fetch the page
  const response = await fetch('https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ', {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  // Get app.js
  const appJsMatch = html.match(/src="([^"]+app\.js[^"]*)"/);
  const jsResponse = await fetch(appJsMatch[1], { headers: HEADERS });
  const js = await jsResponse.text();
  
  console.log('Analyzing obfuscated JS...\n');
  
  // The obfuscator uses lookup tables like W2.e_G() and W2.r2R()
  // These return arrays of arrays that map to actual values
  
  // Find the string table - usually a large array of strings
  const stringArrayMatch = js.match(/var\s+\w+\s*=\s*\[("[^"]*",?\s*)+\]/);
  if (stringArrayMatch) {
    console.log('Found string array');
  }
  
  // Look for the function that processes __PAGE_DATA
  // It's likely called on window load or document ready
  
  // Search for patterns that indicate decryption:
  // 1. Reading __PAGE_DATA
  // 2. Base64 decode (atob)
  // 3. Loop with XOR or similar
  // 4. JSON.parse
  
  // Find atob usage context
  const atobIdx = js.indexOf('atob');
  if (atobIdx > -1) {
    console.log('\natob found at index:', atobIdx);
    console.log('Context:', js.substring(atobIdx - 100, atobIdx + 200));
  }
  
  // Find JSON.parse or similar
  const jsonParsePatterns = ['JSON.parse', 'JSON[', 'parse('];
  for (const pattern of jsonParsePatterns) {
    const idx = js.indexOf(pattern);
    if (idx > -1) {
      console.log(`\n${pattern} found at:`, idx);
    }
  }
  
  // The key insight: look for the decryption function signature
  // It likely takes the encrypted string and returns an object with 'file' or 'sources'
  
  // Search for 'file' or 'sources' in the JS
  const fileMatches = js.match(/"file"|'file'|\.file\b/g);
  console.log('\n"file" occurrences:', fileMatches?.length || 0);
  
  const sourcesMatches = js.match(/"sources"|'sources'|\.sources\b/g);
  console.log('"sources" occurrences:', sourcesMatches?.length || 0);
  
  // Look for the actual decryption by finding where bytes are manipulated
  // Pattern: (byte - constant + 256) % 256 or byte ^ key
  
  // Find all functions that do byte manipulation
  console.log('\n=== Looking for byte manipulation patterns ===');
  
  // Pattern 1: (x - N + 256) % 256
  const subPattern = js.match(/\(\s*\w+\s*-\s*\d+\s*\+\s*256\s*\)\s*%\s*256/g);
  if (subPattern) {
    console.log('\nSubtraction pattern found:', subPattern.length, 'times');
    console.log('Examples:', subPattern.slice(0, 3));
  }
  
  // Pattern 2: x ^ y
  const xorPattern = js.match(/\w+\s*\^\s*\w+/g);
  if (xorPattern) {
    console.log('\nXOR pattern found:', xorPattern.length, 'times');
  }
  
  // Pattern 3: charCodeAt
  const charCodePattern = js.match(/\.charCodeAt\s*\(\s*\w+\s*\)/g);
  if (charCodePattern) {
    console.log('\ncharCodeAt pattern:', charCodePattern.length, 'times');
  }
  
  // Pattern 4: fromCharCode
  const fromCharPattern = js.match(/String\.fromCharCode|fromCharCode/g);
  if (fromCharPattern) {
    console.log('\nfromCharCode pattern:', fromCharPattern.length, 'times');
  }
  
  // Now let's try to find the actual algorithm by looking at the structure
  // The obfuscator uses a state machine pattern with switch/case
  
  // Find functions that look like decryption (take string, return object)
  console.log('\n=== Searching for decryption function structure ===');
  
  // Look for the pattern where __PAGE_DATA is read
  // window.__PAGE_DATA or window["__PAGE_DATA"]
  const pageDataUsage = js.match(/window\s*\.\s*__PAGE_DATA|window\s*\[\s*["']__PAGE_DATA["']\s*\]/g);
  console.log('__PAGE_DATA access:', pageDataUsage?.length || 0);
  
  // The decryption likely happens in a self-executing function
  // Look for IIFE patterns near crypto operations
  
  // Let's extract the actual algorithm by finding the key constants
  console.log('\n=== Extracting constants ===');
  
  // Find numbers that look like crypto constants
  const constants = new Set();
  const numMatches = js.matchAll(/\b(\d{2,3})\b/g);
  for (const match of numMatches) {
    const num = parseInt(match[1]);
    if (num >= 100 && num <= 255) {
      constants.add(num);
    }
  }
  console.log('Potential byte constants:', Array.from(constants).sort((a, b) => a - b).slice(0, 20));
  
  // The constant 131 appeared in the obfuscated code
  // Let's see if it's used in the decryption
  const const131 = js.match(/131/g);
  console.log('\n131 occurrences:', const131?.length || 0);
  
  // Try to find the actual decryption by looking for the output format
  // The result should have 'file' with an m3u8 URL
  
  // Save a beautified version for manual analysis
  const beautified = js
    .replace(/;/g, ';\n')
    .replace(/\{/g, '{\n')
    .replace(/\}/g, '\n}\n');
  
  fs.writeFileSync('source-testing/results/megaup-beautified.js', beautified);
  console.log('\nSaved beautified JS to source-testing/results/megaup-beautified.js');
  
  // Now let's try the algorithm based on what we found
  console.log('\n=== Testing potential algorithms ===');
  
  const encrypted = '3wMOLPOCFprWglc038GT4eurZQDTypKLMDMT4A0mzCCgb6yyhTIuEFpOeciU9-isScEP94g4uw4';
  
  // Base64URL decode
  let b64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const decoded = Buffer.from(b64, 'base64');
  
  // Algorithm 1: Subtract 131, then XOR with UA
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
  
  let result1 = '';
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    b = (b - 131 + 256) % 256;
    b ^= ua.charCodeAt(i % ua.length);
    result1 += String.fromCharCode(b);
  }
  console.log('\nAlgo 1 (sub 131, XOR UA):', result1.substring(0, 80));
  
  // Algorithm 2: XOR with UA, then subtract 131
  let result2 = '';
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    b ^= ua.charCodeAt(i % ua.length);
    b = (b - 131 + 256) % 256;
    result2 += String.fromCharCode(b);
  }
  console.log('Algo 2 (XOR UA, sub 131):', result2.substring(0, 80));
  
  // Algorithm 3: Rotate bits then XOR
  let result3 = '';
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    // Rotate left by 5 (seen in obfuscated code)
    b = ((b << 5) | (b >>> 3)) & 0xFF;
    b ^= ua.charCodeAt(i % ua.length);
    result3 += String.fromCharCode(b);
  }
  console.log('Algo 3 (rotate, XOR UA):', result3.substring(0, 80));
  
  // Algorithm 4: Custom based on the obfuscated patterns
  // The code had: (a[0][0]-131+256)%256 and 255&(a[0][0]<<5|a[0][0]>>>8-5)
  let result4 = '';
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    // First rotate
    b = (255 & ((b << 5) | (b >>> 3)));
    // Then subtract
    b = (b - 131 + 256) % 256;
    result4 += String.fromCharCode(b);
  }
  console.log('Algo 4 (rotate, sub 131):', result4.substring(0, 80));
  
  // Algorithm 5: Reverse order
  let result5 = '';
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    b = (b - 131 + 256) % 256;
    b = (255 & ((b << 5) | (b >>> 3)));
    result5 += String.fromCharCode(b);
  }
  console.log('Algo 5 (sub 131, rotate):', result5.substring(0, 80));
}

main().catch(console.error);
