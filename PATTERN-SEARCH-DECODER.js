const fs = require('fs');

console.log('\n🔍 PATTERN SEARCHING OBFUSCATED DECODER\n');

// Load the obfuscated decoder
const decoder = fs.readFileSync('prorcp-decoder-script.js', 'utf8');
console.log('Decoder length:', decoder.length, 'chars\n');

// Load our captured data
const captured = JSON.parse(fs.readFileSync('decoder-data-captured.json', 'utf8'));

console.log('='.repeat(80));
console.log('KNOWN VALUES FROM CAPTURE');
console.log('='.repeat(80));
console.log('Div ID:', captured.divId);
console.log('M3U8 Variable:', Object.keys(captured.allVariables)[0]);
console.log('M3U8 URL Sample:', captured.allVariables[Object.keys(captured.allVariables)[0]].substring(0, 100));

// The first atob call decoded 5028 chars
const encodedInput = captured.atobCalls[0].inputSample;
const decodedOutput = captured.atobCalls[0].outputSample;

console.log('\nFirst atob call:');
console.log('  Input sample:', encodedInput.substring(0, 80));
console.log('  Output sample:', decodedOutput.substring(0, 80));

console.log('\n' + '='.repeat(80));
console.log('SEARCHING FOR PATTERNS');
console.log('='.repeat(80));

// Search for common decoder patterns
const patterns = [
  { name: 'atob', regex: /atob/gi },
  { name: 'fromCharCode', regex: /fromCharCode/gi },
  { name: 'charCodeAt', regex: /charCodeAt/gi },
  { name: 'getElementById', regex: /getElementById/gi },
  { name: 'window assignment', regex: /window\[/gi },
  { name: 'pako (gzip)', regex: /pako/gi },
  { name: 'inflate', regex: /inflate/gi },
  { name: 'ungzip', regex: /ungzip/gi },
  { name: 'decompress', regex: /decompress/gi },
  { name: 'decode', regex: /decode/gi },
  { name: 'base64', regex: /base64/gi },
  { name: 'split', regex: /split/gi },
  { name: 'replace', regex: /replace/gi },
  { name: 'substring', regex: /substring/gi },
  { name: 'charAt', regex: /charAt/gi }
];

patterns.forEach(p => {
  const matches = decoder.match(p.regex);
  console.log(`\n${p.name}: ${matches ? matches.length : 0} occurrences`);
  
  if (matches && matches.length > 0 && matches.length < 20) {
    // Show context for rare patterns
    const firstMatch = decoder.indexOf(matches[0]);
    const context = decoder.substring(Math.max(0, firstMatch - 100), firstMatch + 200);
    console.log('  Context:', context.replace(/\n/g, ' '));
  }
});

// Search for the div ID pattern (10 random chars)
console.log('\n' + '='.repeat(80));
console.log('SEARCHING FOR DIV ID PATTERN');
console.log('='.repeat(80));

// Look for patterns that might generate random 10-char strings
const randomGenPatterns = [
  /Math\.random/gi,
  /random/gi,
  /[a-zA-Z0-9]{10}/g,  // Any 10-char alphanumeric
  /length.*10/gi,
  /\.length.*===.*10/gi
];

randomGenPatterns.forEach((pattern, i) => {
  const matches = decoder.match(pattern);
  if (matches && matches.length > 0) {
    console.log(`\nPattern ${i + 1} (${pattern}): ${matches.length} matches`);
    if (matches.length < 10) {
      console.log('  Samples:', matches.slice(0, 5));
    }
  }
});

// Search for specific strings that might be in the decoder
console.log('\n' + '='.repeat(80));
console.log('SEARCHING FOR SPECIFIC STRINGS');
console.log('='.repeat(80));

const searchStrings = [
  'tmstr',
  'master.m3u8',
  '.m3u8',
  'http',
  'shadowlands',
  'cloudnestra',
  captured.divId,  // Search for the actual div ID
  'ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz'  // Base64 alphabet
];

searchStrings.forEach(str => {
  const found = decoder.includes(str);
  console.log(`\n"${str}": ${found ? 'FOUND!' : 'not found'}`);
  
  if (found) {
    const index = decoder.indexOf(str);
    const context = decoder.substring(Math.max(0, index - 150), index + 150);
    console.log('  Context:', context.replace(/\n/g, ' '));
  }
});

// Look for pako usage (gzip decompression)
console.log('\n' + '='.repeat(80));
console.log('ANALYZING PAKO/GZIP USAGE');
console.log('='.repeat(80));

if (decoder.includes('pako') || decoder.includes('inflate')) {
  console.log('✅ Decoder uses pako for gzip decompression!');
  console.log('\nThis means the div content is likely:');
  console.log('1. Base64 encoded');
  console.log('2. Gzip compressed');
  console.log('3. Contains the M3U8 URL');
} else {
  console.log('❌ No pako/inflate found');
}

// Extract function names (look for common patterns)
console.log('\n' + '='.repeat(80));
console.log('EXTRACTING FUNCTION PATTERNS');
console.log('='.repeat(80));

// Look for function definitions
const funcPattern = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
const functions = [];
let match;
while ((match = funcPattern.exec(decoder)) !== null && functions.length < 20) {
  functions.push(match[1]);
}

console.log('\nFirst 20 function names:', functions);

// Look for variable assignments that might be the M3U8
console.log('\n' + '='.repeat(80));
console.log('SEARCHING FOR M3U8 ASSIGNMENT PATTERN');
console.log('='.repeat(80));

// The M3U8 URL starts with "https://tmstr5"
const m3u8Pattern = /https:\/\/tmstr/gi;
const m3u8Matches = decoder.match(m3u8Pattern);
console.log(`\nDirect M3U8 URL references: ${m3u8Matches ? m3u8Matches.length : 0}`);

if (m3u8Matches && m3u8Matches.length > 0) {
  console.log('✅ M3U8 URL pattern found in decoder!');
  const index = decoder.indexOf('https://tmstr');
  const context = decoder.substring(Math.max(0, index - 200), index + 300);
  console.log('\nContext around M3U8 URL:');
  console.log(context);
}

console.log('\n✅ Pattern search complete!');
console.log('\nNext steps:');
console.log('1. If pako is used, try: base64 decode -> gzip decompress');
console.log('2. Look for the function that creates the random variable name');
console.log('3. Search for window property assignment patterns');
