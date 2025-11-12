/**
 * Extract nested iframe hashes from all three server pages
 */

const fs = require('fs');
const https = require('https');

const servers = ['cloudstream', 'embed2', 'superembed'];

console.log('=== Extracting Nested Iframes from All Servers ===\n');

async function extractAndFetch(serverName) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`SERVER: ${serverName.toUpperCase()}`);
        console.log('='.repeat(70));
        
        const filename = `examples/${serverName}-player.html`;
        
        try {
            const html = fs.readFileSync(filename, 'utf-8');
            
            // Look for iframe src with hash
            const iframeMatch = html.match(/src:\s*['"]\/prorcp\/([^'"]+)['"]/);
            
            if (iframeMatch) {
                const nestedHash = iframeMatch[1];
                console.log('\n✓ Found nested iframe hash');
                console.log('  Hash:', nestedHash.substring(0, 80) + '...');
                
                // Decode it
                try {
                    const firstDecode = Buffer.from(nestedHash, 'base64').toString('utf-8');
                    const [md5, data] = firstDecode.split(':');
                    console.log('  MD5:', md5);
                    
                    // Fetch the final player
                    const url = `https://cloudnestra.com/prorcp/${nestedHash}`;
                    console.log('\n  Fetching final player...');
                    
                    https.get(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Referer': 'https://cloudnestra.com/'
                        }
                    }, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            console.log('  Status:', res.statusCode);
                            console.log('  Length:', data.length, 'bytes');
                            
                            if (res.statusCode === 200 && data.length > 0) {
                                const finalFilename = `examples/${serverName}-final-player.html`;
                                fs.writeFileSync(finalFilename, data);
                                console.log('  ✓ Saved to:', finalFilename);
                                
                                // Check for m3u8
                                const hasM3u8 = data.includes('m3u8');
                                const hasHls = data.includes('hls.js') || data.includes('Hls');
                                const hasPlyr = data.includes('plyr');
                                
                                console.log('\n  Analysis:');
                                console.log('    Has M3U8:', hasM3u8 ? '✓' : '✗');
                                console.log('    Has HLS.js:', hasHls ? '✓' : '✗');
                                console.log('    Has Plyr:', hasPlyr ? '✓' : '✗');
                                
                                // Look for m3u8 URLs
                                if (hasM3u8) {
                                    const m3u8Matches = data.match(/https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/g);
                                    if (m3u8Matches) {
                                        console.log('\n    🎉 M3U8 URLs found:');
                                        m3u8Matches.forEach(url => console.log('      -', url));
                                    }
                                }
                                
                                // Look for encrypted sources
                                const encryptedMatch = data.match(/encrypted[^}]*source[^}]*["']([^"']+)["']/i);
                                if (encryptedMatch) {
                                    console.log('\n    Encrypted source found:', encryptedMatch[1].substring(0, 80) + '...');
                                }
                                
                                resolve({ 
                                    name: serverName, 
                                    success: true, 
                                    hasM3u8, 
                                    hasHls,
                                    finalSize: data.length 
                                });
                            } else {
                                console.log('  ✗ Failed to fetch final player');
                                resolve({ name: serverName, success: false });
                            }
                        });
                    }).on('error', err => {
                        console.log('  ✗ Error:', err.message);
                        resolve({ name: serverName, success: false, error: err.message });
                    });
                    
                } catch (e) {
                    console.log('  ✗ Decode error:', e.message);
                    resolve({ name: serverName, success: false });
                }
                
            } else {
                console.log('\n✗ No nested iframe found');
                
                // Try alternative patterns
                const altMatch = html.match(/src=["']\/prorcp\/([^"']+)["']/);
                if (altMatch) {
                    console.log('  Found alternative pattern:', altMatch[1].substring(0, 80) + '...');
                }
                
                resolve({ name: serverName, success: false });
            }
            
        } catch (e) {
            console.log('✗ Error reading file:', e.message);
            resolve({ name: serverName, success: false });
        }
    });
}

async function extractAll() {
    const results = [];
    
    for (const server of servers) {
        const result = await extractAndFetch(server);
        results.push(result);
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log('\n\n' + '='.repeat(70));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(70));
    
    results.forEach(result => {
        console.log(`\n${result.name.toUpperCase()}:`);
        if (result.success) {
            console.log('  ✓ Successfully extracted final player');
            console.log('  Has M3U8:', result.hasM3u8 ? '✓' : '✗');
            console.log('  Has HLS.js:', result.hasHls ? '✓' : '✗');
            console.log('  Final Size:', result.finalSize, 'bytes');
        } else {
            console.log('  ✗ Failed to extract');
            if (result.error) {
                console.log('  Error:', result.error);
            }
        }
    });
    
    const withM3u8 = results.filter(r => r.success && r.hasM3u8);
    
    console.log('\n' + '='.repeat(70));
    console.log('CONCLUSION');
    console.log('='.repeat(70));
    
    if (withM3u8.length > 0) {
        console.log('\n✓ Servers with M3U8 references:', withM3u8.map(r => r.name).join(', '));
        console.log('\nNext: Check the final player HTML files for actual stream URLs');
    } else {
        console.log('\n⚠ No direct M3U8 URLs found in any server');
        console.log('Stream URLs are likely loaded dynamically via JavaScript');
        console.log('\nRecommendation: Use browser automation (Puppeteer) to intercept');
        console.log('network requests and capture the m3u8 URL when it loads');
    }
}

extractAll();
