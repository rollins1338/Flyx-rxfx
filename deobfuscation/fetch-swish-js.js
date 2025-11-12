/**
 * Fetch the swish.js script that contains the stream logic
 */

const https = require('https');
const fs = require('fs');

console.log('=== FETCHING SWISH.JS ===\n');

const swishJsUrl = 'https://streamsrcs.2embed.cc/swish.js';

console.log('URL:', swishJsUrl);
console.log('Fetching...\n');

https.get(swishJsUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://streamsrcs.2embed.cc/',
        'Accept': '*/*'
    }
}, (res) => {
    let data = '';
    
    res.on('data', chunk => data += chunk);
    
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Length:', data.length, 'bytes\n');
        
        if (res.statusCode === 200 && data.length > 0) {
            fs.writeFileSync('examples/swish.js', data);
            console.log('✓ Saved to examples/swish.js\n');
            
            // Look for m3u8 or stream URLs
            const m3u8Refs = data.match(/.{0,100}m3u8.{0,100}/gi);
            if (m3u8Refs) {
                console.log(`Found ${m3u8Refs.length} m3u8 references (first 5):`);
                m3u8Refs.slice(0, 5).forEach(ref => console.log('  -', ref.trim()));
            }
            
            // Look for API endpoints
            const urls = data.match(/https?:\/\/[^\s"'`]+/g);
            if (urls) {
                const unique = [...new Set(urls)];
                console.log(`\nFound ${unique.length} unique URLs:`);
                unique.forEach(url => console.log('  -', url));
            }
            
            // Look for fetch/ajax calls
            const fetchCalls = data.match(/fetch\s*\([^)]+\)|ajax\s*\([^)]+\)/g);
            if (fetchCalls) {
                console.log(`\nFound ${fetchCalls.length} fetch/ajax calls (first 5):`);
                fetchCalls.slice(0, 5).forEach(call => console.log('  -', call.substring(0, 100)));
            }
            
            // Show first 1000 chars
            console.log('\n=== First 1000 characters ===');
            console.log(data.substring(0, 1000));
            
        } else {
            console.log('✗ Failed to fetch');
        }
    });
}).on('error', err => {
    console.error('✗ Error:', err.message);
});
