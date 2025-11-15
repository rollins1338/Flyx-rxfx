const fs = require('fs');

console.log('\n🔍 EXTRACTING DECODER FUNCTION\n');

const decoder = fs.readFileSync('prorcp-decoder-script.js', 'utf8');

// Find the key line that shows the pattern
const keyPattern = /window\[([^\]]+)\]\s*=\s*([^\(]+)\(document\.getElementById\(([^\)]+)\)\.innerHTML\)/;
const match = decoder.match(keyPattern);

if (match) {
  console.log('✅ FOUND DECODER PATTERN!\n');
  console.log('Full match:', match[0]);
  console.log('\nVariable name function:', match[1]);
  console.log('Decoder function:', match[2]);
  console.log('Div ID function:', match[3]);
  
  // The pattern is:
  // window[bMGyx71TzQLfdonN("MyL1IRSfHe")] = MyL1IRSfHe(document.getElementById(bMGyx71TzQLfdonN("MyL1IRSfHe")).innerHTML);
  
  console.log('\n' + '='.repeat(80));
  console.log('DECODER ALGORITHM');
  console.log('='.repeat(80));
  console.log('\n1. Call bMGyx71TzQLfdonN("MyL1IRSfHe") to get the div ID');
  console.log('2. Get the innerHTML of that div');
  console.log('3. Pass it to MyL1IRSfHe() function to decode');
  console.log('4. Store result in window[variableName]');
  
  // Now find the bMGyx71TzQLfdonN function
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR DECODER FUNCTIONS');
  console.log('='.repeat(80));
  
  // Search for function definitions
  const funcNames = ['bMGyx71TzQLfdonN', 'MyL1IRSfHe'];
  
  funcNames.forEach(name => {
    const funcPattern = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*{[^}]{0,500}`, 'g');
    const funcMatch = decoder.match(funcPattern);
    
    if (funcMatch) {
      console.log(`\n✅ Found ${name}:`);
      console.log(funcMatch[0].substring(0, 300) + '...');
    } else {
      console.log(`\n❌ ${name} not found as function`);
      
      // Try to find it as a variable assignment
      const varPattern = new RegExp(`${name}\\s*=\\s*function`, 'g');
      const varMatch = decoder.match(varPattern);
      if (varMatch) {
        console.log(`✅ Found as variable assignment`);
        const index = decoder.indexOf(varMatch[0]);
        console.log(decoder.substring(index, index + 300) + '...');
      }
    }
  });
  
  // Look for the actual decoding logic - search for base64 alphabet
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR BASE64 ALPHABET');
  console.log('='.repeat(80));
  
  const base64Patterns = [
    /[A-Za-z0-9+\/=]{64,}/g,
    /'[A-Za-z0-9+\/=]{50,}'/g,
    /"[A-Za-z0-9+\/=]{50,}"/g
  ];
  
  base64Patterns.forEach((pattern, i) => {
    const matches = decoder.match(pattern);
    if (matches && matches.length > 0) {
      console.log(`\nPattern ${i + 1}: Found ${matches.length} matches`);
      matches.slice(0, 3).forEach(m => {
        console.log(`  ${m.substring(0, 80)}...`);
      });
    }
  });
  
} else {
  console.log('❌ Pattern not found');
  
  // Try alternative search
  console.log('\nSearching for window assignment...');
  const windowPattern = /window\[[^\]]+\]\s*=/g;
  const windowMatches = decoder.match(windowPattern);
  console.log(`Found ${windowMatches ? windowMatches.length : 0} window assignments`);
  
  if (windowMatches) {
    windowMatches.slice(0, 5).forEach(m => {
      const index = decoder.indexOf(m);
      console.log('\n' + decoder.substring(index, index + 200));
    });
  }
}

// Extract the RC4 implementation
console.log('\n' + '='.repeat(80));
console.log('EXTRACTING RC4 CIPHER');
console.log('='.repeat(80));

// RC4 has characteristic patterns: charCodeAt, array swapping, XOR
const rc4Pattern = /charCodeAt.*%.*charCodeAt.*\^/s;
if (decoder.match(rc4Pattern)) {
  console.log('✅ RC4 cipher detected!');
  console.log('\nThe decoder uses RC4 encryption with a key.');
  console.log('To decrypt:');
  console.log('1. Initialize RC4 state with key');
  console.log('2. XOR each byte of input with RC4 keystream');
  console.log('3. Result is the decoded M3U8 URL');
}

console.log('\n✅ Analysis complete!');
