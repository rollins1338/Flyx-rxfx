/**
 * VidSrc Page Analysis Script
 * Decodes the iframe URL and identifies the stream extraction flow
 */

const crypto = require('crypto');

// Extract the base64 encoded hash from the iframe URL
const iframeUrl = "//cloudnestra.com/rcp/MmEwNDkxMDc1MzQ4NDk3NmI1ZDZjMDNmNTQzNTA3ZTA6TTFCNFYyNUdVM2hMVm1kRmNubzVNa1o0Ym1wUVlXOTJlWFUxTXpsdFRHMVhabk5IU0RsTmVrSTNWRmRaV2pKME5VOVFMM2hPZGtaalprTnJWbFJuVVZCV2JHc3JOV2x6V0VndmMwVllkSGd3UjNGeFYzRXpTamRKTlRaTmNEaG5VM3BaUWpGbWJFaEZiR0ZsSzJkR05sQXdlVTVyZURsM1kyVjBaazFDUmpWQ2JGUkljbVZQUWtORk5UUnFXVTlrVEc0clZrNWFkMmh6YjBKSFkweEhXV1ZSUkN0aVNHZE1PU3RCUjJGSWQwSmlNV1IyVVVWM05tZ3lOSEJvYTBOQmRteDNjU3RSV0d4d1QzcFRMM1EyTmtOWlVrcExibkZ3SzFaVk1GZzVNRmRDS3pWb2MydFdVV1ZxUVhwWlNGSmxkR2tyVUdSeVVFVTBkemhCU21aa00zeElTalZTVmxoUFJHZEtWWFlyU0hkMFExbFdlbkJaTlZkeVEza3ZlRVpyWm0xeVEyMXlhSHBOZDFkblJHNW9Xa0ZaTldOSmJVZHlSM3BLTmpGM1dTOXJSRUpUV0hOWVVXVmhRMWRrZUdKcGRXNHdTR2RoVW5OS01qbHFTRmN5WVV0WFNWQXpRbmR6VHl0NVRXdExlRzh5ZGtka2FucE1lVmRIYkVJMGEyb3ZaVVIzTDJkMFNsSjNjemhQY1dsWGFUWkVlV1p0Vmt4VVRTOXdOblZuTTBSNWJVNVdXVFpwUjFWMGF6ZHdZMGczWlM5U1UxWTRRWE5xZERSNGN6SkdSV3QxYUU0eWJtdERLemgzVW1GbVUyMXplWGRTY1dOTFFrVklWRFJKTlZrdlJXUkdTVE5wYURSUUsyVjJSVEkyVHpKcVpFTmFRVkZhTVdaREwwVkNkUzlLUlVadGFVdzFaMFJwVFc1b2NqY3lRa1F4V1c5aEsyTlJhakE0TW5GMGFEUTNaRkJvZDNSb2FIUjFUVmMxYjBJeU9URktZemRaTW5wQ1NHUnFSMnd3Tmt0V2RWUTJLMjFWVFhaWVNVZE5abk5UYW01UVIxZG9SRzEyV0VoeFMwRlBjV2xRZGt0eFNWRXphRW93UWtsMWFrVktaMWRSTTNwSkszSTNSSFJLZW5kM2VqaGpRVkp2WjFwWE9GSlJRbVZZU1V4TE1YSmFNRzFvTm14cE9WZG5NRkJtU2t0MVRVTm9OM0pRV0hWV2NuSmpOR0ZWYlV3MU9YRldOVTg0Y1RFeWEwMU9jbmNyVFhGaVlYZFBjakJqV1VKS2MzbEtXRzV1YUdoRlREQjFhR2htTTJWQ01YUnBja3gyZUdwalNHOW5NMkoxV0ZSdmJUaDJUbWhrYWt0QlZVcFBWREZSTDNReVdGRTVkSEZZUVhwbmRGZEhRakkwWWtOc1VuSndkV0pMU3pOMk5qa3lRVFZQVXpaaGJFOUxjQzlOUkVSR2RsTnROR2hDUTFwS2NGZEpUelpyYVhkaVpreExSbEp3YTJNMWNEQTJTamhPV2xWd1luRXdjM3B4Y2pGMVRHMDJjbEZLTUU5R1dVRnlVMEUyS3pjd09FbGxhbkZtT1N0ME1VZ3pVMEZPUlhaS2VtUlRNRVpUWldOb1ZHZHdjbFZhYW1SaVlrWnJjakpZVDI1M2F6YzRhM04wVG1aR1YxSmFOMWRZWml0d1FUaDROWEk1WlRWMGFtVlBXVTl5WVZOWmIyRldPVEJ4VURSSFMzTnNWR0U1WVRZMlZrZFdUbFlySzJZNVR6RnJiRWRvZVVkVGVYWjZMMkZJZURjck1FaEJUMlpoTUVSS1JGWmllVzkwYlZKM1dHaFNSWEYzVGxsNlZHdFhUa2xvVkhkclVqaENlRFZzYzA5Nk5Ya3diMVJrUXpneEwzY3dMMGswUkhjclMwWjJWVVkwZUZsVVpYaENSM2swUlc5bFJEUnlaMGwzVG1GV1lpczBja2hpVDFkUFoxUnliVmxuY2podE4zWlhVQ3RzYTFaTWNIbGlUV2d6WXpsc1pHRkxTRVJCU2s1TFNYcGpSbk5GWVVnemNrcHpiekJTYmpOb01tZDJRMlZRUm1velFUMDk-";

// Server hashes from the HTML
const serverHashes = {
    cloudstream: "MmEwNDkxMDc1MzQ4NDk3NmI1ZDZjMDNmNTQzNTA3ZTA6TTFCNFYyNUdVM2hMVm1kRmNubzVNa1o0Ym1wUVlXOTJlWFUxTXpsdFRHMVhabk5IU0RsTmVrSTNWRmRaV2pKME5VOVFMM2hPZGtaalprTnJWbFJuVVZCV2JHc3JOV2x6V0VndmMwVllkSGd3UjNGeFYzRXpTamRKTlRaTmNEaG5VM3BaUWpGbWJFaEZiR0ZsSzJkR05sQXdlVTVyZURsM1kyVjBaazFDUmpWQ2JGUkljbVZQUWtORk5UUnFXVTlrVEc0clZrNWFkMmh6YjBKSFkweEhXV1ZSUkN0aVNHZE1PU3RCUjJGSWQwSmlNV1IyVVVWM05tZ3lOSEJvYTBOQmRteDNjU3RSV0d4d1QzcFRMM1EyTmtOWlVrcExibkZ3SzFaVk1GZzVNRmRDS3pWb2MydFdVV1ZxUVhwWlNGSmxkR2tyVUdSeVVFVTBkemhCU21aa00zeElTalZTVmxoUFJHZEtWWFlyU0hkMFExbFdlbkJaTlZkeVEza3ZlRVpyWm0xeVEyMXlhSHBOZDFkblJHNW9Xa0ZaTldOSmJVZHlSM3BLTmpGM1dTOXJSRUpUV0hOWVVXVmhRMWRrZUdKcGRXNHdTR2RoVW5OS01qbHFTRmN5WVV0WFNWQXpRbmR6VHl0NVRXdExlRzh5ZGtka2FucE1lVmRIYkVJMGEyb3ZaVVIzTDJkMFNsSjNjemhQY1dsWGFUWkVlV1p0Vmt4VVRTOXdOblZuTTBSNWJVNVdXVFpwUjFWMGF6ZHdZMGczWlM5U1UxWTRRWE5xZERSNGN6SkdSV3QxYUU0eWJtdERLemgzVW1GbVUyMXplWGRTY1dOTFFrVklWRFJKTlZrdlJXUkdTVE5wYURSUUsyVjJSVEkyVHpKcVpFTmFRVkZhTVdaREwwVkNkUzlLUlVadGFVdzFaMFJwVFc1b2NqY3lRa1F4V1c5aEsyTlJhakE0TW5GMGFEUTNaRkJvZDNSb2FIUjFUVmMxYjBJeU9URktZemRaTW5wQ1NHUnFSMnd3Tmt0V2RWUTJLMjFWVFhaWVNVZE5abk5UYW01UVIxZG9SRzEyV0VoeFMwRlBjV2xRZGt0eFNWRXphRW93UWtsMWFrVktaMWRSTTNwSkszSTNSSFJLZW5kM2VqaGpRVkp2WjFwWE9GSlJRbVZZU1V4TE1YSmFNRzFvTm14cE9WZG5NRkJtU2t0MVRVTm9OM0pRV0hWV2NuSmpOR0ZWYlV3MU9YRldOVTg0Y1RFeWEwMU9jbmNyVFhGaVlYZFBjakJqV1VKS2MzbEtXRzV1YUdoRlREQjFhR2htTTJWQ01YUnBja3gyZUdwalNHOW5NMkoxV0ZSdmJUaDJUbWhrYWt0QlZVcFBWREZSTDNReVdGRTVkSEZZUVhwbmRGZEhRakkwWWtOc1VuSndkV0pMU3pOMk5qa3lRVFZQVXpaaGJFOUxjQzlOUkVSR2RsTnROR2hDUTFwS2NGZEpUelpyYVhkaVpreExSbEp3YTJNMWNEQTJTamhPV2xWd1luRXdjM3B4Y2pGMVRHMDJjbEZLTUU5R1dVRnlVMEUyS3pjd09FbGxhbkZtT1N0ME1VZ3pVMEZPUlhaS2VtUlRNRVpUWldOb1ZHZHdjbFZhYW1SaVlrWnJjakpZVDI1M2F6YzRhM04wVG1aR1YxSmFOMWRZWml0d1FUaDROWEk1WlRWMGFtVlBXVTl5WVZOWmIyRldPVEJ4VURSSFMzTnNWR0U1WVRZMlZrZFdUbFlySzJZNVR6RnJiRWRvZVVkVGVYWjZMMkZJZURjck1FaEJUMlpoTUVSS1JGWmllVzkwYlZKM1dHaFNSWEYzVGxsNlZHdFhUa2xvVkhkclVqaENlRFZzYzA5Nk5Ya3diMVJrUXpneEwzY3dMMGswUkhjclMwWjJWVVkwZUZsVVpYaENSM2swUlc5bFJEUnlaMGwzVG1GV1lpczBja2hpVDFkUFoxUnliVmxuY2podE4zWlhVQ3RzYTFaTWNIbGlUV2d6WXpsc1pHRkxTRVJCU2s1TFNYcGpSbk5GWVVnemNrcHpiekJTYmpOb01tZDJRMlZRUm1velFUMDk-",
    embed2: "MDNkNzdlMDRlMjAzNDEzM2NhNjUyNjhkMGE3Nzk4YWU6WVZGWWEwSjNRVTFSWm5OMWVDc3lWVFo1ZVN0aVFURlVaR0l2Unk5SWMzQk5TRmM0VUU5bWNEWjZXRFE0ZW5oU1N6ZHhOaTlhZEhkVU1ITlNXazg0TURsVmJVcDRVMFpEUlRkVFNXdHlTbWRKUjBaYVVYSlJlVGxJTmxwRVFrUXJla2d6T1hsNmEyVkNkemh3V0hCUlowNW5lVW96YTJvNWVGRjBRV1p5ZEdwMU9IUk1NMU5CV0dSelNEZFhlRWxFVHpZcmVteEJabFpKU0cxSUt6Um9lbGw1SzBzM2EwVkpTbkpxU0ZNelUwVlNNbU54VTB4eUwzQm5UUzlaWVdWcQ--",
    superembed: "M2U5MmM3Y2VhMGQ2ZjhiNTBiOGM5YWZmYzM2MjdlM2U6U1ZneVJ5dFlaVk5VYlZaek1VUlBibVpVYld0cVYzZGhOemhNTTNOYVFqbExOQzl1U0VoU2VYVkRNR3BvVG1kU2JGRXdhRTlPTWtKMU9FOTBReklyY0VadWRWZDROR2hwVmtGWFJWaFFhVE5PVVRsS1dVRTlQUT09"
};

console.log("=== VidSrc Page Analysis ===\n");

// Decode the iframe hash
console.log("1. Decoding iframe URL hash...");
const iframeHash = iframeUrl.split('/rcp/')[1];
console.log("   Hash:", iframeHash.substring(0, 50) + "...");

// This is a double base64 encoded string
try {
    const firstDecode = Buffer.from(iframeHash, 'base64').toString('utf-8');
    console.log("   First decode:", firstDecode.substring(0, 100) + "...");
    
    // Split by colon - format is MD5:BASE64_DATA
    const parts = firstDecode.split(':');
    if (parts.length === 2) {
        const md5Hash = parts[0];
        const secondBase64 = parts[1];
        
        console.log("   MD5 Hash:", md5Hash);
        console.log("   Second base64 length:", secondBase64.length);
        
        const secondDecode = Buffer.from(secondBase64, 'base64').toString('utf-8');
        console.log("   Second decode:", secondDecode.substring(0, 200));
        console.log("   Full decoded data:", secondDecode);
    }
} catch (e) {
    console.log("   Error decoding:", e.message);
}

console.log("\n2. Analyzing server hashes...");
Object.entries(serverHashes).forEach(([name, hash]) => {
    console.log(`\n   ${name.toUpperCase()}:`);
    try {
        const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');
        const parts = firstDecode.split(':');
        if (parts.length === 2) {
            console.log("     MD5:", parts[0]);
            const secondDecode = Buffer.from(parts[1], 'base64').toString('utf-8');
            console.log("     Decoded:", secondDecode);
        }
    } catch (e) {
        console.log("     Error:", e.message);
    }
});

console.log("\n3. Key Scripts to Fetch:");
console.log("   - /base64.js - Base64 encoding/decoding utilities");
console.log("   - /sources.js - Source extraction logic");
console.log("   - /reporting.js - Analytics/reporting");
console.log("   - //cloudnestra.com/asdf.js - Player logic");
console.log("   - /sbx.js - Sandbox/security logic");
console.log("   - /f59d610a61063c7ef3ccdc1fd40d2ae6.js - Dynamic script");

console.log("\n4. Next Steps:");
console.log("   a) Fetch cloudnestra.com/rcp/ endpoint with the hash");
console.log("   b) Analyze the returned player page");
console.log("   c) Extract the actual stream URL or m3u8 playlist");
console.log("   d) Follow any additional redirects or decoding steps");

console.log("\n5. Important Data:");
console.log("   - Body data-i:", "30472557");
console.log("   - Sub hash:", "52ca5c1eadf6b07b0b0506793c0e06fa");
console.log("   - Current sub name format:", "sub_30472557");
