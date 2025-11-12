/**
 * Extract stream from YesMovies provider (the actual provider behind 2Embed)
 */

const https = require('https');
const fs = require('fs');

console.log('=== EXTRACTING FROM YESMOVIES PROVIDER ===\n');

// From swish.js: https://yesmovies.baby/e/ + id
const streamId = '1lzngys5exf9';
const yesmoviesUrl = `https://yesmovies.baby/e/${streamId}`;

console.log('YesMovies URL:', yesmoviesUrl);
console.log('Fetching...\n');

https.get(yesmoviesUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://streamsrcs.2embed.cc/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
}, (res) => {
    let data = '';
    
    res.on('data', chunk => data += chunk);
    
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Length:', data.length, 'bytes\n');
        
        if (res.statusCode === 200 && data.length > 0) {
            fs.writeFileSync('examples/yesmovies-player.html', data);
            console.log('✓ Saved to examples/yesmovies-player.html\n');
            
            // Look for direct M3U8 URLs
            const m3u8Matches = data.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g);
            if (m3u8Matches) {
                console.log('🎉 FOUND M3U8 URLs:');
                m3u8Matches.forEach(url => console.log('  -', url));
                console.log('\n✅ SUCCESS! We have the M3U8 URL!\n');
                return;
            }
            
            // Look for video sources
            const sourcePatterns = [
                /(?:file|source|src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/gi,
                /sources\s*:\s*\[{[^}]*file\s*:\s*["']([^"']+)["']/gi,
                /"file"\s*:\s*"([^"]+)"/gi
            ];
            
            console.log('Looking for video source patterns...\n');
            sourcePatterns.forEach((pattern, i) => {
                const matches = [...data.matchAll(pattern)];
                if (matches.length > 0) {
                    console.log(`Pattern ${i + 1}: Found ${matches.length} matches`);
                    matches.forEach(m => console.log('  -', m[1]));
                }
            });
            
            // Look for base64 encoded sources
            console.log('\nLooking for base64 encoded sources...\n');
            const base64Pattern = /atob\s*\(\s*["']([A-Za-z0-9+/=]{50,})["']\s*\)/g;
            const base64Matches = [...data.matchAll(base64Pattern)];
            
            if (base64Matches.length > 0) {
                console.log(`Found ${base64Matches.length} base64 strings (decoding first 5):`);
                base64Matches.slice(0, 5).forEach((match, i) => {
                    try {
                        const decoded = Buffer.from(match[1], 'base64').toString('utf8');
                        if (decoded.includes('http') || decoded.includes('m3u8') || decoded.includes('.ts')) {
                            console.log(`\n  Base64 ${i + 1} decoded:`);
                            console.log('  ', decoded.substring(0, 200));
                            
                            // Extract URLs from decoded data
                            const urls = decoded.match(/https?:\/\/[^\s"'<>]+/g);
                            if (urls) {
                                console.log('  URLs found:');
                                urls.forEach(url => console.log('    -', url));
                            }
                        }
                    } catch (e) {}
                });
            }
            
            // Look for JWPlayer or other player configs
            console.log('\nLooking for player configurations...\n');
            const jwplayerMatch = data.match(/jwplayer[^;]*setup\s*\([^)]*\)/gi);
            if (jwplayerMatch) {
                console.log('Found JWPlayer setup:');
                jwplayerMatch.forEach(setup => console.log('  ', setup.substring(0, 200)));
            }
            
            // Show first 2000 chars
            console.log('\n=== First 2000 characters ===');
            console.log(data.substring(0, 2000));
            
        } else {
            console.log('✗ Failed to fetch');
            console.log('Response:', data);
        }
    });
}).on('error', err => {
    console.error('✗ Error:', err.message);
});
