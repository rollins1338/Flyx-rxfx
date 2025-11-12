/**
 * Decode the hidden div data from the final player
 */

const fs = require('fs');

console.log('=== DECODING HIDDEN DIV DATA ===\n');

// Read the saved player file
const html = fs.readFileSync('examples/server1-final-player.html', 'utf-8');

// Extract the hidden div content
const hiddenDivMatch = html.match(/<div\s+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([^<]+)<\/div>/i);

if (!hiddenDivMatch) {
    console.log('✗ No hidden div found');
    process.exit(1);
}

const divId = hiddenDivMatch[1];
const encodedData = hiddenDivMatch[2];

console.log('Hidden Div ID:', divId);
console.log('Encoded Data Length:', encodedData.length, 'chars');
console.log('Sample:', encodedData.substring(0, 100) + '...\n');

// Try to decode as base64
try {
    const decoded = Buffer.from(encodedData, 'base64').toString('utf-8');
    console.log('Base64 Decoded Length:', decoded.length, 'chars');
    console.log('Decoded Sample:', decoded.substring(0, 200));
    
    // Look for URLs
    const urls = decoded.match(/https?:\/\/[^\s"'<>]+/g);
    if (urls) {
        console.log('\n🎯 URLs found in decoded data:');
        urls.forEach(url => console.log('  -', url));
    }
    
    // Look for m3u8
    if (decoded.includes('m3u8')) {
        console.log('\n🎉 M3U8 reference found!');
        const m3u8Match = decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
        if (m3u8Match) {
            console.log('M3U8 URL:', m3u8Match[0]);
        }
    }
    
    // Save decoded data
    fs.writeFileSync('examples/decoded-hidden-div.txt', decoded);
    console.log('\n✓ Saved decoded data to examples/decoded-hidden-div.txt');
    
} catch (e) {
    console.log('✗ Base64 decode failed:', e.message);
    
    // Try other decoding methods
    console.log('\nTrying alternative decoding...');
    
    // Check if it's hex
    if (/^[0-9a-fA-F]+$/.test(encodedData.substring(0, 100))) {
        console.log('Looks like hex encoding');
        try {
            const hexDecoded = Buffer.from(encodedData, 'hex').toString('utf-8');
            console.log('Hex decoded:', hexDecoded.substring(0, 200));
        } catch (e2) {
            console.log('Hex decode failed');
        }
    }
}
