/**
 * Trace the key generation in i3() function
 * 
 * Key observations from i3():
 * - r[9]=J(u7dV1j(W3.N0M(212))) - initializes key array
 * - r[8]=M() - gets something
 * - r[4]=t4TD2P[u7dV1j(L)][u7dV1j(A)] - gets from t4TD2P
 * - r[1]=new p9Dy1d(r[8]+d)[g3](r[4]) - regex match
 * - r[7]=f() - gets something
 * - Key is built by XORing characters
 */

const fs = require('fs');

console.log('=== Tracing key generation ===\n');

const code = fs.readFileSync('rapidshare-app-fresh.js', 'utf8');

// Find the functions used in i3()
const functionsToFind = ['J', 'M', 'f', 'c', 'S', 'z'];

functionsToFind.forEach(funcName => {
  // Look for function definition
  const patterns = [
    new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
    new RegExp(`${funcName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{`, 'g'),
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const start = match.index;
      let braceCount = 0;
      let end = start;
      for (let i = start; i < Math.min(code.length, start + 5000); i++) {
        if (code[i] === '{') braceCount++;
        if (code[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            end = i + 1;
            break;
          }
        }
      }
      
      const funcCode = code.substring(start, end);
      if (funcCode.length < 2000) {
        console.log(`\n=== Function ${funcName} ===`);
        console.log(funcCode.substring(0, 1000));
      }
    }
  });
});

// Find t4TD2P
console.log('\n=== Looking for t4TD2P ===\n');
const t4tdIdx = code.indexOf('t4TD2P');
if (t4tdIdx !== -1) {
  // Find where it's defined
  const defPattern = /t4TD2P\s*=/g;
  let match;
  while ((match = defPattern.exec(code)) !== null) {
    const start = match.index;
    const end = Math.min(code.length, start + 500);
    console.log('t4TD2P definition:');
    console.log(code.substring(start, end));
    console.log('');
  }
}

// Find p9Dy1d (likely RegExp)
console.log('\n=== Looking for p9Dy1d ===\n');
const p9dyIdx = code.indexOf('p9Dy1d');
if (p9dyIdx !== -1) {
  const defPattern = /p9Dy1d\s*=/g;
  let match;
  while ((match = defPattern.exec(code)) !== null) {
    const start = match.index;
    const end = Math.min(code.length, start + 200);
    console.log('p9Dy1d definition:');
    console.log(code.substring(start, end));
  }
}

// Find u7dV1j (string table accessor)
console.log('\n=== Looking for u7dV1j ===\n');
const u7dvIdx = code.indexOf('u7dV1j');
if (u7dvIdx !== -1) {
  const defPattern = /u7dV1j\s*=/g;
  let match;
  while ((match = defPattern.exec(code)) !== null) {
    const start = match.index;
    const end = Math.min(code.length, start + 500);
    console.log('u7dV1j definition:');
    console.log(code.substring(start, end));
  }
}

// Find the string table index 212 (used in J(u7dV1j(W3.N0M(212))))
console.log('\n=== Looking for N0M(212) ===\n');
// This should return a string from the string table
// Let's find what string index 212 maps to

// Find the k[] string table
const kPattern = /k\[212\]\s*=\s*["']([^"']+)["']/;
const kMatch = code.match(kPattern);
if (kMatch) {
  console.log(`k[212] = "${kMatch[1]}"`);
}

// Find the variables L, A, d used in i3()
console.log('\n=== Looking for L, A, d variables ===\n');

// These are likely indices into the string table
const varPatterns = [
  /\bL\s*=\s*(\d+)/g,
  /\bA\s*=\s*(\d+)/g,
  /\bd\s*=\s*["']([^"']+)["']/g,
];

varPatterns.forEach(pattern => {
  let match;
  while ((match = pattern.exec(code)) !== null) {
    console.log(`Found: ${match[0]}`);
  }
});

// Look for the actual key string
// The key might be a constant string that gets transformed
console.log('\n=== Looking for key constants ===\n');

// Find 32-character strings (potential keys)
const str32Pattern = /["']([A-Za-z0-9]{32})["']/g;
const str32Matches = [];
let match;
while ((match = str32Pattern.exec(code)) !== null) {
  str32Matches.push(match[1]);
}
console.log(`Found ${str32Matches.length} 32-char strings`);
[...new Set(str32Matches)].slice(0, 10).forEach(s => console.log(`  ${s}`));

// Look for the j3 function (likely charCodeAt)
console.log('\n=== Looking for j3 ===\n');
const j3Pattern = /j3\s*=/g;
while ((match = j3Pattern.exec(code)) !== null) {
  const start = match.index;
  const end = Math.min(code.length, start + 200);
  console.log('j3 definition:');
  console.log(code.substring(start, end));
}

// Look for the g3 function (likely match or exec)
console.log('\n=== Looking for g3 ===\n');
const g3Pattern = /g3\s*=/g;
while ((match = g3Pattern.exec(code)) !== null) {
  const start = match.index;
  const end = Math.min(code.length, start + 200);
  console.log('g3 definition:');
  console.log(code.substring(start, end));
}

// Look for where the key is actually used
console.log('\n=== Key usage in decryption ===\n');

// The pattern c[5]^=c[1][c[9]%32] shows:
// c[1] is the key (32 bytes)
// c[9] is the index
// c[5] is the byte being decrypted

// Find where c[1] is set
const c1Pattern = /c\[1\]\s*=\s*([^;,\n]+)/g;
while ((match = c1Pattern.exec(code)) !== null) {
  console.log(`c[1] = ${match[1]}`);
}

console.log('\n=== Done ===');
