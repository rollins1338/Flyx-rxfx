/**
 * Fetch the CloudNestra player page with fresh hash
 */

const https = require('https');
const fs = require('fs');

const freshHash = "MzQ4NGMzMDdjZmZmODVjODViOGU0NTEwMGNmMGU0MGY6VkdWdU9VUXJSVVJzYnpOS1dXTTBjMHRYWjBNNE16UlRWVm95VDI1YVIyMXFURUZzTVVJemRVUmpVVGhvVDI5RVNqVk1hbmhWVmtNd1pEVmFNMjlxVTFSVFNHVkJZazlUU0RNNVpsRklSVEZ5TDA1UVMyRXlOekY1YW5WVGFHZGxhbFZRTjFoeVJrNVFiMHhUY1U1d2JYcE1Na2RrWVVZMll6RnFiRk41UTJkbE5YWmxObU5FTjBadE9GRjBSbXhFWm1WelRXbEJSbk0wYnl0SFVXdGpaVGxrTUdGaVUxbDFVVFUyZWxweFFVNXdXa2xKWmxwUlpVTjFUMnQyT1cxaE9XSnFNR2RQVldrcmVYcDVjbWRyVERkbGNUZEpPRll5ZEdsSFdpdFRUM1ZEUjI4MVRrNWlOaTlzWlZNd1dYVXlVWFZFVm01clVERTFNelZ3UldjclMweEllRkl5YUhoMFNqaGthRTlKTkRjclJYUlVNbVpSUzNWNFMyRlhLMGhqU1ZoalYxVTNNM0J0UkhCVWVsVndOR2NyTms5T0sxRTVTR05qYTNCaWFrNXFLMmROUzFWNlNtZEJZWEI0VVZWelIyczBVM1V5YnpWc1Z6QXpTV2RQTkZKWmNIZ3dLM2xHYUdjMlMwdEpSbGhCVFZObVZscFJSblkxWlROVmJpdHhZVkZSVG1wVGNFNHlTVkF6U2tsNmN6ZHVkbXhaZVV4R1ZGbzBVVzFqY1hwNmRXWnVSbFJhY3poRGJIaDVNblIwU2xSSmFXdGxZMUJpUVRsaE1uZEplRzVvTnpscmVYcDNTRWhMTUZRM05tSlJkRGxVU1V4Tk5IbFFOVW96WlUxWWJWTm5jV1pVTUdJMk5GVjZNbE5yU2xOUVdYbDNWbmhrY2xOWU4xSk1SMVpPTURsNlUzTTRXV1JZY0ZReUswNUZkQ3RMVjNwalZXcDZTakJFV1ZaNlRTOUdaVEp1UkZkRlp5dHdRMVYzYUdFMVVVRTFOVE5JYkRKblVTdFVlblk0VFd0VU0yVXhXV2xXVjJzeGVtOW1ZVGs0WVhwbFdWZGlXRmxCWWtWNFN6ZERaREpoVkU5VVJVc3JRMjA0WmtFcmIxRlRSRU56VGtaYWVWZ3phVEJyVTFCdVZXTjFNRGhuUjBkaFltOVFia1J1Vlhsek1tazRUa2hpY2tNMFN6WkxUek01VDI1blNWbG9UMjU2V0c4MEt6RmxVRVpzWlN0eVVrWm5XWFpYUW1sTEwzaFpWWEpFUzNrNVlUbEhLek0wV21oalNsRXpkRk42VlRGelNIcHZiMDFpWWpkVFdreGtPRlZyV1c1U1lrbEtkR1pSZURkQ1lVMXVNV3QxTUZjelYyeFpVa3h1YTBka1lTOTVUV2xDUzAxbmRGTlNOa3R6TDBGUWRWazVXbTVXY0dVd1V6ZHpibkkwTWxVNVVrRkJabkEwVFRWQlVXWlRkM1ZYUVRoaGFrbGhaR2x2TDNkdFpraFZjalJUTjI1VGVHbEVPVGxzWjB0RWJGRjNVbUpYWVhvcmJqQkxaVGxWUXpCVmVGaEtUaXRwT0RaR1FqTnJOQzgwUzFOQ2FqY3paRmc1YWt4S2F6WkNVUzlsYW5Vek1GcE5iSGRyVVc0ck5sbzVkRFYwY0ZSTlUyUTBPWEoxTTNOQ2F6aGxNMkpLU0ZwcFMwWkhiMjFDVFRoUmVtTTBORkZHVXpsb1YzZHJNM1YzTDFCWVpHMUlXbVl6YWpkTVowSlZlamc0YUdka1drWlNZWHBwZHpKeU0yVnRZelUyV2twUU5XSkdZVm95UVdnMmRsVlZaR1Y0T0hadVVuVTJWa2xCU2pFMVZUZFhaa1U1ZDJaWlVUWnROVFowTTJSRGRIRXdkVk5JYlV0MldUaGFNblpzVFdOaWNXNTRjbVJQZFVFMU5GWnpZVGxxTTNKT01HWlFWMFZUY0VnM05tRldiVlkwV1ZONFdUY3pTVVphUlZCV2RrdDNRMEl3VUhKSlZFMVRVbVppWW5OYWIwcHZiQ3QwT0RCMmQxbEtabk5CU1N0Sk5YaENjVmxvTmpGWlMwVmpSRXhRTDI5QmR6MDk-";

const url = `https://cloudnestra.com/rcp/${freshHash}`;

console.log('Fetching FRESH player page...');
console.log('URL:', url.substring(0, 80) + '...\n');

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://vidsrc.xyz/',
        'Connection': 'keep-alive'
    }
}, (res) => {
    let data = '';
    
    console.log('Status Code:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Content-Length:', res.headers['content-length']);
    
    // Follow redirects
    if (res.statusCode === 301 || res.statusCode === 302) {
        console.log('Redirect to:', res.headers.location);
        return;
    }
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('\nResponse Length:', data.length, 'bytes\n');
        
        if (res.statusCode === 200 && data.length > 0) {
            // Save to file
            const filename = 'examples/cloudnestra-player-fresh.html';
            fs.writeFileSync(filename, data);
            console.log('✓ Saved to:', filename);
            
            // Quick analysis
            console.log('\n=== Quick Analysis ===\n');
            
            // Look for video player
            if (data.includes('video') || data.includes('player')) {
                console.log('✓ Contains video/player references');
            }
            
            // Look for m3u8
            if (data.includes('m3u8')) {
                console.log('✓ Found m3u8 reference!');
                const m3u8Matches = data.match(/https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/g);
                if (m3u8Matches) {
                    console.log('\nM3U8 URLs found:');
                    m3u8Matches.forEach(url => console.log('  -', url));
                }
            }
            
            // Look for script sources
            const scriptMatches = data.match(/<script[^>]*src=["']([^"']+)["']/g);
            if (scriptMatches) {
                console.log('\nScript sources:');
                scriptMatches.slice(0, 10).forEach(match => {
                    const src = match.match(/src=["']([^"']+)["']/)[1];
                    console.log('  -', src);
                });
            }
            
            // Look for data attributes
            const dataMatches = data.match(/data-[a-z-]+="[^"]+"/g);
            if (dataMatches) {
                console.log('\nData attributes (first 10):');
                dataMatches.slice(0, 10).forEach(attr => {
                    console.log('  -', attr);
                });
            }
            
            // Look for API endpoints
            const apiMatches = data.match(/https?:\/\/[^\s"'<>]+\/api\/[^\s"'<>]*/g);
            if (apiMatches) {
                console.log('\nAPI endpoints:');
                const uniqueApis = [...new Set(apiMatches)];
                uniqueApis.forEach(api => console.log('  -', api));
            }
            
            // Show first 1000 characters
            console.log('\n=== First 1000 characters ===');
            console.log(data.substring(0, 1000));
            console.log('...\n');
            
        } else if (res.statusCode === 404) {
            console.log('❌ 404 - Hash expired or invalid');
            console.log('Response:', data);
        } else {
            console.log('❌ Unexpected response');
            console.log('Response:', data.substring(0, 500));
        }
    });
}).on('error', (err) => {
    console.error('❌ Error:', err.message);
});
