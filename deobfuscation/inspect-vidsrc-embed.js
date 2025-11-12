const https = require('https');

function fetch(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function inspect(tmdbId) {
    const url = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    console.log('Fetching:', url, '\n');
    
    try {
        const html = await fetch(url);
        
        console.log('Response length:', html.length, 'bytes\n');
        
        // Look for iframes
        console.log('=== IFRAMES ===');
        const iframeMatches = html.match(/<iframe[^>]*>/gi);
        if (iframeMatches) {
            console.log('Found', iframeMatches.length, 'iframe(s):');
            iframeMatches.forEach((iframe, i) => {
                console.log(`\n${i + 1}.`, iframe.substring(0, 200));
            });
        } else {
            console.log('No iframes found');
        }
        
        // Look for data-hash attributes
        console.log('\n\n=== DATA-HASH ATTRIBUTES ===');
        const hashMatches = html.match(/data-hash=["']([^"']+)["']/gi);
        if (hashMatches) {
            console.log('Found', hashMatches.length, 'data-hash attribute(s):');
            hashMatches.forEach((hash, i) => {
                console.log(`\n${i + 1}.`, hash);
                const hashValue = hash.match(/data-hash=["']([^"']+)["']/)[1];
                try {
                    const decoded = Buffer.from(hashValue, 'base64').toString('utf8');
                    console.log('   Decoded:', decoded);
                } catch (e) {
                    console.log('   Failed to decode');
                }
            });
        } else {
            console.log('No data-hash attributes found');
        }
        
        // Look for any base64 encoded data
        console.log('\n\n=== BASE64 PATTERNS ===');
        const base64Matches = html.match(/["']([A-Za-z0-9+/=]{50,})["']/g);
        if (base64Matches) {
            console.log('Found', base64Matches.length, 'potential base64 strings');
            base64Matches.slice(0, 5).forEach((b64, i) => {
                const value = b64.match(/["']([^"']+)["']/)[1];
                try {
                    const decoded = Buffer.from(value, 'base64').toString('utf8');
                    if (decoded.includes('http') || decoded.includes('embed')) {
                        console.log(`\n${i + 1}. Decoded URL:`, decoded);
                    }
                } catch (e) {}
            });
        }
        
        // Look for script tags with sources
        console.log('\n\n=== SCRIPT SOURCES ===');
        const scriptMatches = html.match(/<script[^>]*src=["']([^"']+)["']/gi);
        if (scriptMatches) {
            console.log('Found', scriptMatches.length, 'external script(s):');
            scriptMatches.slice(0, 10).forEach((script, i) => {
                const src = script.match(/src=["']([^"']+)["']/)[1];
                console.log(`${i + 1}.`, src);
            });
        }
        
        // Save full HTML for inspection
        const fs = require('fs');
        fs.writeFileSync('examples/vidsrc-embed-page.html', html);
        console.log('\n\n✓ Full HTML saved to examples/vidsrc-embed-page.html');
        
        // Show first 2000 chars
        console.log('\n\n=== FIRST 2000 CHARACTERS ===');
        console.log(html.substring(0, 2000));
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

const tmdbId = process.argv[2] || '550';
inspect(tmdbId);
