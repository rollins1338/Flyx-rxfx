/**
 * Fetch the player driver and analyze how it decodes the hidden div data
 */

const https = require('https');
const fs = require('fs');

console.log('=== FETCHING PLAYER DRIVER SCRIPT ===\n');

// Extract the driver URL from the saved player file
const playerHtml = fs.readFileSync('examples/server1-final-player.html', 'utf-8');
const driverMatch = playerHtml.match(/src=["']([^"']*pjs_main_drv[^"']*)["']/);

if (!driverMatch) {
    console.log('✗ Could not find player driver script reference');
    process.exit(1);
}

let driverUrl = driverMatch[1];
if (driverUrl.startsWith('/')) {
    driverUrl = 'https://cloudnestra.com' + driverUrl;
}

console.log('Driver URL:', driverUrl);
console.log('Fetching...\n');

https.get(driverUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cloudnestra.com/',
        'Accept': '*/*'
    }
}, (res) => {
    let data = '';
    
    res.on('data', chunk => data += chunk);
    
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Size:', data.length, 'bytes\n');
        
        if (res.statusCode === 200 && data.length > 0) {
            // Save the driver script
            fs.writeFileSync('examples/pjs_main_drv_cast.js', data);
            console.log('✓ Saved to examples/pjs_main_drv_cast.js\n');
            
            // Now analyze how it decodes the hidden div data
            console.log('=== ANALYZING DECODING LOGIC ===\n');
            
            // Look for the Playerjs constructor or file handling
            const playerJsMatch = data.match(/function\s+Playerjs\s*\([^)]*\)\s*{[\s\S]{0,5000}}/);
            if (playerJsMatch) {
                console.log('Found Playerjs constructor (first 500 chars):');
                console.log(playerJsMatch[0].substring(0, 500) + '...\n');
            }
            
            // Look for decode/decrypt functions
            const decodePatterns = [
                /function\s+(\w+)\s*\([^)]*\)\s*{[\s\S]{0,300}atob[\s\S]{0,300}}/g,
                /(\w+)\s*=\s*function\s*\([^)]*\)\s*{[\s\S]{0,300}decode[\s\S]{0,300}}/gi,
                /function\s+(\w+)\s*\([^)]*\)\s*{[\s\S]{0,300}decrypt[\s\S]{0,300}}/gi
            ];
            
            console.log('Looking for decode/decrypt functions...\n');
            decodePatterns.forEach((pattern, i) => {
                const matches = [...data.matchAll(pattern)];
                if (matches.length > 0) {
                    console.log(`Pattern ${i + 1}: Found ${matches.length} matches`);
                    matches.slice(0, 2).forEach(m => {
                        console.log('Function:', m[1] || 'anonymous');
                        console.log(m[0].substring(0, 200) + '...\n');
                    });
                }
            });
            
            // Look for how the file parameter is processed
            console.log('Looking for file parameter processing...\n');
            const fileProcessing = data.match(/this\.file[\s\S]{0,500}/g);
            if (fileProcessing) {
                console.log('Found file processing (first match):');
                console.log(fileProcessing[0].substring(0, 300) + '...\n');
            }
            
            // Look for m3u8 or playlist references
            console.log('Looking for m3u8/playlist handling...\n');
            const m3u8Refs = data.match(/.{0,100}m3u8.{0,100}/gi);
            if (m3u8Refs) {
                console.log(`Found ${m3u8Refs.length} m3u8 references (showing first 5):`);
                m3u8Refs.slice(0, 5).forEach(ref => {
                    console.log('  -', ref.trim());
                });
            }
            
            console.log('\n=== NEXT STEP ===\n');
            console.log('The driver script is saved. Now we need to:');
            console.log('1. Find the exact function that processes the hidden div data');
            console.log('2. Extract the decoding/decryption logic');
            console.log('3. Implement it in our extractor');
            console.log('\nRun: node deobfuscation/analyze-player-driver.js');
            
        } else {
            console.log('✗ Failed to fetch driver script');
            console.log('Response:', data.substring(0, 500));
        }
    });
}).on('error', err => {
    console.error('✗ Error:', err.message);
});
