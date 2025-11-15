// Extract the SBX decoder function from PlayerJS
const fs = require('fs');

const content = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('='.repeat(70));
console.log('🔍 EXTRACTING SBX DECODER FROM PLAYERJS');
console.log('='.repeat(70));

console.log(`\nFile size: ${content.length} bytes`);

// The file starts with eval(function(p,a,c,k,e,d){...
// We need to unpack it first

console.log('\n[1] Detecting packer format...');
if (content.startsWith('eval(function(p,a,c,k,e,d)')) {
  console.log('✅ Detected eval packer');
  
  // Extract the packed code
  const match = content.match(/eval\((function\(p,a,c,k,e,d\){.*})\((.*)\)\)$/s);
  
  if (match) {
    console.log('✅ Extracted packer function');
    
    // The unpacker function
    const unpackerFunc = match[1];
    const packedData = match[2];
    
    console.log('\n[2] Unpacking...');
    
    try {
      // Execute the unpacker
      const unpacker = eval(`(${unpackerFunc})`);
      
      // Parse the packed data arguments
      const argsMatch = packedData.match(/^'([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);
      
      if (argsMatch) {
        const p = argsMatch[1];
        const a = parseInt(argsMatch[2]);
        const c = parseInt(argsMatch[3]);
        const k = argsMatch[4].split('|');
        
        console.log(`   p length: ${p.length}`);
        console.log(`   a: ${a}`);
        console.log(`   c: ${c}`);
        console.log(`   k length: ${k.length}`);
        
        // Unpack
        const unpacked = unpacker(p, a, c, k, 0, {});
        
        console.log(`\n✅ Unpacked! Length: ${unpacked.length} bytes`);
        
        // Save unpacked code
        fs.writeFileSync('playerjs-unpacked.js', unpacked);
        console.log('✅ Saved to playerjs-unpacked.js');
        
        // Now search for sbx decoder in unpacked code
        console.log('\n[3] Searching for SBX decoder in unpacked code...');
        
        // Look for .sbx function
        const sbxMatches = unpacked.match(/\.sbx\s*=\s*function[^}]+\{[^}]+\}/g);
        if (sbxMatches) {
          console.log(`\n✅ Found ${sbxMatches.length} .sbx function(s):`);
          sbxMatches.forEach((m, i) => {
            console.log(`\n[SBX ${i + 1}]`);
            console.log(m);
          });
        }
        
        // Look for any function that might decode
        console.log('\n[4] Looking for decoder patterns...');
        
        // Pattern: function that takes string and returns decoded string
        const decoderPatterns = [
          /function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*atob[^}]*\}/g,
          /function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*fromCharCode[^}]*\}/g,
          /(\w+)\s*=\s*function\s*\([^)]*\)\s*\{[^}]*reverse[^}]*\}/g,
        ];
        
        decoderPatterns.forEach((pattern, i) => {
          const matches = unpacked.match(pattern);
          if (matches) {
            console.log(`\nPattern ${i + 1}: Found ${matches.length} matches`);
            matches.slice(0, 3).forEach(m => {
              console.log(`  ${m.substring(0, 200)}...`);
            });
          }
        });
        
        // Look for the specific decoding logic
        console.log('\n[5] Searching for URL-safe base64 + reverse pattern...');
        
        // Look for code that does: replace(_,/) replace(-,+) reverse() atob()
        const urlSafePattern = /[^}]{0,500}replace[^}]{0,100}_[^}]{0,100}\/[^}]{0,100}replace[^}]{0,100}-[^}]{0,100}\+[^}]{0,500}/g;
        const urlSafeMatches = unpacked.match(urlSafePattern);
        
        if (urlSafeMatches) {
          console.log(`\n✅ Found ${urlSafeMatches.length} URL-safe base64 pattern(s):`);
          urlSafeMatches.slice(0, 3).forEach((m, i) => {
            console.log(`\n[Match ${i + 1}]`);
            console.log(m);
          });
        }
        
        // Look for XOR operations
        console.log('\n[6] Searching for XOR operations...');
        const xorPattern = /[^}]{0,300}\^[^}]{0,300}charCodeAt[^}]{0,300}/g;
        const xorMatches = unpacked.match(xorPattern);
        
        if (xorMatches) {
          console.log(`\n✅ Found ${xorMatches.length} XOR pattern(s):`);
          xorMatches.slice(0, 5).forEach((m, i) => {
            console.log(`\n[Match ${i + 1}]`);
            console.log(m.substring(0, 300));
          });
        }
        
      } else {
        console.log('❌ Could not parse packed data arguments');
      }
      
    } catch (error) {
      console.error('❌ Error unpacking:', error.message);
    }
    
  } else {
    console.log('❌ Could not extract packer function');
  }
  
} else {
  console.log('❌ Not a packed file or unknown format');
}

console.log('\n' + '='.repeat(70));
console.log('EXTRACTION COMPLETE');
console.log('='.repeat(70));
