const fs = require('fs');

// Read the obfuscated decoder
const obfuscated = fs.readFileSync('decoder-external.js', 'utf8');

console.log('📦 Decoder script length:', obfuscated.length);

// Find the decoder function
const decoderMatch = obfuscated.match(/function\s+C66jPHx8qu\s*\([^)]*\)\s*\{[^}]+\}/);
if (decoderMatch) {
  console.log('\n🎯 Found decoder function:');
  console.log(decoderMatch[0]);
}

// Find where it's called
const callMatch = obfuscated.match(/C66jPHx8qu\(document\.getElementById\([^)]+\)\.innerHTML\)/);
if (callMatch) {
  console.log('\n🎯 Found decoder call:');
  console.log(callMatch[0]);
}

// Extract the div ID
const divIdMatch = obfuscated.match(/getElementById\(bMGyx71TzQLfdonN\("([^"]+)"\)\)/);
if (divIdMatch) {
  console.log('\n🎯 Div ID (obfuscated):', divIdMatch[1]);
}

// Find the deobfuscation function
const deobfuscMatch = obfuscated.match(/function\s+bMGyx71TzQLfdonN\s*\([^)]*\)\s*\{[\s\S]{1,500}\}/);
if (deobfuscMatch) {
  console.log('\n🎯 Found deobfuscation function:');
  console.log(deobfuscMatch[0]);
}

// Try to find atob usage
const atobMatches = obfuscated.match(/atob\([^)]+\)/g);
if (atobMatches) {
  console.log('\n🎯 Found atob calls:', atobMatches.length);
  atobMatches.slice(0, 5).forEach(match => console.log('   ', match));
}

// Find fromCharCode usage
const fromCharCodeMatches = obfuscated.match(/fromCharCode\([^)]+\)/g);
if (fromCharCodeMatches) {
  console.log('\n🎯 Found fromCharCode calls:', fromCharCodeMatches.length);
  fromCharCodeMatches.slice(0, 5).forEach(match => console.log('   ', match));
}

// Save a more readable version
const readable = obfuscated
  .replace(/;/g, ';\n')
  .replace(/\{/g, '{\n')
  .replace(/\}/g, '\n}\n');

fs.writeFileSync('decoder-external-readable.js', readable);
console.log('\n💾 Saved readable version to decoder-external-readable.js');
