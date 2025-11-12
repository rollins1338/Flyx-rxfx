/**
 * Fetch the final player page (prorcp endpoint)
 */

const https = require('https');
const fs = require('fs');

const finalHash = "ZWUzMzA1ZWExYmM1NWE1MjRjZGY1M2E4MzVkZGQ1Y2Q6U0ZaeU5sSXllV2hyU205dk0zRm1SM0ptVUdkT1VWaHBSRlo2UkhadEt5czFhbXRwVmxKSFpERm5aVmQwVG04eU1sTmlRMmhrVkZOVGFWVnZPV2xOU2tJNWVsbERXWFF6VTJzMldITTBhRWN2VDJkdmFVNUJTMU5KYlc4clNUTjNTMlpOUm14NFFsSkxOVXBCTjBSTlYyWjBla3BhY0M5SWJ6UlJibGR2VVhwNFRqbFdVMFZNTkZWb2FrVTBaM05pTW1KWFUycHVVV3hNWlZSMGFXMU9SMU5KVGtZM1EzUjNTVmR6VERZNGNEUXlWSE14VW1Wb1pHaDBlVEJtTDAxblIxSlNOak4wYzJ0eGFFaFpUUzg1VmtGSGJIVjFSVlJRUzBWbU4wdERkMGxYTmsxaVdrWnljVkYxU21kdE5EZFBiRGxsZUdsM1pqRm1OamRUV1V3M1psRXlOblk1WVVob2JEUkpWV1IzVGtkMVNGRnlTa2RDYzFNd1JHOXlLMDlGUkhwdVRtVm9ZbGxPUzFsMGRWRXZkMWRhTlhGa1ZtSmlTMDUxUlVSWWVsWlJabTFJU0dSTlZHRjFabVJ2V0VWelZpOXlUMWRtY3pneVYyRktNU3RHTDBaUGFERTVXamx5VFdoNlpsTklOblFyWjFGUGQxZEdUbTkyVlRSSVpsVnhNbVI2VTJkSFNtc3hObVJQVGs1cmRXRmtSamROVDFaRGNtbHFVR3RQUjNGUVRITnFhMEZ0VEdwa1EzTmxOVE5HUVZsVlNpdFNTa2hqYUdRMmRVZEJia0phYW5oMGVXRTJhMGcyVkZoNlowNU5TRGd5WkRObFZrdHlTM0JMYVhWcmJFZHBjMkZqUjJsSlNERjNjM0ZEV0VGUWQwbFlhRXczTjFGME1YTm5aREZtYm1ONVRuVlRhV1ZXWlV0NlZHcDRLMjVxYTFGRFEzZDFlbGxMUVhKQ2FrZGxhV1l3WTJndldDdFdhblFyU0ZOWmRGSmllRTlzTnpRd1VXVTBPVlZHVFhJMFNsVlNiVlZIZFdOVWRXVkVUVEJ3WnpJeVNIRjJUMnN5VkdOWE9WTTNVU3M0YWpKQloxSjNVMFZoZDJsUFZrMW9SR1ppT1hSYVYxZzBTVGRPVW1wbkx6a3lUU3R6WWxNeGRGTTVZMHMwYzFCWmFWWkpWMnBHVXpOVmVqZzJlbTU1ZVhaaGRURnFZMWhPU1dsckx6bDRVMVY0TUhOT05YbFJZM1p5T1RBMmRVd3hVRXQzVWs1MGMyRnFRelZDV2xKWVdWTnRVbUpsVjFwNlkweFVUa041V1d0RmVTdDZNeTgxY0dWV1R6Z3dVV2RuZHl0YWFtUkdhbkIxVkhaVlpEWkVNMVJtWW5CR1FtcENabXd6VVdob1QwMDRSQzl6UVVWR1pHbFJRM2xQTldack0zVjRZalJuYzFONWJVeHZTVUk0UWxGSEwyczVORzlSYWxoSGFtbDZOMU4zU1c1MkwxVlZRelpWVVdOWE5GVm1abkEyWW1aeGMyWnVWazVuUjFob2FHNUhkRXRwVFZsUFdFaHdiazlKWmxSSmFHSm9jWEJ6ZURaRU9HSTRMMFZ0T1M5WE56RnJiQ3RtVDJveE5HOWlUVVp6U0hwYWRuUkhVV2t4YUN0MmJqTnlWMjlKY1U1SFdtSXJSR0pQUVZnMk1VRXlSMFZYYm1aNk5FNDJWbTR2U2pGSGVWQnBjMHgzY0RWaU9GQXpVbmhHUjBJM2FqbHpkbGhTYW1KWlJ6ZE9OVmxrY0dkMVpuRXJWbWRIWlVkQ04wTjBNUzlzTHl0cmNYRlROa1JMZWxsUVQzWnVURFZRWm5FdlFrMTZXVEEyVTNKU1p6WlVTU3Q0YTNKRlJTOXBZV3g0T1dSUE1tcENjMlZYYVZOeVlWbHVObkpOWjNWaVVVSkdha2hqUmtreWMwaDNia1ZJVWs5U2EzUjVWMk5WVUZKaWNYb3ZNMk5KYWl0WFNGcEhjRkJ1U1dWUWRHdHpLMjU2VkVwcVJWaHZNazVpWlc5R1dUaGhUVVZ6TkZFd1VIVjNSVFZCYzBSYU9WUTRZbEZCVVhaMmR6MDk-";

const url = `https://cloudnestra.com/prorcp/${finalHash}`;

console.log('Fetching FINAL player page (prorcp)...');
console.log('This should contain the actual video player!\n');

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://cloudnestra.com/',
        'Connection': 'keep-alive'
    }
}, (res) => {
    let data = '';
    
    console.log('Status Code:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('Response Length:', data.length, 'bytes\n');
        
        if (res.statusCode === 200 && data.length > 0) {
            // Save to file
            const filename = 'examples/cloudnestra-final-player.html';
            fs.writeFileSync(filename, data);
            console.log('✓ Saved to:', filename);
            
            console.log('\n=== CRITICAL ANALYSIS ===\n');
            
            // Look for m3u8 URLs
            if (data.includes('m3u8')) {
                console.log('🎉 FOUND M3U8 REFERENCE!\n');
                const m3u8Matches = data.match(/https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/g);
                if (m3u8Matches) {
                    console.log('M3U8 URLs:');
                    m3u8Matches.forEach(url => console.log('  ✓', url));
                }
                
                // Also look for m3u8 in variables
                const m3u8VarMatches = data.match(/["']([^"']*m3u8[^"']*)["']/g);
                if (m3u8VarMatches) {
                    console.log('\nM3U8 in variables:');
                    m3u8VarMatches.forEach(match => console.log('  ✓', match));
                }
            }
            
            // Look for video sources
            const videoSrcMatches = data.match(/src\s*[:=]\s*["']([^"']+)["']/g);
            if (videoSrcMatches) {
                console.log('\nVideo sources:');
                videoSrcMatches.slice(0, 10).forEach(match => {
                    console.log('  -', match);
                });
            }
            
            // Look for API calls
            const apiMatches = data.match(/https?:\/\/[^\s"'<>]+\/[^\s"'<>]*/g);
            if (apiMatches) {
                console.log('\nAPI endpoints found:');
                const uniqueApis = [...new Set(apiMatches)].filter(url => 
                    !url.includes('cdnjs') && 
                    !url.includes('googleapis') &&
                    !url.includes('cloudflare')
                );
                uniqueApis.slice(0, 10).forEach(api => console.log('  -', api));
            }
            
            // Look for player initialization
            if (data.includes('jwplayer') || data.includes('JWPlayer')) {
                console.log('\n✓ JW Player detected');
            }
            if (data.includes('hls.js') || data.includes('Hls')) {
                console.log('✓ HLS.js detected');
            }
            if (data.includes('video.js') || data.includes('videojs')) {
                console.log('✓ Video.js detected');
            }
            
            // Show a sample of the content
            console.log('\n=== First 2000 characters ===');
            console.log(data.substring(0, 2000));
            console.log('...\n');
            
        } else {
            console.log('❌ Failed to fetch or empty response');
            console.log('Response:', data);
        }
    });
}).on('error', (err) => {
    console.error('❌ Error:', err.message);
});
