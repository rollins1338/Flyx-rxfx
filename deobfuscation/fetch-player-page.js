/**
 * Fetch and analyze the CloudNestra player page
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

const iframeHash = "MmEwNDkxMDc1MzQ4NDk3NmI1ZDZjMDNmNTQzNTA3ZTA6TTFCNFYyNUdVM2hMVm1kRmNubzVNa1o0Ym1wUVlXOTJlWFUxTXpsdFRHMVhabk5IU0RsTmVrSTNWRmRaV2pKME5VOVFMM2hPZGtaalprTnJWbFJuVVZCV2JHc3JOV2x6V0VndmMwVllkSGd3UjNGeFYzRXpTamRKTlRaTmNEaG5VM3BaUWpGbWJFaEZiR0ZsSzJkR05sQXdlVTVyZURsM1kyVjBaazFDUmpWQ2JGUkljbVZQUWtORk5UUnFXVTlrVEc0clZrNWFkMmh6YjBKSFkweEhXV1ZSUkN0aVNHZE1PU3RCUjJGSWQwSmlNV1IyVVVWM05tZ3lOSEJvYTBOQmRteDNjU3RSV0d4d1QzcFRMM1EyTmtOWlVrcExibkZ3SzFaVk1GZzVNRmRDS3pWb2MydFdVV1ZxUVhwWlNGSmxkR2tyVUdSeVVFVTBkemhCU21aa00zeElTalZTVmxoUFJHZEtWWFlyU0hkMFExbFdlbkJaTlZkeVEza3ZlRVpyWm0xeVEyMXlhSHBOZDFkblJHNW9Xa0ZaTldOSmJVZHlSM3BLTmpGM1dTOXJSRUpUV0hOWVVXVmhRMWRrZUdKcGRXNHdTR2RoVW5OS01qbHFTRmN5WVV0WFNWQXpRbmR6VHl0NVRXdExlRzh5ZGtka2FucE1lVmRIYkVJMGEyb3ZaVVIzTDJkMFNsSjNjemhQY1dsWGFUWkVlV1p0Vmt4VVRTOXdOblZuTTBSNWJVNVdXVFpwUjFWMGF6ZHdZMGczWlM5U1UxWTRRWE5xZERSNGN6SkdSV3QxYUU0eWJtdERLemgzVW1GbVUyMXplWGRTY1dOTFFrVklWRFJKTlZrdlJXUkdTVE5wYURSUUsyVjJSVEkyVHpKcVpFTmFRVkZhTVdaREwwVkNkUzlLUlVadGFVdzFaMFJwVFc1b2NqY3lRa1F4V1c5aEsyTlJhakE0TW5GMGFEUTNaRkJvZDNSb2FIUjFUVmMxYjBJeU9URktZemRaTW5wQ1NHUnFSMnd3Tmt0V2RWUTJLMjFWVFhaWVNVZE5abk5UYW01UVIxZG9SRzEyV0VoeFMwRlBjV2xRZGt0eFNWRXphRW93UWtsMWFrVktaMWRSTTNwSkszSTNSSFJLZW5kM2VqaGpRVkp2WjFwWE9GSlJRbVZZU1V4TE1YSmFNRzFvTm14cE9WZG5NRkJtU2t0MVRVTm9OM0pRV0hWV2NuSmpOR0ZWYlV3MU9YRldOVTg0Y1RFeWEwMU9jbmNyVFhGaVlYZFBjakJqV1VKS2MzbEtXRzV1YUdoRlREQjFhR2htTTJWQ01YUnBja3gyZUdwalNHOW5NMkoxV0ZSdmJUaDJUbWhrYWt0QlZVcFBWREZSTDNReVdGRTVkSEZZUVhwbmRGZEhRakkwWWtOc1VuSndkV0pMU3pOMk5qa3lRVFZQVXpaaGJFOUxjQzlOUkVSR2RsTnROR2hDUTFwS2NGZEpUelpyYVhkaVpreExSbEp3YTJNMWNEQTJTamhPV2xWd1luRXdjM3B4Y2pGMVRHMDJjbEZLTUU5R1dVRnlVMEUyS3pjd09FbGxhbkZtT1N0ME1VZ3pVMEZPUlhaS2VtUlRNRVpUWldOb1ZHZHdjbFZhYW1SaVlrWnJjakpZVDI1M2F6YzRhM04wVG1aR1YxSmFOMWRZWml0d1FUaDROWEk1WlRWMGFtVlBXVTl5WVZOWmIyRldPVEJ4VURSSFMzTnNWR0U1WVRZMlZrZFdUbFlySzJZNVR6RnJiRWRvZVVkVGVYWjZMMkZJZURjck1FaEJUMlpoTUVSS1JGWmllVzkwYlZKM1dHaFNSWEYzVGxsNlZHdFhUa2xvVkhkclVqaENlRFZzYzA5Nk5Ya3diMVJrUXpneEwzY3dMMGswUkhjclMwWjJWVVkwZUZsVVpYaENSM2swUlc5bFJEUnlaMGwzVG1GV1lpczBja2hpVDFkUFoxUnliVmxuY2podE4zWlhVQ3RzYTFaTWNIbGlUV2d6WXpsc1pHRkxTRVJCU2s1TFNYcGpSbk5GWVVnemNrcHpiekJTYmpOb01tZDJRMlZRUm1velFUMDk-";

const url = `https://cloudnestra.com/rcp/${iframeHash}`;

console.log("Fetching player page from:", url);
console.log("This may take a moment...\n");

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://vidsrc.xyz/'
    }
}, (res) => {
    let data = '';
    
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    console.log('\n');
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('Response received. Length:', data.length);
        
        // Save to file
        const filename = 'examples/cloudnestra-player.html';
        fs.writeFileSync(filename, data);
        console.log(`Saved to: ${filename}`);
        
        // Analyze the response
        console.log('\n=== Analysis ===');
        
        // Look for script tags
        const scriptMatches = data.match(/<script[^>]*src=["']([^"']+)["']/g);
        if (scriptMatches) {
            console.log('\nScript sources found:');
            scriptMatches.forEach(match => {
                const src = match.match(/src=["']([^"']+)["']/)[1];
                console.log('  -', src);
            });
        }
        
        // Look for inline scripts with URLs
        const urlMatches = data.match(/https?:\/\/[^\s"'<>]+/g);
        if (urlMatches) {
            console.log('\nURLs found:');
            const uniqueUrls = [...new Set(urlMatches)];
            uniqueUrls.slice(0, 20).forEach(url => {
                console.log('  -', url);
            });
        }
        
        // Look for m3u8 references
        if (data.includes('m3u8')) {
            console.log('\n✓ Found m3u8 reference!');
            const m3u8Matches = data.match(/[^\s"'<>]*\.m3u8[^\s"'<>]*/g);
            if (m3u8Matches) {
                m3u8Matches.forEach(match => {
                    console.log('  -', match);
                });
            }
        }
        
        // Look for data attributes
        const dataAttrs = data.match(/data-[a-z-]+="[^"]+"/g);
        if (dataAttrs) {
            console.log('\nData attributes:');
            dataAttrs.slice(0, 10).forEach(attr => {
                console.log('  -', attr);
            });
        }
        
        // Look for base64 encoded data
        const base64Pattern = /[A-Za-z0-9+/]{50,}={0,2}/g;
        const base64Matches = data.match(base64Pattern);
        if (base64Matches) {
            console.log(`\nFound ${base64Matches.length} potential base64 strings`);
            console.log('First few:');
            base64Matches.slice(0, 3).forEach((match, i) => {
                console.log(`  ${i + 1}. ${match.substring(0, 60)}...`);
            });
        }
    });
}).on('error', (err) => {
    console.error('Error fetching page:', err.message);
});
