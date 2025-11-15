const fs = require('fs');

/**
 * Extract complete decoder function definitions from PlayerJS
 */

const playerJS = fs.readFileSync('deobfuscation/playerjs.js', 'utf8');

console.log('🔍 Extracting complete decoder functions...\n');

// Function to extract complete function body with proper brace matching
function extractCompleteFunction(code, functionName) {
  const regex = new RegExp(`function ${functionName}\\s*\\([^)]*\\)\\s*{`, 'g');
  const match = regex.exec(code);
  
  if (!match) return null;
  
  let startIndex = match.index;
  let braceCount = 0;
  let inFunction = false;
  let endIndex = startIndex;
  
  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === '{') {
      braceCount++;
      inFunction = true;
    } else if (code[i] === '}') {
      braceCount--;
      if (inFunction && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  
  return code.substring(startIndex, endIndex);
}

// Extract the key functions we found
const functionsToExtract = ['xs', 'Ar', 'Q'];

console.log('📦 Extracting functions:\n');

const extractedFunctions = {};

functionsToExtract.forEach(funcName => {
  console.log(`Extracting: ${funcName}...`);
  const funcCode = extractCompleteFunction(playerJS, funcName);
  if (funcCode) {
    extractedFunctions[funcName] = funcCode;
    console.log(`✅ ${funcName}: ${funcCode.length} characters`);
  } else {
    console.log(`❌ ${funcName}: Not found`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('EXTRACTED FUNCTIONS:');
console.log('='.repeat(80) + '\n');

Object.entries(extractedFunctions).forEach(([name, code]) => {
  console.log(`\n// Function: ${name}`);
  console.log('-'.repeat(80));
  console.log(code);
  console.log('\n');
});

// Now search for any function that processes getElementById or pjsdiv
console.log('\n' + '='.repeat(80));
console.log('SEARCHING FOR PJSDIV PROCESSING:');
console.log('='.repeat(80) + '\n');

const pjsdivMatches = playerJS.match(/getElementById[^;]+pjsdiv[^;]+/g);
if (pjsdivMatches) {
  console.log(`Found ${pjsdivMatches.length} pjsdiv references:\n`);
  pjsdivMatches.forEach((match, i) => {
    console.log(`${i + 1}. ${match}`);
  });
}

// Search for any custom base64 decode functions
console.log('\n' + '='.repeat(80));
console.log('SEARCHING FOR CUSTOM BASE64 DECODERS:');
console.log('='.repeat(80) + '\n');

// Look for patterns like: replace(/-/g,'+').replace(/_/g,'/')
const urlSafeBase64Pattern = /(\w+)\s*=\s*[^;]*replace\s*\(\s*['"]\-['"]\s*,\s*['"]\+['"]\s*\)[^;]*replace\s*\(\s*['"]_['"]\s*,\s*['"]\/['"]\s*\)/g;
let match;
const urlSafeDecoders = [];

while ((match = urlSafeBase64Pattern.exec(playerJS)) !== null) {
  // Get surrounding context
  const start = Math.max(0, match.index - 200);
  const end = Math.min(playerJS.length, match.index + match[0].length + 200);
  const context = playerJS.substring(start, end);
  urlSafeDecoders.push(context);
}

console.log(`Found ${urlSafeDecoders.length} URL-safe base64 patterns:\n`);
urlSafeDecoders.forEach((decoder, i) => {
  console.log(`\n${i + 1}.`);
  console.log('-'.repeat(80));
  console.log(decoder);
});

// Search for the actual file: property assignment
console.log('\n' + '='.repeat(80));
console.log('SEARCHING FOR FILE PROPERTY ASSIGNMENT:');
console.log('='.repeat(80) + '\n');

const fileAssignmentPattern = /file\s*:\s*[^,}]+/g;
const fileAssignments = [];

while ((match = fileAssignmentPattern.exec(playerJS)) !== null) {
  const start = Math.max(0, match.index - 300);
  const end = Math.min(playerJS.length, match.index + match[0].length + 100);
  const context = playerJS.substring(start, end);
  fileAssignments.push(context);
}

console.log(`Found ${fileAssignments.length} file property assignments\n`);
fileAssignments.slice(0, 5).forEach((assignment, i) => {
  console.log(`\n${i + 1}.`);
  console.log('-'.repeat(80));
  console.log(assignment);
});

// Save all findings
const findings = {
  extractedFunctions,
  pjsdivMatches,
  urlSafeDecoders,
  fileAssignments: fileAssignments.slice(0, 10)
};

fs.writeFileSync('complete-decoder-functions.json', JSON.stringify(findings, null, 2));
console.log('\n\n💾 All findings saved to complete-decoder-functions.json');
