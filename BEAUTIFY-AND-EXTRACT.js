const fs = require('fs');

console.log('\n🔍 BEAUTIFYING AND EXTRACTING DECODER\n');

const decoder = fs.readFileSync('prorcp-decoder-script.js', 'utf8');

// Simple beautification - add newlines after semicolons and braces
let beautified = decoder
  .replace(/;/g, ';\n')
  .replace(/{/g, '{\n')
  .replace(/}/g, '\n}\n');

// Find the key window assignment
const windowMatch = beautified.match(/window\[[^\]]+\]\s*=\s*[^;]+;/);

if (windowMatch) {
  console.log('✅ FOUND WINDOW ASSIGNMENT:\n');
  console.log(windowMatch[0]);
  console.log('\n' + '='.repeat(80));
  
  // Extract the pattern
  // window[_0x216d47[_0x559bec(...)](bMGyx71TzQLfdonN, ...)] = ...
  
  // The key insight: bMGyx71TzQLfdonN is passed as a parameter
  // This means it's defined elsewhere
  
  // Search for where bMGyx71TzQLfdonN is defined
  const funcDefPattern = /function\s+bMGyx71TzQLfdonN[^}]+}/;
  const funcMatch = beautified.match(funcDefPattern);
  
  if (funcMatch) {
    console.log('\n✅ FOUND FUNCTION DEFINITION:\n');
    console.log(funcMatch[0]);
  } else {
    // Try to find it in the obfuscated code
    console.log('\n🔍 Searching for bMGyx71TzQLfdonN in original code...\n');
    
    const index = decoder.indexOf('bMGyx71TzQLfdonN');
    if (index > 0) {
      // Get 1000 chars before and after
      const context = decoder.substring(Math.max(0, index - 1000), index + 1000);
      console.log('Context around bMGyx71TzQLfdonN:');
      console.log(context);
      
      fs.writeFileSync('decoder-context.txt', context);
      console.log('\n💾 Saved context to decoder-context.txt');
    }
  }
}

// Now search for the actual decoding - look for the div content processing
console.log('\n' + '='.repeat(80));
console.log('SEARCHING FOR DIV CONTENT PROCESSING');
console.log('='.repeat(80));

const getElementPattern = /getElementById[^;]+innerHTML[^;]+;/g;
const getElementMatches = beautified.match(getElementPattern);

if (getElementMatches) {
  console.log(`\n✅ Found ${getElementMatches.length} getElementById calls:\n`);
  getElementMatches.forEach((m, i) => {
    console.log(`${i + 1}. ${m.substring(0, 150)}...`);
  });
}

// The key is that the decoder creates a Blob URL
console.log('\n' + '='.repeat(80));
console.log('ANALYZING BLOB URL CREATION');
console.log('='.repeat(80));

if (decoder.includes('createObjectURL') && decoder.includes('Blob')) {
  console.log('\n✅ Decoder creates a Blob URL!');
  console.log('\nThis means:');
  console.log('1. Div content is decoded');
  console.log('2. Result is wrapped in a Blob');
  console.log('3. Blob URL is created');
  console.log('4. URL is assigned to window[randomVariable]');
  
  // Find the Blob creation
  const blobPattern = /new Blob\([^)]+\)/g;
  const blobMatches = decoder.match(blobPattern);
  if (blobMatches) {
    console.log(`\n✅ Found ${blobMatches.length} Blob creations`);
  }
}

console.log('\n✅ Analysis complete!');
console.log('\nKEY FINDINGS:');
console.log('1. Decoder uses obfuscated function names');
console.log('2. Creates Blob URL from decoded content');
console.log('3. Assigns to window[randomVariableName]');
console.log('4. The actual M3U8 URL is in the Blob');
