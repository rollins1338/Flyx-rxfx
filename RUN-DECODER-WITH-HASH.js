const fs = require('fs');
const vm = require('vm');

const obfuscated = fs.readFileSync('obfuscated-decoder.js', 'utf8');
const encodedHash = fs.readFileSync('encoded-hash.txt', 'utf8');
const divId = fs.readFileSync('div-id.txt', 'utf8').trim();

console.log('🔓 Running decoder with actual hash...\n');
console.log(`Div ID: ${divId}`);
console.log(`Encoded length: ${encodedHash.length}\n`);

// Create a sandbox with mock DOM
const sandbox = {
    window: {},
    document: {
        getElementById: function(id) {
            console.log(`📍 getElementById("${id}")`);
            if (id === divId) {
                return {
                    innerHTML: encodedHash,
                    textContent: encodedHash
                };
            }
            return null;
        }
    },
    console: console
};

try {
    // Execute the obfuscated code
    vm.createContext(sandbox);
    vm.runInContext(obfuscated, sandbox);
    
    console.log('\n✅ Script executed\n');
    
    // Check if the variable was created
    if (sandbox.window[divId]) {
        console.log('🎯🎯🎯 SUCCESS! Decoded URL:\n');
        console.log(sandbox.window[divId]);
        
        // Save it
        fs.writeFileSync('DECODED-URL.txt', sandbox.window[divId]);
        console.log('\n💾 Saved to: DECODED-URL.txt');
    } else {
        console.log('❌ Variable not created');
        console.log('Window keys:', Object.keys(sandbox.window));
    }
    
} catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
}
