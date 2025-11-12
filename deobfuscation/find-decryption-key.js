/**
 * Find the decryption key and algorithm in the player driver
 */

const fs = require('fs');
const crypto = require('crypto');

console.log('=== FINDING DECRYPTION KEY IN PLAYER DRIVER ===\n');

const driver = fs.readFileSync('examples/pjs_main_drv_cast.js', 'utf-8');
const playerHtml = fs.readFileSync('examples/server1-final-player.html', 'utf-8');

// Get the hidden div data
const hiddenDivMatch = playerHtml.match(/<div\s+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([^<]+)<\/div>/i);
const varName = hiddenDivMatch[1];
const encodedData = hiddenDivMatch[2];

console.log('Hidden div variable:', varName);
console.log('Encoded data length:', encodedData.length, 'chars\n');

// The player driver must have:
// 1. A function that gets the element by ID
// 2. Decodes the base64
// 3. Decrypts the binary data
// 4. Returns the stream URL

console.log('1. Looking for AES decryption functions...\n');

// Look for AES-related code
const aesPatterns = [
    /AES[.-]?(?:128|256|CBC|CTR|GCM)/gi,
    /createDecipheriv/g,
    /crypto\.subtle/g
];

aesPatterns.forEach((pattern, i) => {
    const matches = driver.match(pattern);
    if (matches) {
        console.log(`AES Pattern ${i + 1}: Found ${matches.length} matches`);
        const unique = [...new Set(matches)];
        unique.slice(0, 5).forEach(m => console.log('  -', m));
    }
});

console.log('\n2. Looking for key/IV patterns...\n');

// Look for hex strings that might be keys (32 or 64 chars)
const hexKeyPattern = /["']([a-f0-9]{32,64})["']/gi;
const hexKeys = [...driver.matchAll(hexKeyPattern)];

if (hexKeys.length > 0) {
    console.log(`Found ${hexKeys.length} potential hex keys (showing first 10):`);
    const uniqueKeys = [...new Set(hexKeys.map(m => m[1]))];
    uniqueKeys.slice(0, 10).forEach(key => {
        console.log(`  - ${key} (${key.length} chars)`);
    });
}

console.log('\n3. Looking for the file processing logic...\n');

// Search for where the file parameter is actually used
const fileUsage = driver.match(/this\.file[\s\S]{0,1000}/g);
if (fileUsage) {
    console.log('Found file usage (first 2):');
    fileUsage.slice(0, 2).forEach((usage, i) => {
        console.log(`\nUsage ${i + 1}:`);
        console.log(usage.substring(0, 500) + '...');
    });
}

console.log('\n4. ATTEMPTING COMMON DECRYPTION METHODS...\n');

// Try common decryption approaches
const decoded = Buffer.from(encodedData, 'base64');

// Try XOR with common keys
const xorKeys = ['playerjs', 'cloudnestra', 'vidsrc', 'stream'];
console.log('Trying XOR decryption with common keys...');
xorKeys.forEach(key => {
    const result = Buffer.alloc(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
        result[i] = decoded[i] ^ key.charCodeAt(i % key.length);
    }
    const str = result.toString('utf8', 0, Math.min(100, result.length));
    if (str.includes('http') || str.includes('m3u8')) {
        console.log(`✓ XOR with "${key}" might work!`);
        console.log('Result:', str);
    }
});

console.log('\n5. CHECKING FOR EMBEDDED KEYS IN HTML...\n');

// Sometimes keys are embedded in the HTML itself
const htmlKeys = playerHtml.match(/key\s*[:=]\s*["']([^"']{16,})["']/gi);
if (htmlKeys) {
    console.log('Found potential keys in HTML:');
    htmlKeys.forEach(k => console.log('  -', k));
}

console.log('\n=== CONCLUSION ===\n');
console.log('The decryption requires:');
console.log('1. The exact algorithm (likely AES-256-CBC or similar)');
console.log('2. The decryption key (embedded in the player driver)');
console.log('3. The IV (initialization vector)');
console.log('\nWithout reverse engineering the 837KB player driver,');
console.log('we cannot decrypt the stream URL programmatically.');
console.log('\nThe ONLY way forward without Puppeteer is to:');
console.log('1. Fully deobfuscate the player driver script');
console.log('2. Extract the exact decryption function');
console.log('3. Reimplement it in Node.js');
console.log('\nOR use an existing extractor that has already done this work.');
