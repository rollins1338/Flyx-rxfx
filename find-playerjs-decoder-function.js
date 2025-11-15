// Find the actual decoder function in PlayerJS
const fs = require('fs');

const content = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('='.repeat(70));
console.log('🔍 SEARCHING FOR PLAYERJS DECODER FUNCTION');
console.log('='.repeat(70));

// Search for functions that might decode the hidden div content
const patterns = [
  { name: 'pjsdiv + decode', regex: /.{0,300}pjsdiv.{0,300}decode.{0,300}/gi },
  { name: 'innerHTML + decode', regex: /.{0,300}innerHTML.{0,300}decode.{0,300}/gi },
  { name: 'textContent + decode', regex: /.{0,300}textContent.{0,300}decode.{0,300}/gi },
  { name: 'file assignment', regex: /.{0,300}\.file\s*=.{0,300}/gi },
  { name: 'sbx function', regex: /\.sbx\s*=\s*function.{0,500}/gi },
  { name: 'decode function', regex: /function\s+\w*decode\w*.{0,500}/gi },
];

patterns.forEach(({ name, regex }) => {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Pattern: ${name}`);
  console.log('='.repeat(70));
  
  const matches = content.match(regex);
  
  if (matches && matches.length > 0) {
    console.log(`✅ Found ${matches.length} matches\n`);
    matches.slice(0, 3).forEach((match, i) => {
      console.log(`[${i + 1}] ${match.substring(0, 400)}\n`);
    });
  } else {
    console.log(`❌ No matches found\n`);
  }
});

// Look for the actual file reading logic
console.log('\n' + '='.repeat(70));
console.log('SEARCHING FOR FILE READING LOGIC');
console.log('='.repeat(70));

const fileReadPatterns = [
  /getElementById\([^)]+\)\.innerHTML/gi,
  /getElementById\([^)]+\)\.textContent/gi,
  /querySelector\([^)]+\)\.innerHTML/gi,
  /\.file\s*=\s*[^;]+/gi,
];

fileReadPatterns.forEach((pattern, i) => {
  const matches = content.match(pattern);
  if (matches) {
    console.log(`\n[Pattern ${i + 1}] Found ${matches.length} matches:`);
    matches.slice(0, 5).forEach(m => console.log(`  ${m}`));
  }
});

console.log('\n' + '='.repeat(70));
console.log('✅ SEARCH COMPLETE');
console.log('='.repeat(70));
