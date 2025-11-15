const fs = require('fs');

const unpacked = fs.readFileSync('playerjs-unpacked.js', 'utf8');

console.log('🔍 Searching unpacked PlayerJS for decoder...\n');
console.log(`Size: ${unpacked.length} bytes\n`);

// Search for all getElementById calls
const getElementByIdPattern = /getElementById\s*\(\s*["']?([^"')]+)["']?\s*\)/g;
let match;
const matches = [];

while ((match = getElementByIdPattern.exec(unpacked)) !== null) {
    const start = Math.max(0, match.index - 500);
    const end = Math.min(unpacked.length, match.index + 500);
    matches.push({
        id: match[1],
        context: unpacked.substring(start, end)
    });
}

console.log(`Found ${matches.length} getElementById calls\n`);

// Look for ones that might read content
matches.forEach((m, i) => {
    const ctx = m.context.toLowerCase();
    if (ctx.includes('innerhtml') || ctx.includes('textcontent') || ctx.includes('value') || ctx.includes('window[')) {
        console.log(`\nMatch ${i + 1}: getElementById("${m.id}")`);
        console.log('-'.repeat(80));
        console.log(m.context);
        console.log('\n');
    }
});

// Search for window[] assignments
console.log('\n' + '='.repeat(80));
console.log('WINDOW[] ASSIGNMENTS');
console.log('='.repeat(80) + '\n');

const windowPattern = /window\[["']?([^"'\]]+)["']?\]\s*=/g;
const windowMatches = [];

while ((match = windowPattern.exec(unpacked)) !== null) {
    const start = Math.max(0, match.index - 300);
    const end = Math.min(unpacked.length, match.index + 300);
    windowMatches.push({
        key: match[1],
        context: unpacked.substring(start, end)
    });
}

console.log(`Found ${windowMatches.length} window[] assignments\n`);

windowMatches.slice(0, 10).forEach((m, i) => {
    console.log(`\n${i + 1}. window["${m.key}"] =`);
    console.log('-'.repeat(80));
    console.log(m.context);
});

console.log('\n✅ Search complete\n');
