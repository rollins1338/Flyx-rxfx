/**
 * Fetch and analyze the sources.js file from VidSrc
 * This file contains the critical decryption logic
 */

const https = require('https');
const fs = require('fs');

// Try to fetch sources.js from VidSrc
const sourcesUrl = 'https://vidsrc.xyz/sources.js?t=1745104089';

console.log('Fetching sources.js from:', sourcesUrl);
console.log('This file contains the decryption logic...\n');

https.get(sourcesUrl, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://vidsrc.xyz/'
    }
}, (res) => {
    let data = '';
    
    console.log('Status Code:', res.statusCode);
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('Response received. Length:', data.length, 'bytes\n');
        
        if (res.statusCode === 200 && data.length > 0) {
            // Save the file
            const filename = 'examples/sources.js';
            fs.writeFileSync(filename, data);
            console.log(`✓ Saved to: ${filename}\n`);
            
            // Analyze the content
            console.log('=== Quick Analysis ===\n');
            
            // Check if it's obfuscated
            if (data.includes('eval') || data.includes('\\x')) {
                console.log('⚠ File appears to be obfuscated');
            }
            
            // Look for key functions
            const patterns = {
                'decrypt': /decrypt|Decrypt|DECRYPT/g,
                'encode': /encode|Encode|btoa|atob/g,
                'fetch/ajax': /fetch|ajax|XMLHttpRequest/g,
                'm3u8': /m3u8|M3U8|playlist/g,
                'AES': /AES|aes|crypto/g,
                'base64': /base64|Base64|BASE64/g
            };
            
            console.log('Pattern matches:');
            Object.entries(patterns).forEach(([name, pattern]) => {
                const matches = data.match(pattern);
                if (matches) {
                    console.log(`  ${name}: ${matches.length} occurrences`);
                }
            });
            
            // Look for API endpoints
            console.log('\nSearching for API endpoints...');
            const urlPattern = /https?:\/\/[^\s"'`]+/g;
            const urls = data.match(urlPattern);
            if (urls) {
                const uniqueUrls = [...new Set(urls)];
                console.log('Found URLs:');
                uniqueUrls.forEach(url => {
                    console.log(`  - ${url}`);
                });
            }
            
            // Look for function definitions
            console.log('\nSearching for function definitions...');
            const funcPattern = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
            const functions = [];
            let match;
            while ((match = funcPattern.exec(data)) !== null) {
                functions.push(match[1]);
            }
            if (functions.length > 0) {
                console.log(`Found ${functions.length} named functions:`);
                functions.slice(0, 20).forEach(fn => {
                    console.log(`  - ${fn}()`);
                });
                if (functions.length > 20) {
                    console.log(`  ... and ${functions.length - 20} more`);
                }
            }
            
            // Show first 500 characters
            console.log('\n=== First 500 characters ===');
            console.log(data.substring(0, 500));
            console.log('...\n');
            
            // Show last 200 characters
            console.log('=== Last 200 characters ===');
            console.log('...');
            console.log(data.substring(data.length - 200));
            
        } else {
            console.log('❌ Failed to fetch or empty response');
            console.log('Response:', data);
        }
    });
}).on('error', (err) => {
    console.error('❌ Error:', err.message);
    console.log('\nTrying alternative approach...');
    
    // Try fetching from the main page first
    console.log('Fetching main VidSrc page to get current sources.js URL...');
    
    https.get('https://vidsrc.xyz/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    }, (res) => {
        let html = '';
        res.on('data', chunk => html += chunk);
        res.on('end', () => {
            // Look for sources.js reference
            const match = html.match(/sources\.js\?t=(\d+)/);
            if (match) {
                console.log(`Found sources.js with timestamp: ${match[1]}`);
                console.log(`Try: https://vidsrc.xyz/sources.js?t=${match[1]}`);
            } else {
                console.log('Could not find sources.js reference in main page');
            }
        });
    }).on('error', err => {
        console.error('Failed to fetch main page:', err.message);
    });
});
