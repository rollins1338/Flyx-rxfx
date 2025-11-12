/**
 * Complete Stream Extraction Test
 * This script demonstrates the full extraction flow
 */

const crypto = require('crypto');

console.log('=== VidSrc Stream Extraction Test ===\n');

// Sample data from the HTML file
const testData = {
    iframeHash: "MmEwNDkxMDc1MzQ4NDk3NmI1ZDZjMDNmNTQzNTA3ZTA6TTFCNFYyNUdVM2hMVm1kRmNubzVNa1o0Ym1wUVlXOTJlWFUxTXpsdFRHMVhabk5IU0RsTmVrSTNWRmRaV2pKME5VOVFMM2hPZGtaalprTnJWbFJuVVZCV2JHc3JOV2x6V0VndmMwVllkSGd3UjNGeFYzRXpTamRKTlRaTmNEaG5VM3BaUWpGbWJFaEZiR0ZsSzJkR05sQXdlVTVyZURsM1kyVjBaazFDUmpWQ2JGUkljbVZQUWtORk5UUnFXVTlrVEc0clZrNWFkMmh6YjBKSFkweEhXV1ZSUkN0aVNHZE1PU3RCUjJGSWQwSmlNV1IyVVVWM05tZ3lOSEJvYTBOQmRteDNjU3RSV0d4d1QzcFRMM1EyTmtOWlVrcExibkZ3SzFaVk1GZzVNRmRDS3pWb2MydFdVV1ZxUVhwWlNGSmxkR2tyVUdSeVVFVTBkemhCU21aa00zeElTalZTVmxoUFJHZEtWWFlyU0hkMFExbFdlbkJaTlZkeVEza3ZlRVpyWm0xeVEyMXlhSHBOZDFkblJHNW9Xa0ZaTldOSmJVZHlSM3BLTmpGM1dTOXJSRUpUV0hOWVVXVmhRMWRrZUdKcGRXNHdTR2RoVW5OS01qbHFTRmN5WVV0WFNWQXpRbmR6VHl0NVRXdExlRzh5ZGtka2FucE1lVmRIYkVJMGEyb3ZaVVIzTDJkMFNsSjNjemhQY1dsWGFUWkVlV1p0Vmt4VVRTOXdOblZuTTBSNWJVNVdXVFpwUjFWMGF6ZHdZMGczWlM5U1UxWTRRWE5xZERSNGN6SkdSV3QxYUU0eWJtdERLemgzVW1GbVUyMXplWGRTY1dOTFFrVklWRFJKTlZrdlJXUkdTVE5wYURSUUsyVjJSVEkyVHpKcVpFTmFRVkZhTVdaREwwVkNkUzlLUlVadGFVdzFaMFJwVFc1b2NqY3lRa1F4V1c5aEsyTlJhakE0TW5GMGFEUTNaRkJvZDNSb2FIUjFUVmMxYjBJeU9URktZemRaTW5wQ1NHUnFSMnd3Tmt0V2RWUTJLMjFWVFhaWVNVZE5abk5UYW01UVIxZG9SRzEyV0VoeFMwRlBjV2xRZGt0eFNWRXphRW93UWtsMWFrVktaMWRSTTNwSkszSTNSSFJLZW5kM2VqaGpRVkp2WjFwWE9GSlJRbVZZU1V4TE1YSmFNRzFvTm14cE9WZG5NRkJtU2t0MVRVTm9OM0pRV0hWV2NuSmpOR0ZWYlV3MU9YRldOVTg0Y1RFeWEwMU9jbmNyVFhGaVlYZFBjakJqV1VKS2MzbEtXRzV1YUdoRlREQjFhR2htTTJWQ01YUnBja3gyZUdwalNHOW5NMkoxV0ZSdmJUaDJUbWhrYWt0QlZVcFBWREZSTDNReVdGRTVkSEZZUVhwbmRGZEhRakkwWWtOc1VuSndkV0pMU3pOMk5qa3lRVFZQVXpaaGJFOUxjQzlOUkVSR2RsTnROR2hDUTFwS2NGZEpUelpyYVhkaVpreExSbEp3YTJNMWNEQTJTamhPV2xWd1luRXdjM3B4Y2pGMVRHMDJjbEZLTUU5R1dVRnlVMEUyS3pjd09FbGxhbkZtT1N0ME1VZ3pVMEZPUlhaS2VtUlRNRVpUWldOb1ZHZHdjbFZhYW1SaVlrWnJjakpZVDI1M2F6YzRhM04wVG1aR1YxSmFOMWRZWml0d1FUaDROWEk1WlRWMGFtVlBXVTl5WVZOWmIyRldPVEJ4VURSSFMzTnNWR0U1WVRZMlZrZFdUbFlySzJZNVR6RnJiRWRvZVVkVGVYWjZMMkZJZURjck1FaEJUMlpoTUVSS1JGWmllVzkwYlZKM1dHaFNSWEYzVGxsNlZHdFhUa2xvVkhkclVqaENlRFZzYzA5Nk5Ya3diMVJrUXpneEwzY3dMMGswUkhjclMwWjJWVVkwZUZsVVpYaENSM2swUlc5bFJEUnlaMGwzVG1GV1lpczBja2hpVDFkUFoxUnliVmxuY2podE4zWlhVQ3RzYTFaTWNIbGlUV2d6WXpsc1pHRkxTRVJCU2s1TFNYcGpSbk5GWVVnemNrcHpiekJTYmpOb01tZDJRMlZRUm1velFUMDk-",
    contentId: "30472557",
    subHash: "52ca5c1eadf6b07b0b0506793c0e06fa"
};

console.log('Step 1: Decode the iframe hash');
console.log('================================\n');

try {
    // First decode
    const firstDecode = Buffer.from(testData.iframeHash, 'base64').toString('utf-8');
    const [md5Hash, encryptedBase64] = firstDecode.split(':');
    
    console.log('MD5 Hash:', md5Hash);
    console.log('Encrypted data length:', encryptedBase64.length, 'chars\n');
    
    // Second decode
    const encryptedData = Buffer.from(encryptedBase64, 'base64').toString('utf-8');
    
    console.log('Step 2: Analyze encrypted data');
    console.log('================================\n');
    
    // Split by pipe
    const parts = encryptedData.split('|');
    console.log('Number of parts:', parts.length);
    console.log('Part 1 length:', parts[0].length, 'chars');
    console.log('Part 2 length:', parts[1].length, 'chars');
    console.log('Part 2 ends with "==":', parts[1].endsWith('=='));
    
    // Try to decode part 2 (appears to be base64)
    console.log('\nStep 3: Decode Part 2 (appears to be base64)');
    console.log('=============================================\n');
    
    try {
        const part2Decoded = Buffer.from(parts[1], 'base64');
        console.log('Part 2 decoded length:', part2Decoded.length, 'bytes');
        console.log('Part 2 decoded (hex):', part2Decoded.toString('hex').substring(0, 100) + '...');
        console.log('Part 2 decoded (utf8):', part2Decoded.toString('utf8').substring(0, 100) + '...');
    } catch (e) {
        console.log('Could not decode part 2 as base64:', e.message);
    }
    
    console.log('\nStep 4: Encryption Analysis');
    console.log('============================\n');
    
    // Analyze part 1 for patterns
    const part1 = parts[0];
    console.log('Part 1 characteristics:');
    console.log('  - Contains uppercase:', /[A-Z]/.test(part1));
    console.log('  - Contains lowercase:', /[a-z]/.test(part1));
    console.log('  - Contains numbers:', /[0-9]/.test(part1));
    console.log('  - Contains special chars:', /[^A-Za-z0-9]/.test(part1));
    console.log('  - Special chars found:', part1.match(/[^A-Za-z0-9]/g)?.join('') || 'none');
    
    // Check if it might be AES encrypted
    console.log('\nPossible encryption methods:');
    console.log('  - AES (likely - random-looking data)');
    console.log('  - Custom cipher (possible)');
    console.log('  - XOR with key (less likely)');
    
    console.log('\nStep 5: What we need to proceed');
    console.log('================================\n');
    
    console.log('To decrypt and get the m3u8 URL, we need:');
    console.log('  1. ✅ Decoded hash structure (DONE)');
    console.log('  2. ❌ Decryption key (from sources.js)');
    console.log('  3. ❌ Decryption algorithm (from sources.js)');
    console.log('  4. ❌ API endpoint for final stream URL');
    console.log('  5. ❌ Fresh, non-expired hash');
    
    console.log('\nStep 6: Recommended approach');
    console.log('=============================\n');
    
    console.log('Option A: Reverse engineer sources.js');
    console.log('  - Fetch sources.js from a live VidSrc page');
    console.log('  - Deobfuscate the code');
    console.log('  - Extract decryption function');
    console.log('  - Implement in your extractor');
    
    console.log('\nOption B: Browser automation');
    console.log('  - Use Puppeteer/Playwright');
    console.log('  - Load the VidSrc page');
    console.log('  - Intercept network requests');
    console.log('  - Capture the m3u8 URL when player loads');
    
    console.log('\nOption C: Use existing extractors');
    console.log('  - consumet.org API');
    console.log('  - Other open-source extractors');
    console.log('  - May have already solved this');
    
    console.log('\n=== Summary ===\n');
    console.log('The hash structure is now understood:');
    console.log('  BASE64(MD5:BASE64(ENCRYPTED_PART1|BASE64_PART2))');
    console.log('\nThe encrypted data contains stream parameters that');
    console.log('need to be decrypted using logic from sources.js');
    console.log('\nThe main blocker is obtaining the decryption algorithm.');
    
} catch (error) {
    console.error('Error:', error.message);
}
