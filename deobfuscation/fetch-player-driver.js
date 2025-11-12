const https = require('https');
const fs = require('fs');

const url = 'https://cloudnestra.com/pjs/pjs_main_drv_cast.061125.js?_=1762464381';

console.log('Fetching player driver script...');
console.log('URL:', url, '\n');

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cloudnestra.com/'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Length:', data.length, 'bytes\n');
        
        if (res.statusCode === 200 && data.length > 0) {
            const filename = 'examples/pjs_main_drv_cast.js';
            fs.writeFileSync(filename, data);
            console.log('✓ Saved to:', filename);
            
            console.log('\n=== Quick Analysis ===\n');
            
            // Look for m3u8
            if (data.includes('m3u8')) {
                console.log('✓ Contains m3u8 references');
                const m3u8Matches = data.match(/["']([^"']*m3u8[^"']*)["']/g);
                if (m3u8Matches) {
                    console.log('\nM3U8 patterns:');
                    [...new Set(m3u8Matches)].slice(0, 10).forEach(m => console.log('  -', m));
                }
            }
            
            // Look for URLs
            const urlMatches = data.match(/https?:\/\/[^\s"'<>]+/g);
            if (urlMatches) {
                console.log('\nURLs found:');
                [...new Set(urlMatches)].slice(0, 15).forEach(url => console.log('  -', url));
            }
            
            // Look for encrypted/encoded data
            if (data.includes('atob') || data.includes('decrypt')) {
                console.log('\n✓ Contains encryption/decryption logic');
            }
            
            // Look for fetch/ajax calls
            const fetchMatches = data.match(/fetch\([^)]+\)|ajax\([^)]+\)/g);
            if (fetchMatches) {
                console.log('\nAPI calls:');
                fetchMatches.slice(0, 5).forEach(call => console.log('  -', call.substring(0, 80)));
            }
            
            console.log('\n=== First 2000 characters ===');
            console.log(data.substring(0, 2000));
            console.log('...\n');
        } else {
            console.log('✗ Failed to fetch');
        }
    });
}).on('error', err => {
    console.log('✗ Error:', err.message);
});
