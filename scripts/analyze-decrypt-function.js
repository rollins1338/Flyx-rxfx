/**
 * Analyze the decryption function T(a) in detail
 * 
 * The function has multiple steps:
 * 1. c[1]=i3() - get the 32-byte key
 * 2. c[5]=c[0][0][x]() - get next byte from input
 * 3. Apply transformations: D, b, w, I, P, U, F
 * 4. c[5]^=c[1][c[9]%32] - XOR with key
 * 5. c[8][y3](255&c[5]) - push result
 */

const fs = require('fs');

console.log('=== Analyzing Decryption Function ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// Find all the transformation functions
const transformFuncs = ['D', 'b', 'w', 'I', 'P', 'U', 'F'];

transformFuncs.forEach(funcName => {
  // Look for function definition
  const pattern = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{[^}]+\\}`, 'g');
  const matches = code.match(pattern);
  
  if (matches) {
    matches.forEach(m => {
      // Only show short functions (likely the transformation ones)
      if (m.length < 500) {
        console.log(`\n=== Function ${funcName} ===`);
        console.log(m);
      }
    });
  }
});

// Look for the z function (rotate)
console.log('\n=== Looking for z (rotate) ===');
const zPattern = /function z\(a\)\{[^}]+255[^}]+\}/g;
const zMatches = code.match(zPattern);
if (zMatches) {
  zMatches.forEach(m => console.log(m));
}

// The decryption function T(a) processes input byte by byte
// Let's trace the exact sequence of operations

console.log('\n=== Tracing T(a) operations ===\n');

// Find T(a) function
const tFuncIdx = code.indexOf('function T(a){for(var e=W3.w3P()');
if (tFuncIdx !== -1) {
  // Extract the function
  let braceCount = 0;
  let funcEnd = tFuncIdx;
  for (let i = tFuncIdx; i < code.length; i++) {
    if (code[i] === '{') braceCount++;
    if (code[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        funcEnd = i + 1;
        break;
      }
    }
  }
  
  const tFunc = code.substring(tFuncIdx, funcEnd);
  
  // Extract the case statements
  const casePattern = /case\s+W3\.[wQ][36][6P]\(\)\[[^\]]+\]\[[^\]]+\](?:\[[^\]]+\])?:([^;]+);break/g;
  let match;
  const cases = [];
  while ((match = casePattern.exec(tFunc)) !== null) {
    cases.push(match[1].trim());
  }
  
  console.log('Operations in T(a):');
  cases.forEach((c, i) => {
    // Simplify the operation
    let op = c
      .replace(/W3\.N[04][FM]\(\d+\)/g, 'STR')
      .replace(/W3\.[wQ][36][6P]\(\)\[[^\]]+\]\[[^\]]+\](?:\[[^\]]+\])?/g, 'STATE');
    console.log(`  ${i + 1}. ${op}`);
  });
}

// The key insight is that the decryption applies multiple transformations
// Let's identify what each transformation does

console.log('\n=== Identifying transformations ===\n');

// Look for patterns like c[5]=X(c[5])
const transformPattern = /c\[5\]=(\w)\(c\[5\]\)/g;
const transforms = new Set();
let match;
while ((match = transformPattern.exec(code)) !== null) {
  transforms.add(match[1]);
}
console.log('Transformations applied to c[5]:', [...transforms].join(', '));

// Look for the actual implementation of these transforms
transforms.forEach(funcName => {
  // Find the function that does bit manipulation
  const funcPattern = new RegExp(`function ${funcName}\\(a\\)\\{[^}]*(?:<<|>>>|&|\\|)[^}]*\\}`, 'g');
  const funcMatches = code.match(funcPattern);
  if (funcMatches) {
    funcMatches.forEach(m => {
      if (m.length < 300) {
        console.log(`\n${funcName}(): ${m}`);
      }
    });
  }
});

// The z function is: 255 & (a << 3 | a >>> 8-3)
// This is a rotate left by 3 bits

// Let's look for other bit manipulation functions
console.log('\n=== Bit manipulation functions ===\n');

const bitPattern = /function\s+(\w)\s*\(a\)\s*\{[^}]*(?:<<|>>>)[^}]*return[^}]*\}/g;
while ((match = bitPattern.exec(code)) !== null) {
  console.log(`${match[1]}(): ${match[0]}`);
}

// The decryption might use a specific sequence of operations
// Let's look at the order of operations in the switch statement

console.log('\n=== Operation sequence ===\n');

// The switch uses r (or c) variable to track which operation to do
// r = c[9] % 10 determines which transformation to apply

// From the code:
// case 0: some operation
// case 1: some operation
// ...
// case 9: some operation

// Let's find the mapping
const rCasePattern = /e=(\d)===r\?/g;
const rCases = [];
while ((match = rCasePattern.exec(code)) !== null) {
  rCases.push(parseInt(match[1]));
}
console.log('r values checked:', [...new Set(rCases)].sort((a, b) => a - b).join(', '));

// The decryption loop:
// 1. Get next byte from input
// 2. Based on position % 10, apply a transformation
// 3. XOR with key[position % 32]
// 4. Store result

console.log('\n=== Simulating decryption ===\n');

// Let's try to implement the decryption based on what we found

// Transformation functions (guessed based on common patterns)
function rotateLeft(byte, bits) {
  return ((byte << bits) | (byte >>> (8 - bits))) & 0xFF;
}

function rotateRight(byte, bits) {
  return ((byte >>> bits) | (byte << (8 - bits))) & 0xFF;
}

// The transformations might be:
// D, b, w, I, P, U, F - different rotate amounts or other operations

// Let's try different combinations
const pageData = '3wMOLPOCFprWglc038GT4eurZ1SHn5KGODMT519xmCGnN662gTItSQhGesHIou33GZEP94g4uw4';

function urlSafeBase64Decode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

const decoded = urlSafeBase64Decode(pageData);
const embedPath = '/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ';
const cleanPath = embedPath.replace(/[^A-Z0-9]/gi, '').toUpperCase();

// Build key
const key = Buffer.alloc(32);
for (let i = 0; i < 32; i++) {
  key[i] = cleanPath.charCodeAt(i % cleanPath.length);
}

// Try decryption with transformations
function decrypt(data, key, transforms) {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    let byte = data[i];
    
    // Apply transformation based on position
    const transformIdx = i % transforms.length;
    byte = transforms[transformIdx](byte);
    
    // XOR with key
    byte ^= key[i % key.length];
    
    result[i] = byte & 0xFF;
  }
  return result;
}

// Try different transformation sequences
const transformSets = [
  // No transformation
  [b => b, b => b, b => b, b => b, b => b, b => b, b => b, b => b, b => b, b => b],
  // Rotate left by different amounts
  [b => rotateLeft(b, 1), b => rotateLeft(b, 2), b => rotateLeft(b, 3), b => rotateLeft(b, 4),
   b => rotateLeft(b, 5), b => rotateLeft(b, 6), b => rotateLeft(b, 7), b => b,
   b => rotateRight(b, 1), b => rotateRight(b, 2)],
  // Just rotate left 3
  [b => rotateLeft(b, 3)],
  // Alternate rotate
  [b => rotateLeft(b, 3), b => rotateRight(b, 3)],
];

transformSets.forEach((transforms, idx) => {
  const result = decrypt(decoded, key, transforms);
  const str = result.toString('utf8');
  
  // Check if result looks valid
  if (str.includes('http') || str.includes('.m3u8') || str.includes('://')) {
    console.log(`Transform set ${idx}: SUCCESS!`);
    console.log(str);
  }
});

console.log('\n=== Done ===');
