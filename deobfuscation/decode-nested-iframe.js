/**
 * Decode the nested iframe hash from the player page
 */

console.log('=== Nested Iframe Analysis ===\n');

const nestedHash = "ZWUzMzA1ZWExYmM1NWE1MjRjZGY1M2E4MzVkZGQ1Y2Q6U0ZaeU5sSXllV2hyU205dk0zRm1SM0ptVUdkT1VWaHBSRlo2UkhadEt5czFhbXRwVmxKSFpERm5aVmQwVG04eU1sTmlRMmhrVkZOVGFWVnZPV2xOU2tJNWVsbERXWFF6VTJzMldITTBhRWN2VDJkdmFVNUJTMU5KYlc4clNUTjNTMlpOUm14NFFsSkxOVXBCTjBSTlYyWjBla3BhY0M5SWJ6UlJibGR2VVhwNFRqbFdVMFZNTkZWb2FrVTBaM05pTW1KWFUycHVVV3hNWlZSMGFXMU9SMU5KVGtZM1EzUjNTVmR6VERZNGNEUXlWSE14VW1Wb1pHaDBlVEJtTDAxblIxSlNOak4wYzJ0eGFFaFpUUzg1VmtGSGJIVjFSVlJRUzBWbU4wdERkMGxYTmsxaVdrWnljVkYxU21kdE5EZFBiRGxsZUdsM1pqRm1OamRUV1V3M1psRXlOblk1WVVob2JEUkpWV1IzVGtkMVNGRnlTa2RDYzFNd1JHOXlLMDlGUkhwdVRtVm9ZbGxPUzFsMGRWRXZkMWRhTlhGa1ZtSmlTMDUxUlVSWWVsWlJabTFJU0dSTlZHRjFabVJ2V0VWelZpOXlUMWRtY3pneVYyRktNU3RHTDBaUGFERTVXamx5VFdoNlpsTklOblFyWjFGUGQxZEdUbTkyVlRSSVpsVnhNbVI2VTJkSFNtc3hObVJQVGs1cmRXRmtSamROVDFaRGNtbHFVR3RQUjNGUVRITnFhMEZ0VEdwa1EzTmxOVE5HUVZsVlNpdFNTa2hqYUdRMmRVZEJia0phYW5oMGVXRTJhMGcyVkZoNlowNU5TRGd5WkRObFZrdHlTM0JMYVhWcmJFZHBjMkZqUjJsSlNERjNjM0ZEV0VGUWQwbFlhRXczTjFGME1YTm5aREZtYm1ONVRuVlRhV1ZXWlV0NlZHcDRLMjVxYTFGRFEzZDFlbGxMUVhKQ2FrZGxhV1l3WTJndldDdFdhblFyU0ZOWmRGSmllRTlzTnpRd1VXVTBPVlZHVFhJMFNsVlNiVlZIZFdOVWRXVkVUVEJ3WnpJeVNIRjJUMnN5VkdOWE9WTTNVU3M0YWpKQloxSjNVMFZoZDJsUFZrMW9SR1ppT1hSYVYxZzBTVGRPVW1wbkx6a3lUU3R6WWxNeGRGTTVZMHMwYzFCWmFWWkpWMnBHVXpOVmVqZzJlbTU1ZVhaaGRURnFZMWhPU1dsckx6bDRVMVY0TUhOT05YbFJZM1p5T1RBMmRVd3hVRXQzVWs1MGMyRnFRelZDV2xKWVdWTnRVbUpsVjFwNlkweFVUa041V1d0RmVTdDZNeTgxY0dWV1R6Z3dVV2RuZHl0YWFtUkdhbkIxVkhaVlpEWkVNMVJtWW5CR1FtcENabXd6VVdob1QwMDRSQzl6UVVWR1pHbFJRM2xQTldack0zVjRZalJuYzFONWJVeHZTVUk0UWxGSEwyczVORzlSYWxoSGFtbDZOMU4zU1c1MkwxVlZRelpWVVdOWE5GVm1abkEyWW1aeGMyWnVWazVuUjFob2FHNUhkRXRwVFZsUFdFaHdiazlKWmxSSmFHSm9jWEJ6ZURaRU9HSTRMMFZ0T1M5WE56RnJiQ3RtVDJveE5HOWlUVVp6U0hwYWRuUkhVV2t4YUN0MmJqTnlWMjlKY1U1SFdtSXJSR0pQUVZnMk1VRXlSMFZYYm1aNk5FNDJWbTR2U2pGSGVWQnBjMHgzY0RWaU9GQXpVbmhHUjBJM2FqbHpkbGhTYW1KWlJ6ZE9OVmxrY0dkMVpuRXJWbWRIWlVkQ04wTjBNUzlzTHl0cmNYRlROa1JMZWxsUVQzWnVURFZRWm5FdlFrMTZXVEEyVTNKU1p6WlVTU3Q0YTNKRlJTOXBZV3g0T1dSUE1tcENjMlZYYVZOeVlWbHVObkpOWjNWaVVVSkdha2hqUmtreWMwaDNia1ZJVWs5U2EzUjVWMk5WVUZKaWNYb3ZNMk5KYWl0WFNGcEhjRkJ1U1dWUWRHdHpLMjU2VkVwcVJWaHZNazVpWlc5R1dUaGhUVVZ6TkZFd1VIVjNSVFZCYzBSYU9WUTRZbEZCVVhaMmR6MDk-";

console.log('Nested iframe URL: /prorcp/' + nestedHash.substring(0, 50) + '...\n');

try {
    // First decode
    const firstDecode = Buffer.from(nestedHash, 'base64').toString('utf-8');
    console.log('1. First Layer Decode:');
    
    const parts = firstDecode.split(':');
    if (parts.length === 2) {
        const md5Hash = parts[0];
        const secondBase64 = parts[1];
        
        console.log('   MD5 Hash:', md5Hash);
        console.log('   Data Length:', secondBase64.length, 'chars\n');
        
        // Second decode
        const secondDecode = Buffer.from(secondBase64, 'base64').toString('utf-8');
        
        console.log('2. Second Layer Decode:');
        console.log('   Total Length:', secondDecode.length, 'chars');
        console.log('   First 200 chars:', secondDecode.substring(0, 200));
        console.log('   Last 100 chars:', secondDecode.substring(secondDecode.length - 100));
        
        // Check for patterns
        console.log('\n3. Pattern Analysis:');
        console.log('   Contains pipe |:', secondDecode.includes('|'));
        console.log('   Contains http:', secondDecode.includes('http'));
        console.log('   Contains m3u8:', secondDecode.includes('m3u8'));
        console.log('   Contains .mp4:', secondDecode.includes('.mp4'));
        
        // This looks like encrypted data
        console.log('\n4. Encryption Analysis:');
        console.log('   Likely encrypted with AES');
        console.log('   Need decryption key from sources.js or base64.js');
        
        console.log('\n5. Next Step:');
        console.log('   Fetch: https://cloudnestra.com/prorcp/' + nestedHash);
        console.log('   This should be the actual player with stream URL');
    }
} catch (e) {
    console.log('Error:', e.message);
}
