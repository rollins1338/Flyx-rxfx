/**
 * Strings Analysis - Look at strings in WASM data section
 */

const fs = require('fs');
const path = require('path');

const wasmPath = path.join(__dirname, 'wasm-analysis/img_data_bg.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

console.log('=== WASM Strings Analysis ===\n');

// Find data section
let offset = 8;
let dataSection = null;

while (offset < wasmBuffer.length) {
  const sectionId = wasmBuffer[offset];
  offset++;
  
  let size = 0;
  let shift = 0;
  let byte;
  do {
    byte = wasmBuffer[offset++];
    size |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  
  if (sectionId === 11) {
    dataSection = { offset, size };
  }
  
  offset += size;
}

if (!dataSection) {
  console.log('Data section not found');
  process.exit(1);
}

const dataContent = wasmBuffer.slice(dataSection.offset, dataSection.offset + dataSection.size);

// Extract all printable strings
console.log('=== Extracting printable strings ===\n');

const strings = [];
let currentString = '';
let startOffset = 0;

for (let i = 0; i < dataContent.length; i++) {
  const byte = dataContent[i];
  if (byte >= 32 && byte < 127) {
    if (currentString.length === 0) {
      startOffset = i;
    }
    currentString += String.fromCharCode(byte);
  } else {
    if (currentString.length >= 4) {
      strings.push({ offset: startOffset, str: currentString });
    }
    currentString = '';
  }
}

// Filter interesting strings
const interestingPatterns = [
  'tmdb', 'session', 'canvas', 'fingerprint', 'key', 'secret',
  'encrypt', 'decrypt', 'aes', 'sha', 'hmac', 'hash', 'random',
  'seed', 'prng', 'xor', 'mask', 'salt', 'iv', 'nonce',
  'colorDepth', 'userAgent', 'platform', 'language', 'timezone',
  'screen', 'navigator', 'window', 'document', 'localStorage',
];

console.log('Interesting strings:');
for (const { offset, str } of strings) {
  for (const pattern of interestingPatterns) {
    if (str.toLowerCase().includes(pattern.toLowerCase())) {
      console.log(`  Offset ${offset}: "${str}"`);
      break;
    }
  }
}

// Look for format strings (containing colons or special characters)
console.log('\n=== Format strings (containing colons) ===\n');
for (const { offset, str } of strings) {
  if (str.includes(':') && str.length > 10) {
    console.log(`  Offset ${offset}: "${str}"`);
  }
}

// Look for strings that might be fingerprint components
console.log('\n=== Potential fingerprint format strings ===\n');
for (const { offset, str } of strings) {
  if (str.includes('{}') || str.includes('%s') || str.includes('%d')) {
    console.log(`  Offset ${offset}: "${str}"`);
  }
}

// Look at the area around "tmdb_session"
console.log('\n=== Area around "tmdb_session" ===\n');
const tmdbOffset = 2331; // From previous analysis
const contextSize = 200;
const start = Math.max(0, tmdbOffset - 50);
const end = Math.min(dataContent.length, tmdbOffset + contextSize);
const context = dataContent.slice(start, end);

// Print as hex and ASCII
for (let i = 0; i < context.length; i += 16) {
  const hex = [];
  const ascii = [];
  for (let j = 0; j < 16 && i + j < context.length; j++) {
    const byte = context[i + j];
    hex.push(byte.toString(16).padStart(2, '0'));
    ascii.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
  }
  console.log(`${(start + i).toString(16).padStart(4, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
}

// Look for localStorage key patterns
console.log('\n=== localStorage key patterns ===\n');
for (const { offset, str } of strings) {
  if (str.includes('_id') || str.includes('_key') || str.includes('_session')) {
    console.log(`  Offset ${offset}: "${str}"`);
  }
}

// Look for all strings containing numbers (might be format specifiers)
console.log('\n=== Strings with numbers ===\n');
for (const { offset, str } of strings) {
  if (/\d+/.test(str) && str.length > 5 && str.length < 50) {
    console.log(`  Offset ${offset}: "${str}"`);
  }
}

// Dump all strings longer than 20 characters
console.log('\n=== Long strings (>20 chars) ===\n');
for (const { offset, str } of strings) {
  if (str.length > 20 && str.length < 100) {
    console.log(`  Offset ${offset}: "${str}"`);
  }
}
