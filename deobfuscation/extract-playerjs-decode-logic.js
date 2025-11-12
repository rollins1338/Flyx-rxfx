/**
 * Extract the Playerjs decoding logic for the hidden div data
 */

const fs = require('fs');

console.log('=== EXTRACTING PLAYERJS DECODE LOGIC ===\n');

const driver = fs.readFileSync('examples/pjs_main_drv_cast.js', 'utf-8');
const playerHtml = fs.readFileSync('examples/server1-final-player.html', 'utf-8');

// Get the hidden div variable name and data
const hiddenDivMatch = playerHtml.match(/<div\s+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([^<]+)<\/div>/i);

if (!hiddenDivMatch) {
    console.log('✗ No hidden div found');
    process.exit(1);
}

const varName = hiddenDivMatch[1];
const encodedData = hiddenDivMatch[2];

console.log('Variable name:', varName);
console.log('Encoded data length:', encodedData.length);
console.log('\nSearching for how Playerjs processes this...\n');

// The key insight: when you pass `file: varName` to Playerjs,
// it likely does: document.getElementById(varName).textContent
// OR it checks if the file parameter is a string that matches an element ID

// Look for patterns that get element by ID and process its content
const patterns = [
    /getElementById\s*\(\s*[^)]+\s*\)\.(?:textContent|innerHTML|innerText)/g,
    /document\.getElementById[^;]{0,200}/g,
    /\.textContent[^;]{0,100}/g
];

console.log('1. Looking for getElementById patterns...\n');
patterns.forEach((pattern, i) => {
    const matches = [...driver.matchAll(pattern)];
    if (matches.length > 0) {
        console.log(`Pattern ${i + 1}: Found ${matches.length} matches (showing first 3):`);
        matches.slice(0, 3).forEach(m => {
            console.log('  ', m[0].substring(0, 150));
        });
        console.log('');
    }
});

// Look for where the file parameter is processed in Playerjs constructor
console.log('2. Looking for file parameter processing...\n');

// Search for "this.file" or similar
const fileProcessing = driver.match(/this\.file\s*=[\s\S]{0,500}/g);
if (fileProcessing) {
    console.log('Found file assignment (first 3):');
    fileProcessing.slice(0, 3).forEach(fp => {
        console.log(fp.substring(0, 300) + '...\n');
    });
}

// Look for the actual decoding - it's likely base64 decode followed by some processing
console.log('3. Looking for base64 decode operations...\n');

const atobPatterns = driver.match(/atob\s*\([^)]+\)[^;]{0,200}/g);
if (atobPatterns) {
    console.log(`Found ${atobPatterns.length} atob operations (showing first 5):`);
    [...new Set(atobPatterns)].slice(0, 5).forEach(p => {
        console.log('  ', p.substring(0, 150));
    });
}

// The most likely scenario: Playerjs checks if file is an element ID,
// gets its content, decodes it, and uses it as the source
console.log('\n4. HYPOTHESIS:\n');
console.log('When you pass `file: varName` to Playerjs:');
console.log('  1. It checks if varName is an element ID');
console.log('  2. Gets: document.getElementById(varName).textContent');
console.log('  3. Decodes the base64 data');
console.log('  4. Processes it as the stream source');

console.log('\n5. TESTING THE HYPOTHESIS:\n');

// Try to decode the hidden div data ourselves
try {
    const decoded = Buffer.from(encodedData, 'base64');
    console.log('Base64 decoded length:', decoded.length, 'bytes');
    console.log('First 100 bytes (hex):', decoded.toString('hex').substring(0, 200));
    console.log('First 100 bytes (utf8):', decoded.toString('utf8').substring(0, 200));
    
    // Check if it's another layer of encoding
    const decodedStr = decoded.toString('utf8');
    if (/^[A-Za-z0-9+/=]+$/.test(decodedStr.substring(0, 100))) {
        console.log('\n→ Looks like another base64 layer...');
        try {
            const decoded2 = Buffer.from(decodedStr, 'base64');
            console.log('Second decode length:', decoded2.length, 'bytes');
            console.log('Second decode (utf8):', decoded2.toString('utf8').substring(0, 200));
        } catch (e) {
            console.log('Second decode failed');
        }
    }
    
    // Check if it contains JSON
    if (decodedStr.trim().startsWith('{') || decodedStr.trim().startsWith('[')) {
        console.log('\n→ Looks like JSON data');
        try {
            const json = JSON.parse(decodedStr);
            console.log('Parsed JSON:', JSON.stringify(json, null, 2).substring(0, 500));
        } catch (e) {
            console.log('JSON parse failed');
        }
    }
    
} catch (e) {
    console.log('Decode error:', e.message);
}

console.log('\n=== CONCLUSION ===\n');
console.log('The hidden div contains encrypted/encoded stream data.');
console.log('The Playerjs driver script decodes it when the player initializes.');
console.log('\nTo extract the M3U8 URL without browser automation, we need to:');
console.log('1. Reverse engineer the exact decoding algorithm from the driver');
console.log('2. OR find an API endpoint that returns the decoded stream URL');
console.log('3. OR use the fact that the player makes network requests we can intercept');
