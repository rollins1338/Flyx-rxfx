const fs = require('fs');

// Read the eval statement
const evalCode = fs.readFileSync('full-eval-statement.js', 'utf8');

// Extract just the function part (remove "eval(" and ")")
const funcCode = evalCode.substring(5, evalCode.length - 1);

console.log('Creating unpacker function...\n');

// Create the unpacker as a proper function
const unpackerFunc = new Function('return ' + funcCode)();

console.log('✅ Unpacker function created\n');
console.log('Executing unpacker...\n');

try {
    const unpacked = unpackerFunc;
    
    console.log(`✅ Unpacked! Size: ${unpacked.length} bytes\n`);
    
    fs.writeFileSync('playerjs-unpacked.js', unpacked);
    console.log('💾 Saved to: playerjs-unpacked.js\n');
    
    // Search for our patterns
    console.log('🔍 Searching for decoder patterns...\n');
    
    const searches = [
        { name: 'getElementById', pattern: /getElementById\s*\([^)]+\)/g },
        { name: 'textContent', pattern: /textContent/g },
        { name: 'window[', pattern: /window\[/g },
        { name: 'atob', pattern: /atob\s*\(/g }
    ];
    
    searches.forEach(search => {
        const matches = unpacked.match(search.pattern);
        console.log(`${search.name}: ${matches ? matches.length : 0} occurrences`);
    });
    
    // Look for the specific pattern: getElementById + textContent + window assignment
    console.log('\n🔍 Looking for decoder pattern...\n');
    
    const lines = unpacked.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('getElementById') && line.includes('textContent')) {
            console.log(`Line ${i + 1}:`);
            console.log(line);
            console.log('');
        }
    });
    
} catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
}
