/**
 * Extract stream from 2Embed provider (simpler than CloudStream)
 */

const https = require('https');

console.log('=== EXTRACTING FROM 2EMBED PROVIDER ===\n');

// From server2-final-player.html
const swishUrl = 'https://streamsrcs.2embed.cc/swish?id=1lzngys5exf9';

console.log('Swish URL:', swishUrl);
console.log('Fetching...\n');

https.get(swishUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.2embed.cc/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
}, (res) => {
    let data = '';
    
    res.on('data', chunk => data += chunk);
    
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Length:', data.length, 'bytes\n');
        
        if (res.statusCode === 200 && data.length > 0) {
            // Save the response
            const fs = require('fs');
            fs.writeFileSync('examples/2embed-swish-response.html', data);
            console.log('✓ Saved to examples/2embed-swish-response.html\n');
            
            // Look for m3u8 URLs
            const m3u8Matches = data.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
            if (m3u8Matches) {
                console.log('🎉 FOUND M3U8 URLs:');
                m3u8Matches.forEach(url => console.log('  -', url));
            } else {
                console.log('No direct M3U8 URLs found');
                
                // Look for other video sources
                const videoSources = data.match(/(?:src|source|file|url)\s*[:=]\s*["']([^"']+)["']/gi);
                if (videoSources) {
                    console.log('\nFound video source patterns:');
                    videoSources.slice(0, 10).forEach(s => console.log('  -', s));
                }
                
                // Look for base64 encoded data
                const base64Data = data.match(/atob\s*\(\s*["']([A-Za-z0-9+/=]{50,})["']\s*\)/g);
                if (base64Data) {
                    console.log('\nFound base64 encoded data (first 3):');
                    base64Data.slice(0, 3).forEach(b64 => {
                        const match = b64.match(/["']([A-Za-z0-9+/=]+)["']/);
                        if (match) {
                            try {
                                const decoded = Buffer.from(match[1], 'base64').toString('utf8');
                                if (decoded.includes('http') || decoded.includes('m3u8')) {
                                    console.log('  Decoded:', decoded.substring(0, 200));
                                }
                            } catch (e) {}
                        }
                    });
                }
            }
            
            // Show first 1000 chars
            console.log('\n=== First 1000 characters ===');
            console.log(data.substring(0, 1000));
            
        } else {
            console.log('✗ Failed to fetch');
            console.log('Response:', data);
        }
    });
}).on('error', err => {
    console.error('✗ Error:', err.message);
});
