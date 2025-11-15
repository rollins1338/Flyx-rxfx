const fs = require('fs');

const obfuscated = fs.readFileSync('obfuscated-decoder.js', 'utf8');

console.log('🔓 Deobfuscating decoder script...\n');
console.log(`Size: ${obfuscated.length} bytes\n`);

// This is obfuscator.io style obfuscation
// The code is wrapped in an IIFE and uses a lookup array

// Try to execute it in a sandbox to see what it does
console.log('Executing in sandbox to capture behavior...\n');

// Create a mock environment
const sandbox = {
    document: {
        querySelectorAll: function(selector) {
            console.log(`📍 querySelectorAll("${selector}")`);
            
            // Return mock divs with our test data
            if (selector.includes('[id^="pjsdiv"]') || selector === 'div[id^="pjsdiv"]') {
                const encoded = fs.readFileSync('encoded-hash.txt', 'utf8');
                const divId = fs.readFileSync('div-id.txt', 'utf8').trim();
                
                return [{
                    id: divId,
                    innerHTML: encoded,
                    textContent: encoded
                }];
            }
            return [];
        },
        getElementById: function(id) {
            console.log(`📍 getElementById("${id}")`);
            return null;
        }
    },
    window: {},
    console: console
};

// Wrap the code to capture window assignments
const wrappedCode = `
(function() {
    const originalWindow = {};
    const windowProxy = new Proxy(originalWindow, {
        set(target, property, value) {
            console.log('📍 window["' + property + '"] = ' + (typeof value === 'string' ? v