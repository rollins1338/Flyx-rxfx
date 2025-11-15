const fs = require('fs');
const vm = require('vm');

/**
 * FINAL NODE.JS DECODER
 * Runs the obfuscated decoder script with our encoded hash
 */

console.log('🔓 Running obfuscated decoder in Node.js...\n');

const obfuscated = fs.readFileSync('obfuscated-decoder.js', 'utf8');
const encodedHash = fs.readFileSync('encoded-hash.txt', 'utf8');
const divId = fs.readFileSync('div-id.txt', 'utf8').trim();

console.log(`Div ID: ${divId}`);
console.log(`Encoded length: ${encodedHash.length}`);
console.log(`Decoder script size: ${obfuscated.length} bytes\n`);

// Create a complete browser-like environment
const sandbox = {
    // Window object
    window: {},
    
    // Document object with getElementById
    document: {
        getElementById: function(id) {
            console.log(`📍 document.getElementById("${id}")`);
            if (id === divId) {
                return {
                    innerHTML: encodedHash,
                    textContent: encodedHash,
                    innerText: encodedHash
                };
            }
            return null;
        },
        querySelectorAll: function(selector) {
            console.log(`📍 document.querySelectorAll("${selector}")`);
            return [];
        },
        createElement: function(tag) {
            return {
                setAttribute: function() {},
                getAttribute: function() { return null; }
            };
        }
    },
    
    // Console
    console: {
        log: function(...args) {
            console.log('[Script]', ...args);
        },
        error: function(...args) {
            console.error('[Script]', ...args);
        }
    },
    
    // Global functions
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    
    // Make window properties accessible globally
    get self() { return this; },
    get global() { return this; }
};

// Make window properties accessible
Object.setPrototypeOf(sandbox, sandbox.window);

try {
    console.log('Executing decoder script...\n');
    
    // Create context and run
    vm.createContext(sandbox);
    vm.runInContext(obfuscated, sandbox, {
        timeout: 5000,
        displayErrors: true
    });
    
    console.log('\n✅ Script executed successfully\n');
    
    // Check all window properties
    console.log('Window properties created:');
    Object.keys(sandbox.window).forEach(key => {
        console.log(`  - window.${key}`);
    });
    
    // Check if our variable was created
    if (sandbox.window[divId]) {
        console.log('\n🎯🎯🎯 SUCCESS! Decoded URL:\n');
        console.log(sandbox.window[divId]);
        console.log('\n');
        
        // Save it
        fs.writeFileSync('DECODED-M3U8-URL.txt', sandbox.window[divId]);
        console.log('💾 Saved to: DECODED-M3U8-URL.txt\n');
        
        // Verify it's a valid URL
        if (sandbox.window[divId].includes('.m3u8')) {
            console.log('✅ Valid M3U8 URL detected!\n');
        }
    } else {
        console.log('\n❌ Variable not created in window object\n');
        console.log('Checking if it was created elsewhere...\n');
        
        // Check sandbox root
        if (sandbox[divId]) {
            console.log('Found in sandbox root:', sandbox[divId]);
        }
        
        // Check all sandbox properties
        console.log('\nAll sandbox properties:');
        Object.keys(sandbox).forEach(key => {
            if (typeof sandbox[key] === 'string' && sandbox[key].length > 100) {
                console.log(`  - ${key}: ${sandbox[key].substring(0, 100)}...`);
            }
        });
    }
    
} catch (e) {
    console.error('\n❌ Error executing decoder:\n');
    console.error(e.message);
    console.error('\nStack trace:');
    console.error(e.stack);
    
    console.log('\n💡 The obfuscated script may require additional browser APIs.');
    console.log('   Try opening BROWSER-DECODER-TEST.html in a real browser instead.\n');
}
