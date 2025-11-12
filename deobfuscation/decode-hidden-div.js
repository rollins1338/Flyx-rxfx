const fs = require('fs');

// Read the nested player HTML
const files = fs.readdirSync('examples').filter(f => f.startsWith('player-nested-'));
if (files.length === 0) {
    console.log('No nested player files found');
    process.exit(1);
}

const html = fs.readFileSync(`examples/${files[0]}`, 'utf8');

// Extract the hidden div
const hiddenDivMatch = html.match(/<div\s+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([^<]+)<\/div>/i);

if (!hiddenDivMatch) {
    console.log('No hidden div found');
    process.exit(1);
}

const varName = hiddenDivMatch[1];
const encodedData = hiddenDivMatch[2];

console.log('Variable name:', varName);
console.log('Encoded data length:', encodedData.length);
console.log('\nFirst 200 chars of encoded data:');
console.log(encodedData.substring(0, 200));

console.log('\n=== DECODING ===\n');

try {
    const decoded = Buffer.from(encodedData, 'base64').toString('utf8');
    console.log('Decoded length:', decoded.length);
    console.log('\nFirst 500 chars of decoded:');
    console.log(decoded.substring(0, 500));
    
    // Check if it contains URL
    if (decoded.includes('http')) {
        console.log('\n✓ Contains HTTP URL');
        const urlMatches = decoded.match(/https?:\/\/[^\s]+/g);
        if (urlMatches) {
            console.log('\nFound URLs:');
            urlMatches.forEach(url => console.log('  -', url));
        }
    }
    
    // Check if it's another layer of encoding
    if (decoded.match(/^[A-Za-z0-9+/=]+$/)) {
        console.log('\n→ Looks like another base64 layer, decoding again...');
        try {
            const decoded2 = Buffer.from(decoded, 'base64').toString('utf8');
            console.log('\nSecond decode length:', decoded2.length);
            console.log('First 500 chars:');
            console.log(decoded2.substring(0, 500));
            
            if (decoded2.includes('http')) {
                console.log('\n✓ Contains HTTP URL');
                const urlMatches = decoded2.match(/https?:\/\/[^\s]+/g);
                if (urlMatches) {
                    console.log('\nFound URLs:');
                    urlMatches.forEach(url => console.log('  -', url));
                }
            }
        } catch (e) {
            console.log('Second decode failed:', e.message);
        }
    }
    
} catch (e) {
    console.log('Decode failed:', e.message);
}
