const fs = require('fs');

const playerjs = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('Searching for decoder patterns in Playerjs...\n');

// Search for patterns that might decode 'g' and ':'
const patterns = [
  { name: 'Replace g with 8', regex: /replace\([^)]*["']g["'][^)]*["']8["']\)/gi },
  { name: 'Replace : with /', regex: /replace\([^)]*[":"][^)]*["\/"]["']\)/gi },
  { name: 'Replace g', regex: /\.replace\([^)]*["']g["'][^)]*\)/gi },
  { name: 'Replace :', regex: /\.replace\([^)]*[":"][^)]*\)/gi },
  { name: 'Split by :', regex: /\.split\([^)]*[":"][^)]*\)/gi },
  { name: 'fromCharCode', regex: /fromCharCode\([^)]+\)/gi },
  { name: 'parseInt with 16', regex: /parseInt\([^,]+,\s*16\)/gi },
];

for (const pattern of patterns) {
  const matches = [...playerjs.matchAll(pattern.regex)];
  if (matches.length > 0 && matches.length < 100) {
    console.log(`\n${pattern.name}: ${matches.length} matches`);
    matches.slice(0, 5).forEach((m, i) => {
      const start = Math.max(0, m.index - 100);
      const end = Math.min(playerjs.length, m.index + m[0].length + 100);
      const context = playerjs.substring(start, end).replace(/\s+/g, ' ');
      console.log(`  ${i + 1}. ...${context}...`);
    });
  }
}

// Search for functions that might process the file parameter
console.log('\n\n=== Searching for file processing ===\n');

const filePatterns = [
  /function[^(]*\([^)]*file[^)]*\)[^{]*{[^}]{50,500}}/gi,
  /file\s*=\s*[^;]{20,200}/gi,
];

for (const pattern of filePatterns) {
  const matches = [...playerjs.matchAll(pattern)];
  if (matches.length > 0 && matches.length < 50) {
    console.log(`\nFile processing: ${matches.length} matches`);
    matches.slice(0, 3).forEach((m, i) => {
      console.log(`  ${i + 1}. ${m[0].substring(0, 200).replace(/\s+/g, ' ')}`);
    });
  }
}

console.log('\n\nDone!');
