const fs = require('fs');

/**
 * Unpack the eval-packed PlayerJS
 */

const playerjs = fs.readFileSync('pjs_main_drv_cast.js', 'utf8');

console.log('🔍 Unpacking eval-packed PlayerJS...\n');

// Extract the eval content
const evalMatch = playerjs.match(/eval\((function\(p,a,c,k,e,d\){[\s\S]+})\)/);

if (!evalMatch) {
    console.log('❌ Could not find eval pattern');
    process.exit(1);
}

console.log('✅ Found eval pattern\n');

// The unpacker function
const unpackerCode = evalMatch[1];

console.log('📦 Executing unpacker...\n');

try {
    // Execute the unpacker to get the original code
    const unpacked = eval('(' + unpackerCode + ')');
    
    console.log(`✅ Unpacked! Size: ${unpacked.length} bytes\n`);
    
    // Save unpacked code
    fs.writeFileSync('playerjs-unpacked.js', unpacked);
    console.log('💾 Saved to: playerjs-unpacked.js\n');
    
    // Now search the unpacked code for our patterns
    console.log('🔍 Searching unpacked code for decoder patterns...\n');
    
    // Search for getElementById + textContent
    if (unpacked.includes('getElementById') && unpacked.includes('textContent')) {
        console.log('✅ Contains getElementById + textContent');
        
        const pattern = /getElementById\([^)]+\)[^;]*textContent/g;
        let match;
        let count = 0;
        
        while ((match = pattern.exec(unpacked)) !== null && count < 5) {
            const start = Math.max(0, match.index - 200);
            const end = Math.min(unpacked.length, match.index + 300);
            console.log(`\nMatch ${++count}:`);
            console.log('-'.repeat(80));
            console.log(unpacked.substring(start, end));
        }
    }
    
    // Search for window[] assignments
    if (unpacked.includes('window[')) {
        console.log('\n✅ Contains window[] assignments');
        
        const pattern = /window\[([^\]]+)\]\s*=/g;
        let match;
        let count = 0;
        
        while ((match = pattern.exec(unpacked)) !== null && count < 5) {
            const start = Math.max(0, match.index - 200);
            const end = Math.min(unpacked.length, match.index + 200);
            console.log(`\nAssignment ${++count}: window[${match[1]}] =`);
            console.log('-'.repeat(80));
            console.log(unpacked.substring(start, end));
        }
    }
    
    // Search for atob
    if (unpacked.includes('atob')) {
        console.log('\n✅ Contains atob');
        
        const pattern = /atob\([^)]+\)/g;
        const matches = unpacked.match(pattern);
        console.log(`Found ${matches ? matches.length : 0} atob calls`);
        
        if (matches) {
            matches.slice(0, 5).forEach((m, i) => {
                console.log(`  ${i + 1}. ${m}`);
            });
        }
    }
    
    console.log('\n✅ Unpacking complete!\n');
    console.log('Now search playerjs-unpacked.js for the decoder logic.\n');
    
} catch (e) {
    console.error('❌ Error unpacking:', e.message);
}
