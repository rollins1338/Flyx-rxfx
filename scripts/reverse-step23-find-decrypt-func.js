/**
 * Step 23: Find the actual decryption function in the obfuscated code
 * 
 * We need to find where PAGE_DATA is read and processed
 */

const fs = require('fs');

console.log('=== Step 23: Finding Decryption Function ===\n');

const code = fs.readFileSync('rapidshare-app.js', 'utf8');

// Find all switch-case blocks that contain XOR operations
console.log('=== Finding XOR switch-case blocks ===');

// Look for the pattern: c[5]^=c[1][c[9]%32]
const xorPatterns = [
  /c\[\d+\]\^=c\[\d+\]\[c\[\d+\]%32\]/g,
  /r\[\d+\]\^=r\[\d+\]\[r\[\d+\]%32\]/g,
];

xorPatterns.forEach(pattern => {
  const matches = code.match(pattern);
  if (matches) {
    console.log(`Pattern ${pattern}: ${matches.length} matches`);
    [...new Set(matches)].forEach(m => console.log('  ', m));
  }
});

// Find the function that contains the XOR decryption
console.log('\n=== Finding function containing XOR ===');
const xorIdx = code.indexOf('c[5]^=c[1][c[9]%32]');
if (xorIdx !== -1) {
  // Find the function start
  let funcStart = xorIdx;
  let braceCount = 0;
  for (let i = xorIdx; i >= 0; i--) {
    if (code[i] === '}') braceCount++;
    if (code[i] === '{') {
      braceCount--;
      if (braceCount < 0) {
        // Find function keyword
        const before = code.substring(Math.max(0, i - 200), i);
        const funcMatch = before.match(/function\s*(\w*)\s*\([^)]*\)\s*$/);
        if (funcMatch) {
          funcStart = i - 200 + funcMatch.index;
          console.log('Found function:', funcMatch[0].substring(0, 50));
          break;
        }
        // Check for arrow function
        const arrowMatch = before.match(/(\w+)\s*=\s*\([^)]*\)\s*=>\s*$/);
        if (arrowMatch) {
          funcStart = i - 200 + arrowMatch.index;
          console.log('Found arrow function:', arrowMatch[0].substring(0, 50));
          break;
        }
      }
    }
  }
  
  // Get the full function (up to 2000 chars)
  const funcEnd = Math.min(code.length, xorIdx + 1000);
  console.log('\nFunction context around XOR:');
  console.log(code.substring(Math.max(0, xorIdx - 500), funcEnd));
}

// Look for where __PAGE_DATA or window access happens
console.log('\n\n=== Finding window/PAGE_DATA access ===');
const windowPatterns = [
  /window\s*\[\s*[^\]]+\s*\]/g,
  /window\s*\.\s*\w+/g,
];

windowPatterns.forEach(pattern => {
  const matches = code.match(pattern);
  if (matches) {
    const unique = [...new Set(matches)];
    console.log(`\n${pattern}: ${unique.length} unique matches`);
    unique.slice(0, 20).forEach(m => console.log('  ', m));
  }
});

// Look for the N4F/N0M string table
console.log('\n\n=== Analyzing N4F/N0M string table ===');

// Find the M2OpVfE function which builds the string table
const m2opvfeIdx = code.indexOf('M2OpVfE');
if (m2opvfeIdx !== -1) {
  const start = Math.max(0, m2opvfeIdx - 100);
  const end = Math.min(code.length, m2opvfeIdx + 2000);
  console.log('M2OpVfE context:');
  console.log(code.substring(start, end).substring(0, 1500));
}

// Look for the string that gets XOR decoded with "C|B%"
console.log('\n\n=== Finding XOR key "C|B%" usage ===');
const keyIdx = code.indexOf('C%7CB%');
if (keyIdx !== -1) {
  const start = Math.max(0, keyIdx - 500);
  const end = Math.min(code.length, keyIdx + 500);
  console.log('Context around C%7CB%:');
  console.log(code.substring(start, end));
}

// Look for base64 decode patterns
console.log('\n\n=== Finding base64 decode patterns ===');
const atobIdx = code.indexOf('atob');
if (atobIdx !== -1) {
  const start = Math.max(0, atobIdx - 200);
  const end = Math.min(code.length, atobIdx + 200);
  console.log('atob context:');
  console.log(code.substring(start, end));
}

// Look for the actual player setup
console.log('\n\n=== Finding player setup ===');
const setupPatterns = [
  /setup\s*\(\s*\{/g,
  /jwplayer\s*\(/g,
  /sources\s*:/g,
  /file\s*:/g,
];

setupPatterns.forEach(pattern => {
  const matches = code.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// Find where the decrypted data is used
console.log('\n\n=== Finding data flow ===');

// Look for array push operations that might collect decrypted bytes
const pushPatterns = [
  /\[y3\]\s*\(\s*255\s*&/g,  // [y3](255& - push byte
  /\.push\s*\(\s*255\s*&/g,
];

pushPatterns.forEach(pattern => {
  const matches = code.match(pattern);
  if (matches) {
    console.log(`${pattern}: ${matches.length} matches`);
  }
});

// Look for String.fromCharCode usage
console.log('\n=== String.fromCharCode patterns ===');
const fromCharCodeIdx = code.indexOf('fromCharCode');
if (fromCharCodeIdx !== -1) {
  const start = Math.max(0, fromCharCodeIdx - 100);
  const end = Math.min(code.length, fromCharCodeIdx + 200);
  console.log('fromCharCode context:');
  console.log(code.substring(start, end));
}

// Look for the W3 object methods
console.log('\n\n=== W3 object methods ===');
const w3Methods = code.match(/W3\.\w+/g);
if (w3Methods) {
  const unique = [...new Set(w3Methods)];
  console.log('W3 methods:', unique);
}

// Find the actual decryption entry point
console.log('\n\n=== Looking for decryption entry point ===');

// The decryption likely happens when PAGE_DATA is accessed
// Look for patterns like: window.__PAGE_DATA or similar
const pageDataAccess = code.match(/\w+\s*\[\s*['"][^'"]*PAGE[^'"]*['"]\s*\]/gi);
if (pageDataAccess) {
  console.log('PAGE_DATA access patterns:', pageDataAccess);
}

// Look for the function that takes PAGE_DATA as input
const funcWithPageData = code.match(/function\s*\w*\s*\([^)]*\)\s*\{[^}]*PAGE/gi);
if (funcWithPageData) {
  console.log('Functions mentioning PAGE:', funcWithPageData.slice(0, 3));
}
