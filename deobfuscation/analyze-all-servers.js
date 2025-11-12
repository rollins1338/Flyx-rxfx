/**
 * Analyze all three server options (CloudStream, 2Embed, Superembed)
 */

const https = require('https');
const fs = require('fs');

const servers = {
    cloudstream: "MzQ4NGMzMDdjZmZmODVjODViOGU0NTEwMGNmMGU0MGY6VkdWdU9VUXJSVVJzYnpOS1dXTTBjMHRYWjBNNE16UlRWVm95VDI1YVIyMXFURUZzTVVJemRVUmpVVGhvVDI5RVNqVk1hbmhWVmtNd1pEVmFNMjlxVTFSVFNHVkJZazlUU0RNNVpsRklSVEZ5TDA1UVMyRXlOekY1YW5WVGFHZGxhbFZRTjFoeVJrNVFiMHhUY1U1d2JYcE1Na2RrWVVZMll6RnFiRk41UTJkbE5YWmxObU5FTjBadE9GRjBSbXhFWm1WelRXbEJSbk0wYnl0SFVXdGpaVGxrTUdGaVUxbDFVVFUyZWxweFFVNXdXa2xKWmxwUlpVTjFUMnQyT1cxaE9XSnFNR2RQVldrcmVYcDVjbWRyVERkbGNUZEpPRll5ZEdsSFdpdFRUM1ZEUjI4MVRrNWlOaTlzWlZNd1dYVXlVWFZFVm01clVERTFNelZ3UldjclMweEllRkl5YUhoMFNqaGthRTlKTkRjclJYUlVNbVpSUzNWNFMyRlhLMGhqU1ZoalYxVTNNM0J0UkhCVWVsVndOR2NyTms5T0sxRTVTR05qYTNCaWFrNXFLMmROUzFWNlNtZEJZWEI0VVZWelIyczBVM1V5YnpWc1Z6QXpTV2RQTkZKWmNIZ3dLM2xHYUdjMlMwdEpSbGhCVFZObVZscFJSblkxWlROVmJpdHhZVkZSVG1wVGNFNHlTVkF6U2tsNmN6ZHVkbXhaZVV4R1ZGbzBVVzFqY1hwNmRXWnVSbFJhY3poRGJIaDVNblIwU2xSSmFXdGxZMUJpUVRsaE1uZEplRzVvTnpscmVYcDNTRWhMTUZRM05tSlJkRGxVU1V4Tk5IbFFOVW96WlUxWWJWTm5jV1pVTUdJMk5GVjZNbE5yU2xOUVdYbDNWbmhrY2xOWU4xSk1SMVpPTURsNlUzTTRXV1JZY0ZReUswNUZkQ3RMVjNwalZXcDZTakJFV1ZaNlRTOUdaVEp1UkZkRlp5dHdRMVYzYUdFMVVVRTFOVE5JYkRKblVTdFVlblk0VFd0VU0yVXhXV2xXVjJzeGVtOW1ZVGs0WVhwbFdWZGlXRmxCWWtWNFN6ZERaREpoVkU5VVJVc3JRMjA0WmtFcmIxRlRSRU56VGtaYWVWZ3phVEJyVTFCdVZXTjFNRGhuUjBkaFltOVFia1J1Vlhsek1tazRUa2hpY2tNMFN6WkxUek01VDI1blNWbG9UMjU2V0c4MEt6RmxVRVpzWlN0eVVrWm5XWFpYUW1sTEwzaFpWWEpFUzNrNVlUbEhLek0wV21oalNsRXpkRk42VlRGelNIcHZiMDFpWWpkVFdreGtPRlZyV1c1U1lrbEtkR1pSZURkQ1lVMXVNV3QxTUZjelYyeFpVa3h1YTBka1lTOTVUV2xDUzAxbmRGTlNOa3R6TDBGUWRWazVXbTVXY0dVd1V6ZHpibkkwTWxVNVVrRkJabkEwVFRWQlVXWlRkM1ZYUVRoaGFrbGhaR2x2TDNkdFpraFZjalJUTjI1VGVHbEVPVGxzWjB0RWJGRjNVbUpYWVhvcmJqQkxaVGxWUXpCVmVGaEtUaXRwT0RaR1FqTnJOQzgwUzFOQ2FqY3paRmc1YWt4S2F6WkNVUzlsYW5Vek1GcE5iSGRyVVc0ck5sbzVkRFYwY0ZSTlUyUTBPWEoxTTNOQ2F6aGxNMkpLU0ZwcFMwWkhiMjFDVFRoUmVtTTBORkZHVXpsb1YzZHJNM1YzTDFCWVpHMUlXbVl6YWpkTVowSlZlamc0YUdka1drWlNZWHBwZHpKeU0yVnRZelUyV2twUU5XSkdZVm95UVdnMmRsVlZaR1Y0T0hadVVuVTJWa2xCU2pFMVZUZFhaa1U1ZDJaWlVUWnROVFowTTJSRGRIRXdkVk5JYlV0MldUaGFNblpzVFdOaWNXNTRjbVJQZFVFMU5GWnpZVGxxTTNKT01HWlFWMFZUY0VnM05tRldiVlkwV1ZONFdUY3pTVVphUlZCV2RrdDNRMEl3VUhKSlZFMVRVbVppWW5OYWIwcHZiQ3QwT0RCMmQxbEtabk5CU1N0Sk5YaENjVmxvTmpGWlMwVmpSRXhRTDI5QmR6MDk-",
    embed2: "MDk4OGE0ZmFmNjZlYzU2ZjY2NDQxMjk0OTA0MDlmNWY6UVU1aFMxZ3lVbTUxVWxoUVFtUlBlRVpWY0ZVelkzbDJLMGxZV20wNVFuWlZja3QwVVhCcVpteE1RMjFRTjBoRmFXWjBlR2hMV1RsUUswMVpNRmhpZERoRlNqVmtVMjB2TTFrNWNtdHNNbE51Vnk4elVDOTFOak53VG14VllVWjZZMGN4Y3pCUGFYcG9iblY0UVVoRmRrMXZSMEkwZFZwcFZtUjNiV1kwVFRkRU0zcG5TVkI0Wm5Kc2VVTjNiVk5rUlU1blEzcDFWSEpaTUU5MFRsQTJSelJ5SzBwemEwMWxaR1pwWjNOVmRETnROSG8xTlVSSk5HbENhelJuVHpKdA--",
    superembed: "YzUzNzBjOGUxMzNmYjhlODAzZjEzMjg0YjY5OTg4OTI6VjJWWFNFTktabTFMZDNndk4xTjNSM0p4WjNOd09FaFpiMDVxV2xadGNrRXJOR3N3Y3pKRk1IRjNWRTV6Y21KaVRVbG1VVTk2WkM5eE1HWXZkRXcwSzBWa2JXeERaRWcwVFU5d2VEWjNLMlpoVW5KUFZVRTlQUT09"
};

console.log('=== Analyzing All Three Servers ===\n');

async function analyzeServer(name, hash) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`SERVER: ${name.toUpperCase()}`);
        console.log('='.repeat(70));
        
        // Decode hash
        try {
            const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');
            const [md5, data] = firstDecode.split(':');
            const secondDecode = Buffer.from(data, 'base64').toString('utf-8');
            
            console.log('\nHash Info:');
            console.log('  MD5:', md5);
            console.log('  Decoded Length:', secondDecode.length, 'chars');
            console.log('  Sample:', secondDecode.substring(0, 100) + '...');
        } catch (e) {
            console.log('  Decode Error:', e.message);
        }
        
        // Fetch the page
        const url = `https://cloudnestra.com/rcp/${hash}`;
        console.log('\nFetching:', url.substring(0, 80) + '...');
        
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': 'https://vidsrc.xyz/'
            }
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('Status:', res.statusCode);
                console.log('Length:', data.length, 'bytes');
                
                if (res.statusCode === 200 && data.length > 0) {
                    // Save to file
                    const filename = `examples/${name}-player.html`;
                    fs.writeFileSync(filename, data);
                    console.log('✓ Saved to:', filename);
                    
                    // Quick analysis
                    const analysis = {
                        hasM3u8: data.includes('m3u8'),
                        hasIframe: data.includes('<iframe'),
                        hasVideo: data.includes('<video'),
                        hasHls: data.includes('hls.js') || data.includes('Hls'),
                        hasJwplayer: data.includes('jwplayer'),
                        hasPlyr: data.includes('plyr')
                    };
                    
                    console.log('\nQuick Analysis:');
                    Object.entries(analysis).forEach(([key, value]) => {
                        console.log(`  ${key}:`, value ? '✓' : '✗');
                    });
                    
                    // Look for nested iframe
                    const iframeMatch = data.match(/src=["']([^"']+)["']/);
                    if (iframeMatch && analysis.hasIframe) {
                        console.log('\n  Nested iframe found:', iframeMatch[1].substring(0, 80) + '...');
                    }
                    
                    // Look for m3u8 URLs
                    if (analysis.hasM3u8) {
                        const m3u8Matches = data.match(/https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/g);
                        if (m3u8Matches) {
                            console.log('\n  M3U8 URLs:');
                            m3u8Matches.forEach(url => console.log('    -', url));
                        }
                    }
                    
                    resolve({ name, success: true, analysis });
                } else {
                    console.log('✗ Failed or empty response');
                    resolve({ name, success: false });
                }
            });
        }).on('error', (err) => {
            console.log('✗ Error:', err.message);
            resolve({ name, success: false, error: err.message });
        });
    });
}

async function analyzeAll() {
    const results = [];
    
    for (const [name, hash] of Object.entries(servers)) {
        const result = await analyzeServer(name, hash);
        results.push(result);
        
        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    
    results.forEach(result => {
        console.log(`\n${result.name.toUpperCase()}:`);
        if (result.success) {
            console.log('  Status: ✓ Success');
            if (result.analysis) {
                console.log('  Has M3U8:', result.analysis.hasM3u8 ? '✓' : '✗');
                console.log('  Has Iframe:', result.analysis.hasIframe ? '✓' : '✗');
                console.log('  Player:', 
                    result.analysis.hasHls ? 'HLS.js' :
                    result.analysis.hasJwplayer ? 'JWPlayer' :
                    result.analysis.hasPlyr ? 'Plyr' : 'Unknown'
                );
            }
        } else {
            console.log('  Status: ✗ Failed');
            if (result.error) {
                console.log('  Error:', result.error);
            }
        }
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('RECOMMENDATION');
    console.log('='.repeat(70));
    
    const successful = results.filter(r => r.success);
    if (successful.length > 0) {
        console.log('\nSuccessful servers:', successful.map(r => r.name).join(', '));
        console.log('\nNext steps:');
        console.log('1. Check saved HTML files in examples/ directory');
        console.log('2. Look for nested iframes or direct m3u8 URLs');
        console.log('3. Follow the iframe chain to the final player');
    } else {
        console.log('\nNo servers responded successfully.');
        console.log('Hashes may have expired. Try with fresh hashes.');
    }
}

analyzeAll();
