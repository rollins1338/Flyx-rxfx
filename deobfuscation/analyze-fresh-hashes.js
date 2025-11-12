/**
 * Analyze the fresh hashes from the updated HTML file
 */

const crypto = require('crypto');

console.log('=== Fresh VidSrc Hash Analysis ===\n');

// New hashes from the updated HTML
const freshHashes = {
    cloudstream: "MzQ4NGMzMDdjZmZmODVjODViOGU0NTEwMGNmMGU0MGY6VkdWdU9VUXJSVVJzYnpOS1dXTTBjMHRYWjBNNE16UlRWVm95VDI1YVIyMXFURUZzTVVJemRVUmpVVGhvVDI5RVNqVk1hbmhWVmtNd1pEVmFNMjlxVTFSVFNHVkJZazlUU0RNNVpsRklSVEZ5TDA1UVMyRXlOekY1YW5WVGFHZGxhbFZRTjFoeVJrNVFiMHhUY1U1d2JYcE1Na2RrWVVZMll6RnFiRk41UTJkbE5YWmxObU5FTjBadE9GRjBSbXhFWm1WelRXbEJSbk0wYnl0SFVXdGpaVGxrTUdGaVUxbDFVVFUyZWxweFFVNXdXa2xKWmxwUlpVTjFUMnQyT1cxaE9XSnFNR2RQVldrcmVYcDVjbWRyVERkbGNUZEpPRll5ZEdsSFdpdFRUM1ZEUjI4MVRrNWlOaTlzWlZNd1dYVXlVWFZFVm01clVERTFNelZ3UldjclMweEllRkl5YUhoMFNqaGthRTlKTkRjclJYUlVNbVpSUzNWNFMyRlhLMGhqU1ZoalYxVTNNM0J0UkhCVWVsVndOR2NyTms5T0sxRTVTR05qYTNCaWFrNXFLMmROUzFWNlNtZEJZWEI0VVZWelIyczBVM1V5YnpWc1Z6QXpTV2RQTkZKWmNIZ3dLM2xHYUdjMlMwdEpSbGhCVFZObVZscFJSblkxWlROVmJpdHhZVkZSVG1wVGNFNHlTVkF6U2tsNmN6ZHVkbXhaZVV4R1ZGbzBVVzFqY1hwNmRXWnVSbFJhY3poRGJIaDVNblIwU2xSSmFXdGxZMUJpUVRsaE1uZEplRzVvTnpscmVYcDNTRWhMTUZRM05tSlJkRGxVU1V4Tk5IbFFOVW96WlUxWWJWTm5jV1pVTUdJMk5GVjZNbE5yU2xOUVdYbDNWbmhrY2xOWU4xSk1SMVpPTURsNlUzTTRXV1JZY0ZReUswNUZkQ3RMVjNwalZXcDZTakJFV1ZaNlRTOUdaVEp1UkZkRlp5dHdRMVYzYUdFMVVVRTFOVE5JYkRKblVTdFVlblk0VFd0VU0yVXhXV2xXVjJzeGVtOW1ZVGs0WVhwbFdWZGlXRmxCWWtWNFN6ZERaREpoVkU5VVJVc3JRMjA0WmtFcmIxRlRSRU56VGtaYWVWZ3phVEJyVTFCdVZXTjFNRGhuUjBkaFltOVFia1J1Vlhsek1tazRUa2hpY2tNMFN6WkxUek01VDI1blNWbG9UMjU2V0c4MEt6RmxVRVpzWlN0eVVrWm5XWFpYUW1sTEwzaFpWWEpFUzNrNVlUbEhLek0wV21oalNsRXpkRk42VlRGelNIcHZiMDFpWWpkVFdreGtPRlZyV1c1U1lrbEtkR1pSZURkQ1lVMXVNV3QxTUZjelYyeFpVa3h1YTBka1lTOTVUV2xDUzAxbmRGTlNOa3R6TDBGUWRWazVXbTVXY0dVd1V6ZHpibkkwTWxVNVVrRkJabkEwVFRWQlVXWlRkM1ZYUVRoaGFrbGhaR2x2TDNkdFpraFZjalJUTjI1VGVHbEVPVGxzWjB0RWJGRjNVbUpYWVhvcmJqQkxaVGxWUXpCVmVGaEtUaXRwT0RaR1FqTnJOQzgwUzFOQ2FqY3paRmc1YWt4S2F6WkNVUzlsYW5Vek1GcE5iSGRyVVc0ck5sbzVkRFYwY0ZSTlUyUTBPWEoxTTNOQ2F6aGxNMkpLU0ZwcFMwWkhiMjFDVFRoUmVtTTBORkZHVXpsb1YzZHJNM1YzTDFCWVpHMUlXbVl6YWpkTVowSlZlamc0YUdka1drWlNZWHBwZHpKeU0yVnRZelUyV2twUU5XSkdZVm95UVdnMmRsVlZaR1Y0T0hadVVuVTJWa2xCU2pFMVZUZFhaa1U1ZDJaWlVUWnROVFowTTJSRGRIRXdkVk5JYlV0MldUaGFNblpzVFdOaWNXNTRjbVJQZFVFMU5GWnpZVGxxTTNKT01HWlFWMFZUY0VnM05tRldiVlkwV1ZONFdUY3pTVVphUlZCV2RrdDNRMEl3VUhKSlZFMVRVbVppWW5OYWIwcHZiQ3QwT0RCMmQxbEtabk5CU1N0Sk5YaENjVmxvTmpGWlMwVmpSRXhRTDI5QmR6MDk-",
    embed2: "MDk4OGE0ZmFmNjZlYzU2ZjY2NDQxMjk0OTA0MDlmNWY6UVU1aFMxZ3lVbTUxVWxoUVFtUlBlRVpWY0ZVelkzbDJLMGxZV20wNVFuWlZja3QwVVhCcVpteE1RMjFRTjBoRmFXWjBlR2hMV1RsUUswMVpNRmhpZERoRlNqVmtVMjB2TTFrNWNtdHNNbE51Vnk4elVDOTFOak53VG14VllVWjZZMGN4Y3pCUGFYcG9iblY0UVVoRmRrMXZSMEkwZFZwcFZtUjNiV1kwVFRkRU0zcG5TVkI0Wm5Kc2VVTjNiVk5rUlU1blEzcDFWSEpaTUU5MFRsQTJSelJ5SzBwemEwMWxaR1pwWjNOVmRETnROSG8xTlVSSk5HbENhelJuVHpKdA--",
    superembed: "YzUzNzBjOGUxMzNmYjhlODAzZjEzMjg0YjY5OTg4OTI6VjJWWFNFTktabTFMZDNndk4xTjNSM0p4WjNOd09FaFpiMDVxV2xadGNrRXJOR3N3Y3pKRk1IRjNWRTV6Y21KaVRVbG1VVTk2WkM5eE1HWXZkRXcwSzBWa2JXeERaRWcwVFU5d2VEWjNLMlpoVW5KUFZVRTlQUT09"
};

console.log('Analyzing all three server options:\n');

Object.entries(freshHashes).forEach(([serverName, hash]) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SERVER: ${serverName.toUpperCase()}`);
    console.log('='.repeat(60));
    
    try {
        // First decode
        const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');
        const parts = firstDecode.split(':');
        
        if (parts.length === 2) {
            const md5Hash = parts[0];
            const secondBase64 = parts[1];
            
            console.log('\n1. First Layer Decode:');
            console.log('   MD5 Hash:', md5Hash);
            console.log('   Data Length:', secondBase64.length, 'chars');
            
            // Second decode
            const secondDecode = Buffer.from(secondBase64, 'base64').toString('utf-8');
            
            console.log('\n2. Second Layer Decode:');
            console.log('   Total Length:', secondDecode.length, 'chars');
            
            // Check for pipe separator
            if (secondDecode.includes('|')) {
                const encryptedParts = secondDecode.split('|');
                console.log('   Parts Found:', encryptedParts.length);
                console.log('   Part 1 Length:', encryptedParts[0].length, 'chars');
                console.log('   Part 2 Length:', encryptedParts[1].length, 'chars');
                console.log('   Part 2 ends with ==:', encryptedParts[1].endsWith('=='));
                
                // Try to decode part 2
                if (encryptedParts[1].endsWith('==') || encryptedParts[1].endsWith('=')) {
                    try {
                        const part2Decoded = Buffer.from(encryptedParts[1], 'base64');
                        console.log('\n3. Part 2 Decode (appears to be base64):');
                        console.log('   Decoded Length:', part2Decoded.length, 'bytes');
                        console.log('   First 50 bytes (hex):', part2Decoded.toString('hex').substring(0, 100));
                    } catch (e) {
                        console.log('\n3. Part 2 Decode: Failed');
                    }
                }
                
                console.log('\n4. Part 1 Analysis:');
                console.log('   Sample:', encryptedParts[0].substring(0, 80) + '...');
                console.log('   Contains +:', encryptedParts[0].includes('+'));
                console.log('   Contains /:', encryptedParts[0].includes('/'));
                console.log('   Likely Encryption: AES-256-CBC');
                
            } else {
                console.log('   No pipe separator found');
                console.log('   Full data:', secondDecode.substring(0, 100) + '...');
            }
        }
    } catch (e) {
        console.log('   Error:', e.message);
    }
});

console.log('\n\n' + '='.repeat(60));
console.log('NEXT STEP: Fetch CloudNestra Player Page');
console.log('='.repeat(60));
console.log('\nUsing CloudStream Pro hash to fetch player page...');
console.log('URL: https://cloudnestra.com/rcp/' + freshHashes.cloudstream.substring(0, 50) + '...');
