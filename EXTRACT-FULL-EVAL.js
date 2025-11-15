const fs = require('fs');

const playerjs = fs.readFileSync('pjs_main_drv_cast.js', 'utf8');

console.log('Extracting full eval statement...\n');

// Find the start of eval
const evalStart = playerjs.indexOf('eval(');
if (evalStart === -1) {
    console.log('No eval found');
    process.exit(1);
}

// Find the matching closing parenthesis
let depth = 0;
let inString = false;
let stringChar = null;
let escaped = false;
let evalEnd = evalStart + 5; // Start after "eval("

for (let i = evalStart + 5; i < playerjs.length; i++) {
    const char = playerjs[i];
    const prevChar = i > 0 ? playerjs[i - 1] : '';
    
    if (escaped) {
        escaped = false;
        continue;
    }
    
    if (char === '\\') {
        escaped = true;
        continue;
    }
    
    if (!inString) {
        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
        } else if (char === '(') {
            depth++;
        } else if (char === ')') {
            if (depth === 0) {
                evalEnd = i;
                break;
            }
            depth--;
        }
    } else {
        if (char === stringChar) {
            inString = false;
            stringChar = null;
        }
    }
}

const fullEval = playerjs.substring(evalStart, evalEnd + 1);

console.log(`Extracted eval statement: ${fullEval.length} bytes`);
console.log(`First 200 chars: ${fullEval.substring(0, 200)}`);

// Save it
fs.writeFileSync('full-eval-statement.js', fullEval);
console.log('\nSaved to: full-eval-statement.js');

// Now try to execute it
console.log('\nAttempting to execute...\n');

try {
    const result = eval(fullEval.substring(5, fullEval.length - 1)); // Remove "eval(" and ")"
    
    console.log(`✅ Success! Unpacked size: ${result.length} bytes`);
    
    fs.writeFileSync('playerjs-unpacked.js', result);
    console.log('💾 Saved to: playerjs-unpacked.js');
    
    // Quick search
    console.log('\nQuick search:');
    console.log(`- Contains getElementById: ${result.includes('getElementById')}`);
    console.log(`- Contains textContent: ${result.includes('textContent')}`);
    console.log(`- Contains window[: ${result.includes('window[')}`);
    console.log(`- Contains atob: ${result.includes('atob')}`);
    
} catch (e) {
    console.error('Error executing:', e.message);
}
