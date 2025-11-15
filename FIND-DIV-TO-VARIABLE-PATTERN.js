const fs = require('fs');

const unpacked = fs.readFileSync('playerjs-unpacked.js', 'utf8');

console.log('🔍 Searching for div-to-variable pattern...\n');

// The pattern we're looking for:
// 1. Get element by ID
// 2. Read its .id property
// 3. Read its content (innerHTML/textContent)
// 4. Assign to window[id]

// Search for: window[something.id] = something.textContent/innerHTML
const patterns = [
    /window\[([^.]+)\.id\]\s*=\s*\1\.(textContent|innerHTML|value)/g,
    /window\[["']?\+?([^"'\]]+)\.id["']?\]\s*=/g,
    /var\s+(\w+)\s*=\s*[^;]*\.id[^;]*window\[\1\]/g
];

console.log('Testing patterns...\n');

patterns.forEach((pattern, i) => {
    console.log(`Pattern ${i + 1}:`);
    const matches = unpacked.match(pattern);
    if (matches) {
        console.log(`  Found ${matches.length} matches`);
        matches.slice(0, 3).forEach(m => console.log(`    ${m}`));
    } else {
        console.log(`  No matches`);
    }
    console.log('');
});

// More general: look for any code that reads .id and uses it as a key
console.log('Searching for .id usage as object key...\n');

const idAsKeyPattern = /(\w+)\.id[^\n]{0,200}window\[/g;
let match;
const matches = [];

while ((match = idAsKeyPattern.exec(unpacked)) !== null) {
    const start = Math.max(0, match.index - 300);
    const end = Math.min(unpacked.length, match.index + 500);
    matches.push(unpacked.substring(start, end));
}

console.log(`Found ${matches.length} potential matches\n`);

matches.slice(0, 5).forEach((m, i) => {
    console.log(`Match ${i + 1}:`);
    console.log('-'.repeat(80));
    console.log(m);
    console.log('\n');
});

// Search for eval or Function that might generate the decoder
console.log('Searching for dynamic code generation...\n');

const evalMatches = [];
const evalPattern = /eval\([^)]{50,500}\)/g;

while ((match = evalPattern.exec(unpacked)) !== null) {
    evalMatches.push(match[0]);
}

console.log(`Found ${evalMatches.length} eval calls\n`);

evalMatches.slice(0, 3).forEach((m, i) => {
    console.log(`Eval ${i + 1}:`);
    console.log(m.substring(0, 200));
    console.log('\n');
});

console.log('✅ Search complete\n');
