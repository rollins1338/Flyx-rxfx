const https = require('https');
const fs = require('fs');

const servers = {
    embed2: 'N2FlZDdmN2QxYTA3YTVhNTgwMGVjMzU1OWIyZjlhNzc6ZFdwUGVHTmlhbEZpZUdSRVYweHJiMkptU0d0eFJ6TkNNRE12V0hGdWFrWm1iM1pVYnk4M1VYRTFlRkJyTDFVMFUwSTBLMFZFU0ZkekwxVkRUblJsYURNeGNrUm5UbXBaVFRSaGJubDVLeXROVFZJemFWcFlaRFI1VEVKemFXSjBlRGhPZG14cmEwdGlLMm80UmxaSmNFSmpWbGhCZEZnMmQzRllhVGwyUVV4eE5HODFlRzVzVUc1Vk56aE9aME54TDBoelNESldhMVZIZFhsWFUybzNPR2tyVXpJeFF6WmtVSGs0YmtWNlNrNW1LMDFTVUVkSVJuQkpibnBHWTNsMQ--',
    superembed: 'ZWUyY2JkN2Y0ZTk1MzYzNzNiMmNlMGIyMDg4NDdhMzg6VWpaR1VGRXlZWGxJZUZwWFppOTNUak4zV1Vac1NDODVOekpRSzNvclRVdEROR0kwVFZreldIVXpPWFExZGpBMVFUSjFWVk5PYXpCemNVOWtSVzVETTFBNVpGaE9XVlZyV0ZBMk1rWkxPRTFuTW14U2NtYzlQUT09'
};

console.log('=== Fetching Final Players from 2Embed and Superembed ===\n');

async function fetchFinal(name, hash) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`SERVER: ${name.toUpperCase()}`);
        console.log('='.repeat(70));
        
        const url = `https://cloudnestra.com/srcrcp/${hash}`;
        console.log('Fetching:', url.substring(0, 80) + '...');
        
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://cloudnestra.com/'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Status:', res.statusCode);
                console.log('Length:', data.length, 'bytes');
                
                if (res.statusCode === 200 && data.length > 0) {
                    const filename = `examples/${name}-final-player.html`;
                    fs.writeFileSync(filename, data);
                    console.log('✓ Saved to:', filename);
                    
                    const hasM3u8 = data.includes('m3u8');
                    const hasHls = data.includes('hls.js') || data.includes('Hls');
                    
                    console.log('\nAnalysis:');
                    console.log('  Has M3U8:', hasM3u8 ? '✓' : '✗');
                    console.log('  Has HLS.js:', hasHls ? '✓' : '✗');
                    
                    if (hasM3u8) {
                        const m3u8Matches = data.match(/https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/g);
                        if (m3u8Matches) {
                            console.log('\n🎉 M3U8 URLs:');
                            m3u8Matches.forEach(url => console.log('  -', url));
                        }
                    }
                    
                    resolve({ name, success: true, hasM3u8 });
                } else {
                    console.log('✗ Failed');
                    resolve({ name, success: false });
                }
            });
        }).on('error', err => {
            console.log('✗ Error:', err.message);
            resolve({ name, success: false });
        });
    });
}

async function fetchAll() {
    const results = [];
    for (const [name, hash] of Object.entries(servers)) {
        const result = await fetchFinal(name, hash);
        results.push(result);
        await new Promise(r => setTimeout(r, 1500));
    }
    
    console.log('\n\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    results.forEach(r => {
        console.log(`\n${r.name}: ${r.success ? '✓' : '✗'} ${r.hasM3u8 ? '(Has M3U8)' : ''}`);
    });
}

fetchAll();
