/**
 * Decode the API endpoints found in the player
 */

// Found in server1-final-player.html line 526
const endpoint1 = "ZWZhODI2MzAzNjlkZGYzN2Q3ZDQ4NWUxMDNiYzBjODE6V0hCbFNtVkJNVkI1Y21SMWNqVXdPSHBFWWtnck1sRTJSRGN4TmtOWFVFVnVjVzVoUm01dVYwSXhRbnBKTlhCVWFGQkJTRTk2ZWxoa1duWTVZMDVqWmtKUmEweDVOblpZVkRSWE5tOXJlbUl6SzJwRlZVNDJMM05vZDNZemVqZDJOV3RrV0RGT2RIVmFWMlZUTkRSdGExTkNVREowWTA5elRVeFdhME55T0RCelRGVlZWVEVyU3pFclMwUlBlVXcxZWs1d1dEZFBkMkpIUWxGelF6Rnlja1I2UVRKU2FHNHhSa3RaUVcwcldGWll";

console.log('=== DECODING API ENDPOINTS ===\n');

console.log('Endpoint 1:');
console.log('Path: /fsdD/' + endpoint1.substring(0, 50) + '...');

try {
    const decoded = Buffer.from(endpoint1, 'base64').toString('utf-8');
    console.log('\nDecoded:');
    console.log(decoded);
    
    // Check if it's another layer
    const parts = decoded.split(':');
    if (parts.length === 2) {
        console.log('\nFound two parts separated by colon:');
        console.log('Part 1 (MD5-like):', parts[0]);
        console.log('Part 2 length:', parts[1].length);
        
        try {
            const part2Decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
            console.log('Part 2 decoded:', part2Decoded);
        } catch (e) {
            console.log('Part 2 is not base64');
        }
    }
} catch (e) {
    console.log('Decode error:', e.message);
}

console.log('\n=== ANALYSIS ===\n');
console.log('These endpoints appear to be for tracking/reporting, not stream URLs.');
console.log('They are called during playback to report viewing progress.');
