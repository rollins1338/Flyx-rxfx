// Unpack the playerjs to find the SBX decoder
const fs = require('fs');

// Read the packed playerjs
const packed = fs.readFileSync('playerjs-main.js', 'utf8');

// Extract the eval wrapper
const evalMatch = packed.match(/eval\((function\(p,a,c,k,e,d\).*)\)$/s);

if (!evalMatch) {
  console.log('Could not find eval wrapper');
  process.exit(1);
}

console.log('Found packed code, unpacking...\n');

// The unpacker function
function unpack(p, a, c, k, e, d) {
  e = function(c) {
    return (c < a ? '' : e(parseInt(c / a))) + 
           ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
  };
  
  if (!''.replace(/^/, String)) {
    while (c--) {
      d[e(c)] = k[c] || e(c);
    }
    k = [function(e) { return d[e]; }];
    e = function() { return '\\w+'; };
    c = 1;
  }
  
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
    }
  }
  
  return p;
}

// Execute the unpacker
try {
  const unpacked = eval(evalMatch[1]);
  
  // Save unpacked code
  fs.writeFileSync('playerjs-unpacked.js', unpacked);
  console.log('✓ Unpacked code saved to playerjs-unpacked.js');
  console.log('File size:', unpacked.length, 'bytes\n');
  
  // Now search for sbx in the unpacked code
  console.log('=== Searching for SBX decoder ===\n');
  
  const sbxMatches = unpacked.match(/\.sbx\s*=\s*function[^}]+}/g);
  if (sbxMatches) {
    console.log('Found SBX function definitions:');
    sbxMatches.forEach((match, i) => {
      console.log(`\n--- Match ${i + 1} ---`);
      console.log(match.substring(0, 500));
    });
  }
  
  // Look for any function that might decode the data
  const decodePatterns = [
    /function\s+\w+\s*\([^)]*\)\s*{[^}]*fromCharCode[^}]*}/g,
    /\w+\s*=\s*function\s*\([^)]*\)\s*{[^}]*parseInt[^}]*16[^}]*}/g,
    /\.decode\s*=\s*function/g
  ];
  
  console.log('\n=== Looking for decode functions ===\n');
  decodePatterns.forEach((pattern, i) => {
    const matches = unpacked.match(pattern);
    if (matches) {
      console.log(`Pattern ${i + 1}: Found ${matches.length} matches`);
      matches.slice(0, 3).forEach(m => {
        console.log('\n' + m.substring(0, 300) + '...');
      });
    }
  });
  
} catch (error) {
  console.error('Error unpacking:', error.message);
}
