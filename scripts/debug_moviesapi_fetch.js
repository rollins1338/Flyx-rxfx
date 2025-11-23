const fs = require('fs');
const https = require('https');

const url = 'https://moviesapi.club/tv/1396-2-10';

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://moviesapi.club/'
    }
};

console.log(`Fetching ${url}...`);

https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Data length: ${data.length}`);
        fs.writeFileSync('debug_moviesapi_response.html', data);
        console.log('Response saved to debug_moviesapi_response.html');

        // Check for iframe
        const iframeMatch = data.match(/<iframe[^>]+src=["']([^"']+)["']/);
        if (iframeMatch) {
            console.log("Found iframe:", iframeMatch[1]);
        } else {
            console.log("No iframe found in response.");
        }
    });

}).on('error', (err) => {
    console.error('Error:', err.message);
});
