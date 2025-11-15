const fs = require('fs');

/**
 * AGGRESSIVE SEARCH for div ID decoder in PlayerJS
 * The div ID becomes a variable name, so search for:
 * - Code that iterates divs
 * - Code that reads div.id and div.textContent
 * - Code that assigns to window[something]
 */

const playerjs = fs.readFileSync('pjs_main_drv_cast.js', 'utf8');

console.log('🔍 AGGRESSIVE PLAYERJS SEARCH\n');
console.log(`File size: ${playerjs.length} bytes\n`);

// Search 1: Find ALL occurrences of getElementById
console.log('='.repeat(80));
console.log('SEARCH 1: getElementById patterns');
console.log('='.repeat(80) + '\n');

const getElementByIdPattern = /getElementById\s*\(\s*([^)]+)\)/g;
let match;
const getElementByIdMatches = [];

while ((match = getElementByIdPattern.exec(playerjs)) !== null) {
    const start = Math.max(0, match.index - 500);
    const end = Math.min(playerjs.length, match.index + 500);
    const context = playerjs.substring(start, end);
    
    // Only keep if it mentions textContent, innerHTML, or window
    if (context.includes('textContent') || context.includes('innerHTML') || context.includes('window[')) {
        getElementByIdMatches.push({
            match: match[0],
            context: context
        });
    }
}

console.log(`Found ${getElementByIdMatches.length} relevant getElementById calls\n`);

getElementByIdMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\nMatch ${i + 1}:`);
    console.log('-'.repeat(80));
    console.log(m.context);
    console.log('\n');
});

// Search 2: Find window[] assignments
console.log('\n' + '='.repeat(80));
console.log('SEARCH 2: window[] assignment patterns');
console.log('='.repeat(80) + '\n');

const windowAssignPattern = /window\[([^\]]+)\]\s*=/g;
const windowAssignMatches = [];

while ((match = windowAssignPattern.exec(playerjs)) !== null) {
    const start = Math.max(0, match.index - 300);
    const end = Math.min(playerjs.length, match.index + 300);
    const context = playerjs.substring(start, end);
    
    windowAssignMatches.push({
        match: match[0],
        key: match[1],
        context: context
    });
}

console.log(`Found ${windowAssignMatches.length} window[] assignments\n`);

windowAssignMatches.slice(0, 10).forEach((m, i) => {
    console.log(`\nAssignment ${i + 1}: window[${m.key}] =`);
    console.log('-'.repeat(80));
    console.log(m.context);
    console.log('\n');
});

// Search 3: Find code that reads .id property
console.log('\n' + '='.repeat(80));
console.log('SEARCH 3: Reading element.id patterns');
console.log('='.repeat(80) + '\n');

const elementIdPattern = /\.id\s*[,;)]/g;
const elementIdMatches = [];

while ((match = elementIdPattern.exec(playerjs)) !== null) {
    const start = Math.max(0, match.index - 400);
    const end = Math.min(playerjs.length, match.index + 200);
    const context = playerjs.substring(start, end);
    
    // Only keep if it also mentions textContent or innerHTML
    if (context.includes('textContent') || context.includes('innerHTML')) {
        elementIdMatches.push(context);
    }
}

console.log(`Found ${elementIdMatches.length} element.id reads with content access\n`);

elementIdMatches.slice(0, 5).forEach((context, i) => {
    console.log(`\nMatch ${i + 1}:`);
    console.log('-'.repeat(80));
    console.log(context);
    console.log('\n');
});

// Search 4: Find querySelectorAll or getElementsByTagName for divs
console.log('\n' + '='.repeat(80));
console.log('SEARCH 4: Iterating all divs patterns');
console.log('='.repeat(80) + '\n');

const iterateDivsPatterns = [
    /querySelectorAll\s*\(\s*["']div["']\s*\)/g,
    /getElementsByTagName\s*\(\s*["']div["']\s*\)/g,
    /querySelectorAll\s*\(\s*["']\[id[^\]]*\]["']\s*\)/g
];

iterateDivsPatterns.forEach((pattern, i) => {
    const matches = [];
    while ((match = pattern.exec(playerjs)) !== null) {
        const start = Math.max(0, match.index - 300);
        const end = Math.min(playerjs.length, match.index + 500);
        matches.push(playerjs.substring(start, end));
    }
    
    if (matches.length > 0) {
        console.log(`\nPattern ${i + 1}: Found ${matches.length} matches`);
        matches.slice(0, 2).forEach((context, j) => {
            console.log(`\nMatch ${j + 1}:`);
            console.log('-'.repeat(80));
            console.log(context);
        });
    }
});

// Search 5: Find eval or Function constructor (dynamic code execution)
console.log('\n' + '='.repeat(80));
console.log('SEARCH 5: Dynamic code execution (eval/Function)');
console.log('='.repeat(80) + '\n');

const evalPattern = /\beval\s*\(/g;
const functionPattern = /new\s+Function\s*\(/g;

let evalCount = 0;
while (evalPattern.exec(playerjs)) evalCount++;

let functionCount = 0;
while (functionPattern.exec(playerjs)) functionCount++;

console.log(`eval() calls: ${evalCount}`);
console.log(`new Function() calls: ${functionCount}\n`);

if (evalCount > 0 || functionCount > 0) {
    console.log('⚠️  Dynamic code execution detected!');
    console.log('The decoder might be generated at runtime.\n');
}

// Search 6: Look for specific string patterns that might be the decoder
console.log('\n' + '='.repeat(80));
console.log('SEARCH 6: Decoder-like function patterns');
console.log('='.repeat(80) + '\n');

// Look for functions that:
// 1. Take a string parameter
// 2. Do atob
// 3. Do charCodeAt (XOR)
// 4. Return a string

const decoderPattern = /function\s+(\w+)\s*\((\w+)\)\s*{[^}]{0,2000}atob[^}]{0,1000}charCodeAt[^}]{0,1000}return[^}]{0,500}}/g;
const decoderMatches = [];

while ((match = decoderPattern.exec(playerjs)) !== null) {
    decoderMatches.push({
        name: match[1],
        param: match[2],
        code: match[0]
    });
}

console.log(`Found ${decoderMatches.length} decoder-like functions\n`);

decoderMatches.forEach((decoder, i) => {
    console.log(`\nDecoder ${i + 1}: ${decoder.name}(${decoder.param})`);
    console.log('-'.repeat(80));
    console.log(decoder.code);
    console.log('\n');
});

// Save all findings
const findings = {
    getElementByIdMatches: getElementByIdMatches.length,
    windowAssignMatches: windowAssignMatches.length,
    elementIdMatches: elementIdMatches.length,
    evalCount,
    functionCount,
    decoderMatches: decoderMatches.length,
    details: {
        getElementById: getElementByIdMatches.slice(0, 3),
        windowAssign: windowAssignMatches.slice(0, 5),
        decoders: decoderMatches
    }
};

fs.writeFileSync('aggressive-search-results.json', JSON.stringify(findings, null, 2));
console.log('\n💾 Results saved to: aggressive-search-results.json\n');

console.log('\n✅ Search complete!\n');
