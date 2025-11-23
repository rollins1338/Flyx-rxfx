const https = require('https');

// URL from previous debug output (Server 8)
const url = "https://stormgleam42.xyz/file2/stIq3jcBWM+T8TamwpPJYMq1qJ2EIBazjeFg2JVsKYpW3BwK9RyjEzLcFp7h2Av~aOsO6CQJ2vbBXblsKDbtX5C41xAgc+88mW8Ag4d+3xNyoLCN~~N0Rl8sYJ+ElEa3sMv~8CPY6uzNBSqzLAgzds3at+jbc~9KXfjPbCxAUcg=/cGxheWxpc3QubTN1OA==.m3u8";
const referer = "https://ww2.moviesapi.to/";

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': referer,
        'Origin': 'https://ww2.moviesapi.to'
    }
};

console.log(`Fetching ${url}...`);

https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Headers:', res.headers);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Data length: ${data.length}`);
        if (res.statusCode === 200) {
            console.log("Preview:", data.substring(0, 200));
        } else {
            console.log("Response Body:", data);
        }
    });

}).on('error', (err) => {
    console.error('Error:', err.message);
});
